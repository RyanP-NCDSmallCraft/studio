
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Infringement } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useParams, useRouter } // Added useRouter
from "next/navigation";
import Link from "next/link";
import { AlertOctagon, Ship, User, CalendarDays, DollarSign, Edit, CheckCircle, XCircle, Printer, Loader2, ArrowLeft } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, Timestamp, updateDoc, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Helper to ensure date serialization
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) return dateValue.toDate();
  if (dateValue instanceof Date) return dateValue;
  try {
    const parsed = new Date(dateValue);
    if (isValid(parsed)) return parsed;
  } catch (e) { /* ignore */ }
  return undefined;
};

export default function InfringementDetailPage() {
  const params = useParams();
  const infringementId = params.id as string;
  const { currentUser, isAdmin, isRegistrar, isSupervisor } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [infringement, setInfringement] = useState<Infringement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInfringementDetails = useCallback(async () => {
    if (!infringementId) {
      setError("Infringement ID is missing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const infringDocRef = doc(db, "infringements", infringementId);
      const docSnap = await getDoc(infringDocRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setInfringement({
          ...data,
          infringementId: docSnap.id,
          issuedAt: ensureSerializableDate(data.issuedAt),
          approvedAt: ensureSerializableDate(data.approvedAt),
          createdAt: ensureSerializableDate(data.createdAt),
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          paymentDetails: data.paymentDetails ? {
            ...data.paymentDetails,
            paymentDate: ensureSerializableDate(data.paymentDetails.paymentDate),
          } : undefined,
          registrationRef: (data.registrationRef as DocumentReference)?.id || data.registrationRef,
          issuedByRef: (data.issuedByRef as DocumentReference)?.id || data.issuedByRef,
          approvedByRef: (data.approvedByRef as DocumentReference)?.id || data.approvedByRef,
          createdByRef: (data.createdByRef as DocumentReference)?.id || data.createdByRef,
          lastUpdatedByRef: (data.lastUpdatedByRef as DocumentReference)?.id || data.lastUpdatedByRef,
        } as Infringement);
      } else {
        setError("Infringement not found.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load infringement data.");
    } finally {
      setLoading(false);
    }
  }, [infringementId]);

  useEffect(() => {
    fetchInfringementDetails();
  }, [fetchInfringementDetails]);

  const getStatusBadgeVariant = (status?: Infringement["status"]) => {
    // Same as list page
    switch (status) {
      case "Issued": case "PendingReview": return "secondary";
      case "Approved": return "default";
      case "Paid": return "default";
      case "Voided": case "Overdue": return "destructive";
      case "Draft": return "outline";
      default: return "outline";
    }
  };
  
  const handleApprove = async () => {
    if (!infringement || !currentUser) return;
    try {
        await updateDoc(doc(db, "infringements", infringement.infringementId), {
            status: "Approved",
            approvedAt: Timestamp.now(),
            approvedByRef: doc(db, "users", currentUser.userId),
            lastUpdatedAt: Timestamp.now(),
            lastUpdatedByRef: doc(db, "users", currentUser.userId),
        });
        toast({title: "Infringement Approved"});
        fetchInfringementDetails(); // Refresh data
    } catch (e: any) {
        toast({title: "Approval Failed", description: e.message, variant: "destructive"});
    }
  };

  // Placeholder for other actions like Mark Paid, Void, etc.

  if (loading) return <div className="flex h-64 justify-center items-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p>Loading infringement details...</p></div>;
  if (error) return <p className="text-red-500 text-center">Error: {error}</p>;
  if (!infringement) return <p className="text-center">Infringement not found.</p>;

  const canApprove = (isAdmin || isRegistrar) && (infringement.status === "Issued" || infringement.status === "PendingReview");
  const canEdit = (isAdmin || isRegistrar || isInspector || isSupervisor) && infringement.status === "Draft";


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.push('/infringements')} className="mr-1 h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Infringements</span>
            </Button>
          <AlertOctagon className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Infringement: {infringement.infringementId}</h1>
            <Badge variant={getStatusBadgeVariant(infringement.status)} className="mt-1">{infringement.status}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild variant="outline">
              <Link href={`/infringements/${infringementId}/edit`}><Edit className="mr-2 h-4 w-4" /> Edit</Link>
            </Button>
          )}
           {canApprove && (
             <Button onClick={handleApprove}><CheckCircle className="mr-2 h-4 w-4" /> Approve Infringement</Button>
           )}
          <Button variant="outline" disabled><Printer className="mr-2 h-4 w-4" /> Print Notice</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Infringement Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div><strong>Craft Rego:</strong> {infringement.registrationData?.scaRegoNo || <Link href={`/registrations/${infringement.registrationRef as string}`} className="text-primary hover:underline">{infringement.registrationRef as string}</Link>}</div>
          <div><strong>Craft Make/Model:</strong> {infringement.registrationData?.craftMake} {infringement.registrationData?.craftModel || "N/A"}</div>
          <div><strong>Owner:</strong> {infringement.registrationData?.ownerName || "N/A"}</div>
          <div><strong>Issued By:</strong> {infringement.issuedByData?.displayName || infringement.issuedByRef as string || "N/A"}</div>
          <div><strong>Date Issued:</strong> {formatFirebaseTimestamp(infringement.issuedAt, "PPpp")}</div>
          <div><strong>Location:</strong> {infringement.locationDescription}</div>
          <div><strong>Total Penalty:</strong> K{infringement.totalPenaltyAmount?.toFixed(2) || "0.00"}</div>
          {infringement.approvedAt && <div><strong>Approved At:</strong> {formatFirebaseTimestamp(infringement.approvedAt, "PPpp")}</div>}
          {infringement.approvedByRef && <div><strong>Approved By:</strong> {(infringement.approvedByRef as any)?.displayName || infringement.approvedByRef as string}</div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Infringement Items</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {infringement.infringementItems.map((item, index) => (
            <Card key={item.itemId + index} className="p-3">
              <div className="flex justify-between">
                <p className="font-medium">{item.description}</p>
                <p className="font-semibold">K{item.penaltyAmount?.toFixed(2) || "0.00"}</p>
              </div>
              {item.notes && <p className="text-xs text-muted-foreground mt-1">Notes: {item.notes}</p>}
            </Card>
          ))}
        </CardContent>
      </Card>
      
      {infringement.officerNotes && (
        <Card>
          <CardHeader><CardTitle>Officer Notes</CardTitle></CardHeader>
          <CardContent><p className="whitespace-pre-wrap text-sm">{infringement.officerNotes}</p></CardContent>
        </Card>
      )}

      {infringement.paymentDetails && (
         <Card>
          <CardHeader><CardTitle>Payment Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><strong>Receipt Number:</strong> {infringement.paymentDetails.receiptNumber}</div>
            <div><strong>Payment Date:</strong> {formatFirebaseTimestamp(infringement.paymentDetails.paymentDate, "PP")}</div>
            <div><strong>Method:</strong> {infringement.paymentDetails.paymentMethod}</div>
            <div><strong>Amount Paid:</strong> K{infringement.paymentDetails.amountPaid?.toFixed(2)}</div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
