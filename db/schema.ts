import { pgTable, serial, text, timestamp, integer, varchar, jsonb, boolean } from "drizzle-orm/pg-core";

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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),

});




export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
