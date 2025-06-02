
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import type { Registration, Owner, ProofOfOwnershipDoc, Inspection, User } from "@/types";
import { Ship, User as UserIconLucide, FileText, ClipboardCheck, CalendarDays, DollarSign, Edit, CheckCircle, XCircle, Info, FileSpreadsheet, ListChecks, AlertTriangle, Loader2, ArrowLeft, Ban, AlertCircle, CalendarClock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
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
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isValid, addDays } from "date-fns";
import { doc, getDoc, updateDoc, Timestamp, collection, query, where, getDocs, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Textarea } from "@/components/ui/textarea";


// Helper to convert Firestore Timestamps or other date forms to JS Date for client state
const ensureDateObject = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsed = new Date(dateValue);
    if (isValid(parsed)) return parsed;
  }
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) { /* ignore */ }
  }
  console.warn(`RegistrationDetailPage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function RegistrationDetailPage() {
  const params = useParams();
  const registrationId = params.id as string;
  const { currentUser, isRegistrar, isAdmin, isSupervisor } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [linkedInspections, setLinkedInspections] = useState<Inspection[]>([]);
  const [loadingLinkedInspections, setLoadingLinkedInspections] = useState(false);
  const [errorLinkedInspections, setErrorLinkedInspections] = useState<string | null>(null);


  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [scaRegoNo, setScaRegoNo] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [expiryDate, setExpiryDate] = useState(format(addDays(new Date(), 365), "yyyy-MM-dd"));

  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [suspensionEndDate, setSuspensionEndDate] = useState("");

  const [revokeModalOpen, setRevokeModalOpen] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");

  const fetchRegistrationDetails = useCallback(async () => {
    if (!registrationId) {
      setError("Registration ID is missing.");
      setLoading(false);
      return;
    }
    if (!currentUser) {
      return;
    }

    setLoading(true);
    setError(null);
    setLoadingLinkedInspections(true);
    setErrorLinkedInspections(null);

    try {
      const regDocRef = doc(db, "registrations", registrationId);
      const docSnap = await getDoc(regDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        const processedData: Registration = {
          registrationId: docSnap.id,
          scaRegoNo: data.scaRegoNo,
          interimRegoNo: data.interimRegoNo,
          registrationType: data.registrationType,
          previousScaRegoNo: data.previousScaRegoNo,
          status: data.status,
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
          safetyEquipIssued: data.safetyEquipIssued,
          safetyEquipReceiptNumber: data.safetyEquipReceiptNumber,
          owners: (data.owners || []).map((o: any) => ({ ...o, dob: ensureDateObject(o.dob) })),
          proofOfOwnershipDocs: (data.proofOfOwnershipDocs || []).map((d: any) => ({ ...d, uploadedAt: ensureDateObject(d.uploadedAt) })),
          craftMake: data.craftMake,
          craftModel: data.craftModel,
          craftYear: data.craftYear,
          craftColor: data.craftColor,
          hullIdNumber: data.hullIdNumber,
          craftLength: data.craftLength,
          lengthUnits: data.lengthUnits,
          distinguishingFeatures: data.distinguishingFeatures,
          propulsionType: data.propulsionType,
          propulsionOtherDesc: data.propulsionOtherDesc,
          hullMaterial: data.hullMaterial,
          hullMaterialOtherDesc: data.hullMaterialOtherDesc,
          craftUse: data.craftUse,
          craftUseOtherDesc: data.craftUseOtherDesc,
          fuelType: data.fuelType,
          fuelTypeOtherDesc: data.fuelTypeOtherDesc,
          vesselType: data.vesselType,
          vesselTypeOtherDesc: data.vesselTypeOtherDesc,
          engineHorsepower: data.engineHorsepower,
          engineMake: data.engineMake,
          engineSerialNumbers: data.engineSerialNumbers,
          certificateGeneratedAt: ensureDateObject(data.certificateGeneratedAt),
          certificateFileName: data.certificateFileName,
          certificateFileUrl: data.certificateFileUrl,
          suspensionReason: data.suspensionReason,
          suspensionStartDate: ensureDateObject(data.suspensionStartDate),
          suspensionEndDate: ensureDateObject(data.suspensionEndDate),
          revocationReason: data.revocationReason,
          revokedAt: ensureDateObject(data.revokedAt),
          lastUpdatedByRef: (data.lastUpdatedByRef instanceof DocumentReference) ? data.lastUpdatedByRef.id : data.lastUpdatedByRef,
          lastUpdatedAt: ensureDateObject(data.lastUpdatedAt),
          createdByRef: (data.createdByRef instanceof DocumentReference) ? data.createdByRef.id : data.createdByRef,
          createdAt: ensureDateObject(data.createdAt),
        };
        setRegistration(processedData);
        setScaRegoNo(processedData.scaRegoNo || "");
        if (processedData.effectiveDate) setEffectiveDate(format(new Date(processedData.effectiveDate as Date), "yyyy-MM-dd"));
        if (processedData.expiryDate) setExpiryDate(format(new Date(processedData.expiryDate as Date), "yyyy-MM-dd"));

        try {
          const inspectionsQuery = query(
            collection(db, "inspections"),
            where("registrationRef", "==", doc(db, "registrations", registrationId))
          );
          const inspectionSnapshot = await getDocs(inspectionsQuery);
          const inspectionsData = inspectionSnapshot.docs.map(inspDoc => {
            const inspData = inspDoc.data();
            return {
              inspectionId: inspDoc.id,
              ...inspData,
              scheduledDate: ensureDateObject(inspData.scheduledDate),
              inspectionDate: ensureDateObject(inspData.inspectionDate),
              completedAt: ensureDateObject(inspData.completedAt),
              reviewedAt: ensureDateObject(inspData.reviewedAt),
              createdAt: ensureDateObject(inspData.createdAt),
              lastUpdatedAt: ensureDateObject(inspData.lastUpdatedAt),
              registrationRef: (inspData.registrationRef instanceof DocumentReference) ? inspData.registrationRef.id : inspData.registrationRef,
              inspectorRef: (inspData.inspectorRef instanceof DocumentReference) ? inspData.inspectorRef.id : inspData.inspectorRef,
              reviewedByRef: (inspData.reviewedByRef instanceof DocumentReference) ? inspData.reviewedByRef.id : inspData.reviewedByRef,
              createdByRef: (inspData.createdByRef instanceof DocumentReference) ? inspData.createdByRef.id : inspData.createdByRef,
              lastUpdatedByRef: (inspData.lastUpdatedByRef instanceof DocumentReference) ? inspData.lastUpdatedByRef.id : inspData.lastUpdatedByRef,
            } as Inspection;
          });
          setLinkedInspections(inspectionsData);
        } catch (inspError: any) {
          console.error("Error fetching linked inspections:", inspError);
          setErrorLinkedInspections(inspError.message || "Failed to load linked inspections.");
        }

      } else {
        setError("Registration not found.");
        setRegistration(null);
      }
    } catch (err: any) {
      console.error("Error fetching registration:", err);
      setError(err.message || "Failed to load registration data.");
      setRegistration(null);
    } finally {
      setLoading(false);
      setLoadingLinkedInspections(false);
    }
  }, [registrationId, currentUser]);

  useEffect(() => {
    if (currentUser !== undefined) { 
        fetchRegistrationDetails();
    }
  }, [registrationId, currentUser, fetchRegistrationDetails]);


  if (loading) {
    return <div className="flex h-64 justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2">Loading registration details...</p></div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-600"><AlertTriangle className="mx-auto h-10 w-10 mb-2" />Error: {error}</div>;
  }

  if (!registration) {
    return <div className="text-center py-10 text-muted-foreground">Registration not found or you may not have permission to view it.</div>;
  }


  const getStatusBadgeVariant = (status: Registration["status"] | Inspection["status"]) => {
    switch (status) {
      case "Approved": case "Passed": return "default";
      case "PendingReview": case "Submitted": case "Scheduled": return "secondary";
      case "Rejected": case "Expired": case "Failed": case "Cancelled": case "Revoked": case "Suspended": return "destructive";
      case "Draft": case "RequiresInfo": case "InProgress": return "outline";
      default: return "outline";
    }
  };

  const handleApprove = async () => {
     if (!currentUser?.userId || !registration) {
      toast({ title: "Error", description: "User or registration data missing.", variant: "destructive" });
      return;
    }
    if (!scaRegoNo.trim()) {
      toast({ title: "Validation Error", description: "SCA Rego No. is required for approval.", variant: "destructive" });
      return;
    }
     if (!isValid(parseISO(effectiveDate)) || !isValid(parseISO(expiryDate))) {
      toast({ title: "Validation Error", description: "Effective and Expiry dates must be valid.", variant: "destructive" });
      return;
    }

    const registrationDocRef = doc(db, "registrations", registration.registrationId);
    
    const updatePayload: Partial<Registration> = {
      status: "Approved",
      scaRegoNo: scaRegoNo,
      effectiveDate: Timestamp.fromDate(parseISO(effectiveDate)),
      expiryDate: Timestamp.fromDate(parseISO(expiryDate)),
      approvedAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
    };

    try {
      await updateDoc(registrationDocRef, updatePayload as any); 
      toast({ title: "Registration Approved", description: `SCA Rego No: ${scaRegoNo} assigned.` });
      setApproveModalOpen(false);
      fetchRegistrationDetails(); // Re-fetch to update state
    } catch (e: any) {
      console.error("Error approving registration:", e);
      toast({ title: "Approval Failed", description: e.message || "Could not update registration.", variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!currentUser?.userId || !registration) return;
    const registrationDocRef = doc(db, "registrations", registration.registrationId);
    try {
      await updateDoc(registrationDocRef, {
        status: "Rejected",
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: doc(db, "users", currentUser.userId)
      });
      toast({ title: "Registration Rejected", variant: "destructive" });
      fetchRegistrationDetails();
    } catch (e: any) {
       toast({ title: "Rejection Failed", description: e.message || "Could not update registration.", variant: "destructive" });
    }
  };
  
  const handleRequestInfo = async () => {
    if (!currentUser?.userId || !registration) return;
    const registrationDocRef = doc(db, "registrations", registration.registrationId);
     try {
      await updateDoc(registrationDocRef, {
        status: "RequiresInfo",
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: doc(db, "users", currentUser.userId)
      });
      toast({ title: "Information Requested", description: "Owner will be notified." });
      fetchRegistrationDetails();
    } catch (e: any) {
       toast({ title: "Action Failed", description: e.message || "Could not update registration.", variant: "destructive" });
    }
  };

  const handleSuspend = async () => {
    if (!currentUser?.userId || !registration || !suspensionReason.trim()) {
      toast({ title: "Error", description: "User, registration, or suspension reason missing.", variant: "destructive" });
      return;
    }
    if (suspensionEndDate && !isValid(parseISO(suspensionEndDate))) {
        toast({ title: "Validation Error", description: "Suspension End Date is invalid.", variant: "destructive" });
        return;
    }
    const registrationDocRef = doc(db, "registrations", registration.registrationId);
    const updatePayload: Partial<Registration> = {
      status: "Suspended",
      suspensionReason: suspensionReason,
      suspensionStartDate: Timestamp.now(),
      suspensionEndDate: suspensionEndDate ? Timestamp.fromDate(parseISO(suspensionEndDate)) : undefined,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
    };
    try {
      await updateDoc(registrationDocRef, updatePayload as any);
      toast({ title: "Registration Suspended", description: `Reason: ${suspensionReason}` });
      setSuspendModalOpen(false);
      setSuspensionReason("");
      setSuspensionEndDate("");
      fetchRegistrationDetails();
    } catch (e: any) {
      toast({ title: "Suspension Failed", description: e.message || "Could not update registration.", variant: "destructive" });
    }
  };

  const handleRevoke = async () => {
    if (!currentUser?.userId || !registration || !revocationReason.trim()) {
      toast({ title: "Error", description: "User, registration, or revocation reason missing.", variant: "destructive" });
      return;
    }
    const registrationDocRef = doc(db, "registrations", registration.registrationId);
    const updatePayload: Partial<Registration> = {
      status: "Revoked",
      revocationReason: revocationReason,
      revokedAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
    };
    try {
      await updateDoc(registrationDocRef, updatePayload as any);
      toast({ title: "Registration Revoked", description: `Reason: ${revocationReason}`, variant: "destructive" });
      setRevokeModalOpen(false);
      setRevocationReason("");
      fetchRegistrationDetails();
    } catch (e: any) {
      toast({ title: "Revocation Failed", description: e.message || "Could not update registration.", variant: "destructive" });
    }
  };

  const handleUnsuspend = async () => {
    if (!currentUser?.userId || !registration) return;
    const registrationDocRef = doc(db, "registrations", registration.registrationId);
    const updatePayload: Partial<Registration> = {
      status: "Approved", // Or "PendingReview" if it needs re-evaluation
      suspensionReason: undefined, // Clear suspension fields
      suspensionStartDate: undefined,
      suspensionEndDate: undefined,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
    };
     try {
      await updateDoc(registrationDocRef, updatePayload as any);
      toast({ title: "Registration Unsuspended", description: "The registration is now active again." });
      fetchRegistrationDetails();
    } catch (e: any) {
       toast({ title: "Unsuspension Failed", description: e.message || "Could not update registration.", variant: "destructive" });
    }
  };


  const canEdit = (isRegistrar || isAdmin) && (registration.status === "Submitted" || registration.status === "RequiresInfo" || registration.status === "Draft");
  const canApproveReject = (isRegistrar || isAdmin) && (registration.status === "Submitted" || registration.status === "RequiresInfo" || registration.status === "PendingReview");
  const canSuspendRevoke = (isRegistrar || isAdmin) && (registration.status === "Approved" || registration.status === "Expired" || registration.status === "Suspended");
  const canUnsuspend = (isRegistrar || isAdmin) && registration.status === "Suspended";
  const canScheduleInspection = (isAdmin || isSupervisor || isRegistrar);
  const canGenerateCertificate = (isRegistrar || isAdmin) && registration.status === "Approved";


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => router.push('/registrations')} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Registrations</span>
          </Button>
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

      {(canApproveReject || canScheduleInspection || canGenerateCertificate || canSuspendRevoke) && (
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
                      <Label htmlFor="scaRegoNo">SCA Rego No. *</Label>
                      <Input id="scaRegoNo" value={scaRegoNo} onChange={(e) => setScaRegoNo(e.target.value)} placeholder="e.g., NCD-00123" />
                    </div>
                     <div>
                      <Label htmlFor="effectiveDate">Effective Date *</Label>
                      <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                    </div>
                     <div>
                      <Label htmlFor="expiryDate">Expiry Date *</Label>
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
            {canSuspendRevoke && registration.status !== "Suspended" && (
              <AlertDialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-orange-600 border-orange-500 hover:bg-orange-100 hover:text-orange-700"><CalendarClock className="mr-2 h-4 w-4" /> Suspend</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Suspend Registration</AlertDialogTitle><AlertDialogDescription>Provide a reason for suspension and an optional end date.</AlertDialogDescription></AlertDialogHeader>
                  <div className="space-y-4 py-2">
                    <div><Label htmlFor="suspensionReason">Reason for Suspension *</Label><Textarea id="suspensionReason" value={suspensionReason} onChange={(e) => setSuspensionReason(e.target.value)} placeholder="Enter reason" /></div>
                    <div><Label htmlFor="suspensionEndDate">Suspension End Date (Optional)</Label><Input id="suspensionEndDate" type="date" value={suspensionEndDate} onChange={(e) => setSuspensionEndDate(e.target.value)} /></div>
                  </div>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleSuspend}>Confirm Suspension</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {canUnsuspend && (
                <Button variant="outline" className="text-green-600 border-green-500 hover:bg-green-100 hover:text-green-700" onClick={handleUnsuspend}>
                    <CheckCircle className="mr-2 h-4 w-4" /> Unsuspend
                </Button>
            )}
            {canSuspendRevoke && (
              <AlertDialog open={revokeModalOpen} onOpenChange={setRevokeModalOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive"><Ban className="mr-2 h-4 w-4" /> Revoke</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Revoke Registration</AlertDialogTitle><AlertDialogDescription>This action is permanent. Provide a reason for revocation.</AlertDialogDescription></AlertDialogHeader>
                  <div className="space-y-4 py-2">
                    <div><Label htmlFor="revocationReason">Reason for Revocation *</Label><Textarea id="revocationReason" value={revocationReason} onChange={(e) => setRevocationReason(e.target.value)} placeholder="Enter reason" /></div>
                  </div>
                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleRevoke} className="bg-destructive hover:bg-destructive/90">Confirm Revocation</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
          </CardContent>
        </Card>
      )}

      {registration.status === "Suspended" && (
        <Card className="border-orange-500 bg-orange-500/10">
          <CardHeader>
            <CardTitle className="text-orange-700 flex items-center gap-2"><CalendarClock /> Registration Suspended</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-orange-700 space-y-1">
            <p><strong>Reason:</strong> {registration.suspensionReason || "Not specified"}</p>
            {registration.suspensionStartDate && <p><strong>Suspended From:</strong> {formatFirebaseTimestamp(registration.suspensionStartDate, "PP")}</p>}
            {registration.suspensionEndDate && <p><strong>Suspended Until:</strong> {formatFirebaseTimestamp(registration.suspensionEndDate, "PP")}</p>}
            {!registration.suspensionEndDate && <p>Suspended indefinitely or until further notice.</p>}
          </CardContent>
        </Card>
      )}

      {registration.status === "Revoked" && (
        <Card className="border-red-700 bg-red-700/10">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2"><Ban /> Registration Revoked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-red-800 space-y-1">
            <p><strong>Reason:</strong> {registration.revocationReason || "Not specified"}</p>
            {registration.revokedAt && <p><strong>Revoked On:</strong> {formatFirebaseTimestamp(registration.revokedAt, "PP")}</p>}
          </CardContent>
        </Card>
      )}


      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Craft Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><strong>Make:</strong> {registration.craftMake}</div>
              <div><strong>Model:</strong> {registration.craftModel}</div>
              <div><strong>Year:</strong> {registration.craftYear}</div>
              <div><strong>Color:</strong> {registration.craftColor}</div>
              <div><strong>Hull ID:</strong> {registration.hullIdNumber}</div>
              <div><strong>Length:</strong> {registration.craftLength} {registration.lengthUnits}</div>
              {registration.engineMake && <div><strong>Engine Make:</strong> {registration.engineMake}</div>}
              {registration.engineHorsepower && <div><strong>Engine HP:</strong> {registration.engineHorsepower}</div>}
              {registration.engineSerialNumbers && <div className="md:col-span-2"><strong>Engine S/N:</strong> {registration.engineSerialNumbers}</div>}
              <div><strong>Propulsion:</strong> {registration.propulsionType} {registration.propulsionOtherDesc && `(${registration.propulsionOtherDesc})`}</div>
              <div><strong>Hull Material:</strong> {registration.hullMaterial} {registration.hullMaterialOtherDesc && `(${registration.hullMaterialOtherDesc})`}</div>
              <div><strong>Craft Use:</strong> {registration.craftUse} {registration.craftUseOtherDesc && `(${registration.craftUseOtherDesc})`}</div>
              <div><strong>Fuel Type:</strong> {registration.fuelType} {registration.fuelTypeOtherDesc && `(${registration.fuelTypeOtherDesc})`}</div>
              <div><strong>Vessel Type:</strong> {registration.vesselType} {registration.vesselTypeOtherDesc && `(${registration.vesselTypeOtherDesc})`}</div>
              {registration.distinguishingFeatures && <div className="md:col-span-2"><strong>Features:</strong> {registration.distinguishingFeatures}</div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Owners</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {registration.owners.map((owner: Owner, index: number) => (
                <div key={owner.ownerId || index} className="p-3 border rounded-md bg-muted/30">
                  <div className="font-semibold text-md">{owner.firstName} {owner.surname} <Badge variant="secondary">{owner.role}</Badge></div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
                    <p><strong>DOB:</strong> {formatFirebaseTimestamp(owner.dob, "PP")}</p>
                    <p><strong>Sex:</strong> {owner.sex}</p>
                    <p><strong>Phone:</strong> {owner.phone}</p>
                    {owner.email && <p><strong>Email:</strong> {owner.email}</p>}
                    <div className="sm:col-span-2"><strong>Address:</strong> {owner.postalAddress}, {owner.wardVillage}, {owner.llg}, {owner.townDistrict}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>Registration Info</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p><strong>Type:</strong> {registration.registrationType}</p>
              {registration.previousScaRegoNo && <p><strong>Previous Rego:</strong> {registration.previousScaRegoNo}</p>}
              <p><strong>Submitted:</strong> {formatFirebaseTimestamp(registration.submittedAt, "PPpp")}</p>
              <p><strong>Approved:</strong> {formatFirebaseTimestamp(registration.approvedAt, "PPpp")}</p>
              <p><strong>Effective:</strong> {formatFirebaseTimestamp(registration.effectiveDate, "PP")}</p>
              <p><strong>Expires:</strong> {formatFirebaseTimestamp(registration.expiryDate, "PP")}</p>
            </CardContent>
          </Card>

          {registration.paymentAmount != null && (
            <Card>
              <CardHeader><CardTitle>Payment Details</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p><strong>Amount:</strong> K{registration.paymentAmount?.toFixed(2)}</p>
                <p><strong>Method:</strong> {registration.paymentMethod}</p>
                <p><strong>Receipt No:</strong> {registration.paymentReceiptNumber}</p>
                <p><strong>Date:</strong> {formatFirebaseTimestamp(registration.paymentDate, "PP")}</p>
                {registration.bankStampRef && <p><strong>Bank Ref:</strong> {registration.bankStampRef}</p>}
              </CardContent>
            </Card>
          )}
          
           {(registration.safetyCertNumber || registration.safetyEquipIssued) && (
            <Card>
              <CardHeader><CardTitle>Safety Equipment</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-sm">
                {registration.safetyCertNumber && <p><strong>Safety Cert No:</strong> {registration.safetyCertNumber}</p>}
                <p><strong>Equipment Issued:</strong> {registration.safetyEquipIssued ? "Yes" : "No"}</p>
                {registration.safetyEquipReceiptNumber && <p><strong>Receipt No:</strong> {registration.safetyEquipReceiptNumber}</p>}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Proof of Ownership</CardTitle></CardHeader>
        <CardContent>
          {registration.proofOfOwnershipDocs && registration.proofOfOwnershipDocs.length > 0 ? (
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

      <Card>
        <CardHeader><CardTitle>Linked Inspections</CardTitle></CardHeader>
        <CardContent>
          {loadingLinkedInspections ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
              <p>Loading inspections...</p>
            </div>
          ) : errorLinkedInspections ? (
            <p className="text-destructive">Error loading inspections: {errorLinkedInspections}</p>
          ) : linkedInspections.length > 0 ? (
            <ul className="space-y-3">
              {linkedInspections.map((insp: Inspection) => (
                <li key={insp.inspectionId} className="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                  <Link href={`/inspections/${insp.inspectionId}`} className="block">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">{insp.inspectionType} Inspection ({insp.inspectionId})</p>
                      <Badge variant={getStatusBadgeVariant(insp.status)}>{insp.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scheduled: {formatFirebaseTimestamp(insp.scheduledDate, "PP")} |
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
