
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, ClipboardList, Eye, Edit, Filter, Play, CheckSquare, ShieldAlert, CalendarDays } from "lucide-react";
import type { Inspection } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';

// Placeholder data
const placeholderInspections: Inspection[] = [
  {
    inspectionId: "INSP001",
    registrationRef: { id: "REG001" } as any,
    registrationData: { id: "REG001", craftMake: "Yamaha", craftModel: "FX Cruiser HO" },
    inspectorRef: { id: "USER002" } as any,
    inspectorData: {id: "USER002", displayName: "Inspector Bob"},
    inspectionType: "Initial",
    scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) as any,
    inspectionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any,
    status: "Passed",
    overallResult: "Pass",
    findings: "All safety equipment present and in good order.",
    followUpRequired: false,
    checklistItems: [
        { itemId: "chk01", itemDescription: "Hull integrity", result: "Yes" },
        { itemId: "chk02", itemDescription: "Life jackets", result: "Yes" },
    ],
    completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any, 
    reviewedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) as any, 
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
    createdByRef: { id: "USER001" } as any,
  },
  {
    inspectionId: "INSP002",
    registrationRef: { id: "REG002" } as any,
    registrationData: { id: "REG002", craftMake: "Sea-Doo", craftModel: "RXT-X 300" },
    inspectorRef: { id: "USER003" } as any,
    inspectorData: {id: "USER003", displayName: "Supervisor Sue"},
    inspectionType: "Annual",
    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) as any,
    status: "Scheduled",
    findings: "",
    followUpRequired: false,
    checklistItems: [],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) as any,
    createdByRef: { id: "USER001" } as any,
  },
  {
    inspectionId: "INSP003_Pending",
    registrationRef: { id: "REG003" } as any,
    registrationData: { id: "REG003", craftMake: "Quintrex", craftModel: "Renegade" },
    inspectorRef: { id: "USER002" } as any,
    inspectorData: {id: "USER002", displayName: "Inspector Bob"},
    inspectionType: "Initial",
    scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) as any,
    inspectionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
    status: "PendingReview",
    overallResult: "Pass", 
    findings: "All checks passed, minor scuff marks.",
    followUpRequired: false,
    checklistItems: [{itemId: "chk01", itemDescription: "Hull", result: "Yes"}],
    completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
    createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) as any,
    createdByRef: { id: "USER001" } as any,
  },
];

export default function InspectionListPage() {
  const { currentUser, isInspector, isAdmin, isRegistrar, isSupervisor } = useAuth();

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
              {placeholderInspections.map((insp) => {
                const canBeStartedByCurrentUser = (isInspector && insp.inspectorData?.id === currentUser?.userId) || isAdmin || isRegistrar || isSupervisor;
                const canEditScheduleByCurrentUser = (isAdmin || isRegistrar || isSupervisor);
                const canContinueConductingByCurrentUser = (isInspector && insp.inspectorData?.id === currentUser?.userId && insp.status === "InProgress") || ((isAdmin || isRegistrar || isSupervisor) && insp.status === "InProgress");
                const canReviewByCurrentUser = (isRegistrar || isAdmin);

                return (
                <TableRow key={insp.inspectionId}>
                  <TableCell className="font-medium">{insp.inspectionId}</TableCell>
                  <TableCell>
                    <div>{insp.registrationRef.id}</div>
                    <div className="text-xs text-muted-foreground">{insp.registrationData?.craftMake} {insp.registrationData?.craftModel}</div>
                  </TableCell>
                  <TableCell>{insp.inspectionType}</TableCell>
                  <TableCell>{formatFirebaseTimestamp(insp.scheduledDate, "PP")}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(insp.status)}>{insp.status}</Badge>
                  </TableCell>
                  <TableCell>{insp.inspectorData?.displayName || insp.inspectorRef?.id || "N/A"}</TableCell>
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
              )})}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {placeholderInspections.length === 0 && (
        <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No inspections found.
            </CardContent>
        </Card>
      )}
    </div>
  );
}
