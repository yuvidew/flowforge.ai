ALTER TABLE "whiteboardData" ADD COLUMN "version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "whiteboardData" ADD COLUMN "last_seen_at" timestamp;