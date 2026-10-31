CREATE TABLE "boardCollaborators" (
	"id" serial PRIMARY KEY NOT NULL,
	"projectId" varchar NOT NULL,
	"email" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boardCollaborators" ADD CONSTRAINT "boardCollaborators_projectId_projects_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("projectId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "board_collaborators_project_email_idx" ON "boardCollaborators" USING btree ("projectId","email");--> statement-breakpoint
CREATE INDEX "board_collaborators_email_idx" ON "boardCollaborators" USING btree ("email");