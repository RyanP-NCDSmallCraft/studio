
"use client";
import { RegistrationForm } from "@/components/registrations/RegistrationForm";
import type { Registration } from "@/types";
import { Ship, ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// Placeholder for fetching existing registration data
const fetchRegistrationData = (id: string): Registration | null => {
  console.log("Fetching registration data for ID:", id);
  // Simulate API call
  if (id === "REG001") { // Corresponds to an ID from placeholder data for detail view
    return {
      registrationId: "REG001",
      scaRegoNo: "SCA123",
      interimRegoNo: "INT789",
      registrationType: "New",
      status: "Approved", // This should be "Draft" or "RequiresInfo" if editable
      submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) as any,
      owners: [
        { ownerId: "owner1", role: "Primary", surname: "Smith", firstName: "John", dob: new Date(1980, 5, 15) as any, sex: "Male", phone: "555-0101", email: "john.smith@example.com", postalAddress: "P.O. Box 123", townDistrict: "Port Moresby", llg: "NCD", wardVillage: "Waigani" }
      ],
      proofOfOwnershipDocs: [
        { docId: "doc1", description: "Bill of Sale", fileName: "bill_of_sale.pdf", fileUrl: "https://placehold.co/600x400.png?text=Bill+of+Sale", uploadedAt: new Date() as any }
      ],
      craftMake: "Yamaha",
      craftModel: "FX Cruiser HO",
      craftYear: 2022,
      craftColor: "Blue/White",
      hullIdNumber: "YAM12345X122",
      craftLength: 3.56,
      lengthUnits: "m",
      propulsionType: "Inboard",
      hullMaterial: "Fiberglass",
      craftUse: "Pleasure",
      fuelType: "Gasoline",
      vesselType: "PWC",
      lastUpdatedAt: new Date() as any,
      createdByRef: {} as any,
      createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) as any,
    };
  }
  return null;
};


export default function EditRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const registrationId = params.id as string;
  // In a real app, fetch existing data if registrationId is present
  const existingRegistration = fetchRegistrationData(registrationId);


  // For now, we pass the ID and the form component would fetch or receive data
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
        </Button>
        <Ship className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Edit Craft Registration</h1>
      </div>
      <RegistrationForm mode="edit" registrationId={registrationId} existingRegistrationData={existingRegistration} />
    </div>
  );
}


    