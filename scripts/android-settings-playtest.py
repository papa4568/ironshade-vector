#!/usr/bin/env python3
import subprocess, time
from pathlib import Path

PACKAGE="app.ironshade.vector"
ACTIVITY=f"{PACKAGE}/.MainActivity"

def adb(*args,capture=False):
    r=subprocess.run(["adb",*args],check=True,stdout=subprocess.PIPE if capture else None,stderr=subprocess.STDOUT if capture else None)
    return r.stdout.decode("utf-8","replace") if capture else ""

def tap(x,y,pause=.7):
    adb("shell","input","tap",str(x),str(y)); time.sleep(pause)

def swipe(x1,y1,x2,y2,duration=320,pause=.7):
    adb("shell","input","swipe",str(x1),str(y1),str(x2),str(y2),str(duration)); time.sleep(pause)

def shot(name):
    path=f"android-settings-{name}.png"
    with open(path,"wb") as out:
        subprocess.run(["adb","exec-out","screencap","-p"],check=True,stdout=out)
    if Path(path).stat().st_size<10000: raise RuntimeError(f"Screenshot failed: {path}")
    print(f"ANDROID_SETTINGS_STAGE {name} screenshot={path}")

print("ANDROID_SETTINGS_PLAYTEST_START mode=black-box mutations=adb-input observations=screenshot-only dom=forbidden accessibility=unused")
adb("shell","pm","clear",PACKAGE,capture=True)
adb("shell","am","start","-W","-n",ACTIVITY,capture=True)
time.sleep(3)
shot("00-class")

# Pixel 7 Pro emulator is locked to 851x412 landscape by the Android app.
# Vanguard is the default highlighted class; play the visible confirm button.
tap(748,365)
time.sleep(2)
shot("01-command")

# Play the bottom primary navigation exactly as a user would.
tap(425,382)
time.sleep(1)
shot("02-operator")

print("ANDROID_SETTINGS_COORDINATE_PROBE_PASS stage=operator input=touch-only")
