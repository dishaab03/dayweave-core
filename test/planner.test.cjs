const test = require("node:test");
const assert = require("node:assert/strict");
const {
  scoreTask, rankTasks, buildDayPlan, recordFocusSession,
  summarizeDay, replanRemainingTasks
} = require("../src/index.cjs");

const now = new Date("2026-11-17T09:00:00.000Z");
const tasks = [
  { id: "essay", title: "Finish essay", estimateMinutes: 60, impact: 5, dueAt: "2026-11-17T18:00:00Z", energy: "high" },
  { id: "flashcards", title: "Review flashcards", estimateMinutes: 20, impact: 3, dueAt: "2026-11-20T18:00:00Z", energy: "low" },
  { id: "laundry", title: "Do laundry", estimateMinutes: 30, impact: 1, energy: "low" }
];

test("scoreTask exposes a transparent score breakdown", () => {
  const result = scoreTask(tasks[0], { now, energyLevel: "high" });
  assert.equal(result.breakdown.impact, 20);
  assert.equal(result.breakdown.urgency, 25);
  assert.equal(result.breakdown.energyFit, 4);
  assert.equal(result.score, 52);
});

test("rankTasks sorts by score and excludes completed tasks", () => {
  const result = rankTasks([...tasks, { ...tasks[2], id: "done", completed: true }], { now });
  assert.equal(result.length, 3);
  assert.equal(result[0].id, "essay");
});

test("buildDayPlan schedules tasks within the time budget", () => {
  const plan = buildDayPlan(tasks, {
    availableMinutes: 100,
    startAt: now,
    now,
    breakEveryMinutes: 90,
    breakMinutes: 10
  });
  assert.ok(plan.plannedMinutes <= 100);
  assert.equal(plan.blocks[0].type, "task");
  assert.ok(plan.unscheduled.length >= 1);
});

test("buildDayPlan inserts a break after the focus threshold", () => {
  const plan = buildDayPlan(tasks.slice(0, 2), {
    availableMinutes: 100,
    startAt: now,
    now,
    breakEveryMinutes: 60,
    breakMinutes: 10
  });
  assert.equal(plan.blocks[0].type, "task");
  assert.equal(plan.blocks[1].type, "break");
});

test("buildDayPlan reports tasks that cannot fit", () => {
  const plan = buildDayPlan([tasks[0]], {
    availableMinutes: 30,
    startAt: now,
    now
  });
  assert.equal(plan.blocks.length, 0);
  assert.equal(plan.unscheduled[0].reason, "task-exceeds-available-time");
});

test("recordFocusSession calculates elapsed time and variance", () => {
  const session = recordFocusSession({
    taskId: "essay",
    plannedMinutes: 45,
    startedAt: "2026-11-17T09:00:00Z",
    endedAt: "2026-11-17T09:52:00Z",
    completed: true
  });
  assert.equal(session.actualMinutes, 52);
  assert.equal(session.varianceMinutes, 7);
  assert.equal(session.completed, true);
});

test("recordFocusSession rejects an end time before the start", () => {
  assert.throws(() => recordFocusSession({
    taskId: "essay", plannedMinutes: 30,
    startedAt: "2026-11-17T10:00:00Z",
    endedAt: "2026-11-17T09:00:00Z"
  }), /cannot be before/);
});

test("summarizeDay reports completion and focus metrics", () => {
  const summary = summarizeDay(
    [{ ...tasks[0], completed: true }, tasks[1]],
    [
      { taskId: "essay", plannedMinutes: 60, actualMinutes: 55 },
      { taskId: "flashcards", plannedMinutes: 20, actualMinutes: 25 }
    ]
  );
  assert.equal(summary.completionRate, 50);
  assert.equal(summary.focusMinutes, 80);
  assert.equal(summary.estimateAccuracy, 100);
});

test("replanRemainingTasks removes completed tasks before planning", () => {
  const plan = replanRemainingTasks(tasks, ["essay"], {
    availableMinutes: 60, startAt: now, now
  });
  assert.ok(plan.blocks.every((block) => block.id !== "essay"));
});

test("invalid tasks and duplicate ids are rejected", () => {
  assert.throws(() => rankTasks([{ id: "x", title: "Missing estimate", impact: 2 }]), /estimateMinutes/);
  assert.throws(() => rankTasks([tasks[0], tasks[0]]), /Duplicate task id/);
});
