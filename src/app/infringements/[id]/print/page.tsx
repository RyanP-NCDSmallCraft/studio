
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { Infringement, User, Registration, Owner } from "@/types";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertOctagon, Ship, User as UserIconLucide, CalendarDays, DollarSign, Printer, Loader2, ArrowLeft, FileText, Sailboat } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { isValid } from 'date-fns';
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

// Helper to ensure date serialization (copied from detail page)
const ensureSerializableDate = (dateValue: any): Date | undefined => {
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

// Calculate Fine Amount function (copied from detail page)
const calculateFineAmount = (points: number | undefined | null): string => {
    if (points === undefined || points === null || points < 0) {
      return "N/A (Invalid Points)";
    }
    if (points <= 20) return "K100";
    if (points <= 40) return "K200";
    if (points <= 100) return "K500";
    return "K1,000";
};

export default function InfringementPrintPage() {
  const params = useParams();
  const infringementId = params.id as string;
  const router = useRouter();

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

        let registrationData: Infringement['registrationData'] = undefined;
        if (data.registrationRef instanceof DocumentReference) {
            const regDocSnap = await getDoc(data.registrationRef as DocumentReference<Registration>);
            if (regDocSnap.exists()) {
                const regData = regDocSnap.data();
                const primaryOwner = regData.owners?.find((o: Owner) => o.role === 'Primary') || regData.owners?.[0];
                registrationData = {
                    id: regDocSnap.id,
                    scaRegoNo: regData.scaRegoNo,
                    hullIdNumber: regData.hullIdNumber,
                    craftMake: regData.craftMake,
                    craftModel: regData.craftModel,
                    ownerName: primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : 'N/A',
                };
            }
        } else if (data.registrationData) {
            registrationData = data.registrationData;
        }

        let issuedByData: Infringement['issuedByData'] = undefined;
        if (data.issuedByRef instanceof DocumentReference) {
            const userDocSnap = await getDoc(data.issuedByRef as DocumentReference<User>);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                issuedByData = {
                    id: userDocSnap.id,
                    displayName: userData.displayName || userData.email,
                };
            }
        } else if (data.issuedByData) {
             issuedByData = data.issuedByData;
        }

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
          registrationRef: (data.registrationRef instanceof DocumentReference) ? data.registrationRef.id : data.registrationRef,
          registrationData,
          issuedByRef: (data.issuedByRef instanceof DocumentReference) ? data.issuedByRef.id : data.issuedByRef,
          issuedByData,
          approvedByRef: (data.approvedByRef instanceof DocumentReference) ? data.approvedByRef.id : data.approvedByRef,
          createdByRef: (data.createdByRef instanceof DocumentReference) ? data.createdByRef.id : data.createdByRef,
          lastUpdatedByRef: (data.lastUpdatedByRef instanceof DocumentReference) ? data.lastUpdatedByRef.id : data.lastUpdatedByRef,
          offenderSignatureUrl: data.offenderSignatureUrl, // Fetch signature URL
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

  useEffect(() => {
    if (!loading && infringement && !error) {
      setTimeout(() => { // Ensure content is rendered
        window.print();
      }, 500);
    }
  }, [loading, infringement, error]);

  if (loading) return <div className="flex h-screen justify-center items-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /> <p className="ml-3 text-lg">Loading Infringement Notice for Printing...</p></div>;
  if (error) return <div className="p-10 text-center text-red-600">Error: {error} <Button onClick={() => window.close()} className="mt-4 ml-2">Close</Button></div>;
  if (!infringement) return <div className="p-10 text-center">Infringement not found. <Button onClick={() => window.close()} className="mt-4 ml-2">Close</Button></div>;

  return (
    <div className="p-4 md:p-8 certificate-preview print-area bg-white text-black"> {/* Reuse certificate-preview for base print styling */}
       <Sailboat className="absolute inset-0 m-auto h-3/4 w-3/4 text-primary/5 opacity-10 z-0 print:opacity-5" />
        <div className="relative z-10">
            <header className="text-center border-b-2 border-primary pb-4 mb-6">
                <Image 
                src="https://ncdsmallcraft.com/images/114/11667247/LOGO-NCDCRB-small.png" 
                alt="NCDCRB Logo" 
                width={80} 
                height={80} 
                className="mx-auto mb-3 h-20 w-20"
                />
                <h2 className="text-3xl md:text-4xl font-bold text-primary">Infringement Notice</h2>
                <p className="text-muted-foreground text-base md:text-lg">National Capital District Small Craft Registration Board</p>
            </header>

            <CardContent className="space-y-4 md:space-y-6 text-sm md:text-base">
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-base">
                    <div><strong>Notice No:</strong> <span className="font-semibold">{infringement.infringementId}</span></div>
                    <div><strong>Date Issued:</strong> {formatFirebaseTimestamp(infringement.issuedAt, "PPpp")}</div>
                    <div><strong>Status:</strong> <span className="font-semibold">{infringement.status}</span></div>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold text-primary mb-1 text-lg">Alleged Offender & Craft Details:</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pl-2">
                        <p><strong>Craft Rego:</strong> {infringement.registrationData?.scaRegoNo || "N/A"}</p>
                        <p><strong>Craft Make/Model:</strong> {infringement.registrationData?.craftMake} {infringement.registrationData?.craftModel || "N/A"}</p>
                        <p><strong>Alleged Owner/Operator:</strong> {infringement.registrationData?.ownerName || "N/A"}</p>
                        <p><strong>Hull ID (HIN):</strong> {infringement.registrationData?.hullIdNumber || "N/A"}</p>
                    </div>
                </div>
                <Separator/>
                <div>
                    <h3 className="font-semibold text-primary mb-1 text-lg">Incident Details:</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 pl-2">
                        <p><strong>Location:</strong> {infringement.locationDescription}</p>
                        <p><strong>Issuing Officer:</strong> {infringement.issuedByData?.displayName || "N/A"}</p>
                    </div>
                </div>
                <Separator/>
                 <div>
                    <h3 className="font-semibold text-primary mb-2 text-lg">Infringement Items:</h3>
                    <div className="space-y-2 pl-2">
                    {infringement.infringementItems.map((item, index) => (
                        <div key={item.itemId + index} className="p-2 border-b border-dashed">
                            <div className="flex justify-between items-start">
                                <p className="flex-1">{index+1}. {item.description}</p>
                                <p className="font-semibold ml-4">{item.points || 0} points</p>
                            </div>
                            {item.notes && <p className="text-xs text-gray-600 mt-1 ml-4">Officer Notes: {item.notes}</p>}
                        </div>
                    ))}
                    </div>
                </div>
                <Separator/>
                <div className="text-right mt-4 text-lg">
                    <p><strong>Total Demerit Points:</strong> <span className="font-bold text-xl">{infringement.totalPoints || 0}</span></p>
                    <p><strong>Assessed Penalty:</strong> <span className="font-bold text-xl">{calculateFineAmount(infringement.totalPoints)}</span></p>
                </div>
                
                {infringement.officerNotes && (
                    <>
                    <Separator/>
                    <div>
                        <h3 className="font-semibold text-primary mb-1 text-lg">Overall Officer Notes:</h3>
                        <p className="whitespace-pre-wrap text-sm pl-2">{infringement.officerNotes}</p>
                    </div>
                    </>
                )}

                <Separator className="my-6" />
                <div className="text-xs text-gray-700">
                    <p className="font-semibold mb-1">IMPORTANT:</p>
                    <p>This notice alleges that you have committed an offence against the Small Craft Act 2011 or its associated regulations. You have the right to appeal this notice within 14 days from the date of issue. Payment of the assessed penalty is due within 28 days. Failure to pay or appeal may result in further legal action or suspension of craft registration/operator license.</p>
                    <p className="mt-2">For inquiries or payment, please contact the NCD Small Craft Registration Board.</p>
                </div>

                 <div className="grid grid-cols-2 gap-8 mt-10 pt-6 border-t">
                    <div>
                        <div className="h-16 w-full border-b border-gray-400"></div>
                        <p className="text-center text-xs mt-1">Issuing Officer's Signature</p>
                    </div>
                    <div>
                        {infringement.offenderSignatureUrl ? (
                            <div className="flex justify-center items-end h-20">
                                <Image src={infringement.offenderSignatureUrl} alt="Offender Signature" width={150} height={75} className="max-h-[75px] object-contain" data-ai-hint="signature document" />
                            </div>
                        ) : (
                            <div className="h-16 w-full border-b border-gray-400"></div>
                        )}
                        <p className="text-center text-xs mt-1">Offender/Representative's Signature</p>
                    </div>
                </div>

            </CardContent>
             <CardFooter className="mt-8 pt-4 border-t text-center text-xs text-gray-500">
                <p>RegoCraft Infringement System &copy; {new Date().getFullYear()}</p>
            </CardFooter>
        </div>
    </div>
  );
}

