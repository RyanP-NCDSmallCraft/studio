
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Registration, Owner, User } from "@/types"; 
import { FileSpreadsheet, Printer, Sailboat, ArrowLeft, Loader2, AlertTriangle, Download } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import React, { useState, useEffect, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
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
  const [downloading, setDownloading] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

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
          craftImageUrl: data.craftImageUrl,
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



  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    try {
      setDownloading(true);
      // Wait slightly to ensure fonts/images are ready
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const canvas = await html2canvas(printRef.current, { 
        scale: 2, 
        useCORS: true,
        scrollY: -window.scrollY // Fixes issues where page scrolling cuts off bottom of canvas
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      
      const a4Width = pdf.internal.pageSize.getWidth();
      const a4Height = pdf.internal.pageSize.getHeight();
      
      const canvasRatio = canvas.height / canvas.width;
      const a4Ratio = a4Height / a4Width;

      let renderWidth = a4Width;
      let renderHeight = a4Width * canvasRatio;

      // If the rendered canvas is taller than an A4 page, scale it down to fit vertically
      if (canvasRatio > a4Ratio) { 
        renderHeight = a4Height;
        renderWidth = a4Height / canvasRatio;
      }
      
      // Center the image if it's scaled down
      const xOffset = (a4Width - renderWidth) / 2;
      const yOffset = (a4Height - renderHeight) / 2;

      pdf.addImage(imgData, "PNG", xOffset, yOffset, renderWidth, renderHeight);
      pdf.save(`Registration_Certificate_${registration?.scaRegoNo || registrationId}.pdf`);
    } catch (e) {
      console.error("Failed to generate PDF:", e);
    } finally {
      setDownloading(false);
    }
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
        <Button onClick={handleDownloadPdf} disabled={downloading}>
          {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {downloading ? "Generating PDF..." : "Download PDF"}
        </Button>
      </div>

      <Card ref={printRef} className="shadow-lg print-area relative overflow-hidden bg-white border-[12px] border-primary border-double mx-auto max-w-4xl" data-ai-hint="document certificate">
        {/* Large Watermark */}
        <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.05] pointer-events-none grayscale">
            <div className="relative w-3/4 max-w-xl aspect-square">
              <Image 
                src="/logo-highres.png" 
                alt="Watermark" 
                fill
                className="object-contain"
              />
            </div>
        </div>
        
        <div className="relative z-10 p-8 md:p-12 lg:p-16">
          <header className="text-center pb-6 md:pb-8 relative">
            <div className="relative mx-auto mb-6 h-28 w-28 drop-shadow-md">
              <Image 
                src="/logo-highres.png" 
                alt="NCDCRB Logo" 
                fill
                className="object-contain"
              />
            </div>
            <h2 className="text-4xl md:text-5xl tracking-tight font-serif font-bold text-primary mb-3 uppercase">Certificate of Registration</h2>
            <p className="text-md font-semibold text-muted-foreground tracking-widest uppercase">Small Craft Act 2011</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider">Amended Schedules SI 190/2016</p>
          </header>

          <CardContent className="space-y-8 md:space-y-10 text-sm md:text-base px-0 md:px-6">
            <div className="text-center bg-primary/5 py-6 rounded-lg border border-primary/20 shadow-inner">
              <p className="text-primary/70 font-medium mb-2 uppercase tracking-widest text-sm">Official Registration Number</p>
              <p className="text-4xl md:text-5xl font-mono font-bold tracking-widest text-secondary-foreground">{registration.scaRegoNo || "PENDING"}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-3">
                    <h3 className="font-semibold text-primary uppercase text-xs tracking-wider border-b-2 border-primary/20 pb-2">Registered Owner(s)</h3>
                    {registration.owners.map(o => (
                        <p key={o.ownerId} className="font-medium text-xl">
                            {o.firstName} {o.surname} <span className="text-sm text-muted-foreground font-normal ml-2">({o.role})</span>
                        </p>
                    ))}
                </div>
                <div className="space-y-3">
                    <h3 className="font-semibold text-primary uppercase text-xs tracking-wider border-b-2 border-primary/20 pb-2">Primary Address</h3>
                    <p className="text-md leading-relaxed">{registration.owners[0]?.postalAddress}<br/>{registration.owners[0]?.wardVillage}, {registration.owners[0]?.llg}<br/>{registration.owners[0]?.townDistrict}</p>
                </div>
            </div>

            <div className="space-y-5">
               <h3 className="text-center font-bold text-lg text-primary uppercase tracking-widest border-y-2 border-primary/20 py-3 bg-primary/5">Particulars of Craft</h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-3 px-2">
                  <div className="space-y-3">
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Make</span> <span className="font-medium text-right">{registration.craftMake}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Year</span> <span className="font-medium text-right">{registration.craftYear}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Primary Color</span> <span className="font-medium text-right">{registration.craftColor}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Length Overall</span> <span className="font-medium text-right">{registration.craftLength} {registration.lengthUnits}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Propulsion</span> <span className="font-medium text-right">{registration.propulsionType} {registration.propulsionOtherDesc && `(${registration.propulsionOtherDesc})`}</span></div>
                  </div>
                  <div className="space-y-3">
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Model</span> <span className="font-medium text-right">{registration.craftModel}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Hull ID (HIN)</span> <span className="font-medium text-right">{registration.hullIdNumber}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Capacity</span> <span className="font-medium text-right">{registration.passengerCapacity || "N/A"} pax</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Vessel Type</span> <span className="font-medium text-right">{registration.vesselType} {registration.vesselTypeOtherDesc && `(${registration.vesselTypeOtherDesc})`}</span></div>
                      <div className="flex justify-between border-b border-dotted border-gray-300 pb-1"><span className="text-muted-foreground">Permitted Use</span> <span className="font-medium text-right">{registration.craftUse} {registration.craftUseOtherDesc && `(${registration.craftUseOtherDesc})`}</span></div>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 pt-8">
                <div className="space-y-4">
                    <h3 className="font-semibold text-primary uppercase text-xs tracking-wider border-b-2 border-primary/20 pb-2 mb-3">Effective Dates</h3>
                    <p className="flex justify-between text-lg"><span className="text-muted-foreground">Date of Issue:</span> <span className="font-medium">{formatFirebaseTimestamp(registration.effectiveDate || registration.approvedAt, "dd MMM yyyy")}</span></p>
                    <p className="flex justify-between text-lg"><span className="text-red-600/80 font-semibold uppercase tracking-wide">Valid Until:</span> <span className="text-red-700 font-bold">{formatFirebaseTimestamp(registration.expiryDate, "dd MMM yyyy")}</span></p>
                </div>
                <div className="text-center flex flex-col items-center justify-end mt-8 md:mt-0">
                    <div className="w-56 h-20 border-b-2 border-primary mb-3 flex items-end justify-center pb-2 relative">
                        {/* Placeholder for digital signature */}
                        <span className="font-serif italic text-3xl text-blue-900/50">{approvedByName}</span>
                        <div className="absolute -left-10 -bottom-4 w-16 h-16 rounded-full border-4 border-double border-red-500/20 text-red-500/20 flex flex-col justify-center items-center font-bold text-[8px] leading-tight rotate-12">
                          <span className="bg-white/50 w-full text-center">NCDSCRB</span>
                          <span className="bg-white/50 w-full text-center">OFFICIAL</span>
                        </div>
                    </div>
                    <p className="font-semibold uppercase tracking-wider text-sm mt-1">Registrar of Small Craft</p>
                    <p className="text-xs text-muted-foreground font-medium">National Capital District</p>
                </div>
            </div>
            
          </CardContent>
          
          <footer className="mt-12 pt-6 border-t border-primary/20 text-center text-xs text-muted-foreground bg-slate-50 -mx-8 -md:-mx-12 lg:-mx-16 -mb-8 md:-mb-12 lg:-mb-16 p-8 relative overflow-hidden">
             <div className="relative z-10">
                <p className="mb-2 font-medium">This certificate is issued under the authority of the National Capital District Small Craft Registration Board (NCDSCRB).</p>
                <p className="uppercase tracking-widest text-[10px]">Document Generated • {new Date().getFullYear()} • Valid when presented with original seal</p>
             </div>
          </footer>
        </div>
      </Card>
    </div>
  );
}
