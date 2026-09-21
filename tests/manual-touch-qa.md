# Combat touch QA

Run these checks on an Android touch device or emulator after changes to combat input or overlay layout.

## Combat surface

- Drag the movement stick continuously; movement must remain responsive without browser/page panning.
- Drag on the open right side of the combat canvas; manual aim must track the pointer without browser/page panning.
- Hold FIRE, tap abilities, cycle weapons, vent, dodge, and ACT; controls must not lose pointer input during normal use.
- Repeat in landscape and portrait orientations.

## Overlay gesture isolation

- Open a combat extraction/checkpoint overlay on a short viewport.
- Swipe vertically inside the overlay and its card; long content must scroll normally.
- The same vertical swipe must not move or fire the combat controls behind the overlay.
- Close/resolve the overlay and confirm combat touch controls immediately resume.

## Accessibility / platform gestures

- Confirm combat no longer installs document-wide `touchmove` or `gesturestart` cancellation.
- Confirm only the canvas/joystick/control surfaces suppress browser gestures; dialog content remains a vertical pan surface.

## Assisted target feedback

- Hold FIRE without touching the manual-aim field. The best legal hostile must gain one stable ASSIST LOCK reticle and the target readout must name the same hostile.
- Keep FIRE held while two similar hostiles cross. The lock must remain stable unless a materially higher-priority target takes over; each real acquisition/switch should produce one short target cue rather than repeating every frame.
- Release FIRE. The ASSIST LOCK reticle/readout must disappear immediately.
- While assisted FIRE is active, drag the open right side or use the right aiming stick. Manual aim must take authority immediately and clear the assisted lock.
- With Haptics disabled, assisted target acquisition must not vibrate. With Haptics enabled, acquisition may give one short phone vibration where the platform supports it.
- Set Effects to Reduced. The lock must remain high-contrast and readable without reticle pulsing/rotation.

## Controller targeting

- Connect a standard gamepad before or during combat. Left stick moves; right stick aims manually.
- Hold RT without moving the right stick. RT must use assisted target acquisition and show the same ASSIST LOCK reticle/readout used by touch FIRE.
- Move the right stick while RT is held. Manual controller aim must clear the assisted lock immediately and remain authoritative.
- If right-stick fire is enabled, pushing the right stick beyond the firing threshold must aim/fire manually without assisted target takeover.
- Verify A = dodge, B = cycle weapon, X = ACT, Y = reload, LB/RB/LT = the three class abilities, and RT = fire.
- When the connected controller exposes a rumble actuator and Haptics are enabled, a new assisted lock may give one subtle rumble. Disable Haptics and verify controller rumble stops.

## Screen-reader feedback

- With a screen reader enabled, assisted acquisition announces the hostile once when the lock changes and announces release once when the lock ends.
- Target HP/armor updates must not generate repeated live-region chatter; only lock-state changes belong in the live announcement.
