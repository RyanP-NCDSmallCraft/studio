
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge"; // Import BadgeProps
import type { OperatorLicense, Operator, OperatorLicenseAttachedDoc } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";
import { Edit, FileText, UserCircle, ListChecks, ShieldCheck, ShieldX, Info, Loader2, ArrowLeft } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormItem } from "@/components/ui/form"; // Added import
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

// Placeholder Data - adjust as needed
const placeholderOperator: Operator = {
  operatorId: "OP001",
  surname: "Pini",
  firstName: "Ryan",
  dob: Timestamp.fromDate(new Date(1985, 5, 10)),
  age: 38,
  sex: "Male",
  placeOfOriginTown: "Port Moresby",
  placeOfOriginDistrict: "NCD",
  placeOfOriginLLG: "NCD",
  placeOfOriginVillage: "Hanuabada",
  phoneMobile: "70000001",
  email: "ryan.pini@example.com",
  postalAddress: "PO Box 123, Waigani",
  heightCm: 180,
  eyeColor: "Brown",
  skinColor: "Brown",
  hairColor: "Black",
  weightKg: 75,
  bodyMarks: "Tattoo on left arm",
  idSizePhotoUrl: "https://placehold.co/150x150.png?text=ID",
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
};

const placeholderLicenseApplication: OperatorLicense = {
  licenseApplicationId: "LICAPP001",
  operatorRef: { id: "OP001" } as any,
  operatorData: placeholderOperator,
  applicationType: "New",
  status: "PendingReview", // Example status
  submittedAt: Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
  attachedDocuments: [
    { docId: "doc1", docType: "PoliceClearance", fileName: "police_clearance.pdf", fileUrl: "#", uploadedAt: Timestamp.now(), verifiedStatus: "Pending" },
    { docId: "doc2", docType: "BirthCertificateCopy", fileName: "birth_cert.pdf", fileUrl: "#", uploadedAt: Timestamp.now(), verifiedStatus: "Pending" },
    { docId: "doc3", docType: "IDPhoto", fileName: "id_photo.jpg", fileUrl: placeholderOperator.idSizePhotoUrl!, uploadedAt: Timestamp.now(), verifiedStatus: "Verified" },
  ],
  createdByUserRef: {} as any,
  createdAt: Timestamp.now(),
  lastUpdatedAt: Timestamp.now(),
};


export default function OperatorLicenseDetailPage() {
  const params = useParams();
  const licenseApplicationId = params.id as string;
  const { currentUser, isAdmin, isRegistrar, isSupervisor } // Assuming isSupervisor can also manage licenses
    = useAuth(); 
  const router = useRouter();
  const { toast } = useToast();

  // In a real app, fetch data from Firestore by licenseApplicationId
  const [application, setApplication] = useState<OperatorLicense | null>(placeholderLicenseApplication);
  const [operator, setOperator] = useState<Operator | null>(placeholderOperator);
  const [isUpdating, setIsUpdating] = useState(false);

  // Office Use Only state
  const [officeLicenseNumber, setOfficeLicenseNumber] = useState(application?.assignedLicenseNumber || "");
  const [officeReceiptNo, setOfficeReceiptNo] = useState(application?.receiptNo || "");
  // Add other office use fields similarly

  useEffect(() => {
    // Simulate fetching linked operator data if not already denormalized
    if (application && !application.operatorData && application.operatorRef) {
      // const fetchOp = async () => setOperator(placeholderOperator); // fetch by application.operatorRef.id
      // fetchOp();
    } else if (application?.operatorData) {
      setOperator(application.operatorData as Operator);
    }
  }, [application]);

  if (!application || !operator) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <p>Loading license details...</p></div>;
  }

  const canEditApplication = (isAdmin || isRegistrar || isSupervisor) && (application.status === "Draft" || application.status === "RequiresInfo");
  const canManageApplication = isAdmin || isRegistrar || isSupervisor; // Broader permissions for status changes, etc.

  const handleStatusUpdate = async (newStatus: OperatorLicense["status"], extraData?: Partial<OperatorLicense>) => {
    setIsUpdating(true);
    console.log("Updating status to:", newStatus, "with data:", extraData);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setApplication(prev => prev ? ({ ...prev, status: newStatus, ...extraData, lastUpdatedAt: Timestamp.now() }) : null);
    toast({ title: "Status Updated", description: `Application status changed to ${newStatus}.` });
    setIsUpdating(false);
  };
  
  const getStatusBadgeVariant = (status: OperatorLicense["status"]): BadgeProps["variant"] => {
    // Copied from list page, keep consistent
    switch (status) {
      case "Approved": return "default";
      case "Submitted": case "PendingReview": case "AwaitingTest": case "TestScheduled": case "TestPassed": return "secondary";
      case "Rejected": case "Expired": case "Revoked": case "TestFailed": return "destructive";
      case "Draft": case "RequiresInfo": return "outline";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/operator-licenses')} className="mr-1 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Operator Licenses</span>
          </Button>
          <UserCircle className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">License: {application.assignedLicenseNumber || application.licenseApplicationId}</h1>
            <Badge variant={getStatusBadgeVariant(application.status)} className="mt-1">{application.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditApplication && (
            <Button asChild variant="outline">
              <Link href={`/operator-licenses/${licenseApplicationId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit Application</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Action Buttons for different statuses by authorized roles */}
      {canManageApplication && (
        <Card>
            <CardHeader><CardTitle>Management Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                {application.status === "PendingReview" && (
                    <>
                    <Button onClick={() => handleStatusUpdate("AwaitingTest")} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ListChecks className="mr-2 h-4 w-4" />} Mark Ready for Test
                    </Button>
                     <Button variant="outline" onClick={() => handleStatusUpdate("RequiresInfo")} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Info className="mr-2 h-4 w-4" />} Request More Information
                    </Button>
                    </>
                )}
                 {(application.status === "TestPassed") && ( // Simplified approval flow
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="default" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                Approve & Issue License
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Approve License Application?</AlertDialogTitle>
                            <AlertDialogDescription>This will mark the application as 'Approved' and allow setting license details. This action should be final after all checks.</AlertDialogDescription></AlertDialogHeader>
                            {/* TODO: Add fields for office use here - License No, Issue Date, Expiry Date */}
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleStatusUpdate("Approved", { approvedAt: Timestamp.now(), issuedAt: Timestamp.now(), expiryDate: Timestamp.fromDate(new Date(new Date().setFullYear(new Date().getFullYear() + 3))) /* Example expiry */ } )}>
                                Confirm Approve
                            </AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                 {(application.status === "PendingReview" || application.status === "RequiresInfo" || application.status === "TestFailed") && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldX className="mr-2 h-4 w-4" />}
                                Reject Application
                            </Button>
                        </AlertDialogTrigger>
                         <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Reject Application?</AlertDialogTitle>
                            <AlertDialogDescription>This action will mark the application as 'Rejected'. Please provide a reason (in notes section, placeholder).</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleStatusUpdate("Rejected")}>Confirm Reject</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
            </CardContent>
        </Card>
      )}


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Applicant Details (Operator ID: {operator.operatorId})</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>Name:</strong> {operator.firstName} {operator.surname}</p>
              <p><strong>DOB:</strong> {formatFirebaseTimestamp(operator.dob, "PP")} (Age: {operator.age || 'N/A'})</p>
              <p><strong>Sex:</strong> {operator.sex}</p>
              <p><strong>Contact:</strong> {operator.phoneMobile} / {operator.email || "N/A"}</p>
              <p><strong>Postal Address:</strong> {operator.postalAddress}</p>
              <p><strong>Origin:</strong> {operator.placeOfOriginVillage}, {operator.placeOfOriginLLG}, {operator.placeOfOriginTown}, {operator.placeOfOriginDistrict}</p>
              <CardTitle className="text-base pt-2">Physical Characteristics</CardTitle>
              <div className="grid grid-cols-2 gap-x-4">
                <p><strong>Height:</strong> {operator.heightCm || 'N/A'} cm</p>
                <p><strong>Weight:</strong> {operator.weightKg || 'N/A'} kg</p>
                <p><strong>Eye Color:</strong> {operator.eyeColor || 'N/A'}</p>
                <p><strong>Hair Color:</strong> {operator.hairColor || 'N/A'}</p>
                <p><strong>Skin Color:</strong> {operator.skinColor || 'N/A'}</p>
              </div>
              <p><strong>Body Marks:</strong> {operator.bodyMarks || "None"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Attached Documents</CardTitle></CardHeader>
            <CardContent>
              {application.attachedDocuments.length > 0 ? (
                <ul className="space-y-2">
                  {application.attachedDocuments.map((doc: OperatorLicenseAttachedDoc) => (
                    <li key={doc.docId || doc.fileName} className="flex items-center justify-between p-2 border rounded-md">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <span>{doc.docType}: {doc.fileName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={doc.verifiedStatus === "Verified" ? "default" : doc.verifiedStatus === "Rejected" ? "destructive" : "secondary"}>
                            {doc.verifiedStatus}
                        </Badge>
                        <Button variant="outline" size="sm" asChild>
                            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" data-ai-hint="document attachment">View</a>
                        </Button>
                        {canManageApplication && doc.verifiedStatus === "Pending" && (
                            <Button size="sm" onClick={() => console.log("Verify doc (placeholder):", doc.docId)} disabled>Verify</Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No documents attached.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>Application Summary</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>Application ID:</strong> {application.licenseApplicationId}</p>
              <p><strong>Type:</strong> {application.applicationType}</p>
              {application.applicationType === "Renewal" && <p><strong>Previous License:</strong> {application.previousLicenseNumber}</p>}
              <div><strong>Status:</strong> <Badge variant={getStatusBadgeVariant(application.status)}>{application.status}</Badge></div>
              <p><strong>Submitted:</strong> {formatFirebaseTimestamp(application.submittedAt, "PPpp")}</p>
            </CardContent>
          </Card>

          {operator.idSizePhotoUrl && (
            <Card>
                <CardHeader><CardTitle>Applicant ID Photo</CardTitle></CardHeader>
                <CardContent>
                    <img src={operator.idSizePhotoUrl} alt={`${operator.firstName} ${operator.surname} ID Photo`} className="rounded-md w-full aspect-[3/4] object-cover" data-ai-hint="person portrait"/>
                </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Office Use Only</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
                <FormItem>
                    <Label htmlFor="officeLicenseNumber">License Number</Label>
                    <Input id="officeLicenseNumber" value={officeLicenseNumber} onChange={e => setOfficeLicenseNumber(e.target.value)} disabled={!canManageApplication || application.status === "Approved"} />
                </FormItem>
                 <FormItem>
                    <Label htmlFor="officeReceiptNo">Receipt No.</Label>
                    <Input id="officeReceiptNo" value={officeReceiptNo} onChange={e => setOfficeReceiptNo(e.target.value)} disabled={!canManageApplication} />
                </FormItem>
                {/* Add other office use fields here, e.g., Place Issued, Payment Details, Issue Date, Expiry Date */}
                 <p><strong>Issued At:</strong> {formatFirebaseTimestamp(application.issuedAt, "PP")}</p>
                 <p><strong>Expires At:</strong> {formatFirebaseTimestamp(application.expiryDate, "PP")}</p>
            </CardContent>
            {canManageApplication && application.status !== "Approved" && (
                <CardFooter>
                    <Button onClick={() => console.log("Save Office Use details (placeholder)")} disabled={isUpdating}>Save Office Details</Button>
                </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}


    