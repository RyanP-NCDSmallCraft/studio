// src/app/layout.tsx
"use client"; // This was in the original (main)/layout.tsx

// Imports from original root layout & (main)/layout
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: 'swap' });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: 'swap' });

// Note: Static metadata export might be problematic if "use client" is at the very top.
// Consider component-level metadata or moving this to a server component part if needed.
// For now, commenting out to avoid issues with "use client" at root layout.
// export const metadata: Metadata = {
//   title: "RegoCraft",
//   description: "Small Craft Registration and Inspection System",
// };

// This component now houses the logic previously in (main)/layout.tsx
function MainAppLayoutContent({ children }: { children: ReactNode }) {
    const { currentUser, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // console.log(`MainAppLayoutContent Effect: loading=${loading}, currentUser.userId=${currentUser?.userId}, isActive=${currentUser?.isActive}`);
        // This logic applies to all routes *not* covered by a more specific layout like (auth)/layout.tsx
        if (!loading && !currentUser) {
            // console.log("MainAppLayoutContent: No user, redirecting to /login.");
            router.replace("/login");
        } else if (!loading && currentUser && !currentUser.isActive) {
            // console.log("MainAppLayoutContent: User inactive, redirecting to /login.");
            router.replace("/login");
        }
    }, [currentUser, loading, router]);

    if (loading) {
        // console.log("MainAppLayoutContent: 'loading' is true. Rendering loading spinner.");
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="sr-only">Loading application data...</p>
            </div>
        );
    }

    if (!currentUser || !currentUser.isActive) {
        // console.log("MainAppLayoutContent: Not authenticated or not active. Rendering loading spinner (expecting redirect).");
        // This state will be brief as the useEffect above will trigger a redirect.
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="sr-only">Waiting for redirection...</p>
            </div>
        );
    }

    // console.log(`MainAppLayoutContent: Rendering AppShell for UID: ${currentUser.userId}.`);
    return <AppShell>{children}</AppShell>;
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
        <AuthProvider>
          {/* Next.js uses src/app/(auth)/layout.tsx for /login due to route group hierarchy.
              For other routes, MainAppLayoutContent (which includes AppShell) will render. */}
          <MainAppLayoutContent>{children}</MainAppLayoutContent>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}