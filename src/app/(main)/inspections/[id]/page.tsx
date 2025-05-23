
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Inspection, ChecklistItemResult } from "@/types";
import { ClipboardList, Ship, User, CalendarDays, CheckSquare, XSquare, AlertTriangle, Edit, MessageSquare, Image as ImageIcon, Play, ShieldCheck, ShieldX, Loader2 } from "lucide-react";
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
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Placeholder data - expanded
const placeholderInspection: Inspection = {
  inspectionId: "INSP001",
  registrationRef: { id: "REG001" } as any,
  registrationData: { id: "REG001", craftMake: "Yamaha", craftModel: "FX Cruiser HO" },
  inspectorRef: { id: "USER002"} as any,
  inspectorData: {id: "USER002", displayName: "Inspector Bob"},
  inspectionType: "Initial",
  scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) as any,
  inspectionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any,
  status: "Passed", // Example of a passed one
  overallResult: "Pass", // Inspector's assessment
  findings: "All safety equipment present and in good order. Hull is sound. Engine starts and runs smoothly.",
  correctiveActions: "Minor scuff mark on port side, recommend buffing.",
  followUpRequired: false,
  checklistItems: [
    { itemId: "chk01", itemDescription: "Hull Integrity Check", result: "Pass", comments: "No cracks or damage found." },
    { itemId: "chk02", itemDescription: "Life Jackets (min quantity & condition)", result: "Pass", comments: "5 adult, 2 child PFDs, all serviceable." },
    { itemId: "chk03", itemDescription: "Fire Extinguisher (charged & accessible)", result: "Pass", comments: "Type B, fully charged, mounted correctly." },
    { itemId: "chk04", itemDescription: "Navigation Lights", result: "Fail", comments: "Port side light not working." },
    { itemId: "chk05", itemDescription: "Anchor and Rode", result: "N/A", comments: "Craft type does not require anchor for intended use." },
  ],
  completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any, // Inspector submitted
  reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) as any, // Registrar reviewed
  reviewedByRef: { id: "USER003" } as any, // Registrar Ray
  createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
  createdByRef: { id: "USER001" } as any,
};

// Placeholder for an inspection pending review
const placeholderPendingReviewInspection: Inspection = {
  inspectionId: "INSP003_Pending",
  registrationRef: { id: "REG003" } as any,
  registrationData: { id: "REG003", craftMake: "Quintrex", craftModel: "Renegade" },
  inspectorRef: { id: "USER002" } as any,
  inspectorData: {id: "USER002", displayName: "Inspector Bob"},
  inspectionType: "Initial",
  scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) as any,
  inspectionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
  status: "PendingReview",
  overallResult: "Pass", // Inspector's assessment
  findings: "All checks passed, minor scuff marks on hull. Engine oil slightly low, topped up.",
  followUpRequired: false,
  checklistItems: [
    { itemId: "sch3_a", itemDescription: "Lifejackets", result: "Pass", comments: "All present and correct." },
    { itemId: "sch3_j", itemDescription: "Engine", result: "Pass", comments: "Oil topped up." },
  ],
  completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any, // Inspector submitted
  createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) as any,
  createdByRef: { id: "USER001" } as any,
};


export default function InspectionDetailPage() {
  const params = useParams();
  const inspectionId = params.id as string;
  const { currentUser, isInspector, isSupervisor, isAdmin, isRegistrar } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [inspection, setInspection] = useState<Inspection | null>(
    inspectionId === "INSP003_Pending" ? placeholderPendingReviewInspection : placeholderInspection
  );
  const [isReviewing, setIsReviewing] = useState(false);


  if (!inspection) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  const getStatusBadgeVariant = (status: Inspection["status"]) => {
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
  
  const getItemResultIcon = (result: ChecklistItemResult["result"]) => {
    switch (result) {
      case "Pass": return <CheckSquare className="h-5 w-5 text-green-500" />;
      case "Fail": return <XSquare className="h-5 w-5 text-red-500" />;
      case "N/A": return <MessageSquare className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const canConductOrContinueInspection = 
    (isInspector && inspection.inspectorData?.id === currentUser?.userId && (inspection.status === "Scheduled" || inspection.status === "InProgress")) ||
    ((isAdmin || isRegistrar || isSupervisor) && (inspection.status === "Scheduled" || inspection.status === "InProgress"));

  const canEditSchedule = (isAdmin || isRegistrar || isSupervisor) && (inspection.status === "Scheduled" || inspection.status === "InProgress");

  const canReview = (isRegistrar || isAdmin) && inspection.status === "PendingReview";

  const handleReviewAction = async (action: "approve" | "reject") => {
    setIsReviewing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const newStatus = action === "approve" ? "Passed" : "Failed";
    setInspection(prev => prev ? ({ ...prev, status: newStatus, reviewedAt: new Date() as any, reviewedByRef: {id: currentUser?.userId} as any }) : null);
    toast({
        title: `Inspection ${action === "approve" ? "Approved" : "Rejected"}`,
        description: `Inspection ${inspection.inspectionId} has been marked as ${newStatus}.`
    });
    setIsReviewing(false);
    router.refresh();
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Inspection: {inspection.inspectionId}</h1>
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
                    <AlertDialogHeader><AlertDialogTitle>Reject Inspection?</AlertDialogTitle><AlertDialogDescription>This will mark the inspection as 'Failed'. This action should be final. Consider adding comments for the inspector.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleReviewAction("reject")}>Confirm Reject</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            </>
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
              <p><strong>Linked Registration:</strong> <Button variant="link" asChild className="p-0 h-auto"><Link href={`/registrations/${inspection.registrationRef.id}`}>{inspection.registrationRef.id}</Link></Button> ({inspection.registrationData?.craftMake} {inspection.registrationData?.craftModel})</p>
              <p><strong>Inspector:</strong> { inspection.inspectorData?.displayName || inspection.inspectorRef?.id || "Not Assigned"}</p>
              <p><strong>Scheduled Date:</strong> {formatFirebaseTimestamp(inspection.scheduledDate, "PPpp")}</p>
              <p><strong>Inspection Date:</strong> {formatFirebaseTimestamp(inspection.inspectionDate, "PPpp")}</p>
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
                    <p>Details for craft <Button variant="link" asChild className="p-0 h-auto"><Link href={`/registrations/${inspection.registrationRef.id}`}>{inspection.registrationRef.id}</Link></Button></p>
                    <Image src="https://placehold.co/600x400.png?text=Craft+Image" alt="Craft Image" width={600} height={400} className="mt-2 rounded-md aspect-video object-cover" data-ai-hint="boat generic" />
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
                    <Badge variant={item.result === "Pass" ? "default" : item.result === "Fail" ? "destructive" : "secondary"}>
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
