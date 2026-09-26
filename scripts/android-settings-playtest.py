#!/usr/bin/env python3
import re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE="app.ironshade.vector"; ACTIVITY=f"{PACKAGE}/.MainActivity"
REMOTE="/sdcard/settings-native.xml"; LOCAL=Path("settings-native.xml")

def adb(*args,capture=False):
    r=subprocess.run(["adb",*args],check=True,stdout=subprocess.PIPE if capture else None,stderr=subprocess.STDOUT if capture else None)
    return r.stdout.decode("utf-8","replace") if capture else ""

def tap(x,y,pause=.8):
    adb("shell","input","tap",str(x),str(y)); time.sleep(pause)

def shot(name):
    path=f"android-settings-{name}.png"
    with open(path,"wb") as out: subprocess.run(["adb","exec-out","screencap","-p"],check=True,stdout=out)
    if Path(path).stat().st_size<10000: raise RuntimeError(f"Screenshot failed: {path}")
    print(f"ANDROID_SETTINGS_STAGE {name}")

def native_nodes():
    adb("shell","uiautomator","dump","--compressed",REMOTE,capture=True)
    adb("pull",REMOTE,str(LOCAL),capture=True)
    return [n.attrib for n in ET.parse(LOCAL).getroot().iter("node")]

def dismiss_overlays():
    for _ in range(6):
        dismissed=False
        try:
            ns=native_nodes()
            for label in ("Got it","Wait","Close app"):
                for n in ns:
                    if n.get("text","").strip()==label and n.get("bounds"):
                        m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n["bounds"])
                        if not m: continue
                        x1,y1,x2,y2=map(int,m.groups())
                        tap((x1+x2)//2,(y1+y2)//2,1.2)
                        print(f"ANDROID_SETTINGS_SYSTEM_OVERLAY_DISMISSED action={label}")
                        dismissed=True
                        break
                if dismissed: break
        except Exception as exc:
            print(f"ANDROID_SETTINGS_OVERLAY_SCAN detail={exc}")
        if not dismissed: return

print("ANDROID_SETTINGS_PLAYTEST_START mode=black-box game-input=adb-screen-taps game-observation=screenshots dom=forbidden")
adb("shell","pm","clear",PACKAGE,capture=True)
# Suppress emulator-only ANR and immersive-mode education overlays. These are
# Android system UI, not game state, and otherwise intercept human-equivalent taps.
adb("shell","settings","put","global","hide_error_dialogs","1",capture=True)
adb("shell","settings","put","secure","immersive_mode_confirmations","confirmed",capture=True)
adb("shell","am","start","-W","-n",ACTIVITY,capture=True)
time.sleep(14)
dismiss_overlays(); time.sleep(1)
shot("00-class")

# Explicitly pick Vanguard, then press the visible Play Vanguard button.
tap(285,285); time.sleep(.7)
dismiss_overlays()
tap(1618,726); time.sleep(5)
dismiss_overlays(); time.sleep(1)
shot("01-command")

# Physical bottom-nav Operator destination.
tap(875,748); time.sleep(2)
shot("02-operator")

print("ANDROID_SETTINGS_COORDINATE_PROBE_PASS stage=operator input=touch-only")
