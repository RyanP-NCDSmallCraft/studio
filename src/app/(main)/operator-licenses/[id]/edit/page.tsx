
"use client";

import { OperatorLicenseForm } from "@/components/operator-licenses/OperatorLicenseForm";
import type { OperatorLicense, Operator } from "@/types";
import { Contact, Edit } from "lucide-react";
import { useParams } from "next/navigation";
import { Timestamp } from "firebase/firestore";
import { Loader2 } from "lucide-react";
import { useState, useEffect } from "react";


// Placeholder for fetching existing license data
const fetchLicenseApplicationData = (id: string): { license: Partial<OperatorLicense> | null, operator: Partial<Operator> | null } => {
  console.log("Fetching license application data for ID:", id);
  if (id === "LICAPP001" || id === "LICAPP003") { // Match an ID from the list page
    const placeholderOperator: Operator = {
      operatorId: "OP001",
      surname: "Pini",
      firstName: "Ryan",
      dob: Timestamp.fromDate(new Date(1985, 5, 10)),
      sex: "Male",
      placeOfOriginTown: "Port Moresby",
      placeOfOriginDistrict: "NCD",
      placeOfOriginLLG: "NCD",
      placeOfOriginVillage: "Hanuabada",
      phoneMobile: "70000001",
      email: "ryan.pini@example.com",
      postalAddress: "PO Box 123",
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      idSizePhotoUrl: "https://placehold.co/150x150.png?text=ID",
    };
    const license: Partial<OperatorLicense> = id === "LICAPP003" ? {
        licenseApplicationId: "LICAPP003",
        applicationType: "New",
        status: "Draft",
        attachedDocuments: [],
    } : {
        licenseApplicationId: "LICAPP001",
        applicationType: "New",
        status: "Approved", // Typically won't edit approved, but for placeholder...
        assignedLicenseNumber: "OL001",
    };
    return { license, operator: placeholderOperator };
  }
  return { license: null, operator: null };
};


export default function EditOperatorLicensePage() {
  const params = useParams();
  const licenseApplicationId = params.id as string;
  
  const [loading, setLoading] = useState(true);
  const [existingLicenseData, setExistingLicenseData] = useState<Partial<OperatorLicense> | null>(null);
  const [existingOperatorData, setExistingOperatorData] = useState<Partial<Operator> | null>(null);

  useEffect(() => {
    if (licenseApplicationId) {
      // Simulate fetching data
      const {license, operator} = fetchLicenseApplicationData(licenseApplicationId);
      setExistingLicenseData(license);
      setExistingOperatorData(operator);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [licenseApplicationId]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p>Loading application data...</p></div>;
  }

  if (!existingLicenseData && mode === "edit") {
    return <div className="text-center text-red-500">License application not found.</div>;
  }
  
  const mode = licenseApplicationId ? "edit" : "create";


  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2">
        <Edit className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Edit Operator License Application</h1>
      </div>
      <OperatorLicenseForm 
        mode="edit" 
        licenseApplicationId={licenseApplicationId} 
        existingLicenseData={existingLicenseData}
        existingOperatorData={existingOperatorData}
      />
    </div>
  );
}

    