
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp, onSnapshot } from "firebase/firestore"; // Added onSnapshot
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
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true); 
      setFirebaseUser(user);
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setCurrentUser({ userId: user.uid, ...userDocSnap.data() } as AppUser);
          } else {
            console.warn("User document not found in Firestore for UID:", user.uid, "Setting to ReadOnly role.");
            setCurrentUser({
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email?.split('@')[0] || "User",
              role: "ReadOnly", 
              createdAt: Timestamp.now(),
              isActive: true,
            });
          }
        } catch (error) {
            console.error("Error fetching user document from Firestore during auth state change:", error);
            setCurrentUser(null); 
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false); 
    });

    return () => unsubscribeAuth();
  }, []);

  // New useEffect for Firestore onSnapshot listener
  useEffect(() => {
    if (!firebaseUser?.uid) {
      // No authenticated user, so no listener needed, or cleanup if user logs out
      return;
    }

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        console.log("Live user doc update (onSnapshot):", docSnap.data());
        setCurrentUser({ userId: firebaseUser.uid, ...docSnap.data() } as AppUser);
      } else {
        // User document was deleted from Firestore
        console.warn("User document disappeared from Firestore for UID:", firebaseUser.uid, ". Logging user out.");
        setCurrentUser(null); // This will trigger logout flow via MainLayout
      }
    }, (error) => {
      console.error("Error in onSnapshot listener for user document:", error);
      // Potentially set currentUser to null or handle error state
      setCurrentUser(null);
    });

    // Cleanup function to unsubscribe from the snapshot listener
    return () => unsubscribeSnapshot();
  }, [firebaseUser?.uid]); // Re-run this effect if the firebaseUser.uid changes

  const isAdmin = currentUser?.role === "Admin";
  const isRegistrar = currentUser?.role === "Registrar" || isAdmin;
  const isInspector = currentUser?.role === "Inspector" || isAdmin;
  const isSupervisor = currentUser?.role === "Supervisor" || isAdmin;

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
