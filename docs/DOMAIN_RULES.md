# Domain rules

## Scheduling

- A routine may target weekdays, explicit local calendar dates, or both.
- A daily session is created as a snapshot when a scheduled date is first opened.
- Later exercise or routine edits never alter an existing session.
- Archived definitions remain available to history but do not create future sessions.
- A date without a session is a rest day and neither earns nor breaks a recorded streak.

## Completion

- An exercise is complete when every prescribed set is checked.
- A scheduled day is complete when it contains at least one required exercise and all required exercises are complete.
- Optional exercises can earn exercise XP but do not block daily completion.
- Historical checkboxes may be corrected. All derived progression then recalculates.

## Progression

- Each completed exercise contributes 10 XP once because XP is derived from the completion record.
- Each completed scheduled date contributes 25 XP.
- Level is `floor(total XP / 100) + 1`.
- Achievements cover first exercise, first day, 3/7/30-day streaks, and 10/50/100 completed exercises.

These are replaceable policies. Change the policy and its focused specifications together; do not preserve a rule merely because existing code implements it.

## Themes

- System mode follows the browser's current light or dark preference.
- Light and dark modes use documented built-in palettes.
- Custom mode stores a complete palette locally, including page, surface, text, secondary text, accent, button text, border, banner, success, and notice colors.
- Theme edits affect an isolated live preview until explicitly saved.
- Custom palettes are part of local settings and encrypted backups; they are never published with the application.

## Weight tracking

- At most one positive weight reading is stored per local calendar date; saving the same date updates it.
- Missing dates are absent rather than represented by null values.
- Goal dates are mathematical extrapolations, not medical guidance or guarantees.
- The selectable methods are ordinary least-squares, 30-day half-life weighted least-squares, and the outlier-resistant Theil–Sen median slope.
- Weight entries use a dedicated relational table; daily rows remain small, queryable, and easier to validate than month-keyed JSON.
- The weight calendar starts on Monday by default and can be changed to Sunday in settings.
- Weight exports filter recorded entries by inclusive start and end months and are generated locally
  as Excel-compatible CSV, plain text, or PDF files.
