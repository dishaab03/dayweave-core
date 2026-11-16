import core from "./index.cjs";

export const scoreTask = core.scoreTask;
export const rankTasks = core.rankTasks;
export const buildDayPlan = core.buildDayPlan;
export const recordFocusSession = core.recordFocusSession;
export const summarizeDay = core.summarizeDay;
export const replanRemainingTasks = core.replanRemainingTasks;

export default {
  scoreTask,
  rankTasks,
  buildDayPlan,
  recordFocusSession,
  summarizeDay,
  replanRemainingTasks
};
