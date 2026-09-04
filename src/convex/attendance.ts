import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

type SubjectSeed = {
  name: string;
  code: string;
  category: string;
  order: number;
};

/**
 * The exact subject list supplied by the student, in timetable order.
 * `code` is kept verbatim; `name` is a readable label; `category` groups
 * lectures, labs, tutorials and non-academic sessions.
 */
const DEFAULT_SUBJECTS: SubjectSeed[] = [
  { name: "Engineering Mechanics", code: "LAB/MEC1052/ABS", category: "Lab", order: 0 },
  { name: "Engineering Mechanics", code: "LAB/MEC1051/AKR", category: "Lab", order: 1 },
  { name: "Engineering Physics", code: "L/PHY1001/STM", category: "Lecture", order: 2 },
  { name: "Humanities", code: "L/HUM1002/SPR", category: "Lecture", order: 3 },
  { name: "Humanities", code: "L/HUM/1002/KM", category: "Lecture", order: 4 },
  { name: "Basic Electronics", code: "L/ECE1001/AMD", category: "Lecture", order: 5 },
  { name: "Engineering Mathematics I", code: "L/MTH1101/SR", category: "Lecture", order: 6 },
  { name: "Physics Laboratory", code: "LAB/PHY1051/RJR", category: "Lab", order: 7 },
  { name: "Physics Laboratory", code: "LAB/PHY1051/STM", category: "Lab", order: 8 },
  { name: "Mentoring", code: "MENTORING", category: "Sessions", order: 9 },
  { name: "Life Skills", code: "LIFE SKILL", category: "Sessions", order: 10 },
  { name: "Basic Electronics Laboratory", code: "LAB/ECE1051/AC", category: "Lab", order: 11 },
  { name: "Basic Electronics Laboratory", code: "LAB/ECE1051/OB", category: "Lab", order: 12 },
  { name: "Engineering Mathematics I", code: "T1/MTH1101/VB", category: "Tutorial", order: 13 },
  { name: "Engineering Mechanics", code: "L/MEC1052/MB", category: "Lecture", order: 14 },
  { name: "Engineering Mechanics", code: "L/MEC1051/AR", category: "Lecture", order: 15 },
  { name: "Engineering Physics", code: "L/PHY1001/RJR", category: "Lecture", order: 16 },
];

/**
 * Insert the default subjects once. If the stored subject set no longer
 * matches (e.g. an older seed), it is wiped and reseeded so the app always
 * shows exactly the timetable above. Idempotent.
 */
export const ensureDefaultSubjects = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      throw new Error("Not signed in");
    }
    const existing = await ctx.db.query("subjects").collect();
    const expectedCodes = new Set(DEFAULT_SUBJECTS.map((s) => s.code));
    const matches =
      existing.length === DEFAULT_SUBJECTS.length &&
      existing.every((s) => expectedCodes.has(s.code));
    if (matches) {
      return;
    }
    // Reseed: clear old subjects and any attendance pointing at them.
    const records = await ctx.db.query("attendance").collect();
    for (const record of records) {
      await ctx.db.delete(record._id);
    }
    for (const subject of existing) {
      await ctx.db.delete(subject._id);
    }
    for (const subject of DEFAULT_SUBJECTS) {
      await ctx.db.insert("subjects", subject);
    }
  },
});

/** Remember which group (A or B) the student belongs to. */
export const setGroup = mutation({
  args: { group: v.union(v.literal("A"), v.literal("B")) },
  handler: async (ctx, { group }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      throw new Error("Not signed in");
    }
    await ctx.db.patch(user._id, { group });
  },
});

/**
 * Subjects with today's status, lifetime stats and full history for the
 * signed-in user, plus their chosen group and overall summary.
 */
export const dashboard = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return null;
    }

    const subjects = await ctx.db
      .query("subjects")
      .withIndex("by_order")
      .collect();
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const bySubject = new Map<string, { date: string; status: "present" | "absent" }[]>();
    for (const record of records) {
      const list = bySubject.get(record.subjectId) ?? [];
      list.push({ date: record.date, status: record.status });
      bySubject.set(record.subjectId, list);
    }

    let totalMarks = 0;
    let totalPresent = 0;

    const subjectList = subjects.map((subject) => {
      const history = (bySubject.get(subject._id) ?? []).sort((a, b) =>
        a.date < b.date ? 1 : -1,
      );
      const present = history.filter((h) => h.status === "present").length;
      totalMarks += history.length;
      totalPresent += present;
      return {
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        category: subject.category,
        todayStatus: history.find((h) => h.date === date)?.status ?? null,
        present,
        total: history.length,
        history,
      };
    });

    return {
      group: user.group ?? null,
      summary: { totalMarks, totalPresent },
      subjects: subjectList,
    };
  },
});

/**
 * Mark (or unmark) today's attendance for a subject. Calling with the same
 * status again removes the mark.
 */
export const mark = mutation({
  args: {
    subjectId: v.id("subjects"),
    date: v.string(),
    status: v.union(v.literal("present"), v.literal("absent")),
  },
  handler: async (ctx, { subjectId, date, status }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      throw new Error("Not signed in");
    }
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_user_subject_date", (q) =>
        q.eq("userId", user._id).eq("subjectId", subjectId).eq("date", date),
      )
      .first();

    if (existing === null) {
      await ctx.db.insert("attendance", {
        userId: user._id,
        subjectId,
        date,
        status,
        updatedAt: Date.now(),
      });
      return;
    }

    if (existing.status === status) {
      await ctx.db.delete(existing._id);
      return;
    }
    await ctx.db.patch(existing._id, { status, updatedAt: Date.now() });
  },
});