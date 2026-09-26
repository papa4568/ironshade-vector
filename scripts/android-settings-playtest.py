#!/usr/bin/env python3
import re, struct, subprocess, time, xml.etree.ElementTree as ET, zlib
from pathlib import Path

PACKAGE="app.ironshade.vector"
ACTIVITY=f"{PACKAGE}/.MainActivity"
REMOTE="/sdcard/ironshade-settings-playtest.xml"
LOCAL=Path("android-settings-playtest.xml")

def run(*args,capture=False,check=True):
    r=subprocess.run(args,check=check,stdout=subprocess.PIPE if capture else None,stderr=subprocess.STDOUT if capture else None)
    return r.stdout.decode("utf-8","replace") if capture else ""

def adb(*args,capture=False,check=True): return run("adb",*args,capture=capture,check=check)

def nodes():
    adb("shell","uiautomator","dump","--compressed",REMOTE,capture=True)
    adb("pull",REMOTE,str(LOCAL),capture=True)
    return [n.attrib for n in ET.parse(LOCAL).getroot().iter("node")]

def find(label,contains=False):
    q=label.strip().lower()
    for n in nodes():
        for value in (n.get("content-desc","").strip(),n.get("text","").strip()):
            v=value.lower()
            if ((q in v) if contains else (q==v)) and n.get("bounds"):
                return n
    return None

def wait(label,timeout=20,contains=False):
    end=time.time()+timeout
    while time.time()<end:
        n=find(label,contains)
        if n:return n
        time.sleep(.5)
    raise RuntimeError(f"Timed out waiting for visible UI node: {label}")

def center(bounds):
    m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",bounds or "")
    if not m: raise RuntimeError(f"Bad bounds {bounds}")
    x1,y1,x2,y2=map(int,m.groups()); return (x1+x2)//2,(y1+y2)//2

def tap_node(n):
    x,y=center(n["bounds"]); adb("shell","input","tap",str(x),str(y)); time.sleep(.5)

def tap(label,timeout=20,contains=False):
    n=wait(label,timeout,contains); tap_node(n); return n

def up():
    adb("shell","input","swipe","430","345","430","85","320"); time.sleep(.5)

def down():
    adb("shell","input","swipe","430","85","430","345","320"); time.sleep(.5)

def reach(label,attempts=8):
    for _ in range(attempts):
        n=find(label)
        if n: tap_node(n); return n
        up()
    raise RuntimeError(f"Could not reach visible UI control: {label}")

def select(label,option):
    reach(label)
    tap(option,timeout=8)
    time.sleep(.6)

def checkbox(label,wanted):
    n=None
    for _ in range(8):
        n=find(label)
        if n: break
        up()
    if not n: raise RuntimeError(f"Checkbox not reachable: {label}")
    state=n.get("checked")=="true"
    if state!=wanted:
        tap_node(n); n=wait(label); state=n.get("checked")=="true"
    if state!=wanted: raise RuntimeError(f"Checkbox state failed: {label} wanted={wanted} attrs={n}")

def slider(label,fraction=.7):
    n=None
    for _ in range(8):
        n=find(label)
        if n: break
        up()
    if not n: raise RuntimeError(f"Slider not reachable: {label}")
    m=re.fullmatch(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]",n["bounds"])
    x1,y1,x2,y2=map(int,m.groups()); y=(y1+y2)//2
    a=x1+int((x2-x1)*.35); b=x1+int((x2-x1)*fraction)
    adb("shell","input","swipe",str(a),str(y),str(b),str(y),"350"); time.sleep(.5)

def shot(path):
    with open(path,"wb") as f: subprocess.run(["adb","exec-out","screencap","-p"],check=True,stdout=f)
    if Path(path).stat().st_size<10000: raise RuntimeError(f"Screenshot failed: {path}")

def png(path):
    data=Path(path).read_bytes()
    if data[:8]!=b"\x89PNG\r\n\x1a\n": raise RuntimeError("not png")
    p=8; comp=bytearray(); w=h=bd=ct=None
    while p<len(data):
        ln=struct.unpack(">I",data[p:p+4])[0]; typ=data[p+4:p+8]; payload=data[p+8:p+8+ln]; p+=12+ln
        if typ==b"IHDR": w,h,bd,ct,_,_,_=struct.unpack(">IIBBBBB",payload)
        elif typ==b"IDAT": comp.extend(payload)
        elif typ==b"IEND": break
    if bd!=8 or ct not in (2,6): raise RuntimeError(f"unsupported png {bd}/{ct}")
    bpp=4 if ct==6 else 3; raw=zlib.decompress(bytes(comp)); stride=w*bpp; rows=[]; prev=bytearray(stride); off=0
    for _ in range(h):
        ft=raw[off]; off+=1; row=bytearray(raw[off:off+stride]); off+=stride
        for i in range(stride):
            a=row[i-bpp] if i>=bpp else 0; b=prev[i]; c=prev[i-bpp] if i>=bpp else 0
            if ft==1: row[i]=(row[i]+a)&255
            elif ft==2: row[i]=(row[i]+b)&255
            elif ft==3: row[i]=(row[i]+((a+b)//2))&255
            elif ft==4:
                q=a+b-c; pa,pb,pc=abs(q-a),abs(q-b),abs(q-c); pr=a if pa<=pb and pa<=pc else (b if pb<=pc else c)
                row[i]=(row[i]+pr)&255
            elif ft!=0: raise RuntimeError(f"png filter {ft}")
        rows.append(bytes(row)); prev=row
    return w,h,bpp,rows

def diff(a,b):
    wa,ha,ba,ra=png(a); wb,hb,bb,rb=png(b)
    if (wa,ha,ba)!=(wb,hb,bb): raise RuntimeError("screenshot size changed")
    changed=0; total=wa*ha
    for y in range(ha):
        aa,bbrow=ra[y],rb[y]
        for x in range(wa):
            i=x*ba
            if sum(abs(aa[i+c]-bbrow[i+c]) for c in range(3))>=36: changed+=1
    return changed/total

def fresh():
    adb("shell","pm","clear",PACKAGE,capture=True)
    adb("shell","am","start","-W","-n",ACTIVITY,capture=True)
    wait("Operator class selection",30)

def choose():
    for _ in range(9):
        n=find("Confirm Vanguard")
        if n:
            tap_node(n); wait("Command",25); return
        up()
    raise RuntimeError("Could not confirm Vanguard by visible input")

def settings():
    tap("Operator",15)
    reach("Build",4)
    tap("Settings",15)
    wait("Interface size",15)

def command():
    reach("Return to ship",8)
    wait("Command",20); tap("Command")
    wait("Tasking nexus online.",15,True)

print("ANDROID_SETTINGS_PLAYTEST_START mode=black-box mutations=adb-input observations=uiautomator+screenshot dom=forbidden")
fresh(); choose(); settings()

select("Graphics quality","Performance")
select("Interface size","Default")
select("Interface text size","Large")
checkbox("High contrast",True)
checkbox("Reduce motion",True)
select("Combat layout preset","Left-Handed")
slider("Movement cluster inset",.70); slider("Movement cluster height",.65); slider("Movement cluster size",.60)
slider("Action cluster inset",.65); slider("Action cluster height",.60); slider("Action cluster size",.70)
reach("Reset current preset",8)
select("Touch aim assistance","Light")
checkbox("Assisted fire tracking",False)
checkbox("Screen shake",False)
select("Effect intensity","Reduced")
slider("Combat effects volume",.55); slider("Interface volume",.65)
checkbox("Mobile haptics",False)
checkbox("Share anonymous run telemetry",True); checkbox("Share anonymous run telemetry",False)
reach("Replay field tutorial",8)

for _ in range(8): down()
select("Interface size","Default"); command(); shot("android-settings-command-default.png")
settings(); select("Interface size","Compact"); command(); shot("android-settings-command-compact.png")
ratio=diff("android-settings-command-default.png","android-settings-command-compact.png")
if ratio<.08: raise RuntimeError(f"Default/Compact screenshots too similar changed_pixels={ratio:.4f}")
print(f"ANDROID_SETTINGS_VISUAL_DENSITY_PASS changed_pixels={ratio:.4f}")

adb("shell","am","force-stop",PACKAGE)
adb("shell","am","start","-W","-n",ACTIVITY,capture=True)
wait("Command",30); tap("Command"); wait("Tasking nexus online.",15,True)
shot("android-settings-command-compact-relaunch.png")
compact_delta=diff("android-settings-command-compact.png","android-settings-command-compact-relaunch.png")
default_delta=diff("android-settings-command-default.png","android-settings-command-compact-relaunch.png")
if compact_delta>=default_delta: raise RuntimeError(f"Relaunch does not resemble Compact: compact={compact_delta:.4f} default={default_delta:.4f}")
print(f"ANDROID_SETTINGS_RELAUNCH_PASS compact_delta={compact_delta:.4f} default_delta={default_delta:.4f}")

settings()
select("Interface size","Compact"); select("Graphics quality","Adaptive"); select("Interface text size","Default")
checkbox("High contrast",False); checkbox("Reduce motion",False); select("Combat layout preset","Standard")
select("Touch aim assistance","Balanced"); checkbox("Assisted fire tracking",True); checkbox("Screen shake",True)
select("Effect intensity","Full"); checkbox("Mobile haptics",True); checkbox("Share anonymous run telemetry",False)
shot("android-settings-playtest-final.png")
for _ in range(8): down()
select("Interface size","Compact"); command(); shot("android-settings-command-final-compact.png")
print("ANDROID_SETTINGS_PLAYTEST_PASS controls=graphics+interface+text+contrast+motion+hud-preset+6-cluster-sliders+aim+tracking+shake+effects+2-volume-sliders+haptics+telemetry+tutorial persistence=cold-relaunch")
