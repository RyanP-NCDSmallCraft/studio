
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, Timestamp, onSnapshot, FirestoreError } from "firebase/firestore";
import type { ReactNode } from "react";
import React, { createContext, useEffect, useState, useContext, useRef, useCallback } from "react";
import { auth, db } from "@/lib/firebase";
import type { User as AppUser } from "@/types";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  currentUser: AppUser | null | undefined;
  firebaseUser: FirebaseUser | null | undefined;
  loading: boolean;
  isAdmin: boolean;
  isRegistrar: boolean;
  isInspector: boolean;
  isSupervisor: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds
// const INACTIVITY_TIMEOUT_DURATION = 20 * 1000; // For testing: 20 seconds

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null | undefined>(undefined);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const inactivityTimerIdRef = useRef<NodeJS.Timeout | null>(null);

  const logoutUserAndNotify = useCallback(async () => {
    console.log('AuthProvider: Inactivity timer FIRED. Attempting to log out...');
    // Clear the ref immediately, as the timer has fired.
    if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current); // Should be redundant but safe
        inactivityTimerIdRef.current = null;
    }
    try {
      await signOut(auth);
      // onAuthStateChanged will handle setting firebaseUser and currentUser to null.
      toast({
        title: "Session Expired",
        description: "You have been logged out due to inactivity.",
      });
      console.log('AuthProvider: signOut successful after inactivity.');
    } catch (error) {
      console.error("AuthProvider: Error during inactivity logout:", error);
      toast({
        title: "Logout Error",
        description: "An error occurred while logging out due to inactivity.",
        variant: "destructive",
      });
    }
  }, [toast]); // auth is stable from lib/firebase

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerIdRef.current) {
    //   console.log(`AuthProvider: Clearing previous inactivity timer ID: ${inactivityTimerIdRef.current}`);
      clearTimeout(inactivityTimerIdRef.current);
    }
    const newTimerId = setTimeout(logoutUserAndNotify, INACTIVITY_TIMEOUT_DURATION);
    inactivityTimerIdRef.current = newTimerId;
    // console.log(`AuthProvider: Set new inactivity timer ID: ${newTimerId} for ${INACTIVITY_TIMEOUT_DURATION / 1000}s`);
  }, [logoutUserAndNotify]);

  useEffect(() => {
    // console.log("AuthProvider: Inactivity useEffect running. firebaseUser UID:", firebaseUser?.uid || "null");
    if (firebaseUser) {
    //   console.log(`AuthProvider: User ${firebaseUser.uid} authenticated. Setting up inactivity listeners and timer.`);
      const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'visibilitychange'];
      
      const handleActivity = (event: Event) => {
        if (event.type === 'visibilitychange' && document.hidden) {
        //   console.log('AuthProvider: Tab became hidden. Timer continues, not resetting on this event.');
          return; 
        }
        // console.log(`AuthProvider: User activity detected (${event.type}) for user ${firebaseUser.uid}. Resetting timer.`);
        resetInactivityTimer();
      };

      activityEvents.forEach(event => window.addEventListener(event, handleActivity, { capture: true, passive: true }));
      resetInactivityTimer(); // Start the timer initially

      return () => {
        // console.log(`AuthProvider: Cleanup for inactivity listeners and timer for user ${firebaseUser?.uid || 'previous user'}. Current timer ID: ${inactivityTimerIdRef.current}`);
        activityEvents.forEach(event => window.removeEventListener(event, handleActivity, { capture: true }));
        if (inactivityTimerIdRef.current) {
        //   console.log(`AuthProvider: Clearing timer ID ${inactivityTimerIdRef.current} during effect cleanup for user ${firebaseUser?.uid}.`);
          clearTimeout(inactivityTimerIdRef.current);
          inactivityTimerIdRef.current = null;
        }
      };
    } else {
    //   console.log('AuthProvider: No authenticated user. Ensuring inactivity timer (if any) is cleared. Current ID:', inactivityTimerIdRef.current);
      if (inactivityTimerIdRef.current) {
        // console.log(`AuthProvider: Clearing timer ID ${inactivityTimerIdRef.current} because no user is authenticated.`);
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
      }
    }
  }, [firebaseUser, resetInactivityTimer]); // resetInactivityTimer is stable if its deps are stable


  useEffect(() => {
    // console.log("AuthProvider: Setting up onAuthStateChanged listener.");
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // console.log(`AuthProvider onAuthStateChanged: User state changed. New user UID: ${user?.uid || 'null'}. Setting loading to true.`);
      setLoading(true); 
      setFirebaseUser(user); // This is important to trigger the inactivity timer useEffect

      if (user) {
        // console.log(`AuthProvider onAuthStateChanged: User authenticated (UID: ${user.uid}). Fetching Firestore document...`);
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userProfile = { userId: user.uid, ...userDocSnap.data() } as AppUser;
            setCurrentUser(userProfile);
            // console.log(`AuthProvider onAuthStateChanged: User document for ${user.uid} exists. Profile loaded (Role: ${userProfile?.role}).`);
          } else {
            console.warn(`AuthProvider onAuthStateChanged: User document for ${user.uid} NOT found. Creating default ReadOnly profile.`);
            setCurrentUser({
              userId: user.uid,
              email: user.email || "",
              displayName: user.displayName || user.email?.split('@')[0] || "User",
              role: "ReadOnly",
              createdAt: Timestamp.now(),
              isActive: true,
            });
            // Potentially try to create this default user doc in Firestore here if desired
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
          setCurrentUser(null); // Ensure user is not considered logged in for app purposes
        } finally {
          setLoading(false);
          // console.log(`AuthProvider onAuthStateChanged: Finished processing for ${user?.uid || 'null'}. Set loading to false.`);
        }
      } else {
        // console.log("AuthProvider onAuthStateChanged: No user authenticated or user logged out.");
        setCurrentUser(null);
        setLoading(false);
        // console.log("AuthProvider onAuthStateChanged: Set currentUser to null, loading to false.");
      }
    });

    return () => {
    //   console.log("AuthProvider: Unmounting, cleaning up onAuthStateChanged listener.");
      unsubscribeAuth();
      if (inactivityTimerIdRef.current) { 
        // console.log(`AuthProvider: Clearing timer ID ${inactivityTimerIdRef.current} during AuthProvider unmount.`);
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
      }
    };
  }, [toast]); // toast hook should be stable

  useEffect(() => {
    if (!firebaseUser?.uid) {
    //   console.log("AuthProvider (snapshot effect): firebaseUser.uid is null/undefined. Skipping snapshot listener setup.");
      return;
    }
    // console.log(`AuthProvider (snapshot effect): firebaseUser.uid found (${firebaseUser.uid}). Setting up snapshot listener for user profile updates.`);

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
    //   console.log(`AuthProvider (onSnapshot): Snapshot received for user: ${firebaseUser.uid}. Document exists: ${docSnap.exists()}`);
      if (docSnap.exists()) {
        const newProfileData = { userId: firebaseUser.uid, ...docSnap.data() } as AppUser;
        // console.log(`AuthProvider (onSnapshot): User document exists. New profile data (Role: ${newProfileData?.role}). Current role: ${currentUser?.role}`);
        setCurrentUser(prevUser => {
          if (JSON.stringify(prevUser) !== JSON.stringify(newProfileData)) {
            // console.log("AuthProvider (onSnapshot): Profile data has changed, updating currentUser state.");
            return newProfileData;
          }
          // console.log("AuthProvider (onSnapshot): Profile data is the same as current, no update to currentUser state needed.");
          return prevUser;
        });
      } else {
        console.warn(`AuthProvider (onSnapshot): User document NO LONGER exists in Firestore for UID: ${firebaseUser.uid}. Setting currentUser to null and attempting logout.`);
        setCurrentUser(null); 
        signOut(auth).catch(err => console.error("AuthProvider (onSnapshot): Error signing out after profile deletion:", err));
        toast({
          title: "Profile Sync Issue",
          description: "Your user profile could not be found. You have been logged out.",
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
          errorTitle = "Permission Denied during Profile Sync";
          errorDescription = "Profile sync failed due to insufficient permissions. Firestore rules may have changed for the 'users' collection.";
        }
      }
      toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
    });

    return () => {
    //   console.log(`AuthProvider (snapshot effect): Cleaning up snapshot listener for user: ${firebaseUser.uid}`);
      unsubscribeSnapshot();
    };
  }, [firebaseUser?.uid, toast, currentUser?.role]); // Added currentUser?.role to ensure re-check if role changes via snapshot

  const isAdmin = currentUser?.role === "Admin";
  const isRegistrar = currentUser?.role === "Registrar" || isAdmin;
  const isInspector = currentUser?.role === "Inspector" || isAdmin;
  const isSupervisor = currentUser?.role === "Supervisor" || isAdmin;

  if (currentUser === undefined && loading) { // Changed condition slightly for clarity
    // console.log("AuthProvider Render: Initial load - currentUser is undefined AND loading is true. Showing global spinner.");
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
