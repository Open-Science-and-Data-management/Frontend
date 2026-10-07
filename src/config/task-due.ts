import { differenceInCalendarDays } from "date-fns";
import { toLocalDay } from "@/utils/calendarDate";
import type { Task } from "@/types/task";

export type DueState = "overdue" | "due_soon" | "upcoming";

/** "Due soon" means within this many days, today included. */
export const DUE_SOON_DAYS = 3;

/** Work that is still someone's to do. */
export const isOpenTask = (task: Task): boolean =>
  task.status === "todo" || task.status === "in_progress";

/** Calendar days from today to the due date; negative once it has passed. */
export const daysUntilDue = (end: Date, today: Date = new Date()): number =>
  differenceInCalendarDays(toLocalDay(end), today);

export const dueState = (days: number): DueState =>
  days < 0 ? "overdue" : days <= DUE_SOON_DAYS ? "due_soon" : "upcoming";

export const DUE_LABELS: Record<DueState, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  upcoming: "Upcoming",
};
