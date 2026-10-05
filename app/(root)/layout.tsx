import { auth } from "@clerk/nextjs/server"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ModeToggle } from "@/components/mode-toggle";
import { UserButton } from "@clerk/nextjs";

// Mirrors the check in proxy.ts — lets local dev run without Clerk keys
// configured instead of auth() throwing.
const isClerkConfigured =
  !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
  !!process.env.CLERK_SECRET_KEY;

/**
 * @component DashboardLayout
 * @description Shared shell (sidebar + main) for every signed-in route —
 * dashboard, agents, plugins, and runs all render through this layout, so
 * gating access here protects all four without needing path matching in
 * proxy.ts. Redirects to sign-in before rendering anything if there's no
 * active session.
 */
const DashboardLayout = async ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  if (isClerkConfigured) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) return redirectToSignIn();
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center justify-end gap-3">
            <ModeToggle/>
            <UserButton/>
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col">
         {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default DashboardLayout