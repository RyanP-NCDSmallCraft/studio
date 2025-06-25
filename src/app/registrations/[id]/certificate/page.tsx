
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Registration, Owner, User } from "@/types"; 
import { FileSpreadsheet, Printer, Sailboat, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore'; 
import { db } from '@/lib/firebase';
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
      console.warn('CertificatePage: Failed to convert object to Timestamp then to Date:', dateValue, e);
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
  console.warn(`CertificatePage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function CertificatePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const registrationId = params.id as string;

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [approvedByName, setApprovedByName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificateData = useCallback(async () => {
    if (!registrationId) {
      setError("Registration ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setApprovedByName(null);

    try {
      const regDocRef = doc(db, "registrations", registrationId);
      const docSnap = await getDoc(regDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status !== "Approved") {
          setError("Certificate can only be generated for 'Approved' registrations.");
          setRegistration(null);
          setLoading(false);
          return;
        }

        if (data.approvedAt && data.lastUpdatedByRef) {
          try {
            let approverUserRef: DocumentReference<User>;
            if (data.lastUpdatedByRef instanceof DocumentReference) {
              approverUserRef = data.lastUpdatedByRef as DocumentReference<User>;
            } else if (typeof data.lastUpdatedByRef === 'string') {
              approverUserRef = doc(db, "users", data.lastUpdatedByRef) as DocumentReference<User>;
            } else {
               console.warn("Approver reference is not a DocumentReference or string ID for reg:", registrationId);
            }
            
            if (approverUserRef!) {
                const approverDocSnap = await getDoc(approverUserRef);
                if (approverDocSnap.exists()) {
                    const approverData = approverDocSnap.data() as User;
                    setApprovedByName(approverData.displayName || approverData.email || "N/A");
                } else {
                    console.warn("Approver user document not found for ref:", data.lastUpdatedByRef);
                    setApprovedByName("Details Unavailable");
                }
            }
          } catch (userError) {
            console.error("Error fetching approver user data:", userError);
            setApprovedByName("Error fetching approver");
          }
        }


        const mapOwner = (ownerData: any): Owner => ({
          ...ownerData,
          ownerId: ownerData.ownerId || crypto.randomUUID(),
          dob: ensureDateObject(ownerData.dob) as Date,
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
          proofOfOwnershipDocs: Array.isArray(data.proofOfOwnershipDocs) ? data.proofOfOwnershipDocs.map(d => ({...d, uploadedAt: ensureDateObject(d.uploadedAt)})) : [],
          craftMake: data.craftMake || "",
          craftModel: data.craftModel || "",
          craftYear: data.craftYear || new Date().getFullYear(),
          craftColor: data.craftColor || "",
          hullIdNumber: data.hullIdNumber || "",
          craftLength: data.craftLength || 0,
          lengthUnits: data.lengthUnits || "m",
          passengerCapacity: data.passengerCapacity,
          distinguishingFeatures: data.distinguishingFeatures,
          engines: data.engines || [],
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
        setRegistration(processedData);
      } else {
        setError("Registration not found.");
        setRegistration(null);
      }
    } catch (err: any) {
      console.error("Error fetching registration for certificate:", err);
      setError(err.message || "Failed to load registration data.");
      setRegistration(null);
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    fetchCertificateData();
  }, [fetchCertificateData]);

  useEffect(() => {
    if (!loading && registration && !error) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, registration, error]);

  if (loading) {
    return (
      <div className="flex h-64 justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading certificate data...</p>
      </div>
    );
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

  if (!registration) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p>Registration data could not be loaded.</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4 no-print-on-page">
        <div className="flex items-center gap-2">
         <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Certificate Preview</h1>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Print Certificate
        </Button>
      </div>

      <Card className="shadow-lg p-6 md:p-10 certificate-preview relative overflow-hidden" data-ai-hint="document certificate">
        <Sailboat className="absolute inset-0 m-auto h-1/2 w-1/2 text-primary/5 opacity-20 z-0" />
        
        <div className="relative z-10">
          <header className="text-center border-b-2 border-primary pb-4 mb-6">
            <Image 
              src="https://ncdsmallcraft.com/images/114/11667247/LOGO-NCDCRB-small.png" 
              alt="NCDCRB Logo" 
              width={64} 
              height={64} 
              className="mx-auto mb-2 h-16 w-16"
            />
            <h2 className="text-4xl font-bold text-primary">Certificate of Registration</h2>
            <p className="text-muted-foreground text-lg">Small Craft Safety Program</p>
          </header>

          <CardContent className="space-y-6 text-lg">
            <div className="text-center mb-8">
              <p className="text-xl">This is to certify that the craft detailed below is registered:</p>
              <p className="text-5xl font-bold text-primary mt-2">{registration.scaRegoNo || "PENDING"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <h3 className="font-semibold text-primary mb-1">Registered Owner(s):</h3>
                {registration.owners.map(o => <p key={o.ownerId}>{o.firstName} {o.surname} ({o.role})</p>)}
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">Owner Address:</h3>
                <p>{registration.owners[0]?.postalAddress}, {registration.owners[0]?.wardVillage}, {registration.owners[0]?.llg}, {registration.owners[0]?.townDistrict}</p>
              </div>
            </div>
            
            <Separator className="my-6" />

            <h3 className="text-2xl font-semibold text-primary mb-3 text-center">Craft Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <p><strong>Make:</strong> {registration.craftMake}</p>
              <p><strong>Model:</strong> {registration.craftModel}</p>
              <p><strong>Year:</strong> {registration.craftYear}</p>
              <p><strong>Hull ID (HIN):</strong> {registration.hullIdNumber}</p>
              <p><strong>Length:</strong> {registration.craftLength}{registration.lengthUnits}</p>
              <p><strong>Passenger Capacity:</strong> {registration.passengerCapacity || "N/A"}</p>
              <p><strong>Color:</strong> {registration.craftColor}</p>
              <p><strong>Vessel Type:</strong> {registration.vesselType} {registration.vesselTypeOtherDesc && `(${registration.vesselTypeOtherDesc})`}</p>
              <p><strong>Propulsion:</strong> {registration.propulsionType} {registration.propulsionOtherDesc && `(${registration.propulsionOtherDesc})`}</p>
              <p><strong>Use:</strong> {registration.craftUse} {registration.craftUseOtherDesc && `(${registration.craftUseOtherDesc})`}</p>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <h3 className="font-semibold text-primary mb-1">Date of Issue:</h3>
                <p>{formatFirebaseTimestamp(registration.effectiveDate || registration.approvedAt, "MMMM dd, yyyy")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">Expiry Date:</h3>
                <p>{formatFirebaseTimestamp(registration.expiryDate, "MMMM dd, yyyy")}</p>
              </div>
               {approvedByName && (
                <div className="md:col-span-2">
                    <h3 className="font-semibold text-primary mb-1">Approved By:</h3>
                    <p>{approvedByName} (Registrar)</p>
                </div>
              )}
            </div>
            
            <div className="mt-10 text-center">
                <p className="text-sm text-muted-foreground">Official Stamp / Signature Area</p>
                <div className="h-32 w-32 border-2 border-dashed border-muted-foreground mx-auto mt-2 rounded-full flex items-center justify-center text-muted-foreground">
                   
                </div>
            </div>
          </CardContent>
          
          <footer className="mt-10 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>This certificate is issued under the authority of the National Capital District Small Craft Registration Board (NCDSCRB).</p>
            <p>RegoCraft &copy; {new Date().getFullYear()}</p>
          </footer>
        </div>
      </Card>
    </div>
  );
}
