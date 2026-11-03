
"use client";
import { Button } from "@/components/ui/button";
import type { Registration, User } from "@/types";
import { Receipt, Printer, ArrowLeft, Loader2, AlertTriangle, Download, CheckCircle2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from "@/lib/utils";
import React, { useState, useEffect, useCallback, useRef } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { doc, getDoc, Timestamp, updateDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { isValid } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const ensureDateObject = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) return dateValue.toDate();
  if (dateValue instanceof Date) return dateValue;
  if (
    typeof dateValue === "object" &&
    dateValue !== null &&
    typeof dateValue.seconds === "number" &&
    typeof dateValue.nanoseconds === "number"
  ) {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) {
      return undefined;
    }
  }
  if (typeof dateValue === "string" || typeof dateValue === "number") {
    const parsed = new Date(dateValue);
    if (isValid(parsed)) return parsed;
  }
  return undefined;
};

export default function PaymentReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const registrationId = params.id as string;
  const { currentUser, isRegistrar, isAdmin, isSupervisor } = useAuth();
  const { toast } = useToast();

  const [registration, setRegistration] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [savingToRecord, setSavingToRecord] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const fetchReceiptData = useCallback(async () => {
    if (!registrationId) {
      setError("Registration ID is missing.");
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
        const primaryOwner = data.owners?.[0];

        setRegistration({
          ...data,
          registrationId: docSnap.id,
          owners: (data.owners || []).map((o: any) => ({
            ...o,
            dob: ensureDateObject(o.dob),
          })),
          paymentDate: ensureDateObject(data.paymentDate),
          paymentConfirmedAt: ensureDateObject(data.paymentConfirmedAt),
          approvedAt: ensureDateObject(data.approvedAt),
          submittedAt: ensureDateObject(data.submittedAt),
          createdAt: ensureDateObject(data.createdAt) || new Date(),
          lastUpdatedAt: ensureDateObject(data.lastUpdatedAt) || new Date(),
        } as Registration);
      } else {
        setError("Registration not found.");
      }
    } catch (e: any) {
      console.error("Error fetching registration for receipt:", e);
      setError(e.message || "Failed to load registration data.");
    } finally {
      setLoading(false);
    }
  }, [registrationId]);

  useEffect(() => {
    fetchReceiptData();
  }, [fetchReceiptData]);

  const receiptNumber = `RCPT-${registrationId?.slice(-6).toUpperCase() || "000000"}`;

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a5",
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      pdf.addImage(imgData, "PNG", imgX, 0, imgWidth * ratio, imgHeight * ratio);
      const fileName = `payment-receipt-${registration?.scaRegoNo || registrationId}.pdf`;
      pdf.save(fileName);
      toast({ title: "Receipt Downloaded", description: `Saved as ${fileName}` });
    } catch (e: any) {
      toast({ title: "Download Failed", description: e.message, variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const handleSaveToRecord = async () => {
    if (!printRef.current || !registration || !currentUser?.userId) return;
    setSavingToRecord(true);
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgData = canvas.toDataURL("image/png");
      pdf.addImage(imgData, "PNG", imgX, 0, imgWidth * ratio, imgHeight * ratio);

      const fileName = `payment-receipt-${registration.scaRegoNo || registrationId}-${Date.now()}.pdf`;
      const pdfBlob = pdf.output("blob");
      const fileRef = storageRef(storage, `payment_receipts_generated/${registrationId}/${fileName}`);
      await uploadBytes(fileRef, pdfBlob, { contentType: "application/pdf" });
      const downloadUrl = await getDownloadURL(fileRef);

      const regDocRef = doc(db, "registrations", registrationId);
      await updateDoc(regDocRef, {
        paymentReceiptUrl: downloadUrl,
        paymentReceiptFileName: fileName,
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: doc(db, "users", currentUser.userId),
      });

      toast({ title: "Receipt Saved", description: "Payment receipt has been saved to the registration record." });
    } catch (e: any) {
      toast({ title: "Save Failed", description: e.message, variant: "destructive" });
    } finally {
      setSavingToRecord(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex h-64 justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading receipt data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-600">
        <AlertTriangle className="mx-auto h-10 w-10 mb-2" />
        <p>{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Go Back
        </Button>
      </div>
    );
  }

  if (!registration) {
    return <div className="text-center py-10 text-muted-foreground">Registration not found.</div>;
  }

  const primaryOwner = registration.owners?.[0];
  const ownerName = primaryOwner?.ownerType === "Company"
    ? primaryOwner.companyName
    : `${primaryOwner?.firstName || ""} ${primaryOwner?.surname || ""}`.trim();

  const canSave = isAdmin || isRegistrar || isSupervisor;

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Controls (hidden on print) */}
      <div className="flex items-center justify-between print:hidden">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
        <div className="flex gap-2">
          {canSave && (
            <Button variant="outline" size="sm" onClick={handleSaveToRecord} disabled={savingToRecord}>
              {savingToRecord ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Receipt className="mr-2 h-4 w-4" />}
              Save to Record
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={downloading}>
            {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Receipt Document */}
      <div
        ref={printRef}
        style={{ fontFamily: "'Georgia', serif", backgroundColor: "#ffffff", color: "#111827" }}
        className="p-8 border border-gray-200 shadow-sm rounded-lg"
      >
        {/* Header */}
        <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Papua New Guinea</p>
          <h1 className="text-xl font-bold uppercase tracking-wide">Small Craft Authority</h1>
          <p className="text-sm text-gray-600">National Capital District</p>
          <div className="mt-3">
            <h2 className="text-2xl font-bold tracking-wider text-gray-800 border border-gray-400 inline-block px-6 py-1 rounded">
              PAYMENT RECEIPT
            </h2>
          </div>
        </div>

        {/* Receipt Meta */}
        <div className="flex justify-between text-sm mb-6">
          <div>
            <p className="text-gray-500 text-xs uppercase tracking-wide">Receipt No.</p>
            <p className="font-bold text-lg">{receiptNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs uppercase tracking-wide">Date Issued</p>
            <p className="font-semibold">
              {formatFirebaseTimestamp(registration.paymentDate || registration.approvedAt || registration.lastUpdatedAt, "PP")}
            </p>
          </div>
        </div>

        {/* Received From */}
        <div className="mb-5 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Received From</p>
          <p className="font-bold text-base">{ownerName || "—"}</p>
          {primaryOwner?.postalAddress && (
            <p className="text-sm text-gray-600">{primaryOwner.postalAddress}</p>
          )}
          {primaryOwner?.phone && <p className="text-sm text-gray-600">Ph: {primaryOwner.phone}</p>}
        </div>

        {/* Payment Details Table */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Payment Details</p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="text-left p-2 border border-gray-300 font-semibold">Description</th>
                <th className="text-right p-2 border border-gray-300 font-semibold">Amount (K)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border border-gray-300">
                  <p className="font-medium">
                    Craft Registration Fee
                    {registration.scaRegoNo ? ` — ${registration.scaRegoNo}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    {registration.registrationType} Registration ·{" "}
                    {registration.craftMake} {registration.craftModel}{" "}
                    {registration.craftYear ? `(${registration.craftYear})` : ""}
                  </p>
                </td>
                <td className="p-2 border border-gray-300 text-right font-semibold">
                  {registration.paymentAmount != null
                    ? `K${registration.paymentAmount.toFixed(2)}`
                    : "—"}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td className="p-2 border border-gray-300 font-bold text-right">TOTAL PAID</td>
                <td className="p-2 border border-gray-300 font-bold text-right text-lg">
                  {registration.paymentAmount != null
                    ? `K${registration.paymentAmount.toFixed(2)}`
                    : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payment Method & Reference */}
        <div className="grid grid-cols-2 gap-4 text-sm mb-5">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Method</p>
            <p className="font-semibold">{registration.paymentMethod || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Receipt / Reference No.</p>
            <p className="font-semibold">{registration.paymentReceiptNumber || "—"}</p>
          </div>
          {registration.bankStampRef && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Bank Stamp / Ref.</p>
              <p className="font-semibold">{registration.bankStampRef}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Registration Hull ID</p>
            <p className="font-semibold">{registration.hullIdNumber || "—"}</p>
          </div>
        </div>

        {/* Confirmation Status */}
        {registration.paymentConfirmed && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded mb-5 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            <span>
              <strong>Payment Verified</strong>
              {registration.paymentConfirmedAt
                ? ` — Confirmed on ${formatFirebaseTimestamp(registration.paymentConfirmedAt, "PPpp")}`
                : ""}
            </span>
          </div>
        )}

        {/* Signature Block */}
        <div className="mt-8 pt-6 border-t border-gray-300 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="border-b border-gray-400 mb-1 h-10"></div>
            <p className="text-xs text-gray-500">Authorised Officer Signature</p>
          </div>
          <div>
            <div className="border-b border-gray-400 mb-1 h-10"></div>
            <p className="text-xs text-gray-500">Date</p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-gray-400 border-t border-gray-200 pt-3">
          <p>This receipt is an official document issued by the Small Craft Authority, NCD.</p>
          <p className="mt-0.5">Please retain this receipt for your records. Reg. ID: {registrationId}</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #__next [data-print-receipt],
          #__next [data-print-receipt] * {
            visibility: visible;
          }
        }
      `}</style>
    </div>
  );
}
