#!/usr/bin/env python3
import hashlib
import re
import struct
import subprocess
import time
import xml.etree.ElementTree as ET
import zlib
from pathlib import Path

PACKAGE = "app.ironshade.vector"
ACTIVITY = f"{PACKAGE}/.MainActivity"
REMOTE = "/sdcard/settings-native.xml"
LOCAL = Path("settings-native.xml")

def adb(*args, capture=False, check=True):
    result = subprocess.run(
        ["adb", *args],
        check=check,
        stdout=subprocess.PIPE if capture else None,
        stderr=subprocess.STDOUT if capture else None,
    )
    return result.stdout.decode("utf-8", "replace") if capture else ""

def tap(x, y, pause=0.7):
    adb("shell", "input", "tap", str(int(x)), str(int(y)))
    time.sleep(pause)

def swipe(x1, y1, x2, y2, duration=320, pause=0.55):
    adb("shell", "input", "swipe", str(x1), str(y1), str(x2), str(y2), str(duration))
    time.sleep(pause)

def shot(name):
    path = Path(f"android-settings-{name}.png")
    with path.open("wb") as out:
        subprocess.run(["adb", "exec-out", "screencap", "-p"], check=True, stdout=out)
    if path.stat().st_size < 10000:
        raise RuntimeError(f"Screenshot failed: {path}")
    print(f"ANDROID_SETTINGS_STAGE {name} sha256={hashlib.sha256(path.read_bytes()).hexdigest()[:16]}")
    return path

def dump_tree():
    adb("shell", "uiautomator", "dump", "--compressed", REMOTE, capture=True)
    adb("pull", REMOTE, str(LOCAL), capture=True)
    root = ET.parse(LOCAL).getroot()
    parents = {child: parent for parent in root.iter() for child in parent}
    return root, parents

def label_values(node):
    return [node.attrib.get("content-desc", "").strip(), node.attrib.get("text", "").strip()]

def parse_bounds(value):
    match = re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", value or "")
    if not match:
        return None
    bounds = tuple(map(int, match.groups()))
    x1, y1, x2, y2 = bounds
    return bounds if x2 > x1 and y2 > y1 else None

def center(node):
    bounds = parse_bounds(node.attrib.get("bounds", ""))
    if not bounds:
        raise RuntimeError(f"Node has no usable bounds: {node.attrib}")
    x1, y1, x2, y2 = bounds
    return (x1 + x2) // 2, (y1 + y2) // 2

def node_summary(node):
    return {
        "text": node.attrib.get("text", ""),
        "desc": node.attrib.get("content-desc", ""),
        "class": node.attrib.get("class", ""),
        "clickable": node.attrib.get("clickable", ""),
        "checked": node.attrib.get("checked", ""),
        "selected": node.attrib.get("selected", ""),
        "bounds": node.attrib.get("bounds", ""),
    }

def matching_nodes(label, contains=False):
    root, parents = dump_tree()
    wanted = label.strip().lower()
    matches = []
    for node in root.iter("node"):
        desc = node.attrib.get("content-desc", "").strip()
        text = node.attrib.get("text", "").strip()
        values = [desc, text]
        hit = any((wanted in value.lower()) if contains else (value.lower() == wanted) for value in values if value)
        if hit and parse_bounds(node.attrib.get("bounds", "")):
            matches.append((node, parents))
    # Prefer an exact accessibility label on an actionable node.
    matches.sort(key=lambda pair: (
        0 if pair[0].attrib.get("content-desc", "").strip().lower() == wanted else 1,
        0 if pair[0].attrib.get("clickable") == "true" else 1,
        0 if pair[0].attrib.get("enabled") != "false" else 1,
    ))
    return matches

def actionable_node(label, contains=False):
    matches = matching_nodes(label, contains=contains)
    if not matches:
        return None
    node, parents = matches[0]
    current = node
    while current is not None:
        if current.attrib.get("clickable") == "true" and current.attrib.get("enabled") != "false" and parse_bounds(current.attrib.get("bounds", "")):
            return current
        current = parents.get(current)
    return node

def wait_node(label, timeout=20, contains=False, actionable=False):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        node = actionable_node(label, contains=contains) if actionable else (matching_nodes(label, contains=contains)[0][0] if matching_nodes(label, contains=contains) else None)
        if node is not None:
            return node
        last = node
        time.sleep(0.6)
    raise RuntimeError(f"Timed out waiting for UI node {label!r}; last={last}")

def tap_label(label, timeout=20, contains=False):
    node = wait_node(label, timeout=timeout, contains=contains, actionable=True)
    x, y = center(node)
    print(f"ANDROID_SETTINGS_TAP label={label!r} node={node_summary(node)}")
    tap(x, y)
    return node

def visible_label(label, contains=False):
    return bool(matching_nodes(label, contains=contains))

def scroll_up():
    swipe(720, 1110, 720, 330)

def scroll_down():
    swipe(720, 330, 720, 1110)

def tap_with_scroll(label, direction="up", attempts=10, contains=False):
    for _ in range(attempts):
        node = actionable_node(label, contains=contains)
        if node is not None:
            x, y = center(node)
            print(f"ANDROID_SETTINGS_TAP_SCROLL label={label!r} node={node_summary(node)}")
            tap(x, y)
            return node
        scroll_up() if direction == "up" else scroll_down()
    raise RuntimeError(f"Could not reach visible control {label!r} by player scrolling")

def select_option(label, option):
    tap_with_scroll(label, attempts=10)
    option_node = wait_node(option, timeout=10, actionable=True)
    print(f"ANDROID_SETTINGS_OPTION control={label!r} option={option!r} node={node_summary(option_node)}")
    x, y = center(option_node)
    tap(x, y, 0.9)

def checkbox_state(label):
    node = actionable_node(label)
    if node is None:
        return None
    checked = node.attrib.get("checked")
    return checked == "true" if checked in ("true", "false") else None

def set_checkbox(label, expected):
    for _ in range(10):
        node = actionable_node(label)
        if node is not None:
            break
        scroll_up()
    else:
        raise RuntimeError(f"Checkbox not reachable: {label}")
    state = node.attrib.get("checked")
    if state in ("true", "false") and (state == "true") == expected:
        return
    x, y = center(node)
    print(f"ANDROID_SETTINGS_CHECKBOX label={label!r} expected={expected} before={state} node={node_summary(node)}")
    tap(x, y, 0.8)
    node = wait_node(label, timeout=8, actionable=True)
    after = node.attrib.get("checked")
    if after in ("true", "false") and (after == "true") != expected:
        raise RuntimeError(f"Checkbox did not change: {label} expected={expected} after={after}")

def adjust_slider(label, fraction):
    for _ in range(10):
        node = actionable_node(label)
        if node is not None:
            break
        scroll_up()
    else:
        raise RuntimeError(f"Slider not reachable: {label}")
    x1, y1, x2, y2 = parse_bounds(node.attrib["bounds"])
    y = (y1 + y2) // 2
    start = x1 + max(4, int((x2 - x1) * 0.30))
    end = x1 + max(4, int((x2 - x1) * fraction))
    print(f"ANDROID_SETTINGS_SLIDER label={label!r} fraction={fraction:.2f} node={node_summary(node)}")
    swipe(start, y, end, y, duration=420)

def dismiss_system_overlays():
    for _ in range(8):
        dismissed = False
        try:
            root, _ = dump_tree()
            for label in ("Got it", "Wait", "Close app"):
                for node in root.iter("node"):
                    if node.attrib.get("text", "").strip() == label and parse_bounds(node.attrib.get("bounds", "")):
                        x, y = center(node)
                        tap(x, y, 1.0)
                        print(f"ANDROID_SETTINGS_SYSTEM_OVERLAY_DISMISSED action={label}")
                        dismissed = True
                        break
                if dismissed:
                    break
        except Exception as exc:
            print(f"ANDROID_SETTINGS_OVERLAY_SCAN detail={exc}")
        if not dismissed:
            return

def decode_png(path):
    data = Path(path).read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise RuntimeError(f"Not PNG: {path}")
    pos = 8
    width = height = bit_depth = color_type = None
    compressed = bytearray()
    while pos < len(data):
        length = struct.unpack(">I", data[pos:pos+4])[0]
        kind = data[pos+4:pos+8]
        payload = data[pos+8:pos+8+length]
        pos += 12 + length
        if kind == b"IHDR":
            width, height, bit_depth, color_type, _, _, _ = struct.unpack(">IIBBBBB", payload)
        elif kind == b"IDAT":
            compressed.extend(payload)
        elif kind == b"IEND":
            break
    if bit_depth != 8 or color_type not in (2, 6):
        raise RuntimeError(f"Unsupported screenshot PNG bit={bit_depth} type={color_type}")
    bpp = 4 if color_type == 6 else 3
    raw = zlib.decompress(bytes(compressed))
    stride = width * bpp
    rows = []
    prev = bytearray(stride)
    offset = 0
    for _ in range(height):
        filter_type = raw[offset]
        offset += 1
        scan = bytearray(raw[offset:offset+stride])
        offset += stride
        for i in range(stride):
            a = scan[i-bpp] if i >= bpp else 0
            b = prev[i]
            c = prev[i-bpp] if i >= bpp else 0
            if filter_type == 1:
                scan[i] = (scan[i] + a) & 255
            elif filter_type == 2:
                scan[i] = (scan[i] + b) & 255
            elif filter_type == 3:
                scan[i] = (scan[i] + ((a + b) // 2)) & 255
            elif filter_type == 4:
                p = a + b - c
                pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                scan[i] = (scan[i] + pr) & 255
            elif filter_type != 0:
                raise RuntimeError(f"Unsupported PNG filter {filter_type}")
        rows.append(bytes(scan))
        prev = scan
    return width, height, bpp, rows

def pixel_difference(a_path, b_path):
    wa, ha, bppa, ra = decode_png(a_path)
    wb, hb, bppb, rb = decode_png(b_path)
    if (wa, ha, bppa) != (wb, hb, bppb):
        raise RuntimeError("Screenshot dimensions/formats differ")
    changed = 0
    total = wa * ha
    for y in range(ha):
        arow, brow = ra[y], rb[y]
        for x in range(wa):
            base = x * bppa
            delta = abs(arow[base] - brow[base]) + abs(arow[base+1] - brow[base+1]) + abs(arow[base+2] - brow[base+2])
            if delta >= 42:
                changed += 1
    return changed / total

def ensure_class_selected():
    # Fresh beta starts at Operator Intake. Use the actual accessible Play button,
    # never source state or storage mutation.
    shot("00-class")
    candidate = actionable_node("Confirm Vanguard")
    if candidate is None:
        candidate = actionable_node("Play Vanguard")
    if candidate is None:
        # The current default class can vary; confirm whatever visible class is selected.
        for label in ("Confirm Vector", "Play Vector", "Confirm Systems", "Play Systems"):
            candidate = actionable_node(label)
            if candidate is not None:
                break
    if candidate is None:
        raise RuntimeError("No visible class confirmation button found in fresh app")
    x, y = center(candidate)
    print(f"ANDROID_SETTINGS_CLASS_CONFIRM node={node_summary(candidate)}")
    tap(x, y, 2.0)
    wait_node("Command", timeout=25, actionable=True)
    shot("01-command")

def open_settings():
    tap_label("Operator", timeout=20)
    wait_node("Build", timeout=15, actionable=True)
    shot("02-operator")
    tap_label("Build")
    wait_node("Settings", timeout=20, actionable=True)
    shot("03-build")
    tap_label("Settings")
    wait_node("Graphics quality", timeout=20)
    shot("04-settings")

def return_to_command():
    tap_with_scroll("Return to ship", direction="up", attempts=12)
    wait_node("Command", timeout=20, actionable=True)
    if not visible_label("Tasking nexus online.", contains=True):
        tap_label("Command")
    wait_node("Tasking nexus online.", timeout=20, contains=True)
    time.sleep(0.8)

print("ANDROID_SETTINGS_PLAYTEST_START mode=black-box game-input=adb accessibility=uiautomator screenshots=true dom=false cdp=false storage=false")
adb("shell", "pm", "clear", PACKAGE, capture=True)
adb("shell", "settings", "put", "global", "hide_error_dialogs", "1", capture=True)
adb("shell", "settings", "put", "secure", "immersive_mode_confirmations", "confirmed", capture=True)
adb("shell", "am", "start", "-W", "-n", ACTIVITY, capture=True)
time.sleep(12)
dismiss_system_overlays()
ensure_class_selected()
open_settings()

# Play through the visible Settings panel. This intentionally uses the controls
# exactly as a player does and does not inspect profile/localStorage/DOM state.
select_option("Graphics quality", "Performance")
select_option("Interface size", "Default")
select_option("Interface text size", "Large")
set_checkbox("High contrast", True)
set_checkbox("Reduce motion", True)
select_option("Combat layout preset", "Left-Handed")
adjust_slider("Movement cluster inset", 0.70)
adjust_slider("Movement cluster height", 0.65)
adjust_slider("Movement cluster size", 0.62)
adjust_slider("Action cluster inset", 0.68)
adjust_slider("Action cluster height", 0.64)
adjust_slider("Action cluster size", 0.70)
tap_with_scroll("Reset current preset", attempts=12)
select_option("Touch aim assistance", "Light")
set_checkbox("Assisted fire tracking", False)
set_checkbox("Screen shake", False)
select_option("Effect intensity", "Reduced")
adjust_slider("Combat effects volume", 0.55)
adjust_slider("Interface volume", 0.65)
set_checkbox("Mobile haptics", False)
set_checkbox("Share anonymous run telemetry", True)
set_checkbox("Share anonymous run telemetry", False)
tap_with_scroll("Replay field tutorial", attempts=12)
shot("05-settings-exercised")

# Compare Default and Compact from the same player route and state.
for _ in range(12):
    scroll_down()
select_option("Interface size", "Default")
return_to_command()
default_shot = shot("06-command-default")

open_settings()
select_option("Interface size", "Compact")
return_to_command()
compact_shot = shot("07-command-compact")

visual_delta = pixel_difference(default_shot, compact_shot)
if visual_delta < 0.08:
    raise RuntimeError(f"Default and Compact still look too similar in black-box play: changed_pixels={visual_delta:.4f}")
print(f"ANDROID_SETTINGS_VISUAL_DENSITY_PASS changed_pixels={visual_delta:.4f}")

# Cold relaunch without touching app storage, then compare the rendered result.
adb("shell", "am", "force-stop", PACKAGE)
adb("shell", "am", "start", "-W", "-n", ACTIVITY, capture=True)
time.sleep(10)
dismiss_system_overlays()
wait_node("Command", timeout=25, actionable=True)
if not visible_label("Tasking nexus online.", contains=True):
    tap_label("Command")
wait_node("Tasking nexus online.", timeout=20, contains=True)
relaunch_shot = shot("08-command-compact-relaunch")

compact_relaunch_delta = pixel_difference(compact_shot, relaunch_shot)
default_relaunch_delta = pixel_difference(default_shot, relaunch_shot)
if compact_relaunch_delta >= default_relaunch_delta:
    raise RuntimeError(
        f"Cold relaunch does not visually preserve Compact: compact_delta={compact_relaunch_delta:.4f} default_delta={default_relaunch_delta:.4f}"
    )
print(f"ANDROID_SETTINGS_RELAUNCH_PASS compact_delta={compact_relaunch_delta:.4f} default_delta={default_relaunch_delta:.4f}")

# Re-enter Settings after the process restart and restore neutral/default values,
# leaving Interface size on Compact for a final visible proof screenshot.
open_settings()
select_option("Graphics quality", "Adaptive")
select_option("Interface size", "Compact")
select_option("Interface text size", "Default")
set_checkbox("High contrast", False)
set_checkbox("Reduce motion", False)
select_option("Combat layout preset", "Standard")
select_option("Touch aim assistance", "Balanced")
set_checkbox("Assisted fire tracking", True)
set_checkbox("Screen shake", True)
select_option("Effect intensity", "Full")
set_checkbox("Mobile haptics", True)
set_checkbox("Share anonymous run telemetry", False)
shot("09-settings-restored")

for _ in range(12):
    scroll_down()
select_option("Interface size", "Compact")
return_to_command()
shot("10-command-final-compact")

print("ANDROID_SETTINGS_PLAYTEST_PASS route=intake>command>operator>build>settings>command controls=graphics+interface+text+contrast+motion+hud-layout+cluster-sliders+aim+tracking+shake+effects+audio+haptics+telemetry+tutorial persistence=cold-relaunch visual=default-vs-compact input=touch-only")
