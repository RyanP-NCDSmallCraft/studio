
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, ClipboardList, Eye, Edit, Filter, Play, CheckSquare, CalendarDays, Loader2, AlertTriangle, PlayCircle } from "lucide-react";
import type { Inspection, Registration, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where, doc, getDoc, Timestamp, DocumentReference, type QueryConstraint } from 'firebase/firestore'; 
import { db, auth as firebaseAuth } from '@/lib/firebase';
import { useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";


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
      // console.warn('Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  // console.warn('InspectionsPage: Could not convert field to a serializable Date:', dateValue);
  return undefined;
};

const INSPECTION_STATUSES: Inspection['status'][] = ["Scheduled", "InProgress", "PendingReview", "Passed", "Failed", "Cancelled"];


export default function InspectionListPage() {
  const { currentUser, isAdmin, isRegistrar, isSupervisor, isInspector, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [assignedToMeFilter, setAssignedToMeFilter] = useState(false);

  useEffect(() => {
    const statusesFromUrl = searchParams.get('status')?.split(',') || [];
    setStatusFilter(statusesFromUrl.filter(s => s));
    setAssignedToMeFilter(searchParams.get('assignedTo') === 'me');
  }, [searchParams]);


  const loadInspections = useCallback(async () => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (!currentUser) {
      setInspections([]);
      setIsLoading(false);
      setFetchError("Please log in to view inspections.");
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    
    try {
      const queryConstraints: QueryConstraint[] = [];
      const assignedToMe = searchParams.get('assignedTo') === 'me';
      const statusParam = searchParams.get('status');

      if (assignedToMe) {
          const userDocRef = doc(db, "users", currentUser.userId);
          queryConstraints.push(where("inspectorRef", "==", userDocRef));
      } else if (isInspector && !isAdmin && !isRegistrar && !isSupervisor) {
          const userDocRef = doc(db, "users", currentUser.userId);
          queryConstraints.push(where("inspectorRef", "==", userDocRef));
      }

      if (statusParam) {
          const statusArray = statusParam.split(',').filter(s => s);
          if (statusArray.length > 0) {
              queryConstraints.push(where("status", "in", statusArray));
          }
      }

      const inspectionsQuery = query(collection(db, "inspections"), ...queryConstraints);
      const inspectionSnapshot = await getDocs(inspectionsQuery);

      const inspectionsPromises = inspectionSnapshot.docs.map(async (docSnapshot) => {
        const data = docSnapshot.data();
        let registrationData: Inspection['registrationData'] = undefined;
        let inspectorData: Inspection['inspectorData'] = undefined;

        if (data.registrationRef) {
          try {
            let regRef: DocumentReference<Registration>;
            if (data.registrationRef instanceof DocumentReference) {
              regRef = data.registrationRef as DocumentReference<Registration>;
            } else if (typeof data.registrationRef === 'string') {
              regRef = doc(db, "registrations", data.registrationRef) as DocumentReference<Registration>;
            } else if (data.registrationRef.id && typeof data.registrationRef.id === 'string') { 
                regRef = doc(db, "registrations", data.registrationRef.id) as DocumentReference<Registration>;
            } else {
                 throw new Error("Malformed registrationRef");
            }

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
            }
          } catch (regError: any) {
          }
        }

        if (data.inspectorRef) {
          try {
            let inspRef: DocumentReference<User>;
            if (data.inspectorRef instanceof DocumentReference) {
              inspRef = data.inspectorRef as DocumentReference<User>;
            } else if (typeof data.inspectorRef === 'string') {
              inspRef = doc(db, "users", data.inspectorRef) as DocumentReference<User>;
            } else if (data.inspectorRef.id && typeof data.inspectorRef.id === 'string') { 
                inspRef = doc(db, "users", data.inspectorRef.id) as DocumentReference<User>;
            } else {
                throw new Error("Malformed inspectorRef");
            }
            const inspectorDocSnap = await getDoc(inspRef);
            if (inspectorDocSnap.exists()) {
              const inspData = inspectorDocSnap.data();
              inspectorData = {
                id: inspectorDocSnap.id,
                displayName: inspData.displayName || inspData.email,
              };
            }
          } catch (inspError: any) {
          }
        }
        
        const getRefId = (refField: any): string | undefined => {
            if (refField instanceof DocumentReference) return refField.id;
            if (typeof refField === 'string') return refField;
            if (refField && typeof refField.id === 'string') return refField.id; 
            return undefined;
        };

        return {
          inspectionId: docSnapshot.id,
          displayId: data.displayId, // Added displayId
          registrationRef: getRefId(data.registrationRef),
          registrationData,
          inspectorRef: getRefId(data.inspectorRef),
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
          reviewedByRef: getRefId(data.reviewedByRef),
          createdAt: ensureSerializableDate(data.createdAt),
          createdByRef: getRefId(data.createdByRef),
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          lastUpdatedByRef: getRefId(data.lastUpdatedByRef),
        } as Inspection;
      });

      const resolvedInspections = await Promise.all(inspectionsPromises);
      setInspections(resolvedInspections.filter(inspection => inspection !== null) as Inspection[]);
    } catch (error: any) {
      const originalErrorMessage = error.message || "Unknown Firebase error";
      const originalErrorCode = error.code || "N/A";
      const detailedError = `Failed to fetch inspections from server. Original error: [${originalErrorCode}] ${originalErrorMessage}`;
      setFetchError(detailedError);
      toast({
        title: "Error Loading Inspections",
        description: detailedError,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, isAdmin, isRegistrar, isSupervisor, isInspector, toast, authLoading, searchParams]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }
    if (currentUser) {
      loadInspections();
    } else {
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

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    const newStatusFilter = checked
      ? [...statusFilter, status]
      : statusFilter.filter((s) => s !== status);
    
    const params = new URLSearchParams(searchParams.toString());
    if (newStatusFilter.length > 0) {
      params.set('status', newStatusFilter.join(','));
    } else {
      params.delete('status');
    }
    router.push(`/inspections?${params.toString()}`);
  };

  const handleAssignedToMeChange = (checked: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.set('assignedTo', 'me');
    } else {
      params.delete('assignedTo');
    }
    router.push(`/inspections?${params.toString()}`);
  };

  if (authLoading && isLoading) {
    return (
      <div className="flex h-64 justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading application data...</p>
      </div>
    );
  }
  
  const canManageInspections = isAdmin || isRegistrar || isSupervisor;
  const canConductInspections = isInspector || canManageInspections;
  const activeFilterCount = statusFilter.length + (assignedToMeFilter ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
         <div className="flex items-center gap-2">
          <ClipboardList className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Craft Inspections</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                {activeFilterCount > 0 && (
                  <>
                    <Separator orientation="vertical" className="mx-2 h-4" />
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {activeFilterCount}
                    </Badge>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={assignedToMeFilter}
                onCheckedChange={handleAssignedToMeChange}
              >
                Assigned to me
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
               <DropdownMenuLabel>Status</DropdownMenuLabel>
              {INSPECTION_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilter.includes(status)}
                  onCheckedChange={(checked) => handleStatusFilterChange(status, !!checked)}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {canConductInspections && (
             <Button asChild variant="secondary">
              <Link href="/inspections/conduct-new">
                <PlayCircle className="mr-2 h-4 w-4" /> Start On-the-Spot
              </Link>
            </Button>
          )}
          {canManageInspections && (
            <Button asChild>
              <Link href="/inspections/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Schedule New
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
                    <TableCell className="font-medium">
                        <div>{insp.displayId || insp.inspectionId}</div>
                        <div className="text-xs text-muted-foreground">{insp.registrationData?.scaRegoNo || "N/A"}</div>
                    </TableCell>
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
