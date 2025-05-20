
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp, onSnapshot, FirestoreError } from "firebase/firestore"; // Added FirestoreError
import type { ReactNode } from "react";
import React, { createContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { User as AppUser } from "@/types";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast"; // Import useToast

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
  const [loading, setLoading] = useState(true);
  const { toast } = useToast(); // Initialize useToast

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
        } catch (error: any) {
          console.error("Error fetching user document from Firestore during auth state change:", error);
          if (error instanceof FirestoreError && error.code === 'unavailable') {
            toast({
              title: "Network Issue",
              description: "Could not load user profile. The application may be offline.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: "Failed to load user profile.",
              variant: "destructive",
            });
          }
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [toast]); // Added toast to dependency array

  useEffect(() => {
    if (!firebaseUser?.uid) {
      return;
    }

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUser({ userId: firebaseUser.uid, ...docSnap.data() } as AppUser);
      } else {
        console.warn("User document disappeared from Firestore for UID:", firebaseUser.uid, ". Logging user out.");
        setCurrentUser(null);
      }
    }, (error) => {
      console.error("Error in onSnapshot listener for user document:", error);
      if (error instanceof FirestoreError && error.code === 'unavailable') {
        toast({
          title: "Network Issue",
          description: "Could not sync user profile. The application may be offline.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to sync user profile.",
          variant: "destructive",
        });
      }
      // Potentially set currentUser to null or handle error state if critical
      // setCurrentUser(null); // Uncomment if profile sync failure should log out user
    });

    return () => unsubscribeSnapshot();
  }, [firebaseUser?.uid, toast]); // Added toast to dependency array

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
