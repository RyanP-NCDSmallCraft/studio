
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { PlusCircle, Users, Edit, ToggleLeft, ToggleRight, Filter, Loader2, AlertTriangle } from "lucide-react";
import type { User } from "@/types";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import React, { useState, useEffect, useCallback } from 'react';
import { getUsers, updateUserActiveStatus } from '@/actions/users';


export default function UserManagementPage() {
  const { currentUser, isAdmin, isSupervisor, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

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
      const fetchedUsers = await getUsers();
      setUsers(fetchedUsers);
    } catch (error: any) {
      console.error("Failed to load users:", error);
      const errorMessage = error.message || "An unexpected error occurred while fetching users.";
      setFetchError(errorMessage);
      toast({
        title: "Error Loading Users",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isAdmin, isSupervisor, toast]);

  useEffect(() => {
    if (!authLoading) {
      loadUsers();
    }
  }, [authLoading, loadUsers]);

  // Protect this page - although layout should also handle it
  if (!authLoading && !currentUser) {
    // This should be handled by MainLayout, but as a fallback:
    router.replace('/login');
    return <Card><CardContent className="pt-6">Redirecting to login...</CardContent></Card>;
  }
  
  if (!authLoading && currentUser && !isAdmin && !isSupervisor) {
     return <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent>You are not authorized to view this page.</CardContent></Card>;
  }
  
  const getInitials = (name?: string, email?: string) => {
    if (name && name.trim()) {
      const names = name.trim().split(' ');
      if (names.length === 1) return names[0].charAt(0).toUpperCase();
      return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
    }
    if (email) return email.charAt(0).toUpperCase();
    return "U";
  }

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    // Placeholder: In a real app, call a server action to update user in Firebase Auth & Firestore
    console.log(`Toggling active status for ${userId} from ${currentStatus} to ${!currentStatus}`);
    
    // Simulate optimistc update for UI
    setUsers(prevUsers => 
      prevUsers.map(user => 
        user.userId === userId ? { ...user, isActive: !currentStatus } : user
      )
    );

    // Placeholder for server action call
    // const result = await updateUserActiveStatus(userId, !currentStatus);
    // if (result.success) {
    //   toast({
    //       title: `User Status ${!currentStatus ? 'Deactivated' : 'Activated'}`,
    //       description: `User ${userId} has been ${!currentStatus ? 'deactivated' : 'activated'}.`,
    //   });
    // } else {
    //   // Revert UI on failure
    //   setUsers(prevUsers => 
    //     prevUsers.map(user => 
    //       user.userId === userId ? { ...user, isActive: currentStatus } : user // Revert to original status
    //     )
    //   );
    //   toast({
    //       title: `Error Updating Status`,
    //       description: result.error || "Could not update user status.",
    //       variant: "destructive",
    //   });
    // }
     toast({ // Keeping current UI-only behavior for now
          title: `User Status ${!currentStatus ? 'Deactivated' : 'Activated'} (UI Only)`,
          description: `User ${userId} has been ${!currentStatus ? 'deactivated' : 'activated'} (this is a UI placeholder).`,
      });
  };

  if (authLoading || (!currentUser && !fetchError)) { // Added !fetchError to avoid double loading message
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
            {isAdmin && ( // Only Admin can add new users typically
            <Button disabled> {/* Add user functionality is complex, involving Auth + Firestore */}
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
          {isLoading ? (
            <div className="flex h-40 justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Fetching users...</p>
            </div>
          ) : fetchError ? (
             <div className="text-center py-10">
              {fetchError.includes("permission-denied") || fetchError.includes("Missing or insufficient permissions") ? (
                <div className="text-destructive space-y-2 p-4 border border-destructive/50 rounded-md bg-destructive/10">
                  <div className="flex justify-center items-center mb-2">
                    <AlertTriangle className="h-10 w-10 mr-2" />
                    <h3 className="text-xl font-semibold">Permission Denied</h3>
                  </div>
                  <p>Could not load users due to missing Firestore permissions.</p>
                  <p className="font-medium mt-2">Please check your Firebase console and ensure your Firestore Security Rules allow your current role ({currentUser?.role || 'Unknown Role'}) to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">list</code> or <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">read</code> from the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">users</code> collection.</p>
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
                        {/* <AvatarImage src={user.photoURL} /> Should come from Firebase Auth user potentially */}
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
                     {isAdmin && currentUser?.userId !== user.userId && ( // Admin can edit/toggle others, not themselves directly here for safety
                        <>
                        <Button variant="ghost" size="icon" disabled title="Edit User (UI Only)"> {/* Edit user is complex */}
                            <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" title={user.isActive ? "Deactivate User" : "Activate User"}>
                                    {user.isActive ? <ToggleRight className="h-4 w-4 text-green-500" /> : <ToggleLeft className="h-4 w-4 text-red-500" />}
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Confirm Status Change</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Are you sure you want to {user.isActive ? "deactivate" : "activate"} user {user.displayName || user.email}?
                                        {user.isActive ? " Deactivating will prevent them from logging in (via Firestore rules if isActive is checked)." : " Activating will allow them to log in."}
                                        {" "}This is a UI placeholder action.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleToggleActive(user.userId, user.isActive)}>
                                        Confirm {user.isActive ? "Deactivate" : "Activate"}
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        </>
                     )}
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
    </div>
  );
}
