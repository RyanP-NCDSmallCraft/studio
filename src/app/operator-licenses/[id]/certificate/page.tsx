
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { OperatorLicense, Operator, User } from "@/types"; 
import { FileImage, Download, UserCircle2, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore'; 
import { db } from '@/lib/firebase';
import { isValid, addYears } from "date-fns";


// Helper to ensure date serialization
const ensureDateObject = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) return dateValue.toDate();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try { return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate(); } catch (e) { return undefined; }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (isValid(parsedDate)) return parsedDate;
  }
  return undefined;
};


export default function OperatorLicenseCertificatePage() {
  const params = useParams();
  const router = useRouter();
  const licenseApplicationId = params.id as string;
  const { toast } = useToast();

  const [license, setLicense] = useState<OperatorLicense | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCertificateData = useCallback(async () => {
    if (!licenseApplicationId) {
      setError("License Application ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const licenseDocRef = doc(db, "operatorLicenseApplications", licenseApplicationId);
      const licenseSnap = await getDoc(licenseDocRef);

      if (!licenseSnap.exists()) {
        setError("License application not found.");
        setLoading(false);
        return;
      }

      const licenseDataRaw = licenseSnap.data() as Omit<OperatorLicense, 'operatorRef'> & { operatorRef: DocumentReference<Operator> | string };

      if (licenseDataRaw.status !== "Approved") {
        setError("License Card can only be generated for 'Approved' licenses.");
        setLoading(false);
        return;
      }
      
      const currentLicense: OperatorLicense = {
        ...licenseDataRaw,
        licenseApplicationId: licenseSnap.id,
        operatorRef: licenseDataRaw.operatorRef,
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
      setLicense(currentLicense);

      if (currentLicense.operatorRef) {
        let operatorRef: DocumentReference<Operator>;
        if (typeof currentLicense.operatorRef === 'string') {
          operatorRef = doc(db, currentLicense.operatorRef) as DocumentReference<Operator>;
        } else {
          operatorRef = currentLicense.operatorRef as DocumentReference<Operator>;
        }
        const operatorSnap = await getDoc(operatorRef);
        if (operatorSnap.exists()) {
          const opRaw = operatorSnap.data() as Operator;
           setOperator({
            ...opRaw,
            operatorId: operatorSnap.id,
            dob: ensureDateObject(opRaw.dob) as Date,
            createdAt: ensureDateObject(opRaw.createdAt) as Date,
            updatedAt: ensureDateObject(opRaw.updatedAt) as Date,
          });
        } else {
          throw new Error("Associated operator not found.");
        }
      } else {
         throw new Error("Operator reference missing in license data.");
      }

    } catch (err: any) {
      console.error("Error fetching data for license card:", err);
      setError(err.message || "Failed to load license card data.");
    } finally {
      setLoading(false);
    }
  }, [licenseApplicationId]);

  useEffect(() => {
    fetchCertificateData();
  }, [fetchCertificateData]);

  const handleDownloadPlaceholder = () => {
    toast({
      title: "Download Initiated (Placeholder)",
      description: "In a real application, a PDF license card would be generated and downloaded.",
    });
  };

  if (loading) {
    return (
      <div className="flex h-64 justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading license card data...</p>
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

  if (!license || !operator) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p>Required data for license card could not be loaded.</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">Go Back</Button>
      </div>
    );
  }

  const issueDate = license.issuedAt ? ensureDateObject(license.issuedAt) : new Date();
  const expiryDate = license.expiryDate ? ensureDateObject(license.expiryDate) : undefined;

  return (
    <div className="space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
         <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <FileImage className="h-8 w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Operator License Card</h1>
        </div>
        <Button onClick={handleDownloadPlaceholder}>
          <Download className="mr-2 h-4 w-4" /> Download Placeholder
        </Button>
      </div>

      <Card className="shadow-lg p-4 sm:p-6 certificate-preview relative overflow-hidden print-area w-full max-w-md mx-auto aspect-[85.6/53.98] flex flex-col justify-between bg-gradient-to-br from-primary/10 via-background to-primary/5" data-ai-hint="license card id">
        {/* Background Watermark Element */}
        <Image 
            src="https://ncdsmallcraft.com/images/114/11667247/LOGO-NCDCRB-small.png" 
            alt="NCDCRB Watermark" 
            width={150} 
            height={150} 
            className="absolute inset-0 m-auto h-1/2 w-1/2 object-contain opacity-10 z-0"
        />

        <div className="relative z-10 flex flex-col h-full">
          <header className="flex items-center justify-between border-b border-primary/30 pb-2 mb-2">
            <div className="flex items-center gap-2">
                <Image 
                src="https://ncdsmallcraft.com/images/114/11667247/LOGO-NCDCRB-small.png" 
                alt="NCDCRB Logo" 
                width={32} 
                height={32} 
                className="h-8 w-8"
                />
                <div>
                    <h2 className="text-sm font-bold text-primary leading-tight">OPERATOR'S LICENSE</h2>
                    <p className="text-xs text-muted-foreground leading-tight">NCD Small Craft Registration Board</p>
                </div>
            </div>
            <div className="text-right">
                <p className="text-xs text-muted-foreground">License No.</p>
                <p className="text-sm font-semibold text-primary">{license.assignedLicenseNumber || "N/A"}</p>
            </div>
          </header>

          <CardContent className="p-0 grid grid-cols-3 gap-3 flex-grow">
            <div className="col-span-1">
              {operator.idSizePhotoUrl ? (
                <Image 
                  src={operator.idSizePhotoUrl} 
                  alt={`${operator.firstName} ${operator.surname}`} 
                  width={96} 
                  height={128} 
                  className="w-full aspect-[3/4] object-cover rounded border border-muted shadow-sm"
                  data-ai-hint="person portrait"
                />
              ) : (
                <div className="w-full aspect-[3/4] bg-muted rounded border flex items-center justify-center">
                  <UserCircle2 className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="mt-1 text-center">
                <div className="h-5 border-b border-muted-foreground w-full"></div>
                <p className="text-[0.6rem] text-muted-foreground leading-tight">Operator's Signature</p>
              </div>
            </div>

            <div className="col-span-2 space-y-0.5 text-xs">
              <p><strong>Name:</strong> {operator.surname?.toUpperCase()}, {operator.firstName}</p>
              <p><strong>DOB:</strong> {formatFirebaseTimestamp(operator.dob, "dd/MM/yyyy")}</p>
              <p><strong>Sex:</strong> {operator.sex}</p>
              <p><strong>Address:</strong> {operator.postalAddress || "N/A"}</p>
              <p><strong>Phone:</strong> {operator.phoneMobile}</p>
              <p><strong>Class:</strong> {license.licenseClass || "General"}</p>
              <p><strong>Issued:</strong> {formatFirebaseTimestamp(issueDate, "dd/MM/yyyy")}</p>
              <p><strong>Expires:</strong> <span className="font-semibold text-red-600">{formatFirebaseTimestamp(expiryDate, "dd/MM/yyyy")}</span></p>
            </div>
          </CardContent>
          
          <CardFooter className="p-0 mt-2 pt-2 border-t border-primary/30 text-xs text-muted-foreground">
            <div className="w-2/3">
                <p>Restrictions: {license.restrictions || "None"}</p>
            </div>
            <div className="w-1/3 text-right">
                <p className="font-semibold text-xs text-primary/80">(Authorised Signature)</p>
                <div className="h-6 border-b border-muted-foreground mt-1"></div>
            </div>
          </CardFooter>
        </div>
      </Card>
    </div>
  );
}

    
