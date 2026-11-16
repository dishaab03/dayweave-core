const {
  buildDayPlan,
  recordFocusSession,
  summarizeDay
} = require("../src/index.cjs");

const tasks = [
  {
    id: "ada",
    title: "Practise graph algorithms",
    estimateMinutes: 60,
    impact: 5,
    dueAt: "2026-11-18T18:00:00+05:30",
    energy: "high"
  },
  {
    id: "dbms",
    title: "Revise SQL joins",
    estimateMinutes: 35,
    impact: 4,
    dueAt: "2026-11-19T18:00:00+05:30",
    energy: "medium"
  },
  {
    id: "notes",
    title: "Organise lecture notes",
    estimateMinutes: 20,
    impact: 2,
    energy: "low"
  }
];

const startAt = new Date("2026-11-17T09:00:00+05:30");
const plan = buildDayPlan(tasks, {
  availableMinutes: 150,
  startAt,
  now: startAt,
  energyLevel: "high",
  breakEveryMinutes: 60,
  breakMinutes: 10
});

console.log("\nToday's plan");
for (const block of plan.blocks) {
  const time = new Date(block.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  console.log(`${time}  ${block.type === "break" ? "☕" : "→"} ${block.title} (${block.durationMinutes} min)`);
}
console.log("\nUnscheduled:", plan.unscheduled);

const session = recordFocusSession({
  taskId: "ada",
  plannedMinutes: 60,
  startedAt: "2026-11-17T09:00:00+05:30",
  endedAt: "2026-11-17T09:54:00+05:30",
  completed: true
});

console.log("\nSample session:", session);
const updatedTasks = tasks.map((task) =>
  task.id === "ada"
    ? { ...task, completed: true }
    : task
);

console.log("Daily summary:", summarizeDay(updatedTasks, [session]));