
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, AlertOctagon, Eye, Filter, Search, Loader2, ArrowLeft } from "lucide-react";
import type { Infringement } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where, doc, getDoc, Timestamp, DocumentReference, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Input } from "@/components/ui/input";
import { useRouter }
from "next/navigation";
import { isValid } from 'date-fns'; // Ensure isValid is imported

// Helper to ensure date serialization
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) return dateValue.toDate();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) {
      console.warn('Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (isValid(parsedDate)) { // Use isValid from date-fns
      return parsedDate;
    }
  }
  console.warn(`InfringementListPage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function InfringementListPage() {
  const { currentUser, isAdmin, isRegistrar, isInspector, isSupervisor, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [infringements, setInfringements] = useState<Infringement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const loadInfringements = useCallback(async () => {
    if (!currentUser) {
      setFetchError("Please log in to view infringements.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setFetchError(null);

    try {
      const queryConstraints: QueryConstraint[] = [];

      // If the user is ONLY an Inspector (not Admin, Registrar, or Supervisor),
      // then filter infringements to only those they issued.
      if (isInspector && !isAdmin && !isRegistrar && !isSupervisor) {
        queryConstraints.push(where("issuedByRef", "==", doc(db, "users", currentUser.userId)));
      }

      const infringementsQuery = query(collection(db, "infringements"), ...queryConstraints);
      
      const snapshot = await getDocs(infringementsQuery);
      const fetchedInfringementsPromises = snapshot.docs.map(async docSnap => { // Added async here
        const data = docSnap.data();
        
        let registrationData: Infringement['registrationData'] = undefined;
        if (data.registrationRef instanceof DocumentReference) {
            const regDocSnap = await getDoc(data.registrationRef as DocumentReference<Registration>);
            if (regDocSnap.exists()) {
                const regData = regDocSnap.data();
                const primaryOwner = regData.owners?.find(o => o.role === 'Primary') || regData.owners?.[0];
                registrationData = {
                    id: regDocSnap.id,
                    scaRegoNo: regData.scaRegoNo,
                    hullIdNumber: regData.hullIdNumber,
                    craftMake: regData.craftMake,
                    craftModel: regData.craftModel,
                    ownerName: primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : 'N/A',
                };
            }
        } else if (typeof data.registrationRef === 'string') {
           // Potentially fetch if only ID is stored, or assume it's denormalized in registrationData
           if (data.registrationData) {
             registrationData = data.registrationData;
           }
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
        } else if (typeof data.issuedByRef === 'string') {
            if (data.issuedByData) {
                issuedByData = data.issuedByData;
            }
        }


        return {
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
          registrationData, // Use the fetched/denormalized data
          issuedByRef: (data.issuedByRef instanceof DocumentReference) ? data.issuedByRef.id : data.issuedByRef,
          issuedByData, // Use the fetched/denormalized data
          approvedByRef: (data.approvedByRef instanceof DocumentReference) ? data.approvedByRef.id : data.approvedByRef,
          createdByRef: (data.createdByRef instanceof DocumentReference) ? data.createdByRef.id : data.createdByRef,
          lastUpdatedByRef: (data.lastUpdatedByRef instanceof DocumentReference) ? data.lastUpdatedByRef.id : data.lastUpdatedByRef,
        } as Infringement;
      });
      const fetchedInfringements = await Promise.all(fetchedInfringementsPromises); // Wait for all promises
      setInfringements(fetchedInfringements);
    } catch (error: any) {
      console.error("Error fetching infringements:", error);
      setFetchError(error.message || "Failed to load infringements.");
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, toast, isInspector, isAdmin, isRegistrar, isSupervisor]);

  useEffect(() => {
    if (!authLoading) {
      loadInfringements();
    }
  }, [authLoading, loadInfringements]);

  const getStatusBadgeVariant = (status?: Infringement["status"]) => {
    switch (status) {
      case "Issued": case "PendingReview": return "secondary";
      case "Approved": return "default";
      case "Paid": return "default";
      case "Voided": case "Overdue": return "destructive";
      case "Draft": return "outline";
      default: return "outline";
    }
  };

  const filteredInfringements = infringements.filter(inf => {
    const searchLower = searchTerm.toLowerCase();
    return (
        inf.infringementId.toLowerCase().includes(searchLower) ||
        (inf.registrationData?.scaRegoNo && inf.registrationData.scaRegoNo.toLowerCase().includes(searchLower)) ||
        (inf.registrationData?.ownerName && inf.registrationData.ownerName.toLowerCase().includes(searchLower)) ||
        (inf.issuedByData?.displayName && inf.issuedByData.displayName.toLowerCase().includes(searchLower)) ||
        (inf.status && inf.status.toLowerCase().includes(searchLower))
    );
  });


  if (authLoading || (!currentUser && isLoading)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const canCreate = isAdmin || isRegistrar || isInspector || isSupervisor;


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-1 h-9 w-9">
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back</span>
            </Button>
          <AlertOctagon className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Infringement Notices</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search infringements..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/infringements/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Issue New Infringement
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Infringement Log</CardTitle>
          <CardDescription>Manage and track all issued infringement notices.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Loading infringements...</p>
            </div>
          ) : fetchError ? (
            <p className="text-center text-destructive">{fetchError}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID / Craft Rego</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Date Issued</TableHead>
                  <TableHead>Total Points</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInfringements.length > 0 ? filteredInfringements.map((inf) => (
                  <TableRow key={inf.infringementId}>
                    <TableCell className="font-medium">
                        <div>{inf.infringementId}</div>
                        <div className="text-xs text-muted-foreground">{inf.registrationData?.scaRegoNo || "N/A"}</div>
                    </TableCell>
                    <TableCell>{inf.registrationData?.ownerName || "N/A"}</TableCell>
                    <TableCell>{inf.issuedByData?.displayName || inf.issuedByRef as string || "N/A"}</TableCell>
                    <TableCell>{formatFirebaseTimestamp(inf.issuedAt, "PP")}</TableCell>
                    <TableCell>{inf.totalPoints || 0} points</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(inf.status)}>{inf.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" asChild title="View Details">
                        <Link href={`/infringements/${inf.infringementId}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No infringements found.
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
