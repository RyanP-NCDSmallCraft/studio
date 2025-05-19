
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Inspection, ChecklistItemResult } from "@/types";
import { ClipboardList, Ship, User, CalendarDays, CheckSquare, XSquare, AlertTriangle, Edit, MessageSquare, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from 'date-fns';
import Image from "next/image";

// Placeholder data
const placeholderInspection: Inspection = {
  inspectionId: "INSP001",
  registrationRef: { id: "REG001" } as any,
  inspectorRef: { id: "USER002", displayName: "Inspector Bob" } as any,
  inspectionType: "Initial",
  scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) as any,
  inspectionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any,
  status: "Passed",
  overallResult: "Pass",
  findings: "All safety equipment present and in good order. Hull is sound. Engine starts and runs smoothly.",
  correctiveActions: "Minor scuff mark on port side, recommend buffing.",
  followUpRequired: false,
  checklistItems: [
    { itemId: "chk01", itemDescription: "Hull Integrity Check", result: "Pass", comments: "No cracks or damage found." },
    { itemId: "chk02", itemDescription: "Life Jackets (min quantity & condition)", result: "Pass", comments: "5 adult, 2 child PFDs, all serviceable." , evidenceUrls: ["https://placehold.co/300x200.png?text=Life+Jackets", "https://placehold.co/300x200.png?text=PFD+Close+Up"]},
    { itemId: "chk03", itemDescription: "Fire Extinguisher (charged & accessible)", result: "Pass", comments: "Type B, fully charged, mounted correctly." },
    { itemId: "chk04", itemDescription: "Navigation Lights", result: "Fail", comments: "Port side light not working.", evidenceUrls: ["https://placehold.co/300x200.png?text=Nav+Lights"] },
    { itemId: "chk05", itemDescription: "Anchor and Rode", result: "N/A", comments: "Craft type does not require anchor for intended use." },
  ],
  completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any,
  createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
  createdByRef: { id: "USER001" } as any,
};


export default function InspectionDetailPage() {
  const params = useParams();
  const inspectionId = params.id as string;
  const { currentUser, isInspector, isSupervisor, isAdmin } = useAuth();
  const inspection = placeholderInspection; // Use placeholder data

  if (!inspection) {
    return <p>Loading inspection details...</p>;
  }

  const getStatusBadgeVariant = (status: Inspection["status"]) => {
     switch (status) {
      case "Passed": return "default";
      case "Failed": return "destructive";
      case "Scheduled": case "InProgress": return "secondary";
      case "Completed": case "PendingReview": return "outline";
      case "Cancelled": return "destructive";
      default: return "outline";
    }
  };
  
  const getItemResultIcon = (result: ChecklistItemResult["result"]) => {
    switch (result) {
      case "Pass": return <CheckSquare className="h-5 w-5 text-green-500" />;
      case "Fail": return <XSquare className="h-5 w-5 text-red-500" />;
      case "N/A": return <MessageSquare className="h-5 w-5 text-muted-foreground" />; // Or a different icon for N/A
    }
  };

  const canEdit = (isInspector && inspection.inspectorRef?.id === currentUser?.userId && (inspection.status === "Scheduled" || inspection.status === "InProgress")) || isAdmin;
  const canReview = (isSupervisor || isAdmin) && inspection.status === "Completed";


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
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/inspections/${inspectionId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
            </Button>
          )}
          {canReview && (
            <Button variant="default" disabled> {/* Review action to be implemented */}
              <CheckSquare className="mr-2 h-4 w-4" /> Review/Approve
            </Button>
          )}
        </div>
      </div>

      {/* Overall Result Banner */}
      {inspection.overallResult && (
        <Card className={`border-2 ${inspection.overallResult === "Pass" ? "border-green-500" : inspection.overallResult === "Fail" ? "border-red-500" : "border-muted"}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-2xl ${inspection.overallResult === "Pass" ? "text-green-600" : inspection.overallResult === "Fail" ? "text-red-600" : ""}`}>
              {inspection.overallResult === "Pass" ? <CheckSquare /> : inspection.overallResult === "Fail" ? <XSquare /> : <AlertTriangle />}
              Overall Result: {inspection.overallResult}
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      {/* Main Details */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Inspection Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p><strong>Type:</strong> {inspection.inspectionType}</p>
              <p><strong>Linked Registration:</strong> <Button variant="link" asChild className="p-0 h-auto"><Link href={`/registrations/${inspection.registrationRef.id}`}>{inspection.registrationRef.id}</Link></Button></p>
              <p><strong>Inspector:</strong> { (inspection.inspectorRef as any)?.displayName || inspection.inspectorRef?.id || "Not Assigned"}</p>
              <p><strong>Scheduled Date:</strong> {inspection.scheduledDate ? format(inspection.scheduledDate.toDate(), "PPpp") : "N/A"}</p>
              <p><strong>Inspection Date:</strong> {inspection.inspectionDate ? format(inspection.inspectionDate.toDate(), "PPpp") : "N/A"}</p>
              <p><strong>Completed Date:</strong> {inspection.completedAt ? format(inspection.completedAt.toDate(), "PPpp") : "N/A"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Findings & Actions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold mb-1">Overall Findings:</h4>
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
             {/* Placeholder for craft summary or quick info */}
            <Card>
                <CardHeader><CardTitle>Craft Quick View</CardTitle></CardHeader>
                <CardContent className="text-sm">
                    <p>Details for craft <Button variant="link" asChild className="p-0 h-auto"><Link href={`/registrations/${inspection.registrationRef.id}`}>{inspection.registrationRef.id}</Link></Button> would be shown here.</p>
                    <Image src="https://placehold.co/600x400.png?text=Craft+Image" alt="Craft Image" width={600} height={400} className="mt-2 rounded-md aspect-video object-cover" data-ai-hint="boat generic" />
                </CardContent>
            </Card>
        </div>
      </div>
      

      {/* Checklist Items */}
      <Card>
        <CardHeader><CardTitle>Checklist Results</CardTitle></CardHeader>
        <CardContent>
          {inspection.checklistItems.length > 0 ? (
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
                  {item.evidenceUrls && item.evidenceUrls.length > 0 && (
                    <div className="mt-2 ml-7 pl-1">
                      <p className="text-xs font-semibold mb-1 text-muted-foreground">Evidence:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.evidenceUrls.map((url, index) => (
                           <a key={index} href={url} target="_blank" rel="noopener noreferrer" className="hover:opacity-80 transition-opacity" data-ai-hint="inspection evidence">
                            <Image src={url} alt={`Evidence ${index + 1}`} width={100} height={75} className="rounded-md object-cover aspect-[4/3]" />
                           </a>
                        ))}
                      </div>
                    </div>
                  )}
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
