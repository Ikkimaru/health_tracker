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
