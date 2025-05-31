
// src/actions/users.ts
'use server';

import { collection, getDocs, Timestamp, type DocumentReference, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import type { User, UserRole } from '@/types';

// Helper function to safely convert Firestore Timestamps or other date forms to JS Date objects
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue; 
  }
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) {
      console.warn('Server Action users.ts: Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  console.warn(`Server Action users.ts: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};

// Helper to check Admin permissions securely on the server
async function checkAdminPermissions(adminUserId: string): Promise<{ isAdmin: boolean; error?: string }> {
  if (!adminUserId) {
    return { isAdmin: false, error: "Admin user ID not provided for permission check." };
  }
  try {
    const adminUserDocRef = doc(db, "users", adminUserId);
    const adminUserDocSnap = await getDoc(adminUserDocRef);
    if (!adminUserDocSnap.exists()) {
      return { isAdmin: false, error: "Admin user profile not found." };
    }
    const adminUserData = adminUserDocSnap.data() as User;
    if (adminUserData.role !== "Admin" || !adminUserData.isActive) {
      return { isAdmin: false, error: "Action requires active Admin privileges." };
    }
    return { isAdmin: true };
  } catch (error: any) {
    console.error("Error checking admin permissions:", error);
    return { isAdmin: false, error: `Permission check failed: ${error.message}` };
  }
}


export async function getUsers_serverAction(): Promise<User[]> {
  console.log("Server Action getUsers_serverAction: Attempting to fetch users. Note: Firestore rules will apply based on server context, not client's 'request.auth'.");
  try {
    const usersCol = collection(db, "users"); 
    const userSnapshot = await getDocs(usersCol);

    const users = userSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        userId: docSnapshot.id,
        email: data.email || '',
        displayName: data.displayName || '',
        fullname: data.fullname || '', // Include fullname
        role: data.role || 'ReadOnly',
        createdAt: ensureSerializableDate(data.createdAt),
        lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
        isActive: data.isActive === undefined ? true : data.isActive,
      } as User;
    });

    return users;

  } catch (error: any) {
    const originalErrorMessage = error.message || "Unknown Firebase error";
    const originalErrorCode = error.code || "N/A";
    console.error(
      `Server Action getUsers_serverAction: Error fetching users. Original Error Code: ${originalErrorCode}, Message: ${originalErrorMessage}`,
      error
    );
    throw new Error(
      `Failed to fetch users from server. Original error: [${originalErrorCode}] ${originalErrorMessage}`
    );
  }
}

export async function updateUserActiveStatusInternal(
  userId: string,
  isActive: boolean,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const permCheck = await checkAdminPermissions(adminUserId);
  if (!permCheck.isAdmin) {
    return { success: false, error: permCheck.error || "Permission denied." };
  }

  if (!userId) {
    return { success: false, error: "User ID is required." };
  }

  try {
    const userDocRef = doc(db, "users", userId);
    await updateDoc(userDocRef, {
      isActive: isActive,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", adminUserId) // Store reference to admin who made the change
    });
    console.log(`Server Action: User ${userId} active status updated to ${isActive} by admin ${adminUserId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Server Action: Error updating user ${userId} active status:`, error);
    return { success: false, error: error.message || "Failed to update user status." };
  }
}

export async function updateUserProfileDetails(
  userIdToEdit: string,
  data: { displayName?: string; fullname?: string; role?: UserRole },
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const permCheck = await checkAdminPermissions(adminUserId);
  if (!permCheck.isAdmin) {
    return { success: false, error: permCheck.error || "Permission denied." };
  }

  if (!userIdToEdit) {
    return { success: false, error: "User ID to edit is required." };
  }

  const userDataToUpdate: { [key: string]: any } = {
    lastUpdatedAt: Timestamp.now(),
    lastUpdatedByRef: doc(db, "users", adminUserId),
  };

  if (data.displayName !== undefined) userDataToUpdate.displayName = data.displayName;
  if (data.fullname !== undefined) userDataToUpdate.fullname = data.fullname; // Add fullname
  if (data.role) userDataToUpdate.role = data.role;


  if (Object.keys(userDataToUpdate).length <= 2) { // only audit fields
    return { success: false, error: "No details provided to update." };
  }
  
  try {
    const userDocRef = doc(db, "users", userIdToEdit);
    await updateDoc(userDocRef, userDataToUpdate);
    console.log(`Server Action: User ${userIdToEdit} details updated by admin ${adminUserId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Server Action: Error updating user ${userIdToEdit} details:`, error);
    return { success: false, error: error.message || "Failed to update user details." };
  }
}

export async function createUserProfile(
  data: { userId: string; email: string; displayName?: string; fullname?: string; role: UserRole; isActive: boolean },
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const permCheck = await checkAdminPermissions(adminUserId);
  if (!permCheck.isAdmin) {
    return { success: false, error: permCheck.error || "Permission denied." };
  }

  if (!data.userId || !data.email || !data.role) {
    return { success: false, error: "User ID, Email, and Role are required to create a user profile." };
  }
  
  try {
    const userDocRef = doc(db, "users", data.userId);
    const docSnap = await getDoc(userDocRef);
    if (docSnap.exists()) {
      return { success: false, error: `User profile for UID ${data.userId} already exists.` };
    }

    const newUserProfileData: Partial<User> & {createdAt: Timestamp, createdByRef: DocumentReference<User>, lastUpdatedAt: Timestamp, lastUpdatedByRef: DocumentReference<User>} = {
      userId: data.userId, // Storing as a field for easier querying if needed, though ID is the doc ID
      email: data.email,
      displayName: data.displayName || data.email.split('@')[0],
      fullname: data.fullname || data.displayName || data.email.split('@')[0], // Add fullname
      role: data.role,
      isActive: data.isActive,
      createdAt: Timestamp.now(),
      createdByRef: doc(db, "users", adminUserId) as DocumentReference<User>,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", adminUserId) as DocumentReference<User>,
    };

    await setDoc(userDocRef, newUserProfileData);
    console.log(`Server Action: User profile for ${data.userId} created by admin ${adminUserId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Server Action: Error creating user profile for ${data.userId}:`, error);
    return { success: false, error: error.message || "Failed to create user profile." };
  }
}

export async function deleteUserProfileDocument(
  userIdToDelete: string,
  adminUserId: string
): Promise<{ success: boolean; error?: string }> {
  const permCheck = await checkAdminPermissions(adminUserId);
  if (!permCheck.isAdmin) {
    return { success: false, error: permCheck.error || "Permission denied." };
  }

  if (userIdToDelete === adminUserId) {
      return { success: false, error: "Admins cannot delete their own Firestore profile document through this action." };
  }

  if (!userIdToDelete) {
    return { success: false, error: "User ID to delete is required." };
  }

  try {
    const userDocRef = doc(db, "users", userIdToDelete);
    await deleteDoc(userDocRef);
    console.log(`Server Action: User profile document ${userIdToDelete} deleted by admin ${adminUserId}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Server Action: Error deleting user profile document ${userIdToDelete}:`, error);
    return { success: false, error: error.message || "Failed to delete user profile document." };
  }
}
