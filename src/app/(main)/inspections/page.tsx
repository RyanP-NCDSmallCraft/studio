
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, ClipboardList, Eye, Edit, Filter, Play, CheckSquare, CalendarDays, Loader2, AlertTriangle } from "lucide-react";
import type { Inspection, Registration, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where, doc, getDoc, Timestamp, type DocumentReference } from 'firebase/firestore';
import { db, auth as firebaseAuth } from '@/lib/firebase';

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
      console.warn('Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  console.warn(`Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function InspectionListPage() {
  const { currentUser, isAdmin, isRegistrar, isSupervisor, isInspector, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadInspections = useCallback(async () => {
    if (authLoading) {
      console.log("InspectionsPage: Auth is loading. Waiting to fetch inspections.");
      setIsLoading(true);
      return;
    }
    if (!currentUser) {
      console.log("InspectionsPage: No current user. Clearing inspections, not fetching.");
      setInspections([]);
      setIsLoading(false);
      setFetchError("Please log in to view inspections.");
      return;
    }

    console.log(`InspectionsPage: loadInspections called. User: ${currentUser.userId}, Role: ${currentUser.role}, Active: ${currentUser.isActive}`);
    console.log("InspectionsPage: Firebase SDK currentUser (auth.currentUser) UID:", firebaseAuth.currentUser?.uid);
    console.log("InspectionsPage: currentUser from useAuth:", currentUser);


    setIsLoading(true);
    setFetchError(null);
    try {
      let inspectionsQuery;
      if (currentUser.role === "Inspector" && !isAdmin && !isRegistrar && !isSupervisor) {
        const userDocRef = doc(db, "users", currentUser.userId);
        inspectionsQuery = query(collection(db, "inspections"), where("inspectorRef", "==", userDocRef));
        console.log("InspectionsPage: Query for Inspector:", currentUser.userId);
      } else {
        inspectionsQuery = query(collection(db, "inspections"));
        console.log("InspectionsPage: Query for Admin/Registrar/Supervisor (all inspections).");
      }
      const inspectionSnapshot = await getDocs(inspectionsQuery);
      console.log(`InspectionsPage: Fetched ${inspectionSnapshot.docs.length} inspection documents.`);

      const inspectionsPromises = inspectionSnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        let registrationData: Inspection['registrationData'] = undefined;
        let inspectorData: Inspection['inspectorData'] = undefined;

        try {
          if (data.registrationRef) {
            const regRefPath = data.registrationRef.path || (typeof data.registrationRef === 'string' ? `registrations/${data.registrationRef}` : null);
            if (regRefPath) {
                const regRef = doc(db, regRefPath) as DocumentReference<Registration>;
                const regDocSnap = await getDoc(regRef);
                if (regDocSnap.exists()) {
                    const regData = regDocSnap.data();
                    registrationData = {
                        id: regDocSnap.id,
                        scaRegoNo: regData.scaRegoNo,
                        hullIdNumber: regData.hullIdNumber,
                        craftMake: regData.craftMake,
                        craftModel: regData.craftModel,
                        craftType: regData.vesselType,
                    };
                } else {
                    console.warn(`InspectionsPage: Linked registration document ${regRefPath} not found for inspection ${docSnapshot.id}`);
                }
            } else {
                 console.warn(`InspectionsPage: Malformed registrationRef for inspection ${docSnapshot.id}:`, data.registrationRef);
            }
          }
        } catch (regError: any) {
          console.warn(`InspectionsPage: Failed to fetch related registration for inspection ${docSnapshot.id}: Code: ${regError.code}, Msg: ${regError.message}`, regError);
        }

        try {
          if (data.inspectorRef) {
            const inspRefPath = data.inspectorRef.path || (typeof data.inspectorRef === 'string' ? `users/${data.inspectorRef}` : null);
            if (inspRefPath) {
                const inspRef = doc(db, inspRefPath) as DocumentReference<User>;
                const inspectorDocSnap = await getDoc(inspRef);
                if (inspectorDocSnap.exists()) {
                    const inspData = inspectorDocSnap.data();
                    inspectorData = {
                        id: inspectorDocSnap.id,
                        displayName: inspData.displayName || inspData.email,
                    };
                } else {
                     console.warn(`InspectionsPage: Linked inspector document ${inspRefPath} not found for inspection ${docSnapshot.id}`);
                }
            } else {
                 console.warn(`InspectionsPage: Malformed inspectorRef for inspection ${docSnapshot.id}:`, data.inspectorRef);
            }
          }
        } catch (inspError: any) {
          console.warn(`InspectionsPage: Failed to fetch related inspector for inspection ${docSnapshot.id}: Code: ${inspError.code}, Msg: ${inspError.message}`, inspError);
        }
        
        const inspectionRefId = (data.registrationRef instanceof DocumentReference) ? data.registrationRef.id : (typeof data.registrationRef === 'string' ? data.registrationRef : (data.registrationRef?.id || null));
        const inspectorRefId = (data.inspectorRef instanceof DocumentReference) ? data.inspectorRef.id : (typeof data.inspectorRef === 'string' ? data.inspectorRef : (data.inspectorRef?.id || null));
        const createdByRefId = (data.createdByRef instanceof DocumentReference) ? data.createdByRef.id : (typeof data.createdByRef === 'string' ? data.createdByRef : (data.createdByRef?.id || null));
        const lastUpdatedByRefId = (data.lastUpdatedByRef instanceof DocumentReference) ? data.lastUpdatedByRef.id : (typeof data.lastUpdatedByRef === 'string' ? data.lastUpdatedByRef : (data.lastUpdatedByRef?.id || null));
        const reviewedByRefId = (data.reviewedByRef instanceof DocumentReference) ? data.reviewedByRef.id : (typeof data.reviewedByRef === 'string' ? data.reviewedByRef : (data.reviewedByRef?.id || null));


        return {
          inspectionId: docSnapshot.id,
          registrationRef: inspectionRefId,
          registrationData,
          inspectorRef: inspectorRefId,
          inspectorData,
          inspectionType: data.inspectionType || 'Initial',
          scheduledDate: ensureSerializableDate(data.scheduledDate),
          inspectionDate: ensureSerializableDate(data.inspectionDate),
          status: data.status || 'Scheduled',
          overallResult: data.overallResult,
          findings: data.findings,
          correctiveActions: data.correctiveActions,
          followUpRequired: data.followUpRequired || false,
          checklistItems: data.checklistItems || [],
          completedAt: ensureSerializableDate(data.completedAt),
          reviewedAt: ensureSerializableDate(data.reviewedAt),
          reviewedByRef: reviewedByRefId,
          createdAt: ensureSerializableDate(data.createdAt),
          createdByRef: createdByRefId,
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          lastUpdatedByRef: lastUpdatedByRefId,
        } as Inspection;
      });

      const resolvedInspections = await Promise.all(inspectionsPromises);
      setInspections(resolvedInspections.filter(inspection => inspection !== null) as Inspection[]);
    } catch (error: any) {
      const originalErrorMessage = error.message || "Unknown Firebase error";
      const originalErrorCode = error.code || "N/A";
      const detailedError = `Failed to fetch inspections from server. Original error: [${originalErrorCode}] ${originalErrorMessage}`;
      console.error("Failed to load inspections:", detailedError, error);
      console.error("Current user at time of error (InspectionsPage):", currentUser ? {uid: currentUser.userId, role: currentUser.role, isActive: currentUser.isActive} : "null");
      console.error("Auth SDK currentUser at time of error (InspectionsPage):", firebaseAuth.currentUser?.uid || "null");
      setFetchError(detailedError);
      toast({
        title: "Error Loading Inspections",
        description: detailedError,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isAdmin, isRegistrar, isSupervisor, toast, authLoading]); // Added authLoading to dependency array

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true); // Explicitly set loading if auth is still loading
      return;
    }
    if (currentUser) { // Only load if currentUser is resolved and present
      loadInspections();
    } else { // If auth is done and no user, then don't load
      setIsLoading(false);
      setFetchError("Please log in to view inspections.");
      setInspections([]);
    }
  }, [authLoading, currentUser, loadInspections]);


  const getStatusBadgeVariant = (status?: Inspection["status"]) => {
    switch (status) {
      case "Passed": return "default";
      case "Failed": return "destructive";
      case "Scheduled": return "secondary";
      case "InProgress": return "outline"; 
      case "PendingReview": return "outline"; 
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };
  
  const retryLoadInspections = () => {
    if (currentUser && !authLoading) {
      loadInspections();
    } else if (!authLoading && !currentUser) {
      setFetchError("Please log in to retry fetching inspections.");
    }
  };

  if (authLoading && isLoading) {
    return (
      <div className="flex h-64 justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading application data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
         <div className="flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Craft Inspections</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          {(isRegistrar || isAdmin || isSupervisor) && (
            <Button asChild>
              <Link href="/inspections/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Schedule New Inspection
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Inspection Overview</CardTitle>
          <CardDescription>Manage and track all craft safety inspections.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Fetching inspections...</p>
            </div>
          ) : fetchError ? (
             <div className="text-center py-10">
              {(fetchError.includes("permission-denied") || fetchError.includes("Missing or insufficient permissions")) ? (
                <div className="text-destructive space-y-2 p-4 border border-destructive/50 rounded-md bg-destructive/10">
                  <div className="flex justify-center items-center mb-2">
                    <AlertTriangle className="h-10 w-10 mr-2" />
                    <h3 className="text-xl font-semibold">Permission Denied</h3>
                  </div>
                  <p>Could not load inspections due to missing Firestore permissions.</p>
                  <p className="font-medium mt-2">Please check your Firebase console and ensure your Firestore Security Rules allow:</p>
                  <ul className="list-disc list-inside text-left text-sm mx-auto max-w-md">
                    <li>Your current role ({currentUser?.role || 'Unknown Role'}) to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">read</code> from the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">inspections</code> collection.</li>
                    <li>If querying by inspector, ensure the query conditions match your rules for inspectors.</li>
                    <li>Read access to the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">registrations</code> collection (for linked craft details).</li>
                    <li>Read access to the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">users</code> collection (for inspector details and for your role/active status check in rules via `get()` ).</li>
                  </ul>
                  <p className="mt-2">Ensure your user document in Firestore (<code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">/users/{currentUser?.userId || 'YOUR_USER_ID'}</code>) has the correct <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">role</code> and <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">isActive: true</code> fields.</p>
                   <p className="text-xs text-muted-foreground mt-1">Detailed error: {fetchError}</p>
                   <p className="text-xs text-muted-foreground mt-1">Current User (Client): ID: {currentUser?.userId || 'N/A'}, Role: {currentUser?.role || 'N/A'}, Active: {currentUser?.isActive !== undefined ? String(currentUser.isActive) : 'N/A'}</p>
                </div>
              ) : (
                <p className="text-destructive">{fetchError}</p>
              )}
              {currentUser && <Button onClick={retryLoadInspections} className="mt-4">Retry</Button>}
              {!currentUser && !authLoading && <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Inspection ID / Craft Rego</TableHead>
                  <TableHead>Craft Make/Model</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Scheduled</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inspector</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inspections.length > 0 ? inspections.map((insp) => {
                  const canBeStartedByCurrentUser = (isInspector && insp.inspectorData?.id === currentUser?.userId) || isAdmin || isRegistrar || isSupervisor;
                  const canEditScheduleByCurrentUser = (isAdmin || isRegistrar || isSupervisor);
                  const canContinueConductingByCurrentUser = (isInspector && insp.inspectorData?.id === currentUser?.userId && insp.status === "InProgress") || ((isAdmin || isRegistrar || isSupervisor) && insp.status === "InProgress");
                  const canReviewByCurrentUser = (isRegistrar || isAdmin);

                  return (
                  <TableRow key={insp.inspectionId}>
                    <TableCell className="font-medium">{insp.registrationData?.scaRegoNo || insp.inspectionId}</TableCell>
                    <TableCell>
                      <div>{insp.registrationData?.craftMake} {insp.registrationData?.craftModel}</div>
                      <div className="text-xs text-muted-foreground">HIN: {insp.registrationData?.hullIdNumber || 'N/A'}</div>
                    </TableCell>
                    <TableCell>{insp.inspectionType}</TableCell>
                    <TableCell>{formatFirebaseTimestamp(insp.scheduledDate, "PP")}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(insp.status)}>{insp.status}</Badge>
                    </TableCell>
                    <TableCell>{insp.inspectorData?.displayName || (typeof insp.inspectorRef === 'string' ? insp.inspectorRef : "N/A")}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" asChild title="View Details">
                        <Link href={`/inspections/${insp.inspectionId}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                      
                      {insp.status === "Scheduled" && canBeStartedByCurrentUser && (
                         <Button variant="ghost" size="icon" asChild title="Start Inspection">
                          <Link href={`/inspections/${insp.inspectionId}/conduct`}><Play className="h-4 w-4 text-green-500" /></Link>
                        </Button>
                      )}

                      {(insp.status === "Scheduled" || insp.status === "InProgress") && canEditScheduleByCurrentUser && (
                         <Button variant="ghost" size="icon" asChild title="Edit Schedule/Assignment">
                          <Link href={`/inspections/${insp.inspectionId}/edit-schedule`}><CalendarDays className="h-4 w-4" /></Link>
                        </Button>
                      )}
                      
                      {insp.status === "InProgress" && canContinueConductingByCurrentUser && (
                         <Button variant="ghost" size="icon" asChild title="Continue/Edit Inspection">
                          <Link href={`/inspections/${insp.inspectionId}/conduct`}><Edit className="h-4 w-4" /></Link>
                        </Button>
                      )}

                      {insp.status === "PendingReview" && canReviewByCurrentUser && (
                         <Button variant="ghost" size="icon" asChild title="Review Inspection">
                          <Link href={`/inspections/${insp.inspectionId}`}><CheckSquare className="h-4 w-4 text-blue-500" /></Link>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}) : (
                   <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No inspections found.
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

