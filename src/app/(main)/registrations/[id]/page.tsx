
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Registration, Owner, ProofOfOwnershipDoc, Inspection } from "@/types";
import { Ship, User, FileText, ClipboardCheck, CalendarDays, DollarSign, Edit, CheckCircle, XCircle, Info, FileSpreadsheet, ListChecks, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from 'date-fns';
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";

// Placeholder data
const placeholderRegistration: Registration = {
  registrationId: "REG001",
  scaRegoNo: "SCA123",
  interimRegoNo: "INT789",
  registrationType: "New",
  status: "Approved",
  submittedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) as any,
  approvedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) as any,
  effectiveDate: new Date() as any,
  expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) as any,
  provinceOfRegistration: "Central Province",
  paymentMethod: "Card",
  paymentReceiptNumber: "RCPT001",
  paymentAmount: 150,
  paymentDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) as any,
  safetyCertNumber: "SAFE999",
  safetyEquipIssued: true,
  safetyEquipReceiptNumber: "SEQ001",
  owners: [
    { ownerId: "owner1", role: "Primary", surname: "Smith", firstName: "John", dob: new Date(1980, 5, 15) as any, sex: "Male", phone: "555-0101", email: "john.smith@example.com", postalAddress: "P.O. Box 123", townDistrict: "Port Moresby", llg: "NCD", wardVillage: "Waigani" },
    { ownerId: "owner2", role: "CoOwner", surname: "Smith", firstName: "Jane", dob: new Date(1982, 8, 20) as any, sex: "Female", phone: "555-0102", email: "jane.smith@example.com", postalAddress: "P.O. Box 123", townDistrict: "Port Moresby", llg: "NCD", wardVillage: "Waigani" }
  ],
  proofOfOwnershipDocs: [
    { docId: "doc1", description: "Bill of Sale", fileName: "bill_of_sale.pdf", fileUrl: "https://placehold.co/600x400.png?text=Bill+of+Sale", uploadedAt: new Date() as any },
    { docId: "doc2", description: "ID Document", fileName: "owner_id.jpg", fileUrl: "https://placehold.co/600x400.png?text=ID+Document", uploadedAt: new Date() as any }
  ],
  craftMake: "Yamaha",
  craftModel: "FX Cruiser HO",
  craftYear: 2022,
  craftColor: "Blue/White",
  hullIdNumber: "YAM12345X122",
  craftLength: 3.56,
  lengthUnits: "m",
  distinguishingFeatures: "Custom decals on side",
  propulsionType: "Inboard",
  hullMaterial: "Fiberglass",
  craftUse: "Pleasure",
  fuelType: "Gasoline",
  vesselType: "PWC",
  certificateGeneratedAt: new Date() as any,
  certificateFileName: "SCA123_Certificate.pdf",
  certificateFileUrl: "https://placehold.co/800x1100.png?text=Certificate+SCA123",
  lastUpdatedByRef: {} as any,
  lastUpdatedAt: new Date() as any,
  createdByRef: {} as any,
  createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) as any,
};

const placeholderInspections: Inspection[] = [
    { inspectionId: "INSP001", registrationRef: {} as any, inspectorRef: {} as any, inspectionType: "Initial", scheduledDate: new Date() as any, inspectionDate: new Date() as any, status: "Passed", overallResult: "Pass", findings: "All clear", followUpRequired: false, checklistItems: [], createdAt: new Date() as any, createdByRef: {} as any },
    { inspectionId: "INSP002", registrationRef: {} as any, inspectorRef: {} as any, inspectionType: "Annual", scheduledDate: new Date() as any, status: "Scheduled", findings: "", followUpRequired: false, checklistItems: [], createdAt: new Date() as any, createdByRef: {} as any },
];

export default function RegistrationDetailPage() {
  const params = useParams();
  const registrationId = params.id as string;
  const { currentUser, isRegistrar, isAdmin, isSupervisor } = useAuth();
  const registration = placeholderRegistration; // Use placeholder data
  const inspections = placeholderInspections;
  const router = useRouter();
  const { toast } = useToast();

  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [scaRegoNo, setScaRegoNo] = useState(registration.scaRegoNo || "");
  const [effectiveDate, setEffectiveDate] = useState(registration.effectiveDate ? format(registration.effectiveDate.toDate(), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
  const [expiryDate, setExpiryDate] = useState(registration.expiryDate ? format(registration.expiryDate.toDate(), "yyyy-MM-dd") : format(new Date(new Date().setFullYear(new Date().getFullYear() + 1)), "yyyy-MM-dd"));


  if (!registration) {
    return <p>Loading registration details...</p>;
  }

  const getStatusBadgeVariant = (status: Registration["status"]) => {
    // Same as list page
    switch (status) {
      case "Approved": return "default";
      case "PendingReview": case "Submitted": return "secondary";
      case "Rejected": case "Expired": return "destructive";
      case "Draft": case "RequiresInfo": return "outline";
      default: return "outline";
    }
  };

  const handleApprove = async () => {
    // In real app, update Firestore doc with scaRegoNo, effectiveDate, expiryDate, status = "Approved"
    console.log("Approving registration:", registrationId, { scaRegoNo, effectiveDate, expiryDate });
    toast({ title: "Registration Approved", description: `SCA Rego No: ${scaRegoNo}` });
    setApproveModalOpen(false);
    // Simulate update for UI
    registration.status = "Approved";
    registration.scaRegoNo = scaRegoNo;
    // router.refresh(); // Or update state
  };

  const handleReject = async () => {
    // In real app, update Firestore doc with status = "Rejected"
    console.log("Rejecting registration:", registrationId);
    toast({ title: "Registration Rejected", variant: "destructive" });
    registration.status = "Rejected";
    // router.refresh();
  };
  
  const handleRequestInfo = async () => {
    console.log("Requesting info for registration:", registrationId);
    toast({ title: "Information Requested", description: "Owner will be notified." });
    registration.status = "RequiresInfo";
    // router.refresh();
  };


  const canEdit = isRegistrar && (registration.status === "Submitted" || registration.status === "RequiresInfo" || registration.status === "Draft");
  const canApproveReject = (isRegistrar || isAdmin) && (registration.status === "Submitted" || registration.status === "RequiresInfo");
  const canScheduleInspection = (isAdmin || isSupervisor);
  const canGenerateCertificate = (isRegistrar || isAdmin) && registration.status === "Approved";


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Ship className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Registration: {registration.scaRegoNo || registration.interimRegoNo || registration.registrationId}</h1>
            <Badge variant={getStatusBadgeVariant(registration.status)} className="mt-1">{registration.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/registrations/${registrationId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {(canApproveReject || canScheduleInspection || canGenerateCertificate) && (
        <Card>
          <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {canApproveReject && (
              <>
              <AlertDialog open={approveModalOpen} onOpenChange={setApproveModalOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="default"><CheckCircle className="mr-2 h-4 w-4" /> Approve</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Approve Registration</AlertDialogTitle>
                    <AlertDialogDescription>
                      Enter the official SCA Registration Number and validity dates.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label htmlFor="scaRegoNo">SCA Rego No.</Label>
                      <Input id="scaRegoNo" value={scaRegoNo} onChange={(e) => setScaRegoNo(e.target.value)} placeholder="e.g., SCA00123" />
                    </div>
                     <div>
                      <Label htmlFor="effectiveDate">Effective Date</Label>
                      <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                    </div>
                     <div>
                      <Label htmlFor="expiryDate">Expiry Date</Label>
                      <Input id="expiryDate" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
                    </div>
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleApprove}>Approve</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog>
                <AlertDialogTrigger asChild><Button variant="destructive"><XCircle className="mr-2 h-4 w-4" /> Reject</Button></AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Confirm Rejection</AlertDialogTitle><AlertDialogDescription>Are you sure you want to reject this registration? This action cannot be undone easily.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleReject}>Confirm Reject</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="outline" onClick={handleRequestInfo}><Info className="mr-2 h-4 w-4" /> Request Info</Button>
              </>
            )}
            {canScheduleInspection && (
              <Button variant="outline" asChild>
                <Link href={`/inspections/new?registrationId=${registrationId}`}><ListChecks className="mr-2 h-4 w-4" /> Schedule Inspection</Link>
              </Button>
            )}
             {canGenerateCertificate && (
                registration.certificateFileUrl ? (
                    <Button variant="default" asChild>
                        <a href={registration.certificateFileUrl} target="_blank" rel="noopener noreferrer" data-ai-hint="document certificate">
                            <FileSpreadsheet className="mr-2 h-4 w-4" /> View/Download Certificate
                        </a>
                    </Button>
                ) : (
                    <Button variant="default" asChild>
                      <Link href={`/registrations/${registrationId}/certificate`}><FileSpreadsheet className="mr-2 h-4 w-4" /> Generate Certificate</Link>
                    </Button>
                )
            )}
          </CardContent>
        </Card>
      )}

       {registration.status === "Rejected" && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><AlertTriangle /> Registration Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">This registration has been rejected. Please review comments or contact support for more information.</p>
            {/* Add reason if available */}
          </CardContent>
        </Card>
      )}
      
      {registration.status === "RequiresInfo" && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardHeader>
            <CardTitle className="text-yellow-700 flex items-center gap-2"><Info /> Information Required</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-yellow-700">Additional information is required for this registration. The owner has been notified.</p>
            {/* Add comment/reason if available */}
          </CardContent>
        </Card>
      )}


      {/* Main Details Card */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Craft Details */}
          <Card>
            <CardHeader><CardTitle>Craft Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Make:</strong> {registration.craftMake}</div>
              <div><strong>Model:</strong> {registration.craftModel}</div>
              <div><strong>Year:</strong> {registration.craftYear}</div>
              <div><strong>Color:</strong> {registration.craftColor}</div>
              <div><strong>Hull ID:</strong> {registration.hullIdNumber}</div>
              <div><strong>Length:</strong> {registration.craftLength} {registration.lengthUnits}</div>
              <div><strong>Propulsion:</strong> {registration.propulsionType} {registration.propulsionOtherDesc && `(${registration.propulsionOtherDesc})`}</div>
              <div><strong>Hull Material:</strong> {registration.hullMaterial} {registration.hullMaterialOtherDesc && `(${registration.hullMaterialOtherDesc})`}</div>
              <div><strong>Craft Use:</strong> {registration.craftUse} {registration.craftUseOtherDesc && `(${registration.craftUseOtherDesc})`}</div>
              <div><strong>Fuel Type:</strong> {registration.fuelType} {registration.fuelTypeOtherDesc && `(${registration.fuelTypeOtherDesc})`}</div>
              <div><strong>Vessel Type:</strong> {registration.vesselType} {registration.vesselTypeOtherDesc && `(${registration.vesselTypeOtherDesc})`}</div>
              {registration.distinguishingFeatures && <div className="md:col-span-2"><strong>Features:</strong> {registration.distinguishingFeatures}</div>}
            </CardContent>
          </Card>

          {/* Owners */}
          <Card>
            <CardHeader><CardTitle>Owners</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {registration.owners.map((owner: Owner, index: number) => (
                <div key={owner.ownerId} className="p-3 border rounded-md bg-muted/30">
                  <p className="font-semibold text-md">{owner.firstName} {owner.surname} <Badge variant="secondary">{owner.role}</Badge></p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                    <p><strong>DOB:</strong> {format(owner.dob.toDate(), "PP")}</p>
                    <p><strong>Sex:</strong> {owner.sex}</p>
                    <p><strong>Phone:</strong> {owner.phone}</p>
                    {owner.email && <p><strong>Email:</strong> {owner.email}</p>}
                    <p className="sm:col-span-2"><strong>Address:</strong> {owner.postalAddress}, {owner.wardVillage}, {owner.llg}, {owner.townDistrict}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          {/* Registration Info */}
          <Card>
            <CardHeader><CardTitle>Registration Info</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>Type:</strong> {registration.registrationType}</p>
              {registration.previousScaRegoNo && <p><strong>Previous Rego:</strong> {registration.previousScaRegoNo}</p>}
              <p><strong>Province:</strong> {registration.provinceOfRegistration}</p>
              <p><strong>Submitted:</strong> {registration.submittedAt ? format(registration.submittedAt.toDate(), "PPpp") : "N/A"}</p>
              <p><strong>Approved:</strong> {registration.approvedAt ? format(registration.approvedAt.toDate(), "PPpp") : "N/A"}</p>
              <p><strong>Effective:</strong> {registration.effectiveDate ? format(registration.effectiveDate.toDate(), "PP") : "N/A"}</p>
              <p><strong>Expires:</strong> {registration.expiryDate ? format(registration.expiryDate.toDate(), "PP") : "N/A"}</p>
            </CardContent>
          </Card>

          {/* Payment Details */}
          {registration.paymentAmount && (
            <Card>
              <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Amount:</strong> ${registration.paymentAmount?.toFixed(2)}</p>
                <p><strong>Method:</strong> {registration.paymentMethod}</p>
                <p><strong>Receipt No:</strong> {registration.paymentReceiptNumber}</p>
                <p><strong>Date:</strong> {registration.paymentDate ? format(registration.paymentDate.toDate(), "PP") : "N/A"}</p>
                {registration.bankStampRef && <p><strong>Bank Ref:</strong> {registration.bankStampRef}</p>}
              </CardContent>
            </Card>
          )}
          
          {/* Safety Equipment */}
           {registration.safetyCertNumber && (
            <Card>
              <CardHeader><CardTitle>Safety Equipment</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Safety Cert No:</strong> {registration.safetyCertNumber}</p>
                <p><strong>Equipment Issued:</strong> {registration.safetyEquipIssued ? "Yes" : "No"}</p>
                {registration.safetyEquipReceiptNumber && <p><strong>Receipt No:</strong> {registration.safetyEquipReceiptNumber}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Proof of Ownership */}
      <Card>
        <CardHeader><CardTitle>Proof of Ownership</CardTitle></CardHeader>
        <CardContent>
          {registration.proofOfOwnershipDocs.length > 0 ? (
            <ul className="space-y-2">
              {registration.proofOfOwnershipDocs.map((doc: ProofOfOwnershipDoc) => (
                <li key={doc.docId} className="flex items-center justify-between p-2 border rounded-md">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span>{doc.description} ({doc.fileName})</span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" data-ai-hint="document ownership">Download</a>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No proof of ownership documents uploaded.</p>
          )}
        </CardContent>
      </Card>

      {/* Linked Inspections */}
      <Card>
        <CardHeader><CardTitle>Linked Inspections</CardTitle></CardHeader>
        <CardContent>
          {inspections.length > 0 ? (
            <ul className="space-y-3">
              {inspections.map((insp: Inspection) => (
                <li key={insp.inspectionId} className="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                  <Link href={`/inspections/${insp.inspectionId}`} className="block">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">{insp.inspectionType} Inspection ({insp.inspectionId})</p>
                      <Badge>{insp.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scheduled: {insp.scheduledDate ? format(insp.scheduledDate.toDate(), "PP") : "N/A"} |
                      Result: {insp.overallResult || "Pending"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No inspections linked to this registration yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
