// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // This layout is specific to the (auth) group, e.g., /login.
  // It does NOT include AppShell or global auth redirection logic.
  // The page itself (e.g., LoginPage) will define its full-screen styling.
  return <>{children}</>;
}
