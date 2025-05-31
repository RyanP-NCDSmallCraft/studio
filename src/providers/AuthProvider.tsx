
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, Timestamp, onSnapshot, FirestoreError } from "firebase/firestore";
import type { ReactNode } from "react";
import React, { createContext, useEffect, useState, useRef, useCallback } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null | undefined>(undefined);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const inactivityTimerIdRef = useRef<NodeJS.Timeout | null>(null);

  const logoutUserAndNotify = useCallback(async (reason?: string) => {
    // console.log("AuthProvider: logoutUserAndNotify called. Reason:", reason);
    if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
    }
    try {
      await signOut(auth);
      toast({
        title: reason || "Logged Out",
        description: reason ? "You have been logged out." : "You have been successfully logged out.",
      });
    } catch (error) {
      console.error("AuthProvider: Error during logout:", error);
      toast({
        title: "Logout Error",
        description: "An error occurred while logging out.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerIdRef.current) {
      clearTimeout(inactivityTimerIdRef.current);
    }
    // console.log("AuthProvider: Setting inactivity timer for", INACTIVITY_TIMEOUT_DURATION / 1000 / 60, "minutes.");
    const newTimerId = setTimeout(() => logoutUserAndNotify("Session Expired"), INACTIVITY_TIMEOUT_DURATION);
    inactivityTimerIdRef.current = newTimerId;
  }, [logoutUserAndNotify]);

  useEffect(() => {
    if (firebaseUser) {
      const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'visibilitychange'];
      const handleActivity = (event: Event) => {
        if (event.type === 'visibilitychange' && document.hidden) {
          // console.log("AuthProvider: Tab became hidden, not resetting timer for this event.");
          return;
        }
        // console.log("AuthProvider: User activity detected via", event.type, ". Resetting inactivity timer.");
        resetInactivityTimer();
      };
      activityEvents.forEach(event => window.addEventListener(event, handleActivity, { capture: true, passive: true }));
      // console.log("AuthProvider: User is logged in. Starting/Resetting inactivity timer.");
      resetInactivityTimer(); // Initial timer start
      return () => {
        // console.log("AuthProvider: Cleanup inactivity listeners and timer for firebaseUser:", firebaseUser.uid);
        activityEvents.forEach(event => window.removeEventListener(event, handleActivity, { capture: true }));
        if (inactivityTimerIdRef.current) {
          clearTimeout(inactivityTimerIdRef.current);
          inactivityTimerIdRef.current = null;
        }
      };
    } else {
      // console.log("AuthProvider: No firebaseUser. Clearing inactivity timer if it exists.");
      if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
      }
    }
  }, [firebaseUser, resetInactivityTimer]);

  useEffect(() => {
    console.log("AuthProvider: onAuthStateChanged listener setup.");
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      console.log("AuthProvider: onAuthStateChanged triggered. Firebase user:", user ? user.uid : null);
      setLoading(true); // Set loading true at the start of auth state processing
      setFirebaseUser(user);

      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
          console.log(`AuthProvider: Attempting to getDoc for user UID: ${user.uid}`);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userProfileData = userDocSnap.data();
            console.log(`AuthProvider: User document found for UID ${user.uid}. Data:`, JSON.stringify(userProfileData));

            const userProfile: AppUser = {
              userId: user.uid,
              email: userProfileData.email || user.email, // Fallback to auth email
              displayName: userProfileData.displayName,
              fullname: userProfileData.fullname,
              role: userProfileData.role,
              isActive: userProfileData.isActive,
              createdAt: userProfileData.createdAt instanceof Timestamp ? userProfileData.createdAt.toDate() : userProfileData.createdAt,
              lastUpdatedAt: userProfileData.lastUpdatedAt instanceof Timestamp ? userProfileData.lastUpdatedAt.toDate() : userProfileData.lastUpdatedAt,
            };
            
            if (!userProfile.role || typeof userProfile.isActive !== 'boolean') {
              console.warn(`AuthProvider: User profile for UID ${user.uid} is missing 'role' or 'isActive' is not a boolean. Role: '${userProfile.role}', isActive: '${userProfile.isActive}'. Treating as invalid profile.`);
              setCurrentUser(null);
              toast({
                title: "Profile Incomplete",
                description: "Your user profile is incomplete (missing role or active status). Please contact support. You will be logged out.",
                variant: "destructive",
              });
              await signOut(auth);
            } else if (userProfile.isActive !== true) {
              console.warn(`AuthProvider: User profile for UID ${user.uid} is not active (isActive: ${userProfile.isActive}). Setting currentUser to null.`);
              setCurrentUser(null);
               toast({
                title: "Account Not Active",
                description: "Your account is not active. Please contact support. You will be logged out.",
                variant: "destructive",
              });
              await signOut(auth);
            } else {
              console.log(`AuthProvider: User profile for UID ${user.uid} is valid and active. Setting currentUser.`);
              setCurrentUser(userProfile);
            }
          } else {
            console.warn(`AuthProvider: User document NOT found in Firestore for UID: ${user.uid}. Setting currentUser to null and logging out Firebase Auth user.`);
            setCurrentUser(null);
            toast({
              title: "User Profile Not Found",
              description: "Your user profile does not exist in the system. Please contact support. You will be logged out.",
              variant: "destructive",
            });
            await signOut(auth); // Log out the Firebase Auth user
          }
        } catch (error: any) {
          console.error(`AuthProvider: Error fetching user document for ${user.uid}: Code: ${error.code}, Message: ${error.message}`, error);
          let errorTitle = "Profile Load Error";
          let errorDescription = "Failed to load user profile.";
          if (error instanceof FirestoreError) {
            if (error.code === 'unavailable') {
              errorTitle = "Network Issue";
              errorDescription = "Could not load user profile. The application may be offline.";
            } else if (error.code === 'permission-denied') {
              errorTitle = "Permission Denied Loading Profile";
              errorDescription = "Failed to load your user profile due to insufficient Firestore permissions. Please check security rules for the 'users' collection and ensure your user document exists with the correct 'role' and 'isActive' fields. You will be logged out.";
               await signOut(auth); // Log out if profile cannot be read due to permissions
            }
          }
          toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
          setCurrentUser(null);
        } finally {
          console.log(`AuthProvider: Finished processing auth state for UID ${user.uid}. Setting loading to false.`);
          setLoading(false);
        }
      } else { // No Firebase user
        console.log("AuthProvider: No Firebase user. Setting currentUser to null and loading to false.");
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      console.log("AuthProvider: Unsubscribing from onAuthStateChanged.");
      unsubscribeAuth();
      if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
      }
    };
  }, [toast]); // Added toast to dependency array of outer useEffect

  useEffect(() => {
    if (!firebaseUser?.uid) {
      // console.log("AuthProvider (onSnapshot Effect): No firebaseUser.uid, skipping snapshot listener.");
      return;
    }
    console.log(`AuthProvider (onSnapshot Effect): Setting up snapshot listener for user ${firebaseUser.uid}`);
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      console.log(`AuthProvider (onSnapshot): Snapshot received for user ${firebaseUser.uid}. Exists: ${docSnap.exists()}`);
      if (docSnap.exists()) {
        const newProfileDataRaw = docSnap.data();
        console.log(`AuthProvider (onSnapshot): User document for ${firebaseUser.uid} exists. Raw Data:`, JSON.stringify(newProfileDataRaw));
        const newProfileData: AppUser = {
            userId: firebaseUser.uid,
            email: newProfileDataRaw.email || firebaseUser.email,
            displayName: newProfileDataRaw.displayName,
            fullname: newProfileDataRaw.fullname,
            role: newProfileDataRaw.role,
            isActive: newProfileDataRaw.isActive,
            createdAt: newProfileDataRaw.createdAt instanceof Timestamp ? newProfileDataRaw.createdAt.toDate() : newProfileDataRaw.createdAt,
            lastUpdatedAt: newProfileDataRaw.lastUpdatedAt instanceof Timestamp ? newProfileDataRaw.lastUpdatedAt.toDate() : newProfileDataRaw.lastUpdatedAt,
        };

        if (!newProfileData.role || typeof newProfileData.isActive !== 'boolean') {
            console.warn(`AuthProvider (onSnapshot): User profile for ${firebaseUser.uid} from snapshot is missing role or isActive. Role: ${newProfileData.role}, Active: ${newProfileData.isActive}. Setting currentUser to null and logging out.`);
            setCurrentUser(null);
            toast({ title: "Profile Sync Error", description: "Your profile became incomplete. You have been logged out.", variant: "destructive" });
            signOut(auth).catch(err => console.error("AuthProvider (onSnapshot): Error signing out after incomplete profile from snapshot:", err));
        } else if (newProfileData.isActive !== true) {
            console.warn(`AuthProvider (onSnapshot): User ${firebaseUser.uid} from snapshot is no longer active. Setting currentUser to null and logging out.`);
            setCurrentUser(null);
            toast({ title: "Account Deactivated", description: "Your account has been deactivated. You have been logged out.", variant: "destructive" });
            signOut(auth).catch(err => console.error("AuthProvider (onSnapshot): Error signing out after inactive profile from snapshot:", err));
        } else if (JSON.stringify(currentUser) !== JSON.stringify(newProfileData)) { // Compare stringified versions to detect changes
            console.log(`AuthProvider (onSnapshot): Profile for ${firebaseUser.uid} updated. Updating currentUser state.`);
            setCurrentUser(newProfileData);
        }
      } else {
        console.warn(`AuthProvider (onSnapshot): User document NO LONGER exists in Firestore for UID: ${firebaseUser.uid}. Setting currentUser to null and logging out.`);
        setCurrentUser(null);
        signOut(auth).catch(err => console.error("AuthProvider (onSnapshot): Error signing out after profile deletion:", err));
        toast({
          title: "Profile Deleted",
          description: "Your user profile was removed. You have been logged out.",
          variant: "destructive",
        });
      }
    }, (error) => {
      console.error(`AuthProvider (onSnapshot): Firestore snapshot error for user ${firebaseUser.uid}: Code: ${error.code}, Message: ${error.message}`, error);
      let errorTitle = "Profile Sync Error";
      let errorDescription = "Failed to sync user profile in real-time.";
      if (error instanceof FirestoreError) {
        if (error.code === 'unavailable') {
          errorTitle = "Network Issue";
          errorDescription = "Could not sync user profile. The application may be offline.";
        } else if (error.code === 'permission-denied') {
          errorTitle = "Real-time Profile Sync Denied";
          errorDescription = "Changes to your profile cannot be synced due to Firestore permissions. Check rules for 'users' collection and ensure your user document in Firestore has 'role' and 'isActive' fields. Your session may be invalid.";
          // If profile becomes unreadable due to permissions, treat as if logged out for app state
          setCurrentUser(null);
          signOut(auth).catch(err => console.error("AuthProvider (onSnapshot): Error signing out after permission-denied on snapshot:", err));
        }
      }
      toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
    });
    return () => {
      console.log(`AuthProvider (onSnapshot Effect): Unsubscribing snapshot listener for user ${firebaseUser.uid}`);
      unsubscribeSnapshot();
    };
  }, [firebaseUser, toast, currentUser]); // Added currentUser to dependencies for the comparison

  const isAdmin = currentUser?.role === "Admin" && currentUser?.isActive === true;
  const isRegistrar = (currentUser?.role === "Registrar" || isAdmin) && currentUser?.isActive === true;
  const isInspector = (currentUser?.role === "Inspector" || isAdmin) && currentUser?.isActive === true;
  const isSupervisor = (currentUser?.role === "Supervisor" || isAdmin) && currentUser?.isActive === true;

  // This log helps verify the final state before rendering children
  // console.log(`AuthProvider: Rendering. loading=${loading}, firebaseUser=${firebaseUser?.uid}, currentUser.userId=${currentUser?.userId}, currentUser.role=${currentUser?.role}, currentUser.isActive=${currentUser?.isActive}`);

  if (loading && currentUser === undefined) { // Show loading spinner only if loading AND currentUser is still in its initial 'undefined' state
    // console.log("AuthProvider: Global loading state. Rendering loading spinner.");
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
