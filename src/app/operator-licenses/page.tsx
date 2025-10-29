
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Eye, Filter, Search, Contact, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import type { OperatorLicense, Operator, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Timestamp, collection, getDocs, query, where, doc, getDoc, DocumentReference, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useRouter, useSearchParams } from "next/navigation";
import { isValid } from 'date-fns';
import { useToast } from "@/hooks/use-toast"; // Added import


// Helper to ensure date serialization
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


export default function OperatorLicenseListPage() {
  const { currentUser, isAdmin, isRegistrar, isSupervisor, loading: authLoading } = useAuth();
  const { toast } = useToast(); // Assuming useToast is available
  const router = useRouter();
  const searchParamsHook = useSearchParams(); // Renamed to avoid conflict

  const [licenses, setLicenses] = useState<OperatorLicense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadLicenses = useCallback(async () => {
    if (!currentUser) {
      setFetchError("Please log in to view operator licenses.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setFetchError(null);

    try {
      const queryConstraints: QueryConstraint[] = [];
      // Example filter: const statusFilter = searchParamsHook.get('status');
      // if (statusFilter) queryConstraints.push(where("status", "==", statusFilter));

      const licensesQuery = query(collection(db, "operatorLicenseApplications"), ...queryConstraints);
      const snapshot = await getDocs(licensesQuery);
      
      const fetchedLicensesPromises = snapshot.docs.map(async docSnap => {
        const data = docSnap.data() as Omit<OperatorLicense, 'operatorRef'> & { operatorRef: DocumentReference<Operator> | string };
        
        let operatorData: Partial<Operator> | undefined = data.operatorData; // Use denormalized first
        if (!operatorData && data.operatorRef) { // If not denormalized, fetch
            let opRef: DocumentReference<Operator>;
            if (typeof data.operatorRef === 'string') {
                // Assuming the string is a full path, otherwise adjust
                opRef = doc(db, data.operatorRef) as DocumentReference<Operator>; 
            } else {
                opRef = data.operatorRef;
            }
            const operatorDocSnap = await getDoc(opRef);
            if (operatorDocSnap.exists()) {
                const opRaw = operatorDocSnap.data() as Operator;
                operatorData = {
                    operatorId: operatorDocSnap.id,
                    firstName: opRaw.firstName,
                    surname: opRaw.surname,
                    // Add other key fields you need for display
                };
            }
        }

        return {
          ...data,
          licenseApplicationId: docSnap.id,
          operatorData: operatorData, // Assign fetched or existing denormalized data
          // Ensure all date fields are JS Dates for client-side state
          submittedAt: ensureSerializableDate(data.submittedAt),
          approvedAt: ensureSerializableDate(data.approvedAt),
          issuedAt: ensureSerializableDate(data.issuedAt),
          expiryDate: ensureSerializableDate(data.expiryDate),
          paymentDate: ensureSerializableDate(data.paymentDate),
          createdAt: ensureSerializableDate(data.createdAt) as Date,
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt) as Date,
          attachedDocuments: (data.attachedDocuments || []).map(d => ({
            ...d,
            uploadedAt: ensureSerializableDate(d.uploadedAt) as Date,
            verifiedAt: ensureSerializableDate(d.verifiedAt)
          })),
        } as OperatorLicense;
      });
      const fetchedLicenses = await Promise.all(fetchedLicensesPromises);
      setLicenses(fetchedLicenses);
    } catch (error: any) {
      console.error("Error fetching operator licenses:", error);
      setFetchError(error.message || "Failed to load licenses.");
      if (toast) toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, searchParamsHook]);

  useEffect(() => {
    if (!authLoading) {
      loadLicenses();
    }
  }, [authLoading, loadLicenses]);

  const getStatusBadgeVariant = (status?: OperatorLicense["status"]): BadgeProps["variant"] => {
    switch (status) {
      case "Approved": return "default";
      case "Submitted": case "PendingReview": case "AwaitingTest": case "TestScheduled": case "TestPassed": return "secondary";
      case "Rejected": case "Expired": case "Revoked": case "TestFailed": case "Suspended": return "destructive";
      case "Draft": case "RequiresInfo": return "outline";
      default: return "outline";
    }
  };

  const getApplicantName = (license: OperatorLicense): string => {
    return license.operatorData ? `${license.operatorData.firstName || ''} ${license.operatorData.surname || ''}`.trim() : "N/A";
  };
  
  const canAddNew = isAdmin || isRegistrar || isSupervisor;

  const filteredLicenses = useMemo(() => {
    if (!searchTerm) return licenses;
    const lowercasedFilter = searchTerm.toLowerCase();
    return licenses.filter((lic) => {
      const applicantName = getApplicantName(lic);
      return (
        (lic.assignedLicenseNumber || lic.licenseApplicationId).toLowerCase().includes(lowercasedFilter) ||
        applicantName.toLowerCase().includes(lowercasedFilter) ||
        (lic.status && lic.status.toLowerCase().includes(lowercasedFilter)) ||
        (lic.applicationType && lic.applicationType.toLowerCase().includes(lowercasedFilter))
      );
    });
  }, [searchTerm, licenses]);
  
  if (authLoading || (!currentUser && isLoading)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-1 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <Contact className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Operator Licenses</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search licenses..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          {canAddNew && (
            <Button asChild>
              <Link href="/operator-licenses/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Application
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>License Overview</CardTitle>
          <CardDescription>Manage and track all operator license applications and issued licenses.</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoading ? (
            <div className="flex h-40 justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading licenses...</p>
            </div>
          ) : fetchError ? (
             <div className="text-center py-10 text-destructive">
                <AlertTriangle className="mx-auto h-10 w-10 mb-2" />
                <p>{fetchError}</p>
                <Button onClick={loadLicenses} className="mt-4">Retry</Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License No. / App ID</TableHead>
                  <TableHead>Applicant Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLicenses.length > 0 ? filteredLicenses.map((lic) => (
                  <TableRow key={lic.licenseApplicationId}>
                    <TableCell className="font-medium">{lic.assignedLicenseNumber || lic.licenseApplicationId}</TableCell>
                    <TableCell>{getApplicantName(lic)}</TableCell>
                    <TableCell>{lic.applicationType}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lic.status)}>{lic.status}</Badge>
                    </TableCell>
                    <TableCell>{formatFirebaseTimestamp(lic.submittedAt, "PP")}</TableCell>
                    <TableCell>{formatFirebaseTimestamp(lic.expiryDate, "PP")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild title="View Details">
                        <Link href={`/operator-licenses/${lic.licenseApplicationId}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No licenses found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
