import { integer, real, sqliteTable, text, primaryKey, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    login: text("login").notNull(),
    fullName: text("full_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarKey: text("avatar_key"),
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
  district: text("district"),
  workMode: text("work_mode").notNull().default("onsite"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  urgent: integer("urgent", { mode: "boolean" }).notNull().default(false),
  commissionRate: integer("commission_rate").notNull().default(7),
  createdAt: integer("created_at").notNull(),
  archivedAt: integer("archived_at"),
  deletedAt: integer("deleted_at"),
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

export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => tasks.id),
  reviewerId: text("reviewer_id").notNull().references(() => users.id),
  revieweeId: text("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
}, (table) => ({ uniqueReview: uniqueIndex("reviews_task_reviewer_unique").on(table.taskId, table.reviewerId) }));

export const authLimits = sqliteTable("auth_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: integer("expires_at").notNull(),
});

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull(),
});

export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  purpose: text("purpose").notNull(),
  taskId: text("task_id").references(() => tasks.id, { onDelete: "cascade" }),
  applicationId: text("application_id").references(() => applications.id, { onDelete: "cascade" }),
  mime: text("mime").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => ({ taskIndex: index("media_task_idx").on(t.taskId), ownerIndex: index("media_owner_created_idx").on(t.ownerId, t.createdAt) }));

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  senderId: text("sender_id").notNull().references(() => users.id),
  clientId: text("client_id").notNull(),
  body: text("body").notNull(),
  mediaId: text("media_id").references(() => media.id),
  createdAt: integer("created_at").notNull(),
}, (t) => ({ chatIndex: index("messages_chat_id_idx").on(t.applicationId, t.id), dedup: uniqueIndex("messages_sender_client_idx").on(t.senderId, t.clientId), mediaUnique: uniqueIndex("messages_media_idx").on(t.mediaId) }));

export const chatReads = sqliteTable("chat_reads", {
  applicationId: text("application_id").notNull().references(() => applications.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lastReadId: integer("last_read_id").notNull().default(0),
}, (t) => ({ pk: primaryKey({ columns: [t.applicationId, t.userId] }) }));

export const pushConfig = sqliteTable("push_config", {
  id: integer("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => ({ userIndex: index("push_subscriptions_user_idx").on(t.userId) }));

export const geocodeCache = sqliteTable("geocode_cache", {
  query: text("query").primaryKey(),
  result: text("result").notNull(),
  createdAt: integer("created_at").notNull(),
});
