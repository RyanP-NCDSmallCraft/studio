
"use client";
import { RegistrationForm } from "@/components/registrations/RegistrationForm";
import type { Registration, Owner, ProofOfOwnershipDoc, User, EngineDetail } from "@/types";
import { Ship, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from "@/hooks/useAuth"; 
import { isValid } from "date-fns";


// Helper function to safely convert Firestore Timestamps or other date forms to JS Date objects
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
    } catch (e) {
      console.warn('Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  // Handle ISO strings or numbers (timestamps)
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  console.warn(`EditRegistrationPage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function EditRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const registrationId = params.id as string;
  const { currentUser } = useAuth(); 

  const [existingRegistration, setExistingRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRegistrationDetails = useCallback(async () => {
    if (!registrationId) {
      setError("Registration ID is missing.");
      setLoading(false);
      return;
    }
     if (!currentUser) { 
      setLoading(false); 
      return;
    }


    setLoading(true);
    setError(null);

    try {
      const regDocRef = doc(db, "registrations", registrationId);
      const docSnap = await getDoc(regDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        const mapOwner = (ownerData: any): Owner => ({
          ...ownerData,
          ownerId: ownerData.ownerId || crypto.randomUUID(), 
          dob: ensureDateObject(ownerData.dob) as Date, 
        });

        const mapProofDoc = (docData: any): ProofOfOwnershipDoc => ({
          ...docData,
          docId: docData.docId || crypto.randomUUID(), 
          uploadedAt: ensureDateObject(docData.uploadedAt) as Date, 
        });

        const mapEngineDetail = (engineData: any): EngineDetail => ({
          ...engineData,
          engineId: engineData.engineId || crypto.randomUUID(),
        });
        
        const processedData: Registration = {
          registrationId: docSnap.id,
          scaRegoNo: data.scaRegoNo,
          interimRegoNo: data.interimRegoNo,
          registrationType: data.registrationType || "New",
          previousScaRegoNo: data.previousScaRegoNo,
          status: data.status || "Draft",
          submittedAt: ensureDateObject(data.submittedAt),
          approvedAt: ensureDateObject(data.approvedAt),
          effectiveDate: ensureDateObject(data.effectiveDate),
          expiryDate: ensureDateObject(data.expiryDate),
          paymentMethod: data.paymentMethod,
          paymentReceiptNumber: data.paymentReceiptNumber,
          bankStampRef: data.bankStampRef,
          paymentAmount: data.paymentAmount,
          paymentDate: ensureDateObject(data.paymentDate),
          safetyCertNumber: data.safetyCertNumber,
          safetyEquipIssued: data.safetyEquipIssued || false,
          safetyEquipReceiptNumber: data.safetyEquipReceiptNumber,
          owners: Array.isArray(data.owners) ? data.owners.map(mapOwner) : [],
          proofOfOwnershipDocs: Array.isArray(data.proofOfOwnershipDocs) ? data.proofOfOwnershipDocs.map(mapProofDoc) : [],
          craftMake: data.craftMake || "",
          craftModel: data.craftModel || "",
          craftYear: data.craftYear || new Date().getFullYear(),
          craftColor: data.craftColor || "",
          hullIdNumber: data.hullIdNumber || "",
          craftLength: data.craftLength || 0,
          lengthUnits: data.lengthUnits || "m",
          passengerCapacity: data.passengerCapacity,
          distinguishingFeatures: data.distinguishingFeatures,
          engines: Array.isArray(data.engines) ? data.engines.map(mapEngineDetail) : [], 
          propulsionType: data.propulsionType || "Outboard",
          propulsionOtherDesc: data.propulsionOtherDesc,
          hullMaterial: data.hullMaterial || "Fiberglass",
          hullMaterialOtherDesc: data.hullMaterialOtherDesc,
          craftUse: data.craftUse || "Pleasure",
          craftUseOtherDesc: data.craftUseOtherDesc,
          fuelType: data.fuelType || "Petrol",
          fuelTypeOtherDesc: data.fuelTypeOtherDesc,
          vesselType: data.vesselType || "OpenBoat",
          vesselTypeOtherDesc: data.vesselTypeOtherDesc,
          certificateGeneratedAt: ensureDateObject(data.certificateGeneratedAt),
          certificateFileName: data.certificateFileName,
          certificateFileUrl: data.certificateFileUrl,
          suspensionReason: data.suspensionReason,
          suspensionStartDate: ensureDateObject(data.suspensionStartDate),
          suspensionEndDate: ensureDateObject(data.suspensionEndDate),
          revocationReason: data.revocationReason,
          revokedAt: ensureDateObject(data.revokedAt),
          lastUpdatedByRef: (data.lastUpdatedByRef instanceof DocumentReference) ? data.lastUpdatedByRef.id : data.lastUpdatedByRef,
          lastUpdatedAt: ensureDateObject(data.lastUpdatedAt) as Date, 
          createdByRef: (data.createdByRef instanceof DocumentReference) ? data.createdByRef.id : data.createdByRef,
          createdAt: ensureDateObject(data.createdAt) as Date, 
        };
        setExistingRegistration(processedData);
      } else {
        setError("Registration not found.");
        setExistingRegistration(null);
      }
    } catch (err: any) {
      console.error("Error fetching registration for edit:", err);
      setError(err.message || "Failed to load registration data.");
      setExistingRegistration(null);
    } finally {
      setLoading(false);
    }
  }, [registrationId, currentUser]);

  useEffect(() => {
    if (currentUser !== undefined) { 
        fetchRegistrationDetails();
    }
  }, [registrationId, currentUser, fetchRegistrationDetails]);


  if (loading || currentUser === undefined) { 
    return (
      <div className="flex h-64 justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" /> 
        <p className="ml-2">Loading registration data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-500">
        <AlertTriangle className="mx-auto h-10 w-10 mb-2" />
        Error: {error}
      </div>
    );
  }
  
  if (!existingRegistration && !loading) { 
    return <div className="text-center py-10 text-muted-foreground">Registration not found.</div>;
  }

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
      {existingRegistration && (
        <RegistrationForm mode="edit" registrationId={registrationId} existingRegistrationData={existingRegistration} />
      )}
    </div>
  );
}

    
