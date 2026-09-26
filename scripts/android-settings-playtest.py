#!/usr/bin/env python3
import re, subprocess, time, xml.etree.ElementTree as ET
from pathlib import Path

PACKAGE="app.ironshade.vector"
ACTIVITY=f"{PACKAGE}/.MainActivity"
REMOTE="/sdcard/settings-native.xml"
LOCAL=Path("settings-native.xml")

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

def dismiss_native_dialog():
    # Native emulator/launcher dialogs are outside the game WebView. Dismiss only
    # those system overlays before beginning the player-input-only app test.
    try:
        adb("shell","uiautomator","dump","--compressed",REMOTE,capture=True)
        adb("pull",REMOTE,str(LOCAL),capture=True)
        root=ET.parse(LOCAL).getroot()
        for label in ("Wait","Close app"):
            for node in root.iter("node"):
                if node.attrib.get("text","").strip()==label and node.attrib.get("bounds"):
                    m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",node.attrib["bounds"])
                    if m:
                        x1,y1,x2,y2=map(int,m.groups())
                        tap((x1+x2)//2,(y1+y2)//2,1.2)
                        print(f"ANDROID_SETTINGS_SYSTEM_DIALOG_DISMISSED action={label}")
                        return
    except Exception as exc:
        print(f"ANDROID_SETTINGS_SYSTEM_DIALOG_NONE detail={exc}")

print("ANDROID_SETTINGS_PLAYTEST_START mode=black-box game-input=adb-screen-taps game-observation=screenshots dom=forbidden")
adb("shell","pm","clear",PACKAGE,capture=True)
adb("shell","am","start","-W","-n",ACTIVITY,capture=True)
time.sleep(3)
dismiss_native_dialog()
time.sleep(2)
shot("00-class")

# Physical Pixel 7 Pro screenshot space is ~1804x832. beta.418 uses a landscape
# WebView inside the status/navigation bars. Vanguard is selected by default.
tap(1535,735)
time.sleep(2)
shot("01-command")

# Bottom Operator destination, played by touch.
tap(875,742)
time.sleep(1.5)
shot("02-operator")

print("ANDROID_SETTINGS_COORDINATE_PROBE_PASS stage=operator input=touch-only")
