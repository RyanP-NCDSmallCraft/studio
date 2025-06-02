
// src/app/(auth)/layout.tsx
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  // This layout is specific to the (auth) group (e.g., /login).
  // It does NOT include AppShell or global auth redirection logic.
  // The root layout's AppContent component will decide whether to render AppShell
  // or just the children based on the path and authentication state.
  // For /login, AppContent will render children directly.
  return <>{children}</>;
}

    