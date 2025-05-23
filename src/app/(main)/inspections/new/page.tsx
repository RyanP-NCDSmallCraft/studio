
"use client";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import { ClipboardList } from "lucide-react";
import { useSearchParams } from 'next/navigation';

export default function NewInspectionPage() {
  const searchParams = useSearchParams();
  const registrationId = searchParams.get('registrationId');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Schedule New Inspection</h1>
      </div>
      <InspectionForm 
        mode="create" 
        usageContext="schedule" 
        prefilledRegistrationId={registrationId || undefined} 
      />
    </div>
  );
}
