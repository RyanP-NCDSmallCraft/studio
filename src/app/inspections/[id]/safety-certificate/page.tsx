
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { Registration, Inspection, User, Owner } from "@/types"; 
import { FileSpreadsheet, Download, Sailboat, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore'; 
import { db } from '@/lib/firebase';
import { addYears, isValid } from "date-fns";

// Helper function to safely convert Firestore Timestamps or other date forms to JS Date objects
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) {
      console.warn('SafetyCertificatePage: Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  console.warn(`SafetyCertificatePage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function SafetyCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const inspectionId = params.id as string;
  const { toast } = useToast();

  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [inspector, setInspector] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificateData = useCallback(async () => {
    if (!inspectionId) {
      setError("Inspection ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const inspectionDocRef = doc(db, "inspections", inspectionId);
      const inspectionSnap = await getDoc(inspectionDocRef);

      if (!inspectionSnap.exists()) {
        setError("Inspection not found.");
        setLoading(false);
        return;
      }

      const inspectionData = inspectionSnap.data() as Omit<Inspection, 'inspectionId' | 'registrationRef' | 'inspectorRef' | 'createdAt' | 'lastUpdatedAt' | 'reviewedByRef' | 'createdByRef' | 'lastUpdatedByRef'> & {
        registrationRef: string | DocumentReference<Registration>;
        inspectorRef?: string | DocumentReference<User>;
        reviewedByRef?: string | DocumentReference<User>;
        createdByRef?: string | DocumentReference<User>;
        lastUpdatedByRef?: string | DocumentReference<User>;
        createdAt: Timestamp; // Assuming these are always Timestamps from Firestore
        lastUpdatedAt?: Timestamp;
        completedAt?: Timestamp;
        scheduledDate: Timestamp;
        inspectionDate?: Timestamp;
      };


      if (inspectionData.status !== "Passed") {
        setError("Safety Certificate can only be generated for 'Passed' inspections.");
        setLoading(false);
        return;
      }
      
      const currentInspection: Inspection = {
        inspectionId: inspectionSnap.id,
        ...inspectionData,
        registrationRef: (inspectionData.registrationRef instanceof DocumentReference) ? inspectionData.registrationRef.id : inspectionData.registrationRef,
        inspectorRef: inspectionData.inspectorRef ? ((inspectionData.inspectorRef instanceof DocumentReference) ? inspectionData.inspectorRef.id : inspectionData.inspectorRef) : undefined,
        reviewedByRef: inspectionData.reviewedByRef ? ((inspectionData.reviewedByRef instanceof DocumentReference) ? inspectionData.reviewedByRef.id : inspectionData.reviewedByRef) : undefined,
        createdByRef: (inspectionData.createdByRef instanceof DocumentReference) ? inspectionData.createdByRef.id : inspectionData.createdByRef,
        lastUpdatedByRef: inspectionData.lastUpdatedByRef ? ((inspectionData.lastUpdatedByRef instanceof DocumentReference) ? inspectionData.lastUpdatedByRef.id : inspectionData.lastUpdatedByRef) : undefined,
        scheduledDate: ensureSerializableDate(inspectionData.scheduledDate) as Date,
        inspectionDate: ensureSerializableDate(inspectionData.inspectionDate),
        completedAt: ensureSerializableDate(inspectionData.completedAt),
        reviewedAt: ensureSerializableDate(inspectionData.reviewedAt),
        createdAt: ensureSerializableDate(inspectionData.createdAt) as Date,
        lastUpdatedAt: ensureSerializableDate(inspectionData.lastUpdatedAt),
      };
      setInspection(currentInspection);


      // Fetch Registration Data
      if (currentInspection.registrationRef && typeof currentInspection.registrationRef === 'string') {
        const regDocRef = doc(db, "registrations", currentInspection.registrationRef);
        const regSnap = await getDoc(regDocRef);
        if (regSnap.exists()) {
          const regDataFirestore = regSnap.data();
          const regData: Registration = {
            registrationId: regSnap.id,
            ...regDataFirestore,
            owners: (regDataFirestore.owners || []).map((o: any) => ({ ...o, dob: ensureSerializableDate(o.dob) })),
            proofOfOwnershipDocs: (regDataFirestore.proofOfOwnershipDocs || []).map((d: any) => ({ ...d, uploadedAt: ensureSerializableDate(d.uploadedAt) })),
            submittedAt: ensureSerializableDate(regDataFirestore.submittedAt),
            approvedAt: ensureSerializableDate(regDataFirestore.approvedAt),
            effectiveDate: ensureSerializableDate(regDataFirestore.effectiveDate),
            expiryDate: ensureSerializableDate(regDataFirestore.expiryDate),
            paymentDate: ensureSerializableDate(regDataFirestore.paymentDate),
            certificateGeneratedAt: ensureSerializableDate(regDataFirestore.certificateGeneratedAt),
            suspensionStartDate: ensureSerializableDate(regDataFirestore.suspensionStartDate),
            suspensionEndDate: ensureSerializableDate(regDataFirestore.suspensionEndDate),
            revokedAt: ensureSerializableDate(regDataFirestore.revokedAt),
            lastUpdatedAt: ensureSerializableDate(regDataFirestore.lastUpdatedAt) as Date,
            createdAt: ensureSerializableDate(regDataFirestore.createdAt) as Date,
          } as Registration;
          setRegistration(regData);
        } else {
          throw new Error("Associated registration not found.");
        }
      } else if (currentInspection.registrationData) { // Fallback to denormalized if ref string not present
         setRegistration(currentInspection.registrationData as Registration); // Assuming it matches Registration type
      } else {
         throw new Error("Registration reference missing or invalid in inspection data.");
      }


      // Fetch Inspector Data
      if (currentInspection.inspectorRef && typeof currentInspection.inspectorRef === 'string') {
        const inspectorDocRef = doc(db, "users", currentInspection.inspectorRef);
        const inspectorSnap = await getDoc(inspectorDocRef);
        if (inspectorSnap.exists()) {
          setInspector(inspectorSnap.data() as User);
        } else {
          console.warn("Inspector not found for ID:", currentInspection.inspectorRef);
        }
      } else if (currentInspection.inspectorData) {
        setInspector(currentInspection.inspectorData as User);
      }


    } catch (err: any) {
      console.error("Error fetching data for safety certificate:", err);
      setError(err.message || "Failed to load certificate data.");
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useEffect(() => {
    fetchCertificateData();
  }, [fetchCertificateData]);

  const handleDownloadPlaceholder = () => {
    toast({
      title: "Download Initiated (Placeholder)",
      description: "In a real application, a PDF certificate would be generated and downloaded.",
    });
  };

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

  if (!inspection || !registration) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p>Required data for certificate could not be loaded.</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">Go Back</Button>
      </div>
    );
  }

  const primaryOwner = registration.owners.find(o => o.role === "Primary") || registration.owners[0];
  const issueDate = inspection.completedAt ? ensureSerializableDate(inspection.completedAt) : new Date();
  const expiryDate = issueDate ? addYears(issueDate, 1) : undefined;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
         <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Safety Certificate</h1>
        </div>
        <Button onClick={handleDownloadPlaceholder}>
          <Download className="mr-2 h-4 w-4" /> Download
        </Button>
      </div>

      <Card className="shadow-lg p-6 md:p-10 certificate-preview relative overflow-hidden print-area" data-ai-hint="document certificate safety">
        <Sailboat className="absolute inset-0 m-auto h-3/4 w-3/4 text-primary/5 opacity-10 z-0" />
        
        <div className="relative z-10">
          <header className="text-center border-b-2 border-primary pb-4 mb-6">
            <Image 
              src="https://ncdsmallcraft.com/images/114/11667247/LOGO-NCDCRB-small.png" 
              alt="NCDCRB Logo" 
              width={80} 
              height={80} 
              className="mx-auto mb-3 h-20 w-20"
            />
            <h2 className="text-3xl md:text-4xl font-bold text-primary">Safety Certificate</h2>
            <p className="text-muted-foreground text-base md:text-lg">National Capital District Small Craft Registration Board</p>
          </header>

          <CardContent className="space-y-4 md:space-y-6 text-sm md:text-base">
            <div className="text-center my-4 md:my-6">
              <p className="text-lg md:text-xl">Certificate No: <span className="font-semibold">{inspection.inspectionId}</span></p>
            </div>
            
            <Separator />

            <div>
              <h3 className="font-semibold text-primary mb-1 text-lg">Craft Details:</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pl-2">
                <p><strong>Rego No (SCA):</strong> {registration.scaRegoNo || "N/A"}</p>
                <p><strong>Make:</strong> {registration.craftMake}</p>
                <p><strong>Model:</strong> {registration.craftModel}</p>
                <p><strong>Hull ID (HIN):</strong> {registration.hullIdNumber}</p>
              </div>
            </div>

            {primaryOwner && (
              <div>
                <h3 className="font-semibold text-primary mb-1 text-lg">Owner Details:</h3>
                <div className="pl-2">
                  <p><strong>Name:</strong> {primaryOwner.firstName} {primaryOwner.surname}</p>
                  <p><strong>Address:</strong> {primaryOwner.postalAddress}, {primaryOwner.wardVillage}, {primaryOwner.llg}, {primaryOwner.townDistrict}</p>
                </div>
              </div>
            )}

            <Separator />

            <div className="text-center leading-relaxed">
              <p className="font-semibold text-lg mb-2">Certification</p>
              <p>
                This is to certify that the above-mentioned small craft, having been inspected by an authorized officer,
                was found at the time of inspection to:
              </p>
              <ol className="list-decimal list-inside text-left my-3 mx-auto max-w-prose space-y-1">
                <li>Comply with the Small Crafts Act 2011 and Amended Schedules SI 190/2016;</li>
                <li>Be fit to carry no more than <span className="font-semibold">{registration.passengerCapacity || 'N/A'}</span> persons, and;</li>
                <li>Be fit for use as a <span className="font-semibold">{registration.craftUse || 'N/A'}</span> craft.</li>
              </ol>
              <p className="mt-2">This certificate is valid until <span className="font-semibold">{expiryDate ? formatFirebaseTimestamp(expiryDate, "MMMM dd, yyyy") : 'N/A'}</span>, subject to any corrective actions noted during the inspection being completed and maintained.</p>
            </div>
            
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 mt-4">
              <div>
                <h3 className="font-semibold text-primary mb-1">Date of Issue:</h3>
                <p>{formatFirebaseTimestamp(issueDate, "MMMM dd, yyyy")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">Inspecting Officer:</h3>
                <p>{inspector?.displayName || inspection.inspectorData?.displayName || "N/A"}</p>
                <p className="text-xs text-muted-foreground">(Signature Area)</p>
                <div className="h-12 w-full border-b border-muted-foreground mt-2"></div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground mb-1">Official NCDSCRB Stamp</p>
                <div className="h-24 w-24 border-2 border-dashed border-muted-foreground mx-auto rounded-full flex items-center justify-center text-muted-foreground">
                </div>
            </div>
          </CardContent>
          
          <CardFooter className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>This certificate is issued under the Small Craft Act 2011. It must be produced upon request by an authorized officer. Failure to comply with safety standards may render this certificate void.</p>
            <p className="mt-2">RegoCraft &copy; {new Date().getFullYear()}</p>
          </CardFooter>
        </div>
      </Card>
    </div>
  );
}
