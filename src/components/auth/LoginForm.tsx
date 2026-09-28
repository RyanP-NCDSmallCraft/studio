
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithEmailAndPassword, sendPasswordResetEmail, type UserCredential } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { Mail, Lock, LogIn, KeyRound, LifeBuoy, Send, CheckCircle2, HelpCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<"email" | "support">("email");

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    console.log("LoginForm: Attempting to sign in with email:", data.email);
    try {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, data.email, data.password);
      console.log("LoginForm: signInWithEmailAndPassword successful. Firebase User UID:", userCredential.user.uid);
      toast({ title: "Login Successful", description: "Welcome back! Redirecting..." });
      router.push("/dashboard"); 
    } catch (error: any) {
      console.error("LoginForm: Login error:", error);
      const errorMessage = error.code === "auth/invalid-credential" 
        ? "Invalid email or password."
        : "An error occurred during login. Please try again.";
      toast({
        title: "Login Failed",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleOpenResetDialog = () => {
    const currentEmail = form.getValues("email");
    setResetEmail(currentEmail || "");
    setResetSentSuccess(false);
    setActiveTab("email");
    setIsResetDialogOpen(true);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes("@")) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSentSuccess(true);
      toast({
        title: "Password Reset Email Sent",
        description: `Instructions to reset your password have been sent to ${resetEmail}.`,
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      let errorMessage = "Failed to send reset email. Please contact internal support.";
      if (error.code === "auth/user-not-found") {
        errorMessage = "No registered user account found with this email address.";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email address format.";
      }
      toast({
        title: "Reset Request Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl>
                    <Input type="email" placeholder="your@email.com" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Password</FormLabel>
                  <Button
                    type="button"
                    variant="link"
                    className="p-0 text-xs font-normal text-muted-foreground hover:text-primary"
                    onClick={handleOpenResetDialog}
                  >
                    Forgot password?
                  </Button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} className="pl-10" />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Signing In..." : "Sign In"}
            {!form.formState.isSubmitting && <LogIn className="ml-2 h-4 w-4" />}
          </Button>
        </form>
      </Form>

      {/* Password Reset & Support Modal */}
      <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Password Reset &amp; Support
            </DialogTitle>
            <DialogDescription>
              Reset your password using your email or contact internal system administration.
            </DialogDescription>
          </DialogHeader>

          {/* Navigation Tabs */}
          <div className="flex border-b text-sm font-medium">
            <button
              type="button"
              className={`pb-2 px-4 border-b-2 transition-colors ${
                activeTab === "email"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("email")}
            >
              Reset via Email
            </button>
            <button
              type="button"
              className={`pb-2 px-4 border-b-2 transition-colors ${
                activeTab === "support"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveTab("support")}
            >
              Internal Support Request
            </button>
          </div>

          {activeTab === "email" ? (
            <div className="space-y-4 py-2">
              {resetSentSuccess ? (
                <div className="p-4 rounded-md bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300 border border-green-200 dark:border-green-800 space-y-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    Reset Link Dispatched
                  </div>
                  <p className="text-xs">
                    We have sent a password reset link to <strong>{resetEmail}</strong>. Please check your email inbox (and spam folder) to complete your password reset.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendResetEmail} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Enter your registered email address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="your@email.com"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      An automated password reset link will be sent to this email address.
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={isSendingReset}>
                    {isSendingReset ? "Sending Reset Email..." : "Send Reset Link"}
                    {!isSendingReset && <Send className="ml-2 h-4 w-4" />}
                  </Button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2 text-sm">
              <div className="p-3 border rounded-md bg-muted/40 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-primary">
                  <LifeBuoy className="h-4 w-4" /> Internal RegoCraft IT Support
                </div>
                <p className="text-xs text-muted-foreground">
                  Since RegoCraft is an internal system, system administrators can reset passwords directly or issue temporary credentials.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">How to Request Help:</p>
                <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground">
                  <li>
                    Contact your local <strong>RegoCraft System Administrator</strong> to trigger a password reset for your account from the User Management panel.
                  </li>
                  <li>
                    Send an internal support request email to:{" "}
                    <a href="mailto:support@ncdsmallcraft.com" className="text-primary underline font-medium">
                      support@ncdsmallcraft.com
                    </a>
                  </li>
                  <li>Provide your registered staff email and official Display Name when submitting requests.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={() => setIsResetDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
