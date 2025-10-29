
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Inspection, ChecklistItemResult, Registration, User } from "@/types";
import { ClipboardList, Ship, User as UserIconLucide, CalendarDays, CheckSquare, XSquare, AlertTriangle, Edit, MessageSquare, Image as ImageIcon, Play, ShieldCheck, ShieldX, Loader2, ArrowLeft, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import Image from "next/image";
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
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, updateDoc, Timestamp, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isValid } from 'date-fns';

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
      console.warn('InspectionDetailPage: Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  console.warn(`InspectionDetailPage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function InspectionDetailPage() {
  const params = useParams();
  const inspectionId = params.id as string;
  const { currentUser, isInspector, isSupervisor, isAdmin, isRegistrar } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);

  const fetchInspectionDetails = useCallback(async () => {
    if (!inspectionId) {
      setError("Inspection ID is missing.");
      setLoading(false);
      return;
    }
    if (!currentUser) { // Ensure currentUser is available before fetching
      setLoading(false);
      setError("User not authenticated.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inspectionDocRef = doc(db, "inspections", inspectionId);
      const inspectionSnap = await getDoc(inspectionDocRef);

      if (inspectionSnap.exists()) {
        const data = inspectionSnap.data();

        let registrationData: Inspection['registrationData'] = undefined;
        if (data.registrationRef) {
          try {
            let regRefPath: string;
            if (data.registrationRef instanceof DocumentReference) {
              regRefPath = data.registrationRef.path;
            } else if (typeof data.registrationRef === 'string') {
              regRefPath = data.registrationRef.startsWith('registrations/') ? data.registrationRef : `registrations/${data.registrationRef}`;
            } else if (data.registrationRef.id && typeof data.registrationRef.id === 'string') {
                regRefPath = `registrations/${data.registrationRef.id}`;
            } else {
              throw new Error("Malformed registrationRef in inspection document.");
            }

            const regDocSnap = await getDoc(doc(db, regRefPath));
            if (regDocSnap.exists()) {
              const regData = regDocSnap.data() as Registration;
              registrationData = {
                id: regDocSnap.id,
                scaRegoNo: regData.scaRegoNo,
                hullIdNumber: regData.hullIdNumber,
                craftType: regData.vesselType,
                craftMake: regData.craftMake,
                craftModel: regData.craftModel,
                craftImageUrl: regData.craftImageUrl, 
              };
            }
          } catch (regError) {
            console.warn("Failed to fetch linked registration:", regError);
            // Keep going, registrationData will be undefined
          }
        }

        let inspectorData: Inspection['inspectorData'] = undefined;
        if (data.inspectorRef) {
          try {
            let inspRefPath: string;
            if (data.inspectorRef instanceof DocumentReference) {
                inspRefPath = data.inspectorRef.path;
            } else if (typeof data.inspectorRef === 'string') {
                inspRefPath = data.inspectorRef.startsWith('users/') ? data.inspectorRef : `users/${data.inspectorRef}`;
            } else if (data.inspectorRef.id && typeof data.inspectorRef.id === 'string') {
                inspRefPath = `users/${data.inspectorRef.id}`;
            } else {
                throw new Error("Malformed inspectorRef in inspection document.");
            }
            const inspectorDocSnap = await getDoc(doc(db, inspRefPath));
            if (inspectorDocSnap.exists()) {
              const inspData = inspectorDocSnap.data() as User;
              inspectorData = {
                id: inspectorDocSnap.id,
                displayName: inspData.displayName || inspData.email,
              };
            }
          } catch (inspError) {
            console.warn("Failed to fetch linked inspector:", inspError);
          }
        }

        const getRefId = (refField: any): string | undefined => {
            if (refField instanceof DocumentReference) return refField.id;
            if (typeof refField === 'string') return refField;
            if (refField && typeof refField.id === 'string') return refField.id;
            return undefined;
        };

        const fetchedInspection: Inspection = {
          inspectionId: inspectionSnap.id,
          displayId: data.displayId, // Added displayId
          registrationRef: getRefId(data.registrationRef) || data.registrationRef?.path, // Store ID or path for linking
          registrationData,
          inspectorRef: getRefId(data.inspectorRef) || data.inspectorRef?.path,
          inspectorData,
          inspectionType: data.inspectionType || 'Initial',
          scheduledDate: ensureSerializableDate(data.scheduledDate) as Date,
          inspectionDate: ensureSerializableDate(data.inspectionDate),
          status: data.status || 'Scheduled',
          overallResult: data.overallResult,
          findings: data.findings,
          correctiveActions: data.correctiveActions,
          followUpRequired: data.followUpRequired || false,
          checklistItems: data.checklistItems || [],
          completedAt: ensureSerializableDate(data.completedAt),
          reviewedAt: ensureSerializableDate(data.reviewedAt),
          reviewedByRef: getRefId(data.reviewedByRef) || data.reviewedByRef?.path,
          createdAt: ensureSerializableDate(data.createdAt) as Date,
          createdByRef: getRefId(data.createdByRef) || data.createdByRef?.path,
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          lastUpdatedByRef: getRefId(data.lastUpdatedByRef) || data.lastUpdatedByRef?.path,
        };
        setInspection(fetchedInspection);
      } else {
        setError("Inspection not found.");
      }
    } catch (err: any) {
      console.error("Error fetching inspection details:", err);
      setError(err.message || "Failed to load inspection data.");
    } finally {
      setLoading(false);
    }
  }, [inspectionId, currentUser]);

  useEffect(() => {
    if (currentUser !== undefined) { // Ensure currentUser state is resolved before fetching
        fetchInspectionDetails();
    }
  }, [inspectionId, currentUser, fetchInspectionDetails]);


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

  const getItemResultIcon = (result?: ChecklistItemResult["result"]) => {
    switch (result) {
      case "Pass": case "Yes": return <CheckSquare className="h-5 w-5 text-green-500" />;
      case "Fail": case "No": return <XSquare className="h-5 w-5 text-red-500" />;
      case "N/A": return <MessageSquare className="h-5 w-5 text-muted-foreground" />;
      default: return <MessageSquare className="h-5 w-5 text-muted-foreground" />; // Fallback
    }
  };

  const canConductOrContinueInspection =
    (isInspector && inspection?.inspectorData?.id === currentUser?.userId && (inspection?.status === "Scheduled" || inspection?.status === "InProgress")) ||
    ((isAdmin || isRegistrar || isSupervisor) && (inspection?.status === "Scheduled" || inspection?.status === "InProgress"));

  const canEditSchedule = (isAdmin || isRegistrar || isSupervisor) && ["Scheduled", "InProgress", "Passed"].includes(inspection?.status || "");

  const canReview = (isRegistrar || isAdmin || isSupervisor) && inspection?.status === "PendingReview";

  const handleReviewAction = async (action: "approve" | "reject") => {
    if (!currentUser?.userId || !inspection) {
        toast({ title: "Error", description: "User or inspection data missing.", variant: "destructive"});
        return;
    }
    setIsReviewing(true);

    const inspectionDocRef = doc(db, "inspections", inspection.inspectionId);
    const newStatus = action === "approve" ? "Passed" : "Failed";
    const updatePayload = {
        status: newStatus,
        reviewedAt: Timestamp.now(),
        reviewedByRef: doc(db, "users", currentUser.userId),
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: doc(db, "users", currentUser.userId),
    };

    try {
        await updateDoc(inspectionDocRef, updatePayload);
        toast({
            title: `Inspection ${action === "approve" ? "Approved" : "Rejected"}`,
            description: `Inspection ${inspection.displayId || inspection.inspectionId} has been marked as ${newStatus}.`
        });
        fetchInspectionDetails(); // Re-fetch to update local state
    } catch (e: any) {
        console.error("Error updating inspection status:", e);
        toast({ title: "Review Failed", description: e.message || "Could not update inspection status.", variant: "destructive" });
    } finally {
        setIsReviewing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p className="ml-2">Loading inspection details...</p></div>;
  }
  if (error) {
    return <div className="text-center py-10"><AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-2" /><p className="text-red-500">Error: {error}</p></div>;
  }
  if (!inspection) {
    return <div className="text-center py-10 text-muted-foreground">Inspection details could not be loaded.</div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/inspections')} className="mr-1 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Inspections</span>
          </Button>
          <ClipboardList className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Inspection: {inspection.displayId || inspection.inspectionId}</h1>
            <Badge variant={getStatusBadgeVariant(inspection.status)} className="mt-1">{inspection.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditSchedule && (
            <Button asChild variant="outline">
              <Link href={`/inspections/${inspectionId}/edit-schedule`}><CalendarDays className="mr-2 h-4 w-4" /> Edit Schedule</Link>
            </Button>
          )}
          {inspection.status === "Scheduled" && canConductOrContinueInspection && (
             <Button asChild variant="default">
              <Link href={`/inspections/${inspectionId}/conduct`}><Play className="mr-2 h-4 w-4" /> Start Inspection</Link>
            </Button>
          )}
          {inspection.status === "InProgress" && canConductOrContinueInspection && (
             <Button asChild variant="outline">
              <Link href={`/inspections/${inspectionId}/conduct`}><Edit className="mr-2 h-4 w-4" /> Continue Inspection</Link>
            </Button>
          )}
          {canReview && (
            <>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="default" disabled={isReviewing}>
                        {isReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Approve
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Approve Inspection?</AlertDialogTitle><AlertDialogDescription>This will mark the inspection as 'Passed'. This action should be final.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleReviewAction("approve")}>Confirm Approve</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
             <AlertDialog>
                <AlertDialogTrigger asChild>
                     <Button variant="destructive" disabled={isReviewing}>
                        {isReviewing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldX className="mr-2 h-4 w-4" />}
                        Reject
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>Reject Inspection?</AlertDialogTitle><AlertDialogDescription>This action will mark the inspection as 'Failed'. This action should be final. Consider adding comments for the inspector.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleReviewAction("reject")}>Confirm Reject</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </>
          )}
           {inspection.status === "Passed" && (
            <Button asChild>
              <Link href={`/inspections/${inspectionId}/safety-certificate`}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Generate Safety Certificate
              </Link>
            </Button>
          )}
        </div>
      </div>

      {inspection.status === "Passed" && inspection.overallResult && (
        <Card className={`border-2 border-green-500`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-2xl text-green-600`}>
              <CheckSquare /> Final Result: Passed
            </CardTitle>
            {inspection.reviewedAt && <CardDescription>Reviewed on: {formatFirebaseTimestamp(inspection.reviewedAt, "PPpp")} by { (inspection.reviewedByRef as any)?.displayName || inspection.reviewedByRef?.id || 'N/A'}</CardDescription>}
          </CardHeader>
        </Card>
      )}
       {inspection.status === "Failed" && inspection.overallResult && (
        <Card className={`border-2 border-red-500`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-2xl text-red-600`}>
              <XSquare /> Final Result: Failed
            </CardTitle>
             {inspection.reviewedAt && <CardDescription>Reviewed on: {formatFirebaseTimestamp(inspection.reviewedAt, "PPpp")} by { (inspection.reviewedByRef as any)?.displayName || inspection.reviewedByRef?.id || 'N/A'}</CardDescription>}
          </CardHeader>
        </Card>
      )}
      {inspection.status === "PendingReview" && inspection.overallResult && (
         <Card className={`border-2 border-yellow-500`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-2xl text-yellow-600`}>
              <AlertTriangle /> Inspector's Assessment: {inspection.overallResult} (Pending Final Review)
            </CardTitle>
            <CardDescription>Submitted by inspector on: {formatFirebaseTimestamp(inspection.completedAt, "PPpp")}</CardDescription>
          </CardHeader>
        </Card>
      )}


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Inspection Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Type:</strong> {inspection.inspectionType}</p>
              <p><strong>Linked Registration:</strong>
                {typeof inspection.registrationRef === 'string' ? (
                  <Button variant="link" asChild className="p-0 h-auto"><Link href={`/registrations/${inspection.registrationRef}`}>{inspection.registrationData?.scaRegoNo || inspection.registrationRef}</Link></Button>
                ) : "N/A"}
                 ({inspection.registrationData?.craftMake || "N/A"} {inspection.registrationData?.craftModel || "N/A"})
              </p>
              <p><strong>Inspector:</strong> { inspection.inspectorData?.displayName || (typeof inspection.inspectorRef === 'string' ? inspection.inspectorRef : "Not Assigned")}</p>
              <p><strong>Scheduled Date:</strong> {formatFirebaseTimestamp(inspection.scheduledDate, "PPpp")}</p>
              <p><strong>Inspection Date:</strong> {formatFirebaseTimestamp(inspection.inspectionDate, "PPpp") || "Not yet conducted"}</p>
              <p><strong>Inspector Submitted:</strong> {formatFirebaseTimestamp(inspection.completedAt, "PPpp")}</p>
              <p><strong>Registrar Reviewed:</strong> {formatFirebaseTimestamp(inspection.reviewedAt, "PPpp")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Findings & Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold mb-1">Inspector's Findings:</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inspection.findings || "No findings recorded."}</p>
              </div>
              {inspection.correctiveActions && (
                <div>
                  <h4 className="font-semibold mb-1">Corrective Actions Required:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{inspection.correctiveActions}</p>
                </div>
              )}
              <p><strong>Follow-up Required:</strong> {inspection.followUpRequired ? "Yes" : "No"}</p>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
            <Card>
                <CardHeader><CardTitle>Craft Quick View</CardTitle></CardHeader>
                <CardContent className="text-sm">
                    {typeof inspection.registrationRef === 'string' ? (
                       <p>Details for craft <Button variant="link" asChild className="p-0 h-auto"><Link href={`/registrations/${inspection.registrationRef}`}>{inspection.registrationData?.scaRegoNo || inspection.registrationRef}</Link></Button></p>
                    ) : (
                        <p>Craft details unavailable.</p>
                    )}
                    {inspection.registrationData?.craftImageUrl ? (
                        <Image src={inspection.registrationData.craftImageUrl} alt="Craft Image" width={600} height={400} className="mt-2 rounded-md aspect-video object-cover" data-ai-hint="boat yacht"/>
                    ) : (
                        <Image src="https://placehold.co/600x400.png?text=Craft+Image" alt="Craft Image Placeholder" width={600} height={400} className="mt-2 rounded-md aspect-video object-cover" data-ai-hint="boat generic"/>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>


      <Card>
        <CardHeader><CardTitle>Checklist Results</CardTitle></CardHeader>
        <CardContent>
          {inspection.checklistItems && inspection.checklistItems.length > 0 ? (
            <div className="space-y-4">
              {inspection.checklistItems.map((item) => (
                <Card key={item.itemId} className="p-4">
                  <div className="flex items-start justify-between">
                    <h4 className="font-medium flex items-center gap-2">{getItemResultIcon(item.result)} {item.itemDescription}</h4>
                    <Badge variant={item.result === "Pass" || item.result === "Yes" ? "default" : item.result === "Fail" || item.result === "No" ? "destructive" : "secondary"}>
                      {item.result}
                    </Badge>
                  </div>
                  {item.comments && <p className="text-sm text-muted-foreground mt-1 ml-7 pl-1 border-l-2 border-muted"><strong>Comments:</strong> {item.comments}</p>}

                </Card>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No checklist items recorded for this inspection.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    