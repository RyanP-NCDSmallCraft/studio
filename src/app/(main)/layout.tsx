
"use client";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function MainLayout({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log(`MainLayout Effect: loading: ${loading}, currentUser: ${!!currentUser} (ID: ${currentUser?.userId || 'N/A'})`);
    if (!loading && !currentUser) {
      console.log("MainLayout Effect: NOT loading and NO currentUser. Redirecting to /login.");
      router.replace("/login");
    } else if (!loading && currentUser) {
      console.log(`MainLayout Effect: NOT loading and currentUser IS present (UID: ${currentUser.userId}). No redirect needed from effect.`);
    } else if (loading) {
      console.log("MainLayout Effect: STILL loading. No redirect decision yet from effect.");
    }
  }, [currentUser, loading, router]);

  if (loading) {
    console.log("MainLayout Render: 'loading' is true. Rendering loading spinner.");
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="sr-only">Loading application data...</p>
      </div>
    );
  }

  // After loading is false, we check currentUser again
  if (!currentUser) {
    // This case should ideally be caught by the useEffect redirect,
    // but it acts as a fallback to prevent rendering AppShell if currentUser is null.
    console.log("MainLayout Render: 'loading' is false, but 'currentUser' is still null/undefined. Rendering loading spinner (expecting redirect from effect).");
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="sr-only">Waiting for redirection...</p>
      </div>
    );
  }

  console.log(`MainLayout Render: 'loading' is false and 'currentUser' IS present (UID: ${currentUser.userId}). Rendering AppShell.`);
  return <AppShell>{children}</AppShell>;
}

    