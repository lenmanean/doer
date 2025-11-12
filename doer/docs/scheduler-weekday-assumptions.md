# Scheduler Scheduling Assumptions

This note records how the time-block scheduler handled weekday-only constraints and what changed with the weekend-aware update.

## Prior weekday-only behaviour

- `src/lib/time-block-scheduler.ts`
  - Counted only weekdays when distributing priorities and converting workday indices to `day_index`.
  - Skipped weekend dates when scanning for placements.
  - Used a constant weekday capacity derived from `workdayStartHour`, `workdayEndHour`, and the lunch window.
- Upstream (`src/app/api/plans/generate/route.ts`, `src/lib/smart-scheduler.ts`, `CreateTaskModal`) forwarded only weekday settings, so weekends never received tasks.

## Weekend-aware update (2025-11-08)

- Added `allowWeekends` plus weekend-specific start/end/lunch settings and per-day `DayScheduleConfig` calculations.
- Introduced `weekdayMaxMinutes` / `weekendMaxMinutes` overrides so we can cap weekday minutes (to respect commute fatigue) while leaving weekends more open.
- Distribution now works over the list of active days (which can include weekends), and placement logic skips weekends only when explicitly disabled.
- Capacity analysis reports weekday vs. weekend totals separately so validations match the blended schedule.

## Upstream changes

- `src/app/api/plans/generate/route.ts`
  - Enables weekends by default, applies a 60% weekday cap, and extends weekend hours by up to two hours.
  - Uses the same blended capacity when auto-extending timelines for unscheduled minutes.
- `src/lib/smart-scheduler.ts` and `CreateTaskModal`
  - Mirror the new options to keep redistributions and previews in sync with the scheduler’s weekend logic.

## Testing

- `src/lib/scheduler-tests.ts` now includes `testWeekendSchedulingBias()` to verify that longer tasks gravitate to weekends while shorter habits stay on weekdays when weekend scheduling is enabled.
- The existing console-driven test harness (`runAllSchedulerTests`) runs the new scenario alongside the legacy regression checks.

Keep this checklist handy when iterating on scheduling preferences (e.g., per-user weekend rules or different weekday caps).

