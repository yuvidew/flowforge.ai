import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Server-side guard for protected pages: sends signed-out visitors to /sign-in, otherwise returns the Clerk auth object.
export const requireAuth = async () => {
  const session = await auth();

  if (!session.userId) {
    redirect("/sign-in");
  }

  return session;
};

// Server-side guard for sign-in/sign-up pages: sends already signed-in users to the home page.
export const requireUnAuth = async () => {
  const { userId } = await auth();

  if (userId) {
    redirect("/");
  }
};
