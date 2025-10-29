
"use client";

import { OperatorLicenseForm } from "@/components/operator-licenses/OperatorLicenseForm";
import type { OperatorLicense, Operator, User } from "@/types";
import { Edit, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Timestamp, doc, getDoc, DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from "@/lib/utils";


// Helper to convert Firestore Timestamps or other date forms to JS Date for client state
const ensureDateObject = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  // Handle Firestore-like {seconds, nanoseconds} objects
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) { return undefined; }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
};


export default function EditOperatorLicensePage() {
  const params = useParams();
  const router = useRouter();
  const licenseApplicationId = params.id as string;
  const { currentUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [existingLicenseData, setExistingLicenseData] = useState<Partial<OperatorLicense> | null>(null);
  const [existingOperatorData, setExistingOperatorData] = useState<Partial<Operator> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLicenseAndOperatorData = useCallback(async () => {
    if (!currentUser || !licenseApplicationId) {
      setLoading(false);
      if (!currentUser) setError("User not authenticated.");
      if (!licenseApplicationId) setError("License Application ID is missing.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const licenseDocRef = doc(db, "operatorLicenseApplications", licenseApplicationId);
      const licenseSnap = await getDoc(licenseDocRef);

      if (!licenseSnap.exists()) {
        setError("License application not found.");
        setExistingLicenseData(null);
        setExistingOperatorData(null);
        setLoading(false);
        return;
      }
      
      const licenseDataRaw = licenseSnap.data() as Omit<OperatorLicense, 'operatorRef'> & { operatorRef: DocumentReference<Operator> | string };
      const licenseData: Partial<OperatorLicense> = {
        ...licenseDataRaw,
        licenseApplicationId: licenseSnap.id,
        // Ensure dates are JS Dates for the form
        submittedAt: ensureDateObject(licenseDataRaw.submittedAt),
        approvedAt: ensureDateObject(licenseDataRaw.approvedAt),
        issuedAt: ensureDateObject(licenseDataRaw.issuedAt),
        expiryDate: ensureDateObject(licenseDataRaw.expiryDate),
        paymentDate: ensureDateObject(licenseDataRaw.paymentDate),
        createdAt: ensureDateObject(licenseDataRaw.createdAt) as Date,
        lastUpdatedAt: ensureDateObject(licenseDataRaw.lastUpdatedAt) as Date,
        attachedDocuments: (licenseDataRaw.attachedDocuments || []).map(d => ({
            ...d,
            uploadedAt: ensureDateObject(d.uploadedAt) as Date,
            verifiedAt: ensureDateObject(d.verifiedAt)
        })),
      };
      setExistingLicenseData(licenseData);

      if (licenseDataRaw.operatorRef) {
        let operatorRef: DocumentReference<Operator>;
        if (typeof licenseDataRaw.operatorRef === 'string') {
          operatorRef = doc(db, licenseDataRaw.operatorRef) as DocumentReference<Operator>; // Assuming path string
        } else {
          operatorRef = licenseDataRaw.operatorRef as DocumentReference<Operator>;
        }
        
        const operatorSnap = await getDoc(operatorRef);
        if (operatorSnap.exists()) {
          const operatorDataRaw = operatorSnap.data() as Operator;
          const operatorData: Partial<Operator> = {
            ...operatorDataRaw,
            operatorId: operatorSnap.id,
            dob: ensureDateObject(operatorDataRaw.dob) as Date,
            createdAt: ensureDateObject(operatorDataRaw.createdAt) as Date,
            updatedAt: ensureDateObject(operatorDataRaw.updatedAt) as Date,
          };
          setExistingOperatorData(operatorData);
        } else {
          console.warn("Linked operator not found for license:", licenseApplicationId);
          setExistingOperatorData(null); // Or handle as error
        }
      } else {
        setExistingOperatorData(null);
      }

    } catch (err: any) {
      console.error("Error fetching license/operator data:", err);
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [licenseApplicationId, currentUser]);

  useEffect(() => {
    fetchLicenseAndOperatorData();
  }, [fetchLicenseAndOperatorData]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading application data...</p></div>;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
        <p className="text-destructive text-lg">{error}</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">Go Back</Button>
      </div>
    );
  }
  
  if (!existingLicenseData && !loading) { 
    return <div className="text-center py-10 text-muted-foreground">License application not found.</div>;
  }
  

  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
        </Button>
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
