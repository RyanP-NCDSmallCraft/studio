
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, Timestamp, onSnapshot, FirestoreError } from "firebase/firestore";
import type { ReactNode } from "react";
import React, { createContext, useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import type { User as AppUser } from "@/types";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();

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
          let errorTitle = "Profile Load Error";
          let errorDescription = "Failed to load user profile.";

          if (error instanceof FirestoreError) {
            if (error.code === 'unavailable') {
              errorTitle = "Network Issue";
              errorDescription = "Could not load user profile. The application may be offline.";
            } else if (error.code === 'permission-denied') {
              errorDescription = "Failed to load user profile due to insufficient permissions. Please check Firestore security rules.";
            }
          }
          
          toast({
            title: errorTitle,
            description: errorDescription,
            variant: "destructive",
          });
          setCurrentUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [toast]);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      return;
    }

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setCurrentUser({ userId: firebaseUser.uid, ...docSnap.data() } as AppUser);
      } else {
        console.warn("User document disappeared from Firestore for UID:", firebaseUser.uid, ". Logging user out or setting to null.");
        setCurrentUser(null); // User document no longer exists
      }
    }, (error) => {
      console.error("Error in onSnapshot listener for user document:", error);
      let errorTitle = "Profile Sync Error";
      let errorDescription = "Failed to sync user profile.";
      if (error instanceof FirestoreError) {
        if (error.code === 'unavailable') {
          errorTitle = "Network Issue";
          errorDescription = "Could not sync user profile. The application may be offline.";
        } else if (error.code === 'permission-denied') {
          errorDescription = "Profile sync failed due to insufficient permissions. Rules may have changed.";
        }
      }
      toast({
        title: errorTitle,
        description: errorDescription,
        variant: "destructive",
      });
      // Optionally, set currentUser to null if profile sync is critical and fails
      // setCurrentUser(null); 
    });

    return () => unsubscribeSnapshot();
  }, [firebaseUser?.uid, toast]);

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
