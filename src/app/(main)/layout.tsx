
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
    console.log(`MainLayout Effect: loading=${loading}, currentUser.userId=${currentUser?.userId}, currentUser.isActive=${currentUser?.isActive}`);
    if (!loading && !currentUser) {
      console.log("MainLayout Effect: NOT loading and NO currentUser. Redirecting to /login.");
      router.replace("/login");
    } else if (!loading && currentUser && currentUser.isActive === false) {
      console.log("MainLayout Effect: User is NOT active. Redirecting to /login.");
      router.replace("/login"); // Also redirect if user profile loaded but is inactive
    } else if (loading) {
      console.log("MainLayout Effect: STILL loading. No redirect decision yet from effect.");
    } else if (!loading && currentUser && currentUser.isActive === true) {
      console.log(`MainLayout Effect: NOT loading and ACTIVE currentUser IS present (UID: ${currentUser.userId}). No redirect needed from effect.`);
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

  if (!currentUser) {
    console.log("MainLayout Render: 'loading' is false, but 'currentUser' is still null/undefined. Rendering loading spinner (expecting redirect from effect).");
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="sr-only">Waiting for redirection...</p>
      </div>
    );
  }
  
  if (currentUser.isActive === false) {
     console.log("MainLayout Render: 'currentUser' exists but is NOT active. Rendering loading spinner (expecting redirect from effect).");
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
         <p className="sr-only">Waiting for redirection due to inactive account...</p>
      </div>
    );
  }


  console.log(`MainLayout Render: 'loading' is false and ACTIVE 'currentUser' IS present (UID: ${currentUser.userId}). Rendering AppShell.`);
  return <AppShell>{children}</AppShell>;
}
