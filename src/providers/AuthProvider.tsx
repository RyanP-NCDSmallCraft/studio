
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import type { ReactNode } from "react";
import React, { createContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { User as AppUser } from "@/types";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  currentUser: AppUser | null | undefined; // undefined means loading, null means no user
  firebaseUser: FirebaseUser | null | undefined;
  loading: boolean;
  isAdmin: boolean;
  isRegistrar: boolean;
  isInspector: boolean;
  isSupervisor: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null | undefined>(undefined);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true); // Start true for initial load

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // Set loading to true at the start of any auth state change
      setFirebaseUser(user);
      if (user) {
        // User is signed in, fetch app user profile from Firestore
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setCurrentUser({ userId: user.uid, ...userDocSnap.data() } as AppUser);
          } else {
            // Potentially handle case where user exists in Auth but not Firestore
            console.warn("User document not found in Firestore for UID:", user.uid, "Setting to ReadOnly role.");
            // For scaffolding, let's assume a basic user if not found
            setCurrentUser({
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email?.split('@')[0] || "User",
              role: "ReadOnly", // Default role if not found
              createdAt: Timestamp.now(), // Use Firestore Timestamp
              isActive: true,
            });
          }
        } catch (error) {
            console.error("Error fetching user document from Firestore:", error);
            setCurrentUser(null); // Or handle error more gracefully
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setLoading(false); // Set loading to false after all processing for this auth change is done
    });

    return () => unsubscribe();
  }, []);

  const isAdmin = currentUser?.role === "Admin";
  const isRegistrar = currentUser?.role === "Registrar" || isAdmin;
  const isInspector = currentUser?.role === "Inspector" || isAdmin;
  const isSupervisor = currentUser?.role === "Supervisor" || isAdmin;

  // This initial loading screen is for the very first time the app loads
  // and onAuthStateChanged hasn't fired yet, or is in its initial processing.
  if (currentUser === undefined && loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="sr-only">Loading application...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ currentUser, firebaseUser, loading, isAdmin, isRegistrar, isInspector, isSupervisor }}>
      {children}
    </AuthContext.Provider>
  );
}
