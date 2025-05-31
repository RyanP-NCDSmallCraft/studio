
"use client";

import type { User as FirebaseUser } from "firebase/auth";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, Timestamp, onSnapshot, FirestoreError } from "firebase/firestore"; // Ensured FirestoreError is imported
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AppUser | null | undefined>(undefined);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const inactivityTimerIdRef = useRef<NodeJS.Timeout | null>(null);

  const logoutUserAndNotify = useCallback(async () => {
    if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
    }
    try {
      await signOut(auth);
      toast({
        title: "Session Expired",
        description: "You have been logged out due to inactivity.",
      });
    } catch (error) {
      console.error("AuthProvider: Error during inactivity logout:", error);
      toast({
        title: "Logout Error",
        description: "An error occurred while logging out due to inactivity.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerIdRef.current) {
      clearTimeout(inactivityTimerIdRef.current);
    }
    const newTimerId = setTimeout(logoutUserAndNotify, INACTIVITY_TIMEOUT_DURATION);
    inactivityTimerIdRef.current = newTimerId;
  }, [logoutUserAndNotify]);

  useEffect(() => {
    if (firebaseUser) {
      const activityEvents: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart', 'visibilitychange'];
      const handleActivity = (event: Event) => {
        if (event.type === 'visibilitychange' && document.hidden) {
          return;
        }
        resetInactivityTimer();
      };
      activityEvents.forEach(event => window.addEventListener(event, handleActivity, { capture: true, passive: true }));
      resetInactivityTimer();
      return () => {
        activityEvents.forEach(event => window.removeEventListener(event, handleActivity, { capture: true }));
        if (inactivityTimerIdRef.current) {
          clearTimeout(inactivityTimerIdRef.current);
          inactivityTimerIdRef.current = null;
        }
      };
    } else {
      if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
      }
    }
  }, [firebaseUser, resetInactivityTimer]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      setFirebaseUser(user);

      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userProfile = { userId: user.uid, ...userDocSnap.data() } as AppUser;
            if (userProfile.createdAt && typeof (userProfile.createdAt as any).toDate === 'function') {
                userProfile.createdAt = (userProfile.createdAt as Timestamp).toDate();
            }
            if (userProfile.lastUpdatedAt && typeof (userProfile.lastUpdatedAt as any).toDate === 'function') {
                userProfile.lastUpdatedAt = (userProfile.lastUpdatedAt as Timestamp).toDate();
            }
            setCurrentUser(userProfile);
          } else {
            console.warn(`AuthProvider onAuthStateChanged: User document for ${user.uid} NOT found in Firestore. Defaulting to ReadOnly profile and attempting to log out auth user.`);
            setCurrentUser(null);
            toast({
              title: "User Profile Not Found",
              description: "Your user profile does not exist in the system. Please contact support. You will be logged out.",
              variant: "destructive",
            });
            await signOut(auth);
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
              errorTitle = "Permission Denied Loading Profile";
              errorDescription = "Failed to load your user profile due to insufficient Firestore permissions. Please check security rules and your user data in Firestore.";
            }
          }
          toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
          setCurrentUser(null);
        } finally {
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });
    return () => {
      unsubscribeAuth();
      if (inactivityTimerIdRef.current) {
        clearTimeout(inactivityTimerIdRef.current);
        inactivityTimerIdRef.current = null;
      }
    };
  }, [toast]);

  useEffect(() => {
    if (!firebaseUser?.uid) {
      return;
    }
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const newProfileData = { userId: firebaseUser.uid, ...docSnap.data() } as AppUser;
        if (newProfileData.createdAt && typeof (newProfileData.createdAt as any).toDate === 'function') {
            newProfileData.createdAt = (newProfileData.createdAt as Timestamp).toDate();
        }
        if (newProfileData.lastUpdatedAt && typeof (newProfileData.lastUpdatedAt as any).toDate === 'function') {
            newProfileData.lastUpdatedAt = (newProfileData.lastUpdatedAt as Timestamp).toDate();
        }
        if (currentUser?.role !== newProfileData.role || currentUser?.isActive !== newProfileData.isActive || currentUser?.displayName !== newProfileData.displayName || currentUser?.fullname !== newProfileData.fullname) {
            setCurrentUser(newProfileData);
        }
      } else {
        console.warn(`AuthProvider (onSnapshot): User document NO LONGER exists in Firestore for UID: ${firebaseUser.uid}. Setting currentUser to null and attempting logout.`);
        setCurrentUser(null);
        signOut(auth).catch(err => console.error("AuthProvider (onSnapshot): Error signing out after profile deletion:", err));
        toast({
          title: "Profile Sync Issue",
          description: "Your user profile could not be found or was removed. You have been logged out.",
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
          errorTitle = "Real-time Profile Sync Denied";
          errorDescription = "Changes to your profile cannot be synced due to Firestore permissions. Check rules for 'users' collection and ensure your user document in Firestore has 'role' and 'isActive' fields.";
        }
      }
      toast({ title: errorTitle, description: errorDescription, variant: "destructive" });
    });
    return () => {
      unsubscribeSnapshot();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseUser?.uid, toast]);

  const isAdmin = currentUser?.role === "Admin" && currentUser?.isActive === true;
  const isRegistrar = (currentUser?.role === "Registrar" || isAdmin) && currentUser?.isActive === true;
  const isInspector = (currentUser?.role === "Inspector" || isAdmin) && currentUser?.isActive === true;
  const isSupervisor = (currentUser?.role === "Supervisor" || isAdmin) && currentUser?.isActive === true;

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

    