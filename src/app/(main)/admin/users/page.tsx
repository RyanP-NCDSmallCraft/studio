
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { PlusCircle, Users, Edit, ToggleLeft, ToggleRight, Filter, Loader2, AlertTriangle, Trash2 } from "lucide-react";
import type { User, UserRole } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"; // Removed AlertDialogTrigger as it's used via asChild
import { useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import React, { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, Timestamp, doc, updateDoc, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateUserActiveStatusInternal, deleteUserProfileDocument } from "@/actions/users";
import { UserFormDialog, type UserFormData } from "@/components/admin/UserFormDialog";

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
      console.warn('UserManagementPage: Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  console.warn(`UserManagementPage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function UserManagementPage() {
  const { currentUser, isAdmin, isSupervisor, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  const [isUserFormDialogOpen, setIsUserFormDialogOpen] = useState(false);
  const [userFormMode, setUserFormMode] = useState<"create" | "edit">("create");
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [userToConfirmDelete, setUserToConfirmDelete] = useState<User | null>(null);


  const loadUsers = useCallback(async () => {
    if (!currentUser || (!isAdmin && !isSupervisor)) {
      setFetchError("You are not authorized to view this page.");
      setIsLoading(false);
      setUsers([]);
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    try {
      console.log(`UserManagementPage: Attempting to fetch users directly from client. Current user role: ${currentUser?.role}, isActive: ${currentUser?.isActive}`);
      const usersCol = collection(db, "users");
      const userSnapshot = await getDocs(usersCol);

      const fetchedUsers = userSnapshot.docs.map((docSnapshot) => {
        const data = docSnapshot.data();
        return {
          userId: docSnapshot.id,
          email: data.email || '',
          displayName: data.displayName || '',
          fullname: data.fullname || '',
          role: data.role || 'ReadOnly',
          createdAt: ensureSerializableDate(data.createdAt),
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          isActive: data.isActive === undefined ? true : data.isActive,
        } as User;
      });
      setUsers(fetchedUsers);
    } catch (error: any) {
      const originalErrorMessage = error.message || "Unknown Firebase error";
      const originalErrorCode = error.code || "N/A";
      const detailedError = `Failed to fetch users. Original error: [${originalErrorCode}] ${originalErrorMessage}`;
      console.error("UserManagementPage: Error fetching users:", detailedError, error);
      setFetchError(detailedError);
      toast({
        title: "Error Loading Users",
        description: detailedError,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isAdmin, isSupervisor, toast]);

  useEffect(() => {
    if (!authLoading && currentUser) { 
      loadUsers();
    } else if (!authLoading && !currentUser) {
      setFetchError("Please log in to view user management.");
      setIsLoading(false);
    }
  }, [authLoading, currentUser, loadUsers]);

  const handleOpenAddUserDialog = () => {
    setUserFormMode("create");
    setSelectedUserForEdit(null);
    setIsUserFormDialogOpen(true);
  };

  const handleOpenEditUserDialog = (user: User) => {
    setUserFormMode("edit");
    setSelectedUserForEdit(user);
    setIsUserFormDialogOpen(true);
  };
  
  const handleOpenDeleteConfirmDialog = (user: User) => {
    setUserToConfirmDelete(user);
  };

  const handleConfirmDelete = async () => {
    if (!userToConfirmDelete || !currentUser?.userId || !isAdmin) {
      toast({ title: "Error", description: "Cannot delete user.", variant: "destructive" });
      setUserToConfirmDelete(null);
      return;
    }
    if (currentUser.userId === userToConfirmDelete.userId) {
      toast({ title: "Action Denied", description: "You cannot delete your own user profile document.", variant: "destructive"});
      setUserToConfirmDelete(null);
      return;
    }

    const result = await deleteUserProfileDocument(userToConfirmDelete.userId, currentUser.userId);
    if (result.success) {
      toast({ title: "User Profile Deleted", description: `Firestore profile for ${userToConfirmDelete.displayName || userToConfirmDelete.email} has been deleted.` });
      loadUsers(); // Refresh list
    } else {
      toast({ title: "Deletion Failed", description: result.error || "Could not delete user profile.", variant: "destructive" });
    }
    setUserToConfirmDelete(null);
  };


  if (!authLoading && !currentUser && !fetchError) {
    router.replace('/login');
    return <Card><CardContent className="pt-6">Redirecting to login...</CardContent></Card>;
  }

  if (!authLoading && currentUser && !isAdmin && !isSupervisor) {
     return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent>You are not authorized to view this page.</CardContent></Card>;
  }

  const getInitials = (displayName?: string, email?: string) => {
    if (displayName && displayName.trim()) {
      const names = displayName.trim().split(' ');
      if (names.length === 1) return names[0].charAt(0).toUpperCase();
      return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
    }
    if (email) return email.charAt(0).toUpperCase();
    return "U";
  }

  const handleToggleActive = async (userToToggle: User) => {
    if (!currentUser || !isAdmin) {
        toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
        return;
    }
    if (currentUser.userId === userToToggle.userId) {
        toast({ title: "Action Denied", description: "You cannot change your own active status.", variant: "destructive"});
        return;
    }

    const newStatus = !userToToggle.isActive;
    const result = await updateUserActiveStatusInternal(userToToggle.userId, newStatus, currentUser.userId);

    if (result.success) {
      toast({
          title: `User Status ${newStatus ? 'Activated' : 'Deactivated'}`,
          description: `User ${userToToggle.displayName || userToToggle.email} has been ${newStatus ? 'activated' : 'deactivated'}.`,
      });
      loadUsers(); // Refresh list
    } else {
      toast({
          title: "Status Update Failed",
          description: result.error || "Could not update user status.",
          variant: "destructive",
      });
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-64 justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading user data...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Users className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">User Management</h1>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" disabled>
                <Filter className="mr-2 h-4 w-4" /> Filter
            </Button>
            {isAdmin && (
            <Button onClick={handleOpenAddUserDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add New User
            </Button>
            )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>System Users</CardTitle>
          <CardDescription>Manage user accounts, roles, and access permissions.</CardDescription>
        </CardHeader>
        <CardContent>
          {fetchError ? (
             <div className="text-center py-10">
              {fetchError.includes("permission-denied") || fetchError.includes("Missing or insufficient permissions") ? (
                <div className="text-destructive space-y-2 p-4 border border-destructive/50 rounded-md bg-destructive/10">
                  <div className="flex justify-center items-center mb-2">
                    <AlertTriangle className="h-10 w-10 mr-2" />
                    <h3 className="text-xl font-semibold">Permission Denied</h3>
                  </div>
                  <p>Could not load users due to missing Firestore permissions.</p>
                  <p className="font-medium mt-2">
                    Please check your Firebase console and ensure your Firestore Security Rules allow your current role
                    ({currentUser?.role || 'Unknown Role'}) to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">list</code> or <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">read</code> from the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">users</code> collection.
                    The rule often involves checking the requesting user's role (e.g., 'Admin', 'Supervisor') from their own document in <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">/users/{`request.auth.uid`}</code>.
                  </p>
                  <p className="mt-2">Also, ensure your user document in Firestore (<code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">/users/{currentUser?.userId || 'YOUR_USER_ID'}</code>) has the correct <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">role</code> and <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">isActive: true</code> fields, and that these match the conditions in your security rules.</p>
                  <p className="text-xs text-muted-foreground mt-1">Detailed error: {fetchError}</p>
                </div>
              ) : (
                 <p className="text-destructive">{fetchError}</p>
              )}
              <Button onClick={loadUsers} className="mt-4">Retry</Button>
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length > 0 ? users.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.displayName || user.email?.split('@')[0] || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant={user.role === "Admin" ? "default" : "secondary"}>{user.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatFirebaseTimestamp(user.createdAt, "PP")}</TableCell>
                  <TableCell className="text-right">
                     {isAdmin && currentUser?.userId !== user.userId && (
                        <>
                        <Button variant="ghost" size="icon" title="Edit User Details" onClick={() => handleOpenEditUserDialog(user)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialog.Trigger asChild>
                                <Button variant="ghost" size="icon" title={user.isActive ? "Deactivate User" : "Activate User"}>
                                    {user.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                                </Button>
                            </AlertDialog.Trigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to {user.isActive ? "deactivate" : "activate"} user {user.displayName || user.email}?
                                        {user.isActive ? " Deactivating will prevent them from logging in (if Firestore rules check isActive)." : " Activating will allow them to log in."}
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleActive(user)}>
                                        Confirm {user.isActive ? "Deactivate" : "Activate"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                         <AlertDialog>
                            <AlertDialog.Trigger asChild>
                                <Button variant="ghost" size="icon" title="Delete User Profile" onClick={() => handleOpenDeleteConfirmDialog(user)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </AlertDialog.Trigger>
                             {userToConfirmDelete && userToConfirmDelete.userId === user.userId && (
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Confirm Profile Deletion</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete the Firestore profile for {userToConfirmDelete.displayName || userToConfirmDelete.email}? 
                                            This action only removes their profile document, not their Firebase Authentication account. This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel onClick={() => setUserToConfirmDelete(null)}>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                                            Confirm Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                             )}
                        </AlertDialog>
                        </>
                     )}
                     {/* Show if current user is THIS user (for future self-edit, if needed) */}
                     {/* {currentUser?.userId === user.userId && (
                        <Button variant="ghost" size="icon" disabled title="Edit My Profile (Not Implemented)">
                            <Edit className="h-4 w-4" />
                        </Button>
                     )} */}
                  </TableCell>
                </TableRow>
              )) : (
                 <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <UserFormDialog
            mode={userFormMode}
            user={selectedUserForEdit}
            open={isUserFormDialogOpen}
            onOpenChange={setIsUserFormDialogOpen}
            onUserUpdated={() => {
                setIsUserFormDialogOpen(false);
                loadUsers(); // Refresh the list
            }}
        />
      )}
    </div>
  );
}
