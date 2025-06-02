
"use client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, Ship, ClipboardList, ArrowRight, Info, Loader2, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getCountFromServer, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { currentUser, isAdmin, isRegistrar, isInspector, isSupervisor, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState<number | null>(null);
  const [generalPendingInspectionsCount, setGeneralPendingInspectionsCount] = useState<number | null>(null);
  const [userInspectionsCount, setUserInspectionsCount] = useState<number | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const fetchDashboardStats = useCallback(async () => {
    if (!currentUser) {
      setLoadingStats(false);
      return;
    }

    setLoadingStats(true);
    setStatsError(null);

    try {
      // Fetch pending registrations for Admin/Registrar/Supervisor
      if (isAdmin || isRegistrar || isSupervisor) {
        const regsRef = collection(db, "registrations");
        const pendingRegsQuery = query(regsRef, where("status", "in", ["Submitted", "PendingReview", "RequiresInfo"]));
        const pendingRegsSnapshot = await getCountFromServer(pendingRegsQuery);
        setPendingRegistrationsCount(pendingRegsSnapshot.data().count);
      } else {
        setPendingRegistrationsCount(0);
      }

      // Fetch general pending inspections for Admin/Supervisor/Registrar
      if (isAdmin || isSupervisor || isRegistrar) {
        const inspsRef = collection(db, "inspections");
        const generalPendingInspsQuery = query(inspsRef, where("status", "in", ["Scheduled", "InProgress", "PendingReview"]));
        const generalPendingInspsSnapshot = await getCountFromServer(generalPendingInspsQuery);
        setGeneralPendingInspectionsCount(generalPendingInspsSnapshot.data().count);
      } else {
        setGeneralPendingInspectionsCount(0);
      }
      
      // Fetch user-specific inspections for Inspectors
      if (isInspector) {
        const userInspectorRef = doc(db, "users", currentUser.userId);
        const userInspsQuery = query(
          collection(db, "inspections"),
          where("inspectorRef", "==", userInspectorRef),
          where("status", "in", ["Scheduled", "InProgress", "PendingReview"])
        );
        const userInspsSnapshot = await getCountFromServer(userInspsQuery);
        setUserInspectionsCount(userInspsSnapshot.data().count);
      } else {
         setUserInspectionsCount(0);
      }

    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      setStatsError("Could not load dashboard statistics. " + error.message);
      toast({
        title: "Dashboard Error",
        description: "Failed to load some statistics. Please check your connection or permissions.",
        variant: "destructive",
      });
      // Set counts to null or 0 on error to avoid showing stale data or breaking UI
      setPendingRegistrationsCount(null);
      setGeneralPendingInspectionsCount(null);
      setUserInspectionsCount(null);
    } finally {
      setLoadingStats(false);
    }
  }, [currentUser, isAdmin, isRegistrar, isInspector, isSupervisor, toast]);

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchDashboardStats();
    } else if (!authLoading && !currentUser) {
      setLoadingStats(false); // Not logged in, no stats to load
    }
  }, [authLoading, currentUser, fetchDashboardStats]);

  if (authLoading || (!currentUser && !statsError)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }
  
  if (!currentUser && statsError) { // Handles case where statsError is set due to no user
     return (
        <Card>
            <CardHeader>
                <CardTitle className="text-destructive">Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{statsError || "You must be logged in to view the dashboard."}</p>
                <Button asChild className="mt-4"><Link href="/login">Login</Link></Button>
            </CardContent>
        </Card>
     );
  }
  
   if (!currentUser) { // Fallback for no user, if not caught by statsError
     return (
        <Card>
            <CardHeader>
                <CardTitle>Please Log In</CardTitle>
            </CardHeader>
            <CardContent>
                <p>You need to be logged in to view the dashboard content.</p>
                <Button asChild className="mt-4"><Link href="/login">Login</Link></Button>
            </CardContent>
        </Card>
     );
  }


  const getRoleSpecificGreeting = () => {
    switch (currentUser.role) {
      case "Admin": return "Oversee and manage all system activities.";
      case "Supervisor": return "Manage inspections and review submissions.";
      case "Registrar": return "Manage craft registrations and process applications.";
      case "Inspector": return "Conduct craft inspections and submit reports.";
      case "ReadOnly": return "View system data.";
      default: return "Welcome to RegoCraft!";
    }
  };
  
  const renderStat = (count: number | null) => {
    if (loadingStats) return <Loader2 className="h-6 w-6 animate-spin" />;
    if (count === null && statsError) return <span className="text-destructive text-lg">Error</span>;
    if (count === null) return <span className="text-muted-foreground text-lg">N/A</span>;
    return count;
  };


  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {currentUser.displayName || currentUser.email}!</CardTitle>
          <CardDescription className="text-lg">{getRoleSpecificGreeting()}</CardDescription>
        </CardHeader>
      </Card>

      {statsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Stats</AlertTitle>
          <AlertDescription>
            There was an issue fetching some dashboard statistics: {statsError}
          </AlertDescription>
        </Alert>
      )}
      
      {(isAdmin || isSupervisor) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Admin/Supervisor View</AlertTitle>
          <AlertDescription>
            You have access to high-level system management and overview.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(isAdmin || isRegistrar || isSupervisor) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
              <Ship className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {renderStat(pendingRegistrationsCount)}
              </div>
              <p className="text-xs text-muted-foreground">Crafts awaiting review or approval</p>
              {(isRegistrar || isAdmin) && (
                 <Button asChild size="sm" className="mt-4">
                  <Link href="/registrations/new">New Registration <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {(isAdmin || isInspector || isSupervisor || isRegistrar) && ( // Registrar also sees general pending inspections
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Inspections (System-wide)</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {renderStat(generalPendingInspectionsCount)}
              </div>
              <p className="text-xs text-muted-foreground">Inspections needing action or review</p>
            </CardContent>
          </Card>
        )}
        
        {isInspector && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Pending Inspections</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {renderStat(userInspectionsCount)}
              </div>
              <p className="text-xs text-muted-foreground">Inspections assigned to you that are scheduled or in progress</p>
            </CardContent>
          </Card>
        )}
        
        {(isAdmin || isSupervisor) && (
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Management</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Manage system users and roles.</p>
               <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/admin/users">Go to Users <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild variant="secondary">
            <Link href="/registrations">View All Registrations</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/inspections">View All Inspections</Link>
          </Button>
          {(isAdmin || isRegistrar || isSupervisor) && (
            <Button asChild variant="secondary">
                <Link href="/operator-licenses">Manage Operator Licenses</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
