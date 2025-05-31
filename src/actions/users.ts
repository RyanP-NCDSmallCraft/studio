
// src/actions/users.ts
'use server';

import { collection, getDocs, Timestamp, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // This db is the client SDK instance
import type { User } from '@/types';

// Helper function to safely convert Firestore Timestamps or other date forms to JS Date objects
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue; // Already a JS Date
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

// This server action might still be useful for other server-side operations or if you later
// implement Firebase Admin SDK for certain backend tasks.
// However, the UserManagementPage will now fetch users client-side for rule evaluation.
export async function getUsers_serverAction(): Promise<User[]> {
  console.log("Server Action getUsers_serverAction: Attempting to fetch users. Note: Firestore rules will apply based on server context, not client's 'request.auth'.");
  try {
    const usersCol = collection(db, "users"); // db here is the client SDK instance
    const userSnapshot = await getDocs(usersCol);

    const users = userSnapshot.docs.map((docSnapshot) => {
      const data = docSnapshot.data();
      return {
        userId: docSnapshot.id,
        email: data.email || '',
        displayName: data.displayName || '',
        role: data.role || 'ReadOnly',
        createdAt: ensureSerializableDate(data.createdAt),
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

// Placeholder for updating user active status - to be implemented later
export async function updateUserActiveStatus(userId: string, isActive: boolean): Promise<{ success: boolean; error?: string }> {
  console.log(`Server Action (Placeholder): Updating user ${userId} active status to ${isActive}`);
  // In a real app, you would use Firebase Admin SDK or ensure proper security rules for this client SDK update
  // For now, this is just a placeholder
  // try {
  //   const userDocRef = doc(db, "users", userId);
  //   await updateDoc(userDocRef, { isActive: isActive, lastUpdatedAt: Timestamp.now() });
  //   return { success: true };
  // } catch (error: any) {
  //   console.error("Error updating user active status:", error);
  //   return { success: false, error: error.message || "Failed to update user status." };
  // }
  return { success: true }; // Simulate success
}

    