CREATE TABLE "apiKeys" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"userEmail" varchar NOT NULL,
	"keyHash" varchar NOT NULL,
	"keyPrefix" varchar NOT NULL,
	"lastUsedAt" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "apiKeys_keyHash_unique" UNIQUE("keyHash")
);
