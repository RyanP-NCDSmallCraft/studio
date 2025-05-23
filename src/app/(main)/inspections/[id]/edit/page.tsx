
"use client";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import type { Inspection } from "@/types";
import { ClipboardList, Play } from "lucide-react"; // Added Play icon
import { useParams } from "next/navigation";

// Placeholder for fetching existing inspection data
const fetchInspectionData = (id: string): Inspection | null => {
  console.log("Fetching inspection data for ID:", id);
  // Simulate API call
  if (id === "INSP001") { 
     return {
      inspectionId: "INSP001",
      registrationRef: { id: "REG001" } as any,
      inspectorRef: { id: "USER002" } as any,
      inspectionType: "Initial",
      scheduledDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) as any,
      status: "Scheduled", // Or "InProgress" if already started
      findings: "", // Default to empty if starting
      followUpRequired: false,
      checklistItems: [], // Default to empty if starting
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000) as any,
      createdByRef: { id: "USER001" } as any,
    };
  }
   if (id === "INSP002_InProgress") { // Example of an in-progress inspection
     return {
      inspectionId: "INSP002_InProgress",
      registrationRef: { id: "REG002" } as any,
      inspectorRef: { id: "USER003" } as any,
      inspectionType: "Annual",
      scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) as any,
      status: "InProgress", 
      findings: "Initial checks done.",
      followUpRequired: false,
      checklistItems: [{itemId: "test", itemDescription: "Test Item", result: "N/A"}],
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) as any,
      createdByRef: { id: "USER001" } as any,
    };
  }
  return null;
};


export default function EditInspectionPage() {
  const params = useParams();
  const inspectionId = params.id as string;
  const existingInspection = fetchInspectionData(inspectionId);

  // Determine title based on context (e.g., if status is 'Scheduled', it's more like "Start Inspection")
  const pageTitle = existingInspection?.status === "Scheduled" 
    ? "Start / Conduct Craft Inspection" 
    : "Edit Craft Inspection";
  const Icon = existingInspection?.status === "Scheduled" ? Play : ClipboardList;


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Icon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">{pageTitle}</h1>
      </div>
      <InspectionForm 
        mode="edit" 
        usageContext="conduct" 
        inspectionId={inspectionId} 
        existingInspectionData={existingInspection} 
      />
    </div>
  );
}
