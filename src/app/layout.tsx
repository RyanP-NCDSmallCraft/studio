
"use client"; 

import type { Metadata } from "next"; // Keep for potential static metadata if needed elsewhere
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/providers/AuthProvider";
import { Toaster } from "@/components/ui/toaster";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: 'swap' });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: 'swap' });

// export const metadata: Metadata = { // Static metadata example
//   title: "RegoCraft",
//   description: "Small Craft Registration and Inspection System",
// };


function AppContent({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    console.log(`AppContent Effect: Pathname='${pathname}', Loading=${loading}, CurrentUser Exists=${!!currentUser}, CurrentUser Active=${currentUser?.isActive}`);
    if (!loading) {
      if (pathname === "/login") {
        if (currentUser && currentUser.isActive) {
          console.log("AppContent: User on /login but already logged in and active. Redirecting to /dashboard.");
          router.replace("/dashboard");
        }
        // If on /login and not (currentUser && currentUser.isActive), stay on /login.
      } else { // For all other paths NOT /login
        if (!currentUser) {
          console.log("AppContent: No current user, and not on /login. Redirecting to /login.");
          router.replace("/login");
        } else if (currentUser && !currentUser.isActive) {
          console.log("AppContent: User exists but is not active. Redirecting to /login.");
          router.replace("/login");
        }
        // If currentUser exists and is active, and not on /login, stay on the current page.
      }
    }
  }, [currentUser, loading, router, pathname]);

  if (loading && currentUser === undefined) { // Only show full page loader if auth state is truly undetermined
    console.log("AppContent: Auth loading and currentUser is undefined. Showing full page loader.");
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="sr-only">Loading application...</p>
      </div>
    );
  }

  // For /login page, render children directly without AppShell
  if (pathname === "/login") {
    // If loading but currentUser is already known (e.g. null), we might still be on login page briefly.
    // The useEffect will handle redirection if necessary.
    console.log("AppContent: Rendering children directly for /login path.");
    return <>{children}</>;
  }

  // For authenticated routes, if still loading but currentUser is just null (not yet determined if valid profile exists),
  // show a loader. The useEffect will redirect if user remains null.
  if (loading && !currentUser && pathname !== "/login") {
    console.log("AppContent: Loading and no currentUser on protected route. Showing loader.");
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="sr-only">Verifying session...</p>
      </div>
    );
  }
  
  // If there's no current user (and not loading) AND we are not on /login, this state means redirect is imminent
  // or has failed. Return minimal loader to avoid flashing content before redirect.
  if (!currentUser && !loading && pathname !== "/login") {
    console.log("AppContent: No currentUser, not loading, not on /login. Expecting redirect. Rendering loader.");
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="sr-only">Redirecting...</p>
      </div>
    );
  }
  
  // If currentUser exists and is active, and we are not on /login, wrap children with AppShell
  if (currentUser && currentUser.isActive && pathname !== "/login") {
    console.log(`AppContent: Rendering AppShell for UID: ${currentUser.userId}.`);
    return <AppShell>{children}</AppShell>;
  }
  
  // Fallback: This case should ideally be covered by logic above (e.g. user is null, inactive on a protected route, or on login page)
  // Render children directly if none of the above conditions met (e.g., user is null and we're on login page, or some other edge case)
  console.log("AppContent: Fallback rendering. Pathname:", pathname);
  return <>{children}</>;
}


export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans`}>
        <AuthProvider>
          <AppContent>{children}</AppContent>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

    