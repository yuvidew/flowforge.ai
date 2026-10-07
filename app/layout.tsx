import { ClerkProvider } from '@clerk/nextjs';
import "./globals.css";
import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toast";
import RoolLayoutProvider from '@/components/providers/root-layout-provider';

// App-wide sans font; exposed as --font-sans so Tailwind's `font-sans` picks it up.
const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "FlowForge AI – AI Diagram & Whiteboard Maker",
  description: "Describe an idea and FlowForge AI draws flowcharts, architecture diagrams and wireframes on a collaborative whiteboard.",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <ClerkProvider>
      <html lang="en" className={figtree.variable} suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <RoolLayoutProvider>
              <QueryProvider>
                <Toaster>{children}</Toaster>
              </QueryProvider>
            </RoolLayoutProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
