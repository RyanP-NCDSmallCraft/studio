// src/app/inspections/conduct-new/page.tsx (MOVED FROM (main)/inspections/conduct-new/)
"use client";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import { PlayCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useSearchParams } from 'next/navigation';

export default function ConductNewInspectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registrationId = searchParams.get('registrationId');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/inspections')} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Inspections</span>
        </Button>
        <PlayCircle className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Start On-the-Spot Inspection</h1>
      </div>
      <InspectionForm 
        mode="create" 
        usageContext="conduct"
        prefilledRegistrationId={registrationId || undefined} 
      />
    </div>
  );
}
