
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { OperatorLicense, Operator, OperatorLicenseAttachedDoc, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Timestamp, doc, getDoc, updateDoc, DocumentReference } from "firebase/firestore";
import { db } from '@/lib/firebase';
import { Edit, FileText, UserCircle, ListChecks, ShieldCheck, ShieldX, Info, Loader2, ArrowLeft, BookUser, FileImage, Ban, AlertCircle, CalendarClock, CalendarCheck2 } from "lucide-react";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormItem } from "@/components/ui/form";
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, addYears } from 'date-fns';
import Image from "next/image";


// Helper to convert Firestore Timestamps or other date forms to JS Date for client state
const ensureDateObject = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) return dateValue.toDate();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try { return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate(); } catch (e) { return undefined; }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return undefined;
};

const licenseClassOptions = [
  "Commercial Passenger Small Craft",
  "Commercial Fishing Small Craft",
  "Commercial Cargo Small Craft",
  "Commercial Mixed Use Small Craft",
  "Other"
];

function generateRandomSixDigitNumber(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}


export default function OperatorLicenseDetailPage() {
  const params = useParams();
  const licenseApplicationId = params.id as string;
  const { currentUser, isAdmin, isRegistrar, isSupervisor } = useAuth(); 
  const router = useRouter();
  const { toast } = useToast();

  const [application, setApplication] = useState<OperatorLicense | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const [officeUseModalOpen, setOfficeUseModalOpen] = useState(false);
  const [officeLicenseNumber, setOfficeLicenseNumber] = useState("");
  const [officeReceiptNo, setOfficeReceiptNo] = useState("");
  const [officePlaceIssued, setOfficePlaceIssued] = useState("");
  const [officePaymentMethod, setOfficePaymentMethod] = useState<OperatorLicense["methodOfPayment"]>(undefined);
  const [officePaymentBy, setOfficePaymentBy] = useState("");
  const [officePaymentDate, setOfficePaymentDate] = useState("");
  const [officePaymentAmount, setOfficePaymentAmount] = useState<number | string>("");
  const [officeIssuedAt, setOfficeIssuedAt] = useState("");
  const [officeExpiryDate, setOfficeExpiryDate] = useState("");
  const [officeLicenseClass, setOfficeLicenseClass] = useState("");
  const [officeRestrictions, setOfficeRestrictions] = useState("");
  
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionEndDate, setSuspensionEndDate] = useState("");

  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");


  const fetchApplicationData = useCallback(async () => {
    if (!currentUser || !licenseApplicationId) {
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
        setApplication(null);
        setOperator(null);
        setLoading(false);
        return;
      }
      
      const licenseDataRaw = licenseSnap.data() as Omit<OperatorLicense, 'operatorRef'> & { operatorRef: DocumentReference<Operator> | string };
      const appData: OperatorLicense = {
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
        // Suspension and Revocation fields
        suspensionReason: licenseDataRaw.suspensionReason,
        suspensionStartDate: ensureDateObject(licenseDataRaw.suspensionStartDate),
        suspensionEndDate: ensureDateObject(licenseDataRaw.suspensionEndDate),
        revocationReason: licenseDataRaw.revocationReason,
        revokedAt: ensureDateObject(licenseDataRaw.revokedAt),
      };
      setApplication(appData);

      // Set initial values for office use modal state
      setOfficeLicenseNumber(appData.assignedLicenseNumber || "");
      setOfficeReceiptNo(appData.receiptNo || "");
      setOfficePlaceIssued(appData.placeIssued || "");
      setOfficePaymentMethod(appData.methodOfPayment);
      setOfficePaymentBy(appData.paymentBy || "");
      setOfficePaymentDate(appData.paymentDate ? format(appData.paymentDate as Date, "yyyy-MM-dd") : "");
      setOfficePaymentAmount(appData.paymentAmount !== undefined && appData.paymentAmount !== null ? String(appData.paymentAmount) : "");
      setOfficeIssuedAt(appData.issuedAt ? format(appData.issuedAt as Date, "yyyy-MM-dd") : "");
      setOfficeExpiryDate(appData.expiryDate ? format(appData.expiryDate as Date, "yyyy-MM-dd") : "");
      setOfficeLicenseClass(appData.licenseClass || "");
      setOfficeRestrictions(appData.restrictions || "");


      if (licenseDataRaw.operatorRef) {
        let operatorRef: DocumentReference<Operator>;
        if (typeof licenseDataRaw.operatorRef === 'string') {
          operatorRef = doc(db, licenseDataRaw.operatorRef) as DocumentReference<Operator>;
        } else {
          operatorRef = licenseDataRaw.operatorRef as DocumentReference<Operator>;
        }
        
        const operatorSnap = await getDoc(operatorRef);
        if (operatorSnap.exists()) {
          const opDataRaw = operatorSnap.data() as Operator;
          setOperator({
            ...opDataRaw,
            operatorId: operatorSnap.id,
            dob: ensureDateObject(opDataRaw.dob) as Date,
            createdAt: ensureDateObject(opDataRaw.createdAt) as Date,
            updatedAt: ensureDateObject(opDataRaw.updatedAt) as Date,
          });
        } else {
          setError("Linked operator not found.");
          setOperator(null);
        }
      } else {
        setError("Operator reference missing in application.");
        setOperator(null);
      }

    } catch (err: any) {
      console.error("Error fetching application data:", err);
      setError(err.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, [licenseApplicationId, currentUser]);

  useEffect(() => {
    fetchApplicationData();
  }, [fetchApplicationData]);

  const handleOpenOfficeUseModal = () => {
    // If current application.assignedLicenseNumber is empty and status is suitable, generate one
    if (application && !application.assignedLicenseNumber && 
        (application.status === "Submitted" || 
         application.status === "PendingReview" || 
         application.status === "TestPassed" ||
         application.status === "Approved")) {
      setOfficeLicenseNumber(generateRandomSixDigitNumber());
    } else if (application) {
      setOfficeLicenseNumber(application.assignedLicenseNumber || "");
    }
    // Reset other fields from application state if modal was closed without saving
    if (application) {
        setOfficeReceiptNo(application.receiptNo || "");
        setOfficePlaceIssued(application.placeIssued || "");
        setOfficePaymentMethod(application.methodOfPayment);
        setOfficePaymentBy(application.paymentBy || "");
        setOfficePaymentDate(application.paymentDate ? format(application.paymentDate as Date, "yyyy-MM-dd") : "");
        setOfficePaymentAmount(application.paymentAmount !== undefined && application.paymentAmount !== null ? String(application.paymentAmount) : "");
        setOfficeIssuedAt(application.issuedAt ? format(application.issuedAt as Date, "yyyy-MM-dd") : "");
        setOfficeExpiryDate(application.expiryDate ? format(application.expiryDate as Date, "yyyy-MM-dd") : "");
        setOfficeLicenseClass(application.licenseClass || "");
        setOfficeRestrictions(application.restrictions || "");
    }
    setOfficeUseModalOpen(true);
  };


  const handleStatusUpdate = async (newStatus: OperatorLicense["status"], extraData?: Partial<OperatorLicense>) => {
    if (!currentUser?.userId || !application) return;
    setIsUpdating(true);
    try {
        const licenseDocRef = doc(db, "operatorLicenseApplications", application.licenseApplicationId);
        await updateDoc(licenseDocRef, {
            status: newStatus,
            ...extraData,
            lastUpdatedAt: Timestamp.now(),
            lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
        });
        toast({ title: "Status Updated", description: `Application status changed to ${newStatus}.` });
        fetchApplicationData(); 
    } catch (e: any) {
        toast({title: "Status Update Failed", description: e.message, variant: "destructive"});
    } finally {
        setIsUpdating(false);
    }
  };
  
  const handleSaveOfficeUse = async () => {
    if (!currentUser?.userId || !application) return;
    setIsUpdating(true);
    try {
        const licenseDocRef = doc(db, "operatorLicenseApplications", application.licenseApplicationId);
        const updatePayload: Partial<OperatorLicense> = {
            assignedLicenseNumber: officeLicenseNumber || undefined,
            receiptNo: officeReceiptNo || undefined,
            placeIssued: officePlaceIssued || undefined,
            methodOfPayment: officePaymentMethod || undefined,
            paymentBy: officePaymentBy || undefined,
            paymentDate: officePaymentDate ? Timestamp.fromDate(parseISO(officePaymentDate)) : null,
            paymentAmount: officePaymentAmount !== "" ? parseFloat(String(officePaymentAmount)) : null,
            issuedAt: officeIssuedAt ? Timestamp.fromDate(parseISO(officeIssuedAt)) : null,
            expiryDate: officeExpiryDate ? Timestamp.fromDate(parseISO(officeExpiryDate)) : null,
            licenseClass: officeLicenseClass || undefined,
            restrictions: officeRestrictions || undefined,
            lastUpdatedAt: Timestamp.now(),
            lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
        };
        
        if (application.status === "Approved" && !updatePayload.issuedAt && !officeIssuedAt) {
            updatePayload.issuedAt = Timestamp.now();
        }
        if (application.status === "Approved" && !updatePayload.expiryDate && !officeExpiryDate && updatePayload.issuedAt) {
            updatePayload.expiryDate = Timestamp.fromDate(addYears( (updatePayload.issuedAt as Timestamp).toDate(), 3));
        }

        await updateDoc(licenseDocRef, updatePayload as any);
        toast({ title: "Office Details Saved", description: "Office use information has been updated."});
        setOfficeUseModalOpen(false);
        fetchApplicationData(); 
    } catch (e: any) {
        console.error("Error saving office use data:", e);
        toast({title: "Save Failed", description: e.message || "Could not save office details.", variant: "destructive"});
    } finally {
        setIsUpdating(false);
    }
  };

  const handleSuspend = async () => {
    if (!currentUser?.userId || !application || !suspensionReason.trim()) {
      toast({ title: "Error", description: "User, application, or suspension reason missing.", variant: "destructive" });
      return;
    }
    if (suspensionEndDate && !isValid(parseISO(suspensionEndDate))) {
      toast({ title: "Validation Error", description: "Suspension End Date is invalid.", variant: "destructive" });
      return;
    }
    setIsUpdating(true);
    const updatePayload: Partial<OperatorLicense> = {
      status: "Suspended",
      suspensionReason: suspensionReason,
      suspensionStartDate: Timestamp.now(),
      suspensionEndDate: suspensionEndDate ? Timestamp.fromDate(parseISO(suspensionEndDate)) : null, // Use null
    };
    await handleStatusUpdate("Suspended", updatePayload);
    setSuspendModalOpen(false);
    setSuspensionReason("");
    setSuspensionEndDate("");
    setIsUpdating(false);
  };

  const handleRevoke = async () => {
    if (!currentUser?.userId || !application || !revocationReason.trim()) {
      toast({ title: "Error", description: "User, application, or revocation reason missing.", variant: "destructive" });
      return;
    }
    setIsUpdating(true);
    const updatePayload: Partial<OperatorLicense> = {
      status: "Revoked",
      revocationReason: revocationReason,
      revokedAt: Timestamp.now(),
    };
    await handleStatusUpdate("Revoked", updatePayload);
    setRevokeModalOpen(false);
    setRevocationReason("");
    setIsUpdating(false);
  };
  
  const handleUnsuspend = async () => {
    if (!currentUser?.userId || !application) return;
    setIsUpdating(true);
    const updatePayload: Partial<OperatorLicense> = {
      status: "Approved", // Or determine previous valid state if more complex logic needed
      suspensionReason: null,
      suspensionStartDate: null,
      suspensionEndDate: null,
    };
    await handleStatusUpdate("Approved", updatePayload);
    setIsUpdating(false);
  };

  const getStatusBadgeVariant = (status?: OperatorLicense["status"]): BadgeProps["variant"] => {
    if (!status) return "outline";
    switch (status) {
      case "Approved": return "default";
      case "Submitted": case "PendingReview": case "AwaitingTest": case "TestScheduled": case "TestPassed": return "secondary";
      case "Rejected": case "Expired": case "Revoked": case "TestFailed": case "Suspended": return "destructive";
      case "Draft": case "RequiresInfo": return "outline";
      default: return "outline";
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading license details...</p></div>;
  }
  if (error) return <div className="text-center py-10 text-destructive"><AlertCircle className="mx-auto h-10 w-10 mb-2"/>Error: {error}</div>;
  if (!application || !operator) return <div className="text-center py-10 text-muted-foreground">License application or operator details not found.</div>;

  const canEditApplication = (isAdmin || isRegistrar || isSupervisor) && 
                             (application.status === "Draft" || application.status === "RequiresInfo" || application.status === "Approved");
  const canManageApplication = isAdmin || isRegistrar || isSupervisor;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/operator-licenses')} className="mr-1 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Operator Licenses</span>
          </Button>
          <BookUser className="h-10 w-10 text-primary" />
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
          {canManageApplication && (
            <Button onClick={handleOpenOfficeUseModal} variant="outline">Manage Office Details</Button>
          )}
          {application.status === "Approved" && canManageApplication && (
            <Button asChild>
                <Link href={`/operator-licenses/${licenseApplicationId}/certificate`}><FileImage className="mr-2 h-4 w-4"/> View License Card</Link>
            </Button>
          )}
        </div>
      </div>

      {canManageApplication && (
        <Card>
            <CardHeader><CardTitle>Management Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                { (application.status === "PendingReview" || application.status === "Submitted" || application.status === "TestPassed" || application.status === "RequiresInfo") && (
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="default" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldCheck className="mr-2 h-4 w-4" />}
                                Approve & Issue License
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Approve License Application?</AlertDialogTitle>
                            <AlertDialogDescription>This will mark the application as 'Approved'. Ensure all office details are correct before proceeding. This action should be final.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleStatusUpdate("Approved", { approvedAt: Timestamp.now() } )}>
                                Confirm Approve
                            </AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )}
                 {(application.status === "PendingReview" || application.status === "Submitted" || application.status === "RequiresInfo" || application.status === "TestFailed" || application.status === "AwaitingTest" || application.status === "TestScheduled") && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ShieldX className="mr-2 h-4 w-4" />}
                                Reject Application
                            </Button>
                        </AlertDialogTrigger>
                         <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Reject Application?</AlertDialogTitle>
                            <AlertDialogDescription>This action will mark the application as 'Rejected'.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleStatusUpdate("Rejected")}>Confirm Reject</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
                 {application.status === "PendingReview" && (
                     <Button variant="outline" onClick={() => handleStatusUpdate("RequiresInfo")} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Info className="mr-2 h-4 w-4" />} Request More Information
                    </Button>
                 )}
                 {(application.status === "Approved" || application.status === "Expired") && (
                    <AlertDialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" className="text-orange-600 border-orange-500 hover:bg-orange-100 hover:text-orange-700" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CalendarClock className="mr-2 h-4 w-4" />} Suspend
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Suspend License</AlertDialogTitle><AlertDialogDescription>Provide reason and optional end date.</AlertDialogDescription></AlertDialogHeader>
                            <div className="space-y-2 py-2">
                                <Textarea placeholder="Reason for suspension..." value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)} />
                                <Input type="date" placeholder="Suspension end date (optional)" value={suspensionEndDate} onChange={(e) => setSuspensionEndDate(e.target.value)} />
                            </div>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleSuspend}>Confirm Suspend</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                 )}
                 {application.status === "Suspended" && (
                    <Button variant="outline" className="text-green-600 border-green-500 hover:bg-green-100 hover:text-green-700" onClick={handleUnsuspend} disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CalendarCheck2 className="mr-2 h-4 w-4" />} Unsuspend
                    </Button>
                 )}
                  {(application.status === "Approved" || application.status === "Expired" || application.status === "Suspended") && (
                    <AlertDialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Ban className="mr-2 h-4 w-4" />} Revoke
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Revoke License</AlertDialogTitle><AlertDialogDescription>This action is permanent. Provide reason.</AlertDialogDescription></AlertDialogHeader>
                             <Textarea placeholder="Reason for revocation..." value={revocationReason} onChange={(e) => setRevocationReason(e.target.value)} />
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRevoke} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">Confirm Revoke</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  )}
            </CardContent>
        </Card>
      )}

       {application.status === "Suspended" && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardHeader>
            <CardTitle className="text-orange-700 flex items-center gap-2"><CalendarClock /> License Suspended</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-orange-700 space-y-1">
            <p><strong>Reason:</strong> {application.suspensionReason || "Not specified"}</p>
            {application.suspensionStartDate && <p><strong>Suspended From:</strong> {formatFirebaseTimestamp(application.suspensionStartDate, "PP")}</p>}
            {application.suspensionEndDate && <p><strong>Suspended Until:</strong> {formatFirebaseTimestamp(application.suspensionEndDate, "PP")}</p>}
            {!application.suspensionEndDate && <p>Suspended indefinitely or until further notice.</p>}
          </CardContent>
        </Card>
      )}

      {application.status === "Revoked" && (
        <Card className="border-red-700 bg-red-700/10">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2"><Ban /> License Revoked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-800 space-y-1">
            <p><strong>Reason:</strong> {application.revocationReason || "Not specified"}</p>
            {application.revokedAt && <p><strong>Revoked On:</strong> {formatFirebaseTimestamp(application.revokedAt, "PP")}</p>}
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
              {application.attachedDocuments && application.attachedDocuments.length > 0 ? (
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
              <p><strong>Last Updated:</strong> {formatFirebaseTimestamp(application.lastUpdatedAt, "PPpp")}</p>
            </CardContent>
          </Card>

          {operator.idSizePhotoUrl && (
            <Card>
                <CardHeader><CardTitle>Applicant ID Photo</CardTitle></CardHeader>
                <CardContent>
                    <Image src={operator.idSizePhotoUrl} alt={`${operator.firstName} ${operator.surname} ID Photo`} className="rounded-md w-full aspect-[3/4] object-cover" data-ai-hint="person portrait" width={150} height={200}/>
                </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Office Use Information</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
                <p><strong>Assigned License No:</strong> {application.assignedLicenseNumber || "N/A"}</p>
                <p><strong>Receipt No:</strong> {application.receiptNo || "N/A"}</p>
                <p><strong>Place Issued:</strong> {application.placeIssued || "N/A"}</p>
                <p><strong>Payment Method:</strong> {application.methodOfPayment || "N/A"}</p>
                <p><strong>Payment By:</strong> {application.paymentBy || "N/A"}</p>
                <p><strong>Payment Date:</strong> {formatFirebaseTimestamp(application.paymentDate, "PP")}</p>
                <p><strong>Payment Amount:</strong> {application.paymentAmount !== undefined && application.paymentAmount !== null ? `K${application.paymentAmount.toFixed(2)}` : "N/A"}</p>
                <p><strong>Date Issued:</strong> {formatFirebaseTimestamp(application.issuedAt, "PP")}</p>
                <p><strong>Expiry Date:</strong> {formatFirebaseTimestamp(application.expiryDate, "PP")}</p>
                <p><strong>License Class:</strong> {application.licenseClass || "N/A"}</p>
                <p><strong>Restrictions:</strong> {application.restrictions || "None"}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={officeUseModalOpen} onOpenChange={setOfficeUseModalOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Update Office Use Details</AlertDialogTitle>
            <AlertDialogDescription>
              Modify official license information. This is typically done by authorized personnel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-2">
            <FormItem><Label htmlFor="officeLicenseNumber">Assigned License No.</Label><Input id="officeLicenseNumber" value={officeLicenseNumber} onChange={e => setOfficeLicenseNumber(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officeReceiptNo">Receipt No.</Label><Input id="officeReceiptNo" value={officeReceiptNo} onChange={e => setOfficeReceiptNo(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officePlaceIssued">Place Issued</Label><Input id="officePlaceIssued" value={officePlaceIssued} onChange={e => setOfficePlaceIssued(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officePaymentMethod">Payment Method</Label>
                <Select onValueChange={(value) => setOfficePaymentMethod(value as OperatorLicense["methodOfPayment"])} value={officePaymentMethod}>
                    <SelectTrigger><SelectValue placeholder="Select method..."/></SelectTrigger>
                    <SelectContent>{["Cash", "Card", "BankDeposit", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
            </FormItem>
            <FormItem><Label htmlFor="officePaymentBy">Payment By</Label><Input id="officePaymentBy" value={officePaymentBy} onChange={e => setOfficePaymentBy(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officePaymentDate">Payment Date</Label><Input id="officePaymentDate" type="date" value={officePaymentDate} onChange={e => setOfficePaymentDate(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officePaymentAmount">Payment Amount (K)</Label><Input id="officePaymentAmount" type="number" value={officePaymentAmount} onChange={e => setOfficePaymentAmount(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officeIssuedAt">Date Issued</Label><Input id="officeIssuedAt" type="date" value={officeIssuedAt} onChange={e => setOfficeIssuedAt(e.target.value)} /></FormItem>
            <FormItem><Label htmlFor="officeExpiryDate">Expiry Date</Label><Input id="officeExpiryDate" type="date" value={officeExpiryDate} onChange={e => setOfficeExpiryDate(e.target.value)} /></FormItem>
            <FormItem>
                <Label htmlFor="officeLicenseClass">License Class</Label>
                <Select onValueChange={(value) => setOfficeLicenseClass(value)} value={officeLicenseClass}>
                    <SelectTrigger id="officeLicenseClass"><SelectValue placeholder="Select license class..."/></SelectTrigger>
                    <SelectContent>
                        {licenseClassOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                    </SelectContent>
                </Select>
            </FormItem>
            <FormItem><Label htmlFor="officeRestrictions">Restrictions</Label><Textarea id="officeRestrictions" value={officeRestrictions} onChange={e => setOfficeRestrictions(e.target.value)} /></FormItem>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <Button onClick={handleSaveOfficeUse} disabled={isUpdating}>
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Office Details"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

