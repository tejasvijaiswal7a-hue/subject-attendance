import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./users";

/** Default subject list for Heritage Institute of Technology students. */
const DEFAULT_SUBJECTS: {
  name: string;
  code: string;
  section: string;
  order: number;
}[] = [
  // Section A
  { name: "Data Structures", code: "CS 401", section: "Section A", order: 0 },
  { name: "Formal Language & Automata Theory", code: "CS 402", section: "Section A", order: 1 },
  { name: "Design & Analysis of Algorithms", code: "CS 403", section: "Section A", order: 2 },
  { name: "Computer Organization", code: "CS 404", section: "Section A", order: 3 },
  { name: "Object Oriented Programming", code: "CS 405", section: "Section A", order: 4 },
  { name: "Discrete Mathematics", code: "M(CS) 402", section: "Section A", order: 5 },
  // Section B
  { name: "Operating Systems", code: "CS 501", section: "Section B", order: 0 },
  { name: "Computer Networks", code: "CS 502", section: "Section B", order: 1 },
  { name: "Database Management Systems", code: "CS 503", section: "Section B", order: 2 },
  { name: "Software Engineering", code: "CS 504", section: "Section B", order: 3 },
  { name: "Theory of Computation", code: "CS 505", section: "Section B", order: 4 },
  { name: "Numerical Methods", code: "M(CS) 501", section: "Section B", order: 5 },
];

/** Insert the default subjects once, on first app load. Idempotent. */
export const ensureDefaultSubjects = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      throw new Error("Not signed in");
    }
    const existing = await ctx.db.query("subjects").first();
    if (existing !== null) {
      return;
    }
    for (const subject of DEFAULT_SUBJECTS) {
      await ctx.db.insert("subjects", subject);
    }
  },
});

/** Subjects with today's status and lifetime stats for the signed-in user. */
export const dashboard = query({
  args: { date: v.string() },
  handler: async (ctx, { date }) => {
    const user = await getCurrentUser(ctx);
    if (user === null) {
      return null;
    }

    const subjects = await ctx.db.query("subjects").withIndex("by_order").collect();
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const todayStatus = new Map<string, "present" | "absent">();
    const stats = new Map<string, { present: number; total: number }>();
    for (const record of records) {
      const subjectStats = stats.get(record.subjectId) ?? { present: 0, total: 0 };
      subjectStats.total += 1;
      if (record.status === "present") {
        subjectStats.present += 1;
      }
      stats.set(record.subjectId, subjectStats);
      if (record.date === date) {
        todayStatus.set(record.subjectId, record.status);
      }
    }

    return {
      subjects: subjects.map((subject) => ({
        _id: subject._id,
        name: subject.name,
        code: subject.code,
        section: subject.section,
        todayStatus: todayStatus.get(subject._id) ?? null,
        present: stats.get(subject._id)?.present ?? 0,
        total: stats.get(subject._id)?.total ?? 0,
      })),
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