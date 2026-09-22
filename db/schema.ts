import { integer, real, sqliteTable, text, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    login: text("login").notNull(),
    fullName: text("full_name").notNull(),
    passwordHash: text("password_hash").notNull(),
    salt: text("salt").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({ loginUnique: uniqueIndex("users_login_unique").on(table.login) }),
);

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  tokenHash: text("token_hash").notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  price: integer("price").notNull(),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  urgent: integer("urgent", { mode: "boolean" }).notNull().default(false),
  commissionRate: integer("commission_rate").notNull().default(7),
  createdAt: integer("created_at").notNull(),
});

export const favorites = sqliteTable(
  "favorites",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({ pk: primaryKey({ columns: [table.userId, table.taskId] }) }),
);

export const applications = sqliteTable(
  "applications",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    applicantId: text("applicant_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    status: text("status").notNull().default("new"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => ({ applicantTaskUnique: uniqueIndex("applications_task_applicant_unique").on(table.taskId, table.applicantId) }),
);
