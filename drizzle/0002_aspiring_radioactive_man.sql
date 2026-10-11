CREATE TABLE "chatMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessionId" uuid NOT NULL,
	"role" varchar(16) NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatSessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"projectId" varchar NOT NULL,
	"userEmail" varchar NOT NULL,
	"name" varchar(60) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "apiKeys" CASCADE;--> statement-breakpoint
ALTER TABLE "chatMessages" ADD CONSTRAINT "chatMessages_sessionId_chatSessions_id_fk" FOREIGN KEY ("sessionId") REFERENCES "public"."chatSessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatSessions" ADD CONSTRAINT "chatSessions_projectId_projects_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("projectId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_session_idx" ON "chatMessages" USING btree ("sessionId","id");--> statement-breakpoint
CREATE INDEX "chat_sessions_project_idx" ON "chatSessions" USING btree ("projectId","userEmail");