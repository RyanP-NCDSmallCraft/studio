
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, ClipboardList, Eye, Edit, Filter, Play, CheckSquare, ShieldAlert, CalendarDays, Loader2, AlertTriangle } from "lucide-react";
import type { Inspection } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { getInspections } from "@/actions/inspections"; // Import the server action

export default function InspectionListPage() {
  const { currentUser, isInspector, isAdmin, isRegistrar, isSupervisor, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const loadInspections = useCallback(async () => {
    if (!currentUser) {
      setInspections([]);
      setIsLoading(false);
      // setFetchError("Please log in to view inspections."); // User might not be logged in yet, wait for auth
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    try {
      const fetchedInspections = await getInspections();
      setInspections(fetchedInspections);
    } catch (error) {
      const errorMessage = (error as Error).message || "An unexpected error occurred while fetching inspections.";
      console.error("Failed to load inspections:", errorMessage, error);
      setFetchError(errorMessage);
      toast({
        title: "Error Loading Inspections",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (authLoading) {
      setIsLoading(true); // Show loading if auth is still processing
      return;
    }
    if (currentUser) {
      loadInspections();
    } else {
      // Not logged in and auth is resolved
      setIsLoading(false);
      setFetchError("Please log in to view inspections.");
      setInspections([]);
    }
  }, [currentUser, authLoading, loadInspections]);


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
                  <p>
                    Please check your Firebase console: ensure your Firestore Security Rules allow authenticated users (or the appropriate roles)
                    to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">read</code> from the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">inspections</code> collection.
                    Also, if fetching related data, ensure read access to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">registrations</code> and <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">users</code> collections is correctly configured.
                  </p>
                   <p className="text-xs text-muted-foreground mt-1">Detailed error: {fetchError}</p>
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
                  <TableHead>Inspection ID</TableHead>
                  <TableHead>Craft (Rego / Make/Model)</TableHead>
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
                    <TableCell className="font-medium">{insp.inspectionId}</TableCell>
                    <TableCell>
                      <div>{insp.registrationData?.scaRegoNo || insp.registrationData?.id || (typeof insp.registrationRef === 'string' ? insp.registrationRef : 'N/A')}</div>
                      <div className="text-xs text-muted-foreground">{insp.registrationData?.craftMake} {insp.registrationData?.craftModel}</div>
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
