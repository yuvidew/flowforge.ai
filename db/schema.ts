import { pgTable, serial, text, timestamp, integer, varchar, jsonb, boolean, uuid, index } from "drizzle-orm/pg-core";


export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  // Clerk's user id (user_xxx); lets webhooks update/delete the right row even if the email changes.
  clerkId: text("clerk_id").unique(),
  name: text("name"),
  email: text("email").notNull().unique(),
  credits: integer("credits").default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  projectId: varchar("projectId").notNull().unique(),
  projectName: varchar("projectName").notNull(),
  userEmail: varchar("userEmail").notNull(),
  // File name inside public/cover (e.g. "blue.png"), picked randomly at creation; null for older rows.
  coverImage: varchar("coverImage"),
  // Archived boards are hidden from the all-files grid but kept in the DB.
  isArchived: boolean("isArchived").notNull().default(false),
  // Pinned boards are listed first in All Files and on the Favorites page; archiving a board unpins it.
  isPinned: boolean("isPinned").notNull().default(false),
  // When true, anyone with the link can view the board read-only at /view/[projectId].
  isPublished: boolean("isPublished").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const whiteboardData = pgTable("whiteboardData", {
  id: serial("id").primaryKey(),
  projectId: varchar("projectId").notNull().unique().references(() => projects.projectId),
  elements: jsonb("elements"),
  appState: jsonb("appState"),
  files: jsonb("files"),
  // Diagram specs queued by the MCP server; the open workspace converts them to Excalidraw elements and clears them.
  pendingDiagrams: jsonb("pendingDiagrams"),
  // Bumped by every scene write; a writer holding an older version is rejected so nobody overwrites newer work.
  version: integer("version").notNull().default(0),
  // Last poll from an open workspace tab; MCP draws on the server only when this is stale.
  lastSeenAt: timestamp("last_seen_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// One AI chat conversation on a board; a board can have many. Deleted together with the board's messages.
export const chatSessions = pgTable("chatSessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: varchar("projectId").notNull().references(() => projects.projectId, { onDelete: "cascade" }),
  // Owner's email, same ownership key the projects table uses.
  userEmail: varchar("userEmail").notNull(),
  // Starts as the first ~40 characters of the first message; the user can rename it.
  name: varchar("name", { length: 60 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // Bumped on every message so the session list can show the latest conversation first.
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("chat_sessions_project_idx").on(table.projectId, table.userEmail),
]);

// One message of a chat session. The serial id doubles as the ordering and pagination cursor.
export const chatMessages = pgTable("chatMessages", {
  id: serial("id").primaryKey(),
  sessionId: uuid("sessionId").notNull().references(() => chatSessions.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 16 }).notNull().$type<"user" | "assistant">(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("chat_messages_session_idx").on(table.sessionId, table.id),
]);


export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessageRow = typeof chatMessages.$inferSelect;

