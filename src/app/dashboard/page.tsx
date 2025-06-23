
"use client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { 
  Users, Ship, ClipboardList, ArrowRight, Info, Loader2, AlertTriangle, 
  CheckCircle, FileEdit, Ban, PauseCircle, AlertOctagon, UserCheck, Siren, CalendarClock
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import React, { useState, useEffect, useCallback } from "react";
import { collection, query, where, getCountFromServer, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const { currentUser, isAdmin, isRegistrar, isInspector, isSupervisor, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Existing counts
  const [pendingRegistrationsCount, setPendingRegistrationsCount] = useState<number | null>(null);
  const [generalPendingInspectionsCount, setGeneralPendingInspectionsCount] = useState<number | null>(null);
  const [userInspectionsCount, setUserInspectionsCount] = useState<number | null>(null);

  // New counts
  const [approvedRegistrationsCount, setApprovedRegistrationsCount] = useState<number | null>(null);
  const [draftRegistrationsCount, setDraftRegistrationsCount] = useState<number | null>(null);
  const [suspendedRegistrationsCount, setSuspendedRegistrationsCount] = useState<number | null>(null);
  const [revokedRegistrationsCount, setRevokedRegistrationsCount] = useState<number | null>(null);
  const [pendingInfringementsCount, setPendingInfringementsCount] = useState<number | null>(null);
  const [expiringRegistrationsCount, setExpiringRegistrationsCount] = useState<number | null>(null);
  
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
      const regsRef = collection(db, "registrations");
      const inspsRef = collection(db, "inspections");
      const infringementsRef = collection(db, "infringements");

      // Fetch pending registrations for Admin/Registrar/Supervisor
      if (isAdmin || isRegistrar || isSupervisor) {
        // Reverted query to exclude "Draft"
        const pendingRegsQuery = query(regsRef, where("status", "in", ["Submitted", "PendingReview", "RequiresInfo"]));
        const pendingRegsSnapshot = await getCountFromServer(pendingRegsQuery);
        setPendingRegistrationsCount(pendingRegsSnapshot.data().count);

        const approvedRegsQuery = query(regsRef, where("status", "==", "Approved"));
        const approvedRegsSnapshot = await getCountFromServer(approvedRegsQuery);
        setApprovedRegistrationsCount(approvedRegsSnapshot.data().count);
        
        // Separate count for Draft
        const draftRegsQuery = query(regsRef, where("status", "==", "Draft"));
        const draftRegsSnapshot = await getCountFromServer(draftRegsQuery);
        setDraftRegistrationsCount(draftRegsSnapshot.data().count);

        const suspendedRegsQuery = query(regsRef, where("status", "==", "Suspended"));
        const suspendedRegsSnapshot = await getCountFromServer(suspendedRegsQuery);
        setSuspendedRegistrationsCount(suspendedRegsSnapshot.data().count);

        const revokedRegsQuery = query(regsRef, where("status", "==", "Revoked"));
        const revokedRegsSnapshot = await getCountFromServer(revokedRegsQuery);
        setRevokedRegistrationsCount(revokedRegsSnapshot.data().count);
        
        const pendingInfringementsQuery = query(infringementsRef, where("status", "in", ["Issued", "PendingReview"]));
        const pendingInfringementsSnapshot = await getCountFromServer(pendingInfringementsQuery);
        setPendingInfringementsCount(pendingInfringementsSnapshot.data().count);

        // Upcoming expirations query
        const threeMonthsFromNow = new Date();
        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
        const expiringRegsQuery = query(
          regsRef,
          where("status", "==", "Approved"),
          where("expiryDate", ">=", Timestamp.now()),
          where("expiryDate", "<=", Timestamp.fromDate(threeMonthsFromNow))
        );
        const expiringRegsSnapshot = await getCountFromServer(expiringRegsQuery);
        setExpiringRegistrationsCount(expiringRegsSnapshot.data().count);

      } else {
        setPendingRegistrationsCount(0);
        setApprovedRegistrationsCount(0);
        setDraftRegistrationsCount(0);
        setSuspendedRegistrationsCount(0);
        setRevokedRegistrationsCount(0);
        setPendingInfringementsCount(0);
        setExpiringRegistrationsCount(0);
      }

      // Fetch general pending inspections for Admin/Supervisor/Registrar
      if (isAdmin || isSupervisor || isRegistrar) {
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
          inspsRef,
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
      const fullErrorMessage = `Could not load dashboard statistics. ${error.message}. Firestore Code: ${error.code || 'N/A'}. Check Firestore rules and indexes.`;
      setStatsError(fullErrorMessage);
      toast({
        title: "Dashboard Error",
        description: "Failed to load some statistics. Check connection or permissions.",
        variant: "destructive",
      });
      // Set counts to null or 0 on error
      setPendingRegistrationsCount(null);
      setApprovedRegistrationsCount(null);
      setDraftRegistrationsCount(null);
      setSuspendedRegistrationsCount(null);
      setRevokedRegistrationsCount(null);
      setPendingInfringementsCount(null);
      setGeneralPendingInspectionsCount(null);
      setUserInspectionsCount(null);
      setExpiringRegistrationsCount(null);
    } finally {
      setLoadingStats(false);
    }
  }, [currentUser, isAdmin, isRegistrar, isInspector, isSupervisor, toast]);

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchDashboardStats();
    } else if (!authLoading && !currentUser) {
      setLoadingStats(false); 
    }
  }, [authLoading, currentUser, fetchDashboardStats]);

  if (authLoading || (!currentUser && !statsError && loadingStats)) { 
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading dashboard...</p>
      </div>
    );
  }
  
   if (!currentUser) { 
     return (
        <Card>
            <CardHeader>
                <CardTitle>Please Log In</CardTitle>
            </CardHeader>
            <CardContent>
                <p>{statsError || "You need to be logged in to view the dashboard content."}</p>
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

      {statsError && !loadingStats && ( 
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Stats</AlertTitle>
          <AlertDescription>
            There was an issue fetching dashboard statistics: {statsError}
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
          <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Upcoming Expirations</CardTitle>
              <CalendarClock className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(expiringRegistrationsCount)}</div>
              <p className="text-xs text-muted-foreground">Registrations expiring in the next 3 months</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/registrations?status=Approved">View Approved <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registered Craft</CardTitle>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(approvedRegistrationsCount)}</div>
              <p className="text-xs text-muted-foreground">Total craft with 'Approved' status</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/registrations?status=Approved">View Approved <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
              <Ship className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(pendingRegistrationsCount)}</div>
              {/* Reverted description text */}
              <p className="text-xs text-muted-foreground">Crafts awaiting review or info (Submitted, PendingReview, RequiresInfo)</p>
              <Button asChild size="sm" className="mt-4">
                {/* Reverted link */}
                <Link href="/registrations?status=Submitted,PendingReview,RequiresInfo">View Pending <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Draft Registrations (Alone)</CardTitle>
              <FileEdit className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(draftRegistrationsCount)}</div>
              <p className="text-xs text-muted-foreground">Registrations saved as 'Draft'</p>
               <Button asChild size="sm" className="mt-4">
                <Link href="/registrations?status=Draft">View Drafts <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Suspended Registrations</CardTitle>
              <PauseCircle className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(suspendedRegistrationsCount)}</div>
              <p className="text-xs text-muted-foreground">Craft with 'Suspended' status</p>
               <Button asChild size="sm" className="mt-4">
                <Link href="/registrations?status=Suspended">View Suspended <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revoked Registrations</CardTitle>
              <Ban className="h-5 w-5 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(revokedRegistrationsCount)}</div>
              <p className="text-xs text-muted-foreground">Craft with 'Revoked' status</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/registrations?status=Revoked">View Revoked <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Infringements</CardTitle>
              <Siren className="h-5 w-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(pendingInfringementsCount)}</div>
              <p className="text-xs text-muted-foreground">Infringements 'Issued' or 'PendingReview'</p>
              <Button asChild size="sm" className="mt-4">
                <Link href="/infringements?status=Issued,PendingReview">View Pending <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </CardContent>
          </Card>
          </>
        )}

        {(isAdmin || isInspector || isSupervisor || isRegistrar) && ( 
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Inspections (System-wide)</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{renderStat(generalPendingInspectionsCount)}</div>
              <p className="text-xs text-muted-foreground">Inspections needing action or review (Scheduled, InProgress, PendingReview)</p>
               <Button asChild size="sm" className="mt-4">
                <Link href="/inspections?status=Scheduled,InProgress,PendingReview">View Inspections <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
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
              <div className="text-2xl font-bold">{renderStat(userInspectionsCount)}</div>
              <p className="text-xs text-muted-foreground">Inspections assigned to you (Scheduled, InProgress, PendingReview)</p>
               <Button asChild size="sm" className="mt-4">
                <Link href="/inspections?assignedTo=me&status=Scheduled,InProgress,PendingReview">View Your Inspections <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
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
            <>
            <Button asChild variant="secondary">
                <Link href="/operator-licenses">Manage Operator Licenses</Link>
            </Button>
            <Button asChild variant="secondary">
                <Link href="/infringements">Manage Infringements</Link>
            </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


    

    

