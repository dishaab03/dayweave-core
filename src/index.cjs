const ENERGY_LEVELS = new Set(["low", "medium", "high"]);

function asDate(value, label) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`${label} must be a valid date.`);
  }
  return date;
}

function validateTask(task) {
  if (!task || typeof task !== "object" || Array.isArray(task)) {
    throw new TypeError("Each task must be an object.");
  }
  if (typeof task.id !== "string" || !task.id.trim()) {
    throw new TypeError("Each task needs a non-empty string id.");
  }
  if (typeof task.title !== "string" || !task.title.trim()) {
    throw new TypeError(`Task "${task.id}" needs a title.`);
  }
  if (!Number.isInteger(task.estimateMinutes) || task.estimateMinutes < 5 || task.estimateMinutes > 480) {
    throw new RangeError(`Task "${task.id}" estimateMinutes must be an integer from 5 to 480.`);
  }
  if (!Number.isInteger(task.impact) || task.impact < 1 || task.impact > 5) {
    throw new RangeError(`Task "${task.id}" impact must be an integer from 1 to 5.`);
  }
  if (task.energy && !ENERGY_LEVELS.has(task.energy)) {
    throw new TypeError(`Task "${task.id}" energy must be low, medium or high.`);
  }
  if (task.dueAt != null) asDate(task.dueAt, `Task "${task.id}" dueAt`);
  if (task.completed != null && typeof task.completed !== "boolean") {
    throw new TypeError(`Task "${task.id}" completed must be a boolean.`);
  }
  return task;
}

function validateTasks(tasks) {
  if (!Array.isArray(tasks)) throw new TypeError("Tasks must be an array.");
  const ids = new Set();
  for (const task of tasks) {
    validateTask(task);
    if (ids.has(task.id)) throw new Error(`Duplicate task id: ${task.id}`);
    ids.add(task.id);
  }
  return tasks;
}

function urgencyPoints(dueAt, now) {
  if (!dueAt) return 0;
  const hoursLeft = (asDate(dueAt, "dueAt").getTime() - now.getTime()) / 3_600_000;
  if (hoursLeft < 0) return 30;
  if (hoursLeft <= 24) return 25;
  if (hoursLeft <= 72) return 18;
  if (hoursLeft <= 168) return 10;
  return 4;
}

function scoreTask(task, options = {}) {
  validateTask(task);
  const now = asDate(options.now ?? new Date(), "now");
  const energyLevel = options.energyLevel;
  if (energyLevel && !ENERGY_LEVELS.has(energyLevel)) {
    throw new TypeError("energyLevel must be low, medium or high.");
  }

  const impactPoints = task.impact * 4;
  const urgency = urgencyPoints(task.dueAt, now);
  const effortPoints = task.estimateMinutes <= 30 ? 6
    : task.estimateMinutes <= 60 ? 3
    : task.estimateMinutes > 120 ? -2 : 0;
  const energyPoints = energyLevel && task.energy === energyLevel ? 4 : 0;

  return {
    score: impactPoints + urgency + effortPoints + energyPoints,
    breakdown: { impact: impactPoints, urgency, effort: effortPoints, energyFit: energyPoints }
  };
}

function rankTasks(tasks, options = {}) {
  validateTasks(tasks);
  const now = asDate(options.now ?? new Date(), "now");

  return tasks
    .filter((task) => !task.completed)
    .map((task) => ({ ...task, ...scoreTask(task, { ...options, now }) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aDue = a.dueAt ? asDate(a.dueAt, "dueAt").getTime() : Infinity;
      const bDue = b.dueAt ? asDate(b.dueAt, "dueAt").getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return a.id.localeCompare(b.id);
    });
}

function buildDayPlan(tasks, options = {}) {
  validateTasks(tasks);
  const availableMinutes = options.availableMinutes;
  if (!Number.isInteger(availableMinutes) || availableMinutes < 1) {
    throw new RangeError("availableMinutes must be a positive integer.");
  }

  const breakEveryMinutes = options.breakEveryMinutes ?? 90;
  const breakMinutes = options.breakMinutes ?? 10;
  if (!Number.isInteger(breakEveryMinutes) || breakEveryMinutes < 1) {
    throw new RangeError("breakEveryMinutes must be a positive integer.");
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 1) {
    throw new RangeError("breakMinutes must be a positive integer.");
  }

  const startAt = asDate(options.startAt ?? new Date(), "startAt");
  const ranked = rankTasks(tasks, { now: options.now ?? startAt, energyLevel: options.energyLevel });
  const blocks = [];
  const unscheduled = [];
  let cursor = startAt.getTime();
  let usedMinutes = 0;
  let focusSinceBreak = 0;

  for (const task of ranked) {
    const needsBreak = blocks.length > 0 && focusSinceBreak >= breakEveryMinutes;
    const required = task.estimateMinutes + (needsBreak ? breakMinutes : 0);

    if (usedMinutes + required > availableMinutes) {
      unscheduled.push({
        id: task.id,
        title: task.title,
        reason: task.estimateMinutes > availableMinutes
          ? "task-exceeds-available-time"
          : "not-enough-time-left"
      });
      continue;
    }

    if (needsBreak) {
      const breakStart = new Date(cursor);
      cursor += breakMinutes * 60_000;
      blocks.push({
        type: "break",
        title: "Take a break",
        durationMinutes: breakMinutes,
        startAt: breakStart.toISOString(),
        endAt: new Date(cursor).toISOString()
      });
      usedMinutes += breakMinutes;
      focusSinceBreak = 0;
    }

    const taskStart = new Date(cursor);
    cursor += task.estimateMinutes * 60_000;
    blocks.push({
      type: "task",
      id: task.id,
      title: task.title,
      score: task.score,
      durationMinutes: task.estimateMinutes,
      startAt: taskStart.toISOString(),
      endAt: new Date(cursor).toISOString()
    });
    usedMinutes += task.estimateMinutes;
    focusSinceBreak += task.estimateMinutes;
  }

  return {
    startAt: startAt.toISOString(),
    availableMinutes,
    plannedMinutes: usedMinutes,
    remainingMinutes: availableMinutes - usedMinutes,
    blocks,
    unscheduled
  };
}

function recordFocusSession(input) {
  if (!input || typeof input !== "object") throw new TypeError("Session input must be an object.");
  if (typeof input.taskId !== "string" || !input.taskId.trim()) {
    throw new TypeError("Session needs a taskId.");
  }
  if (!Number.isInteger(input.plannedMinutes) || input.plannedMinutes < 1) {
    throw new RangeError("plannedMinutes must be a positive integer.");
  }
  const startedAt = asDate(input.startedAt ?? new Date(), "startedAt");
  const endedAt = asDate(input.endedAt, "endedAt");
  if (endedAt < startedAt) throw new RangeError("endedAt cannot be before startedAt.");

  const elapsedMinutes = Math.round((endedAt - startedAt) / 60_000);
  const actualMinutes = input.actualMinutes ?? elapsedMinutes;
  if (!Number.isInteger(actualMinutes) || actualMinutes < 0) {
    throw new RangeError("actualMinutes must be a non-negative integer.");
  }

  return {
    taskId: input.taskId,
    plannedMinutes: input.plannedMinutes,
    actualMinutes,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    completed: Boolean(input.completed),
    varianceMinutes: actualMinutes - input.plannedMinutes
  };
}

function summarizeDay(tasks, sessions) {
  validateTasks(tasks);
  if (!Array.isArray(sessions)) throw new TypeError("Sessions must be an array.");
  for (const session of sessions) {
    if (!session || typeof session.taskId !== "string" ||
        !Number.isInteger(session.actualMinutes) || session.actualMinutes < 0) {
      throw new TypeError("Each session needs a taskId and non-negative integer actualMinutes.");
    }
  }

  const completedTasks = tasks.filter((task) => task.completed).length;
  const focusMinutes = sessions.reduce((total, session) => total + session.actualMinutes, 0);
  const plannedMinutes = sessions.reduce((total, session) => total + (session.plannedMinutes ?? 0), 0);
  const varianceMinutes = focusMinutes - plannedMinutes;
  const estimateAccuracy = plannedMinutes === 0
    ? null
    : Math.round(Math.max(0, 1 - Math.abs(varianceMinutes) / plannedMinutes) * 100);

  return {
    totalTasks: tasks.length,
    completedTasks,
    completionRate: tasks.length === 0 ? 0 : Math.round((completedTasks / tasks.length) * 100),
    focusSessions: sessions.length,
    focusMinutes,
    plannedFocusMinutes: plannedMinutes,
    varianceMinutes,
    estimateAccuracy
  };
}

function replanRemainingTasks(tasks, completedTaskIds, options = {}) {
  if (!Array.isArray(completedTaskIds) || completedTaskIds.some((id) => typeof id !== "string")) {
    throw new TypeError("completedTaskIds must be an array of strings.");
  }
  const completed = new Set(completedTaskIds);
  const remaining = tasks.filter((task) => !completed.has(task.id) && !task.completed);
  return buildDayPlan(remaining, options);
}

module.exports = {
  scoreTask,
  rankTasks,
  buildDayPlan,
  recordFocusSession,
  summarizeDay,
  replanRemainingTasks
};
