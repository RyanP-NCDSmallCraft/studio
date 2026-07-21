
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
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { createUserProfile, updateUserProfileDetails } from "@/actions/users";
import { useAuth } from "@/hooks/useAuth";
import { initializeApp, deleteApp, getApps, type FirebaseApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { firebaseConfig } from "@/lib/firebase";
import { Copy, Check, KeyRound } from "lucide-react";

const userFormSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
  displayName: z.string().min(1, "Display name is required.").optional(),
  fullname: z.string().optional(),
  role: z.enum(["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] as [UserRole, ...UserRole[]]),
  isActive: z.boolean().default(true).optional(),
});

export type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormDialogProps {
  mode: "create" | "edit";
  user?: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

// Generates a cryptographically random password
function generateSecurePassword(length = 16): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (x) => charset[x % charset.length]).join("");
}

// Dialog shown after successful creation, displaying the temp password
function CreatedUserInfoDialog({
  open,
  onClose,
  email,
  password,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  password: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            User Created Successfully
          </DialogTitle>
          <DialogDescription>
            Share the following temporary credentials with the new user. They will be required to reset their password on first login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Email</p>
            <p className="font-mono text-sm bg-muted rounded px-3 py-2">{email}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Temporary Password</p>
            <div className="flex items-center gap-2">
              <p className="font-mono text-sm bg-muted rounded px-3 py-2 flex-1 break-all">{password}</p>
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copy password">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            ⚠️ This password will not be shown again. Please copy it now.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UserFormDialog({ mode, user, open, onOpenChange, onUserUpdated }: UserFormDialogProps) {
  const { toast } = useToast();
  const { currentUser: adminUser } = useAuth();
  const [createdUserInfo, setCreatedUserInfo] = useState<{ email: string; password: string } | null>(null);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      displayName: "",
      fullname: "",
      role: "ReadOnly",
      isActive: true,
    },
  });

  useEffect(() => {
    if (mode === "edit" && user) {
      form.reset({
        email: user.email,
        displayName: user.displayName || "",
        fullname: user.fullname || "",
        role: user.role,
        isActive: user.isActive,
      });
    } else if (mode === "create") {
      form.reset({
        email: "",
        displayName: "",
        fullname: "",
        role: "ReadOnly",
        isActive: true,
      });
    }
  }, [mode, user, open, form]);

  const onSubmit = async (data: UserFormData) => {
    if (!adminUser?.userId) {
      toast({ title: "Error", description: "Admin user not found. Please re-login.", variant: "destructive" });
      return;
    }

    try {
      if (mode === "create") {
        // Step 1: Generate a secure temporary password
        const tempPassword = generateSecurePassword();

        // Step 2: Create a secondary Firebase app instance so the admin is NOT logged out
        const secondaryAppName = `secondary-${Date.now()}`;
        let secondaryApp: FirebaseApp | null = null;
        let newUid: string;

        try {
          secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          const secondaryAuth = getAuth(secondaryApp);

          // Step 3: Create the Firebase Authentication user
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, data.email, tempPassword);
          newUid = userCredential.user.uid;

          // Step 4: Send a password reset email so the user is prompted to set their own password
          await sendPasswordResetEmail(secondaryAuth, data.email);

          // Sign out of the secondary instance
          await secondaryAuth.signOut();
        } finally {
          // Step 5: Always clean up the secondary app
          if (secondaryApp) {
            await deleteApp(secondaryApp);
          }
        }

        // Step 6: Create the Firestore profile using the new uid
        const result = await createUserProfile({
          userId: newUid,
          email: data.email,
          displayName: data.displayName,
          fullname: data.fullname,
          role: data.role,
          isActive: data.isActive !== undefined ? data.isActive : true,
        }, adminUser.userId);

        if (result.success) {
          onOpenChange(false);
          onUserUpdated();
          // Show the credentials dialog
          setCreatedUserInfo({ email: data.email, password: tempPassword });
        } else {
          let description = result.error || "Could not create user profile.";
          if (result.error?.toLowerCase().includes("permission check failed")) {
            description = `Server-side permission check failed: ${result.error}. Verify your admin role in Firestore.`;
          }
          toast({ title: "Profile Creation Failed", description, variant: "destructive" });
        }

      } else if (mode === "edit" && user) {
        const result = await updateUserProfileDetails(user.userId, {
          displayName: data.displayName,
          fullname: data.fullname,
          role: data.role,
        }, adminUser.userId);

        if (result.success) {
          toast({ title: "User Updated", description: `${data.displayName || data.email} has been updated.` });
          onUserUpdated();
          onOpenChange(false);
        } else {
          let description = result.error || "Could not update user profile.";
          if (result.error?.toLowerCase().includes("permission check failed")) {
            description = `Server-side permission check failed: ${result.error}. Verify your admin role in Firestore.`;
          }
          toast({ title: "Update Failed", description, variant: "destructive" });
        }
      }
    } catch (error: any) {
      // Handle Firebase Auth-specific errors with friendly messages
      let description = error.message || "An unexpected error occurred.";
      if (error.code === "auth/email-already-in-use") {
        description = "This email address is already registered in Firebase Authentication.";
      } else if (error.code === "auth/invalid-email") {
        description = "The email address is not valid.";
      } else if (error.code === "auth/weak-password") {
        description = "The generated password was rejected. Please try again.";
      }
      console.error(`Unexpected error during ${mode} user operation:`, error);
      toast({ title: "Operation Failed", description, variant: "destructive" });
    }
  };

  const userRoles: UserRole[] = ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Add New User" : "Edit User Details"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Fill in the details below. A temporary password will be auto-generated and a password-reset email will be sent to the new user."
                : `Editing details for ${user?.displayName || user?.email}`}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
              {mode === "edit" && user && (
                <>
                  <FormItem>
                    <FormLabel>User ID (Firebase Auth UID)</FormLabel>
                    <FormControl><Input value={user.userId} disabled /></FormControl>
                  </FormItem>
                </>
              )}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="user@example.com"
                        {...field}
                        disabled={mode === "edit"}
                      />
                    </FormControl>
                    {mode === "edit" && (
                      <FormDescription>Email cannot be changed after creation.</FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        <FormDescription>Controls if the user can log in.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? "Saving..." : (mode === "create" ? "Create User" : "Save Changes")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Credentials reveal dialog shown after successful creation */}
      {createdUserInfo && (
        <CreatedUserInfoDialog
          open={!!createdUserInfo}
          email={createdUserInfo.email}
          password={createdUserInfo.password}
          onClose={() => {
            setCreatedUserInfo(null);
          }}
        />
      )}
    </>
  );
}
