
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
  const [loading, setLoading] = useState(true); // Initial state is true until first auth check completes
  const { toast } = useToast();

  useEffect(() => {
    console.log("AuthProvider: Mounting and setting up onAuthStateChanged listener.");
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true); // SET LOADING TRUE IMMEDIATELY upon any auth state change detection
      console.log(`AuthProvider onAuthStateChanged: Triggered. User UID: ${user?.uid || 'null'}. Set loading to true.`);

      setFirebaseUser(user);

      if (user) {
        console.log(`AuthProvider onAuthStateChanged: User authenticated (UID: ${user.uid}). Fetching Firestore document...`);
        const userDocRef = doc(db, "users", user.uid);
        let loadedUserProfile: AppUser | null = null;
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            loadedUserProfile = { userId: user.uid, ...userDocSnap.data() } as AppUser;
            console.log(`AuthProvider onAuthStateChanged: User document for ${user.uid} exists. Profile loaded (Role: ${loadedUserProfile?.role}).`);
          } else {
            console.warn(`AuthProvider onAuthStateChanged: User document for ${user.uid} NOT found. Creating default ReadOnly profile.`);
            // This is a fallback. In a real app, user creation/role assignment should be a more robust process.
            loadedUserProfile = {
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email?.split('@')[0] || "User",
              role: "ReadOnly", // Default to least privileged role
              createdAt: Timestamp.now(),
              isActive: true, // Assume active unless specified otherwise
            };
            console.log(`AuthProvider onAuthStateChanged: Default ReadOnly profile created for ${user.uid}.`);
          }
        } catch (error: any) {
          console.error(`AuthProvider onAuthStateChanged: Error fetching user document for ${user.uid}: Code: ${error.code}, Message: ${error.message}`);
          let errorTitle = "Profile Load Error";
          let errorDescription = "Failed to load user profile.";

          if (error instanceof FirestoreError) {
            if (error.code === 'unavailable') {
              errorTitle = "Network Issue";
              errorDescription = "Could not load user profile. The application may be offline.";
            } else if (error.code === 'permission-denied') {
              errorTitle = "Permission Denied";
              errorDescription = "Failed to load user profile due to insufficient Firestore permissions. Please check security rules for the 'users' collection.";
            }
          }
          toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
          loadedUserProfile = null; // Ensure it's null on error
        } finally {
          setCurrentUser(loadedUserProfile);
          setLoading(false);
          console.log(`AuthProvider onAuthStateChanged: Finished processing for ${user?.uid || 'null'}. Set currentUser to ${loadedUserProfile ? `User (Role: ${loadedUserProfile.role})` : 'null'}. Set loading to false.`);
        }
      } else {
        console.log("AuthProvider onAuthStateChanged: No user authenticated or user logged out.");
        setCurrentUser(null);
        // firebaseUser is already set to null by setFirebaseUser(user) above
        setLoading(false);
        console.log("AuthProvider onAuthStateChanged: Set currentUser to null, loading to false.");
      }
    });

    return () => {
      console.log("AuthProvider: Unmounting, cleaning up onAuthStateChanged listener.");
      unsubscribeAuth();
    };
  }, [toast]);


  useEffect(() => {
    if (!firebaseUser?.uid) {
      // console.log("AuthProvider (onSnapshot effect): No firebaseUser.uid, skipping or cleaning up snapshot listener.");
      return;
    }
    console.log(`AuthProvider (onSnapshot effect): firebaseUser.uid found (${firebaseUser.uid}). Setting up snapshot listener for user profile updates.`);

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      console.log(`AuthProvider (onSnapshot): Snapshot received for user: ${firebaseUser.uid}`);
      if (docSnap.exists()) {
        const newProfileData = { userId: firebaseUser.uid, ...docSnap.data() } as AppUser;
        console.log(`AuthProvider (onSnapshot): User document exists. New profile data (Role: ${newProfileData?.role}).`);
        setCurrentUser(newProfileData);
      } else {
        // This case means the user's document was deleted from Firestore while they were logged in.
        // This could be a valid scenario (admin deletes user) or an error.
        console.warn(`AuthProvider (onSnapshot): User document NO LONGER exists in Firestore for UID: ${firebaseUser.uid}. Setting currentUser to null.`);
        setCurrentUser(null); // Effectively logs the user out of the app's protected state
        toast({
          title: "Profile Unavailable",
          description: "Your user profile could not be found. You may need to log in again or contact support.",
          variant: "destructive",
        });
      }
    }, (error) => {
      console.error(`AuthProvider (onSnapshot): Firestore snapshot error for user ${firebaseUser.uid}: Code: ${error.code}, Message: ${error.message}`);
      let errorTitle = "Profile Sync Error";
      let errorDescription = "Failed to sync user profile in real-time.";
      if (error instanceof FirestoreError) {
        if (error.code === 'unavailable') {
          errorTitle = "Network Issue";
          errorDescription = "Could not sync user profile. The application may be offline.";
        } else if (error.code === 'permission-denied') {
          errorDescription = "Profile sync failed due to insufficient permissions. Firestore rules may have changed for the 'users' collection.";
        }
      }
      toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
      // Decide if we should set currentUser to null here.
      // If the snapshot fails, it might be temporary. Forcing logout might be too aggressive.
      // But if permissions are denied, the current profile might be stale/incorrect.
      // For now, let's keep the existing currentUser data but notify about the sync issue.
      // If persistent 'permission-denied', the user might get an old role until next full login.
    });

    return () => {
      console.log(`AuthProvider (onSnapshot effect): Cleaning up snapshot listener for user: ${firebaseUser.uid}`);
      unsubscribeSnapshot();
    };
  }, [firebaseUser?.uid, toast]); // firebaseUser.uid ensures this runs when the UID changes

  const isAdmin = currentUser?.role === "Admin";
  const isRegistrar = currentUser?.role === "Registrar" || isAdmin;
  const isInspector = currentUser?.role === "Inspector" || isAdmin;
  const isSupervisor = currentUser?.role === "Supervisor" || isAdmin;

  // This initial loading screen is for the very first load of the AuthProvider
  if (currentUser === undefined && loading) {
    console.log("AuthProvider Render: Initial load - currentUser is undefined, loading is true. Showing global spinner.");
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

    