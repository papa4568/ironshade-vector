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
