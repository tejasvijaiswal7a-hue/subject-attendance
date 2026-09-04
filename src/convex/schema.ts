import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
      group: v.optional(v.union(v.literal("A"), v.literal("B"))), // student group, chosen at first sign-in
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // Fixed set of subjects students mark attendance for.
    subjects: defineTable({
      name: v.string(), // readable subject name, e.g. "Engineering Physics"
      code: v.string(), // class code as printed on the timetable, e.g. "L/PHY1001/STM"
      category: v.string(), // Lecture | Lab | Tutorial | Sessions
      order: v.number(), // display order within the timetable
    }).index("by_order", ["order"]),

    // One row per student, subject, and day.
    attendance: defineTable({
      userId: v.id("users"),
      subjectId: v.id("subjects"),
      date: v.string(), // local date as YYYY-MM-DD
      status: v.union(v.literal("present"), v.literal("absent")),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_subject", ["userId", "subjectId"])
      .index("by_user_date", ["userId", "date"])
      .index("by_user_subject_date", ["userId", "subjectId", "date"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
