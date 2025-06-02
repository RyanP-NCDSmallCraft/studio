// src/app/layout.tsx
"use client"; 

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

// This component now houses the logic previously in (main)/layout.tsx
function MainAppLayoutContent({ children }: { children: ReactNode }) {
    const { currentUser, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // console.log(`MainAppLayoutContent Effect: loading=${loading}, currentUser.userId=${currentUser?.userId}, isActive=${currentUser?.isActive}`);
        if (!loading && !currentUser) {
            // console.log("MainAppLayoutContent: No user, redirecting to /login.");
            router.replace("/login");
        } else if (!loading && currentUser && !currentUser.isActive) {
            // console.log("MainAppLayoutContent: User inactive, redirecting to /login.");
            router.replace("/login");
        }
    }, [currentUser, loading, router]);

    if (loading && currentUser === undefined) { // Only show global loader if auth is truly loading and currentUser is not yet determined
        // console.log("MainAppLayoutContent: 'loading' is true and currentUser is undefined. Rendering loading spinner.");
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="sr-only">Loading application data...</p>
            </div>
        );
    }

    if (!currentUser || !currentUser.isActive) {
        // console.log("MainAppLayoutContent: Not authenticated or not active (currentUser might be null or undefined). Expecting redirect soon.");
        // This state will be brief as the useEffect above will trigger a redirect.
        // Render a minimal loader or nothing to avoid flashing AppShell if user is immediately redirected.
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="sr-only">Redirecting...</p>
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
          {/* 
            Next.js route groups determine layout application.
            - Routes under /src/app/(auth)/ will use src/app/(auth)/layout.tsx.
            - All other routes not in a group with its own layout will use this RootLayout,
              and thus MainAppLayoutContent which includes AppShell and auth checks.
          */}
          <MainAppLayoutContent>{children}</MainAppLayoutContent>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
