
"use client";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import { ClipboardList, ArrowLeft } from "lucide-react";
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";

export default function NewInspectionPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const registrationId = searchParams.get('registrationId');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/inspections')} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Inspections</span>
        </Button>
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


    