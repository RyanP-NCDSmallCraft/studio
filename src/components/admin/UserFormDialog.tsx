
"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { User, UserRole } from "@/types";
import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { createUserProfile, updateUserProfileDetails } from "@/actions/users";
import { useAuth } from "@/hooks/useAuth";

const userFormSchema = z.object({
  userId: z.string().min(1, "User ID (Firebase Auth UID) is required.").optional(), // Required for create, display for edit
  email: z.string().email("Invalid email address.").min(1, "Email is required."), // Required for create, display for edit
  displayName: z.string().min(1, "Display name is required.").optional(),
  fullname: z.string().optional(), // Added fullname
  role: z.enum(["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] as [UserRole, ...UserRole[]]), // Ensure it aligns with UserRole type
  isActive: z.boolean().default(true).optional(), // Only relevant for create mode
});

export type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  mode: "create" | "edit";
  user?: User | null; // For pre-filling in edit mode
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void; // Callback to refresh user list
}

export function UserFormDialog({ mode, user, open, onOpenChange, onUserUpdated }: UserFormDialogProps) {
  const { toast } = useToast();
  const { currentUser: adminUser } = useAuth();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      userId: "",
      email: "",
      displayName: "",
      fullname: "", // Default for fullname
      role: "ReadOnly",
      isActive: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && user) {
      form.reset({
        userId: user.userId,
        email: user.email,
        displayName: user.displayName || "",
        fullname: user.fullname || "", // Reset with fullname
        role: user.role,
        isActive: user.isActive, // Though isActive is not directly edited in this dialog for "edit" mode
      });
    } else if (mode === "create") {
      form.reset({
        userId: "",
        email: "",
        displayName: "",
        fullname: "", // Default for fullname
        role: "ReadOnly",
        isActive: true,
      });
    }
  }, [mode, user, open, form]);

  const onSubmit = async (data: UserFormData) => {
    if (!adminUser?.userId) {
      toast({ title: "Error", description: "Admin user not found.", variant: "destructive" });
      return;
    }

    try {
      let result;
      if (mode === "create") {
        if (!data.userId || !data.email) { // Extra check for create mode
          toast({ title: "Validation Error", description: "User ID and Email are mandatory for new users.", variant: "destructive" });
          return;
        }
        result = await createUserProfile({
          userId: data.userId,
          email: data.email,
          displayName: data.displayName,
          fullname: data.fullname, // Pass fullname
          role: data.role,
          isActive: data.isActive !== undefined ? data.isActive : true,
        }, adminUser.userId);
      } else if (mode === "edit" && user) {
        result = await updateUserProfileDetails(user.userId, {
          displayName: data.displayName,
          fullname: data.fullname, // Pass fullname
          role: data.role,
        }, adminUser.userId);
      } else {
        throw new Error("Invalid form mode or missing user data for edit.");
      }

      if (result.success) {
        toast({ title: `User ${mode === "create" ? "Profile Created" : "Details Updated"}`, description: `User ${data.displayName || data.email} has been successfully ${mode === "create" ? "added" : "updated"}.` });
        onUserUpdated(); // Refresh the list
        onOpenChange(false); // Close dialog
      } else {
        throw new Error(result.error || `Failed to ${mode} user profile.`);
      }
    } catch (error: any) {
      console.error(`Error ${mode === 'create' ? 'creating' : 'updating'} user profile:`, error);
      toast({ title: `Operation Failed`, description: error.message || `Could not ${mode} user profile.`, variant: "destructive" });
    }
  };

  const userRoles: UserRole[] = ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add New User Profile" : "Edit User Details"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Enter the details for the new user profile. The User ID and Email must correspond to an existing Firebase Authentication user."
              : `Editing details for ${user?.displayName || user?.email}`}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
            {mode === "create" && (
              <>
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID (Firebase Auth UID) *</FormLabel>
                      <FormControl><Input placeholder="Enter Firebase Auth UID" {...field} /></FormControl>
                      <FormDescription>This must match the UID from Firebase Authentication.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl><Input type="email" placeholder="user@example.com" {...field} /></FormControl>
                       <FormDescription>This must match the email from Firebase Authentication.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
             {mode === "edit" && user && (
              <>
                <FormItem>
                  <FormLabel>User ID (Firebase Auth UID)</FormLabel>
                  <FormControl><Input value={user.userId} disabled /></FormControl>
                </FormItem>
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input value={user.email} disabled /></FormControl>
                </FormItem>
              </>
            )}
            <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl><Input placeholder="e.g., John Doe" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fullname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Johnathan Michael Doe" {...field} value={field.value || ""} /></FormControl>
                  <FormDescription>Official full name, if different from display name.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select a role" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {userRoles.map((roleOption) => (
                        <SelectItem key={roleOption} value={roleOption}>{roleOption}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {mode === "create" && (
               <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Set Active</FormLabel>
                      <FormDescription>
                        Controls if the user can log in.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving..." : (mode === "create" ? "Create User Profile" : "Save Changes")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
