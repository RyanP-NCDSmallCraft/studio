
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { PlusCircle, Users, Edit, ToggleLeft, ToggleRight, Filter } from "lucide-react";
import type { User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { format } from 'date-fns';
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


// Placeholder data
const placeholderUsers: User[] = [
  { userId: "USER001", email: "admin@regocraft.com", displayName: "Admin User", role: "Admin", createdAt: new Date() as any, isActive: true },
  { userId: "USER002", email: "registrar@regocraft.com", displayName: "Registrar Ray", role: "Registrar", createdAt: new Date() as any, isActive: true },
  { userId: "USER003", email: "inspector.bob@regocraft.com", displayName: "Inspector Bob", role: "Inspector", createdAt: new Date() as any, isActive: true },
  { userId: "USER004", email: "supervisor.sue@regocraft.com", displayName: "Supervisor Sue", role: "Supervisor", createdAt: new Date() as any, isActive: false },
  { userId: "USER005", email: "readonly@regocraft.com", displayName: "Viewer Vic", role: "ReadOnly", createdAt: new Date() as any, isActive: true },
];

export default function UserManagementPage() {
  const { currentUser, isAdmin, isSupervisor } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // Protect this page - although layout should also handle it
  if (!isAdmin && !isSupervisor) {
     // router.replace('/dashboard'); // Or show an unauthorized message
     return <Card><CardContent className="pt-6">You are not authorized to view this page.</CardContent></Card>;
  }
  
  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const names = name.split(' ');
      if (names.length === 1) return names[0].charAt(0).toUpperCase();
      return names[0].charAt(0).toUpperCase() + names[names.length - 1].charAt(0).toUpperCase();
    }
    if (email) return email.charAt(0).toUpperCase();
    return "U";
  }

  const handleToggleActive = (userId: string, currentStatus: boolean) => {
    // In a real app, update user in Firebase Auth (disable/enable) and Firestore
    console.log(`Toggling active status for ${userId} from ${currentStatus} to ${!currentStatus}`);
    toast({
        title: `User Status ${!currentStatus ? 'Deactivated' : 'Activated'}`,
        description: `User ${userId} has been ${!currentStatus ? 'deactivated' : 'activated'}.`,
    });
    // Simulate update
    // router.refresh(); // or update state locally
  };

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
              {placeholderUsers.map((user) => (
                <TableRow key={user.userId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        {/* <AvatarImage src={user.photoURL} /> Should come from user data */}
                        <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.displayName || "N/A"}</span>
                    </div>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell><Badge variant={user.role === "Admin" ? "default" : "secondary"}>{user.role}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={user.isActive ? "default" : "destructive"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.createdAt ? format(user.createdAt.toDate(), "PP") : "N/A"}</TableCell>
                  <TableCell className="text-right">
                     {isAdmin && (
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
                                        Are you sure you want to {user.isActive ? "deactivate" : "activate"} this user?
                                        {user.isActive ? " Deactivating will prevent them from logging in." : " Activating will allow them to log in."}
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
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {placeholderUsers.length === 0 && (
        <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No users found.
            </CardContent>
        </Card>
      )}
    </div>
  );
}
