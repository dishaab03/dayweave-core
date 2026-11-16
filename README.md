# dayweave-core

A deterministic daily-planning engine for JavaScript. It helps turn a list of tasks into a realistic plan by weighing deadlines, impact, effort and energy fit, then tracks planned vs actual focus time.

**Not another timer.** Dayweave focuses on the decision-making layer: what fits today, what should come first, and what needs to move when the day changes.

## Features

- Explainable task scoring with a score breakdown
- Deadline-aware and impact-aware task ranking
- Small-task effort bonus and optional energy matching
- Time-budgeted daily plans with scheduled breaks
- Clear reasons for tasks that could not fit
- Focus-session records with planned-vs-actual variance
- Daily completion and focus summaries
- Replanning after tasks are completed
- CommonJS and ES module support
- Zero runtime dependencies

## Install

```bash
npm install dayweave-core
```

## Quick start

```js
const { buildDayPlan } = require("dayweave-core");

const tasks = [
  {
    id: "assignment",
    title: "Finish algorithm assignment",
    estimateMinutes: 60,
    impact: 5,
    dueAt: "2026-11-18T18:00:00+05:30",
    energy: "high"
  },
  {
    id: "revision",
    title: "Revise database notes",
    estimateMinutes: 30,
    impact: 3,
    energy: "medium"
  }
];

const plan = buildDayPlan(tasks, {
  availableMinutes: 120,
  startAt: new Date(),
  energyLevel: "high",
  breakEveryMinutes: 60,
  breakMinutes: 10
});

console.log(plan.blocks);
console.log(plan.unscheduled);
```

## Task shape

| Property | Required | Details |
|---|---|---|
| `id` | Yes | Unique, non-empty string |
| `title` | Yes | Human-readable task name |
| `estimateMinutes` | Yes | Integer from 5 to 480 |
| `impact` | Yes | Integer from 1 (low) to 5 (high) |
| `dueAt` | No | Date or date string |
| `energy` | No | `low`, `medium` or `high` |
| `completed` | No | Boolean; completed tasks are excluded from ranking |

## API

### `scoreTask(task, options?)`

Returns `{ score, breakdown }`. The score is deterministic and explainable:

- Impact: `impact × 4`
- Urgency: overdue 30; due within 24 hours 25; within 72 hours 18; within 7 days 10; later 4; no deadline 0
- Effort: +6 for tasks up to 30 minutes; +3 up to 60 minutes; −2 above 120 minutes
- Energy fit: +4 when `options.energyLevel` matches the task's energy

Pass `options.now` to make scoring reproducible in tests or simulations.

### `rankTasks(tasks, options?)`

Returns incomplete tasks sorted by score (highest first). Ties are resolved by earliest deadline, then task id.

### `buildDayPlan(tasks, options)`

Required option: `availableMinutes`.

Optional options:

- `startAt`: plan start date (defaults to now)
- `now`: reference time used for deadline scoring
- `energyLevel`: `low`, `medium` or `high`
- `breakEveryMinutes`: focus time before a break (default 90)
- `breakMinutes`: break length (default 10)

Returns `blocks`, `unscheduled`, `plannedMinutes` and `remainingMinutes`. Tasks are kept whole; the planner does not silently split a task into partial work.

Unscheduled reasons are `task-exceeds-available-time` and `not-enough-time-left`.

### `recordFocusSession(input)`

Creates a plain session record. Required: `taskId`, `plannedMinutes`, `endedAt`. `startedAt` defaults to now. If `actualMinutes` is omitted, it is calculated from the timestamps. The result includes `varianceMinutes` (actual minus planned).

### `summarizeDay(tasks, sessions)`

Returns task completion rate, total focus minutes, planned focus minutes, variance and estimate accuracy. Estimate accuracy is `null` when there is no planned focus time.

### `replanRemainingTasks(tasks, completedTaskIds, options)`

Removes completed task ids and builds a fresh plan using the remaining time budget supplied in `options`.

## Run the example

```bash
npm run demo
```

## Run tests

Node.js 18 or newer:

```bash
npm test
```

The project uses Node's built-in test runner. There are no runtime or development dependencies.

## Design decisions

- **Deterministic, not AI-based:** the same inputs and reference time produce the same ranking.
- **Explainable scores:** callers can show users why a task ranked highly.
- **No hidden persistence:** the package returns plain JavaScript objects; the host application chooses whether and where to save them.
- **Whole-task scheduling:** tasks are either scheduled in full or listed as unscheduled, so the plan never implies that a task is finished when only part of its estimate fits.

## Limitations

This is a planning engine, not a calendar integration or background timer. It does not persist data, send notifications, split tasks, or account for calendar events unless the calling application subtracts those events from `availableMinutes`.

## License

MIT
