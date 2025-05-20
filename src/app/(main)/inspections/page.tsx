
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, ClipboardList, Eye, Edit, Filter } from "lucide-react";
import type { Inspection } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';

// Placeholder data
const placeholderInspections: Inspection[] = [
  {
    inspectionId: "INSP001",
    registrationRef: { id: "REG001" } as any, // Simulate DocumentReference
    inspectorRef: { id: "USER002" } as any,
    inspectionType: "Initial",
    scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) as any,
    inspectionDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any,
    status: "Passed",
    overallResult: "Pass",
    findings: "All safety equipment present and in good order.",
    followUpRequired: false,
    checklistItems: [
        { itemId: "chk01", itemDescription: "Hull integrity", result: "Pass" },
        { itemId: "chk02", itemDescription: "Life jackets", result: "Pass" },
    ],
    completedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000) as any,
    createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
    createdByRef: { id: "USER001" } as any,
  },
  {
    inspectionId: "INSP002",
    registrationRef: { id: "REG002" } as any,
    inspectorRef: { id: "USER003" } as any,
    inspectionType: "Annual",
    scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) as any,
    status: "Scheduled",
    findings: "",
    followUpRequired: false,
    checklistItems: [],
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) as any,
    createdByRef: { id: "USER001" } as any,
  },
];

export default function InspectionListPage() {
  const { isInspector, isAdmin, isSupervisor } = useAuth();

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
          {(isInspector || isAdmin || isSupervisor) && ( // Or specific roles that can create inspections
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
                <TableHead>Craft Rego (Ref)</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scheduled Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Inspector (Ref)</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholderInspections.map((insp) => (
                <TableRow key={insp.inspectionId}>
                  <TableCell>{insp.inspectionId}</TableCell>
                  <TableCell>{insp.registrationRef.id}</TableCell>
                  <TableCell>{insp.inspectionType}</TableCell>
                  <TableCell>{formatFirebaseTimestamp(insp.scheduledDate, "PP")}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(insp.status)}>{insp.status}</Badge>
                  </TableCell>
                  <TableCell>{insp.inspectorRef?.id || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild title="View Details">
                      <Link href={`/inspections/${insp.inspectionId}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {(isInspector || isAdmin || isSupervisor) && (insp.status === "Scheduled" || insp.status === "InProgress") && (
                       <Button variant="ghost" size="icon" asChild title="Edit Inspection">
                        <Link href={`/inspections/${insp.inspectionId}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
