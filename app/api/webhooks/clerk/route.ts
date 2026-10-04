import { db, users } from "@/db";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

// Receives Clerk webhooks and mirrors user create/update/delete events into the Neon `users` table.
export const POST = async (req: NextRequest) => {
  try {
    // Verifies the Svix signature using CLERK_WEBHOOK_SIGNING_SECRET; throws if invalid.
    const evt = await verifyWebhook(req);

    if (evt.type === "user.created" || evt.type === "user.updated") {
      const { id, first_name, last_name, email_addresses, primary_email_address_id } = evt.data;

      const email = (
        email_addresses.find((e) => e.id === primary_email_address_id) ?? email_addresses[0]
      )?.email_address;
      if (!email) {
        return NextResponse.json({ error: "User has no email address" }, { status: 400 });
      }

      const name = [first_name, last_name].filter(Boolean).join(" ") || null;

      // Known user (matched by Clerk id): just refresh name/email.
      const updated = await db
        .update(users)
        .set({ name, email })
        .where(eq(users.clerkId, id))
        .returning();

      // New user, or a row created earlier by /api/users without a clerkId: insert, or attach the id by email.
      if (updated.length === 0) {
        await db
          .insert(users)
          .values({ clerkId: id, name, email })
          .onConflictDoUpdate({ target: users.email, set: { clerkId: id, name } });
      }
    }

    if (evt.type === "user.deleted" && evt.data.id) {
      await db.delete(users).where(eq(users.clerkId, evt.data.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Clerk webhook failed:", error);
    return NextResponse.json({ error: "Webhook verification or processing failed" }, { status: 400 });
  }
};
