CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" varchar NOT NULL,
	"projectName" varchar NOT NULL,
	"userEmail" varchar NOT NULL,
	"coverImage" varchar,
	"isArchived" boolean DEFAULT false NOT NULL,
	"isPublished" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "projects_projectId_unique" UNIQUE("projectId")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_id" text,
	"name" text,
	"email" text NOT NULL,
	"credits" integer DEFAULT 3,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whiteboardData" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" varchar NOT NULL,
	"elements" jsonb,
	"appState" jsonb,
	"files" jsonb,
	"pendingDiagrams" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "whiteboardData_projectId_unique" UNIQUE("projectId")
);
--> statement-breakpoint
ALTER TABLE "whiteboardData" ADD CONSTRAINT "whiteboardData_projectId_projects_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("projectId") ON DELETE no action ON UPDATE no action;