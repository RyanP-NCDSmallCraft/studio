
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge }
from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Ship, Eye, Edit, Filter, Search, Loader2, AlertTriangle, MoreHorizontal, RefreshCw, CheckCircle, Clock, Ban, DollarSign, CalendarClock } from "lucide-react";
import type { Registration, Owner, ProofOfOwnershipDoc, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where, Timestamp, DocumentReference, QueryConstraint } from 'firebase/firestore'; // Corrected import
import { db } from '@/lib/firebase';
import { useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

// Helper function to safely convert Firestore Timestamps or other date forms to JS Date
// This is moved here as it's now used directly in this client component
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) {
      console.warn('Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string') {
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  if (typeof dateValue === 'number') {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
          return parsedDate;
      }
  }
  console.warn(`Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};

const REGISTRATION_STATUSES: Registration['status'][] = ["Draft", "Submitted", "PendingReview", "RequiresInfo", "Approved", "Rejected", "Expired", "Suspended", "Revoked"];

export default function RegistrationsPage() {
  const { currentUser, isAdmin, isRegistrar, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  useEffect(() => {
      const statusesFromUrl = searchParams.get('status')?.split(',') || [];
      setStatusFilter(statusesFromUrl.filter(s => s)); // filter out empty strings
  }, [searchParams]);

  const loadRegistrations = useCallback(async () => {
    if (!currentUser) {
      console.log("RegistrationsPage (Client): No current user. Clearing registrations and not fetching.");
      setRegistrations([]);
      setIsLoading(false);
      setFetchError("Please log in to view registrations.");
      return;
    }

    console.log("RegistrationsPage (Client): Current user found, attempting to fetch registrations directly using client SDK.");
    setIsLoading(true);
    setFetchError(null);

    try {
      const queryConstraints: QueryConstraint[] = [];
      const statusFilterParam = searchParams.get('status');

      if (statusFilterParam) {
        const statusArray = statusFilterParam.split(',');
        if (statusArray.length > 0) {
          queryConstraints.push(where("status", "in", statusArray));
          console.log("RegistrationsPage (Client): Applying status filter:", statusArray);
        }
      }

      const registrationsColRef = collection(db, "registrations");
      const q = query(registrationsColRef, ...queryConstraints);
      
      const registrationSnapshot = await getDocs(q);
      console.log(`RegistrationsPage (Client): Fetched ${registrationSnapshot.docs.length} documents from Firestore.`);

      const fetchedRegistrations = registrationSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();

        const mapOwner = (ownerData: any): Owner => ({
          ownerId: ownerData.ownerId || '',
          role: ownerData.role || 'Primary',
          surname: ownerData.surname || '',
          firstName: ownerData.firstName || '',
          dob: ensureSerializableDate(ownerData.dob),
          sex: ownerData.sex || 'Male',
          phone: ownerData.phone || '',
          fax: ownerData.fax,
          email: ownerData.email,
          postalAddress: ownerData.postalAddress || '',
          townDistrict: ownerData.townDistrict || '',
          llg: ownerData.llg || '',
          wardVillage: ownerData.wardVillage || '',
          ownerType: ownerData.ownerType || 'Private',
          companyName: ownerData.companyName,
          companyRegNo: ownerData.companyRegNo,
          companyAddress: ownerData.companyAddress,
        });

        const mapProofDoc = (docData: any): ProofOfOwnershipDoc => ({
          docId: docData.docId || '',
          description: docData.description || '',
          fileName: docData.fileName || '',
          fileUrl: docData.fileUrl || '',
          uploadedAt: ensureSerializableDate(docData.uploadedAt),
        });
        
        const createdByRefId = data.createdByRef instanceof DocumentReference ? data.createdByRef.id : data.createdByRef;
        const lastUpdatedByRefId = data.lastUpdatedByRef instanceof DocumentReference ? data.lastUpdatedByRef.id : data.lastUpdatedByRef;


        return {
          registrationId: docSnapshot.id,
          scaRegoNo: data.scaRegoNo,
          interimRegoNo: data.interimRegoNo,
          registrationType: data.registrationType || 'New',
          previousScaRegoNo: data.previousScaRegoNo,
          status: data.status || 'Draft',
          submittedAt: ensureSerializableDate(data.submittedAt),
          approvedAt: ensureSerializableDate(data.approvedAt),
          effectiveDate: ensureSerializableDate(data.effectiveDate),
          expiryDate: ensureSerializableDate(data.expiryDate),
          paymentMethod: data.paymentMethod,
          paymentReceiptNumber: data.paymentReceiptNumber,
          bankStampRef: data.bankStampRef,
          paymentAmount: data.paymentAmount,
          paymentDate: ensureSerializableDate(data.paymentDate),
          safetyCertNumber: data.safetyCertNumber,
          safetyEquipIssued: data.safetyEquipIssued || false,
          safetyEquipReceiptNumber: data.safetyEquipReceiptNumber,
          owners: Array.isArray(data.owners) ? data.owners.map(mapOwner) : [],
          proofOfOwnershipDocs: Array.isArray(data.proofOfOwnershipDocs) ? data.proofOfOwnershipDocs.map(mapProofDoc) : [],
          craftMake: data.craftMake || '',
          craftModel: data.craftModel || '',
          craftYear: data.craftYear || new Date().getFullYear(),
          craftColor: data.craftColor || '',
          hullIdNumber: data.hullIdNumber || '',
          craftLength: data.craftLength || 0,
          lengthUnits: data.lengthUnits || 'm',
          distinguishingFeatures: data.distinguishingFeatures,
          propulsionType: data.propulsionType || 'Outboard',
          propulsionOtherDesc: data.propulsionOtherDesc,
          hullMaterial: data.hullMaterial || 'Fiberglass',
          hullMaterialOtherDesc: data.hullMaterialOtherDesc,
          craftUse: data.craftUse || 'Pleasure',
          craftUseOtherDesc: data.craftUseOtherDesc,
          fuelType: data.fuelType || 'Petrol',
          fuelTypeOtherDesc: data.fuelTypeOtherDesc,
          vesselType: data.vesselType || 'OpenBoat',
          vesselTypeOtherDesc: data.vesselTypeOtherDesc,
          engineHorsepower: data.engineHorsepower,
          engineMake: data.engineMake,
          engineSerialNumbers: data.engineSerialNumbers,
          certificateGeneratedAt: ensureSerializableDate(data.certificateGeneratedAt),
          certificateFileName: data.certificateFileName,
          certificateFileUrl: data.certificateFileUrl,
          suspensionReason: data.suspensionReason,
          suspensionStartDate: ensureSerializableDate(data.suspensionStartDate),
          suspensionEndDate: ensureSerializableDate(data.suspensionEndDate),
          revocationReason: data.revocationReason,
          revokedAt: ensureSerializableDate(data.revokedAt),
          lastUpdatedByRef: lastUpdatedByRefId, 
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          createdByRef: createdByRefId, 
          createdAt: ensureSerializableDate(data.createdAt),
        } as Registration;
      });
      setRegistrations(fetchedRegistrations);
      console.log("RegistrationsPage (Client): Successfully fetched and mapped registrations.", fetchedRegistrations.length);
    } catch (error: any) {
      const originalErrorMessage = error.message || "Unknown Firebase error";
      const originalErrorCode = error.code || "N/A";
      const detailedError = `Failed to fetch registrations directly from client. Original error: [${originalErrorCode}] ${originalErrorMessage}`;
      console.error("RegistrationsPage (Client): Error details:", detailedError, error);
      setFetchError(detailedError);
      toast({
        title: "Error Loading Registrations",
        description: detailedError,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      console.log("RegistrationsPage (Client): Finished fetching. isLoading set to false.");
    }
  }, [currentUser, toast, searchParams]);

  useEffect(() => {
    if (authLoading) {
      console.log("RegistrationsPage (Client): Auth is still loading. Waiting...");
      setIsLoading(true); 
      return;
    }
    if (currentUser) {
      loadRegistrations();
    } else {
      setIsLoading(false);
      setFetchError("Please log in to view registrations.");
      setRegistrations([]); 
    }
  }, [currentUser, authLoading, loadRegistrations]);


  const getStatusBadgeVariant = (status?: Registration["status"]): BadgeProps["variant"] => {
    switch (status) {
      case "Approved":
        return "default";
      case "Submitted":
      case "PendingReview":
        return "secondary";
      case "Rejected":
      case "Expired":
      case "Revoked":
      case "Suspended": // Changed to destructive
        return "destructive";
      case "Draft":
      case "RequiresInfo":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPrimaryOwnerName = (owners: Owner[] | undefined): string => {
    if (!owners || owners.length === 0) return "N/A";
    const primaryOwner = owners.find(o => o.role === "Primary");
    if (!primaryOwner) return "N/A";
    return primaryOwner.ownerType === 'Company' 
      ? primaryOwner.companyName || 'N/A' 
      : `${primaryOwner.firstName || ''} ${primaryOwner.surname || ''}`.trim();
  };

  const canEditRegistration = (regStatus?: Registration["status"]): boolean => {
    if (!currentUser) return false;
    const editableStatuses: Array<Registration["status"]> = ["Draft", "Submitted", "RequiresInfo"];
    return (isRegistrar || isAdmin) && !!regStatus && editableStatuses.includes(regStatus);
  };

  const filteredRegistrations = useMemo(() => {
    if (!searchTerm) return registrations;
    const lowercasedFilter = searchTerm.toLowerCase();
    return registrations.filter((reg) => {
      const regoNo = reg.scaRegoNo || reg.interimRegoNo || reg.registrationId;
      const ownerName = getPrimaryOwnerName(reg.owners);
      return (
        regoNo.toLowerCase().includes(lowercasedFilter) ||
        (reg.craftMake && reg.craftMake.toLowerCase().includes(lowercasedFilter)) ||
        (reg.craftModel && reg.craftModel.toLowerCase().includes(lowercasedFilter)) ||
        ownerName.toLowerCase().includes(lowercasedFilter) ||
        (reg.status && reg.status.toLowerCase().includes(lowercasedFilter))
      );
    });
  }, [searchTerm, registrations]);

  const retryLoadRegistrations = () => {
    if (currentUser && !authLoading) {
      loadRegistrations();
    } else if (!authLoading && !currentUser) {
      setFetchError("Please log in to retry fetching registrations.");
    }
  };

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    const newStatusFilter = checked 
      ? [...statusFilter, status]
      : statusFilter.filter(s => s !== status);
    
    const params = new URLSearchParams(searchParams.toString());
    if (newStatusFilter.length > 0) {
      params.set('status', newStatusFilter.join(','));
    } else {
      params.delete('status');
    }
    router.push(`/registrations?${params.toString()}`);
  };


  const stats = useMemo(() => {
    let approved = 0;
    let pending = 0;
    let expiringSoon = 0;
    let suspendedOrRevoked = 0;

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    futureDate.setHours(23, 59, 59, 999);

    filteredRegistrations.forEach(reg => {
      if (reg.status === 'Approved') approved++;
      if (reg.status === 'PendingReview' || reg.status === 'Submitted' || reg.status === 'RequiresInfo') pending++;
      if (reg.status === 'Suspended' || reg.status === 'Revoked' || reg.status === 'Expired') suspendedOrRevoked++;
      
      if (reg.status === 'Approved' && reg.expiryDate) {
         if (reg.expiryDate <= futureDate) {
            expiringSoon++;
         }
      }
    });

    return { approved, pending, expiringSoon, suspendedOrRevoked };
  }, [filteredRegistrations]);

  if (authLoading && isLoading) { 
    return (
      <div className="flex h-64 justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading application data...</p>
      </div>
    );
  }


  return (
    <div className="space-y-6">
      {/* High-Impact Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-2">
        <Card className="relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-500/5 hover:shadow-md transition-all duration-300 border-green-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400">Total Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.approved}</div>
            <p className="text-xs font-medium text-green-600/70 mt-1">Current valid registrations</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:shadow-md transition-all duration-300 border-blue-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-16 h-16 text-blue-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-500">{stats.pending}</div>
            <p className="text-xs font-medium text-blue-600/70 mt-1">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:shadow-md transition-all duration-300 border-amber-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CalendarClock className="w-16 h-16 text-amber-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">
               {stats.expiringSoon}
            </div>
            <p className="text-xs font-medium text-amber-600/70 mt-1">Expiring within 3 months (or overdue)</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-orange-500/5 hover:shadow-md transition-all duration-300 border-orange-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Ban className="w-16 h-16 text-orange-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-400">Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">{stats.suspendedOrRevoked}</div>
            <p className="text-xs font-medium text-orange-600/70 mt-1">Suspended or Revoked</p>
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Ship className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Craft Registrations</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search registrations..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              disabled={!currentUser || isLoading}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                {statusFilter.length > 0 && (
                  <>
                    <Separator orientation="vertical" className="mx-2 h-4" />
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {statusFilter.length}
                    </Badge>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by Status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {REGISTRATION_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilter.includes(status)}
                  onCheckedChange={(checked) => handleStatusFilterChange(status, !!checked)}
                >
                  {status}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {(isRegistrar || isAdmin) && (
            <Button asChild>
              <Link href="/registrations/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Registration
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Registration Overview</CardTitle>
          <CardDescription>Manage and track all craft registrations.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && !fetchError ? ( 
             <div className="flex h-40 justify-center items-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Fetching registrations...</p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-10">
              {fetchError.includes("permission-denied") || fetchError.includes("Missing or insufficient permissions") ? (
                <div className="text-destructive space-y-2 p-4 border border-destructive/50 rounded-md bg-destructive/10">
                  <div className="flex justify-center items-center mb-2">
                    <AlertTriangle className="h-10 w-10 mr-2" />
                    <h3 className="text-xl font-semibold">Permission Denied</h3>
                  </div>
                  <p>Could not load registrations due to missing Firestore permissions.</p>
                  <p className="font-medium mt-2">
                    Your Firestore Security Rules currently allow reading registrations if `isUserActiveAndAuthenticated()` is true.
                    This function checks if your user profile in Firestore (<code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">/users/{currentUser?.userId || 'YOUR_USER_ID'}</code>) exists AND has the field <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">isActive: true</code>.
                  </p>
                  <p className="mt-1">
                    Please ensure your user document in Firestore exists and has <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">isActive</code> set to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">true</code>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Detailed error: {fetchError}</p>
                </div>
              ) : (
                <p className="text-destructive">{fetchError}</p>
              )}
              {currentUser && <Button onClick={retryLoadRegistrations} className="mt-4">Retry</Button>}
              {!currentUser && !authLoading && <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Rego No.</TableHead>
                  <TableHead>Craft Make/Model</TableHead>
                  <TableHead>Primary Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.length > 0 ? filteredRegistrations.map((reg) => (
                  <TableRow key={reg.registrationId}>
                    <TableCell className="font-medium">
                      {reg.scaRegoNo || reg.interimRegoNo || reg.registrationId}
                    </TableCell>
                    <TableCell>{reg.craftMake} {reg.craftModel}</TableCell>
                    <TableCell>{getPrimaryOwnerName(reg.owners)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(reg.status)}>{reg.status || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      {(reg.status === "Approved" || reg.status === "Suspended") && reg.expiryDate
                        ? formatFirebaseTimestamp(reg.expiryDate, "PP")
                        : "N/A"}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/registrations/${reg.registrationId}`} className="cursor-pointer flex items-center">
                              <Eye className="mr-2 h-4 w-4" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          
                          {canEditRegistration(reg.status) && (
                            <DropdownMenuItem asChild>
                              <Link href={`/registrations/${reg.registrationId}/edit`} className="cursor-pointer flex items-center">
                                <Edit className="mr-2 h-4 w-4" /> Edit Registration
                              </Link>
                            </DropdownMenuItem>
                          )}

                          {(isAdmin || isRegistrar) && ["Approved", "Expired"].includes(reg.status) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link 
                                  href={`/registrations/new?type=Renewal&previousScaRegoNo=${reg.scaRegoNo || reg.interimRegoNo || ''}`} 
                                  className="cursor-pointer flex items-center"
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" /> Renew Registration
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {!isLoading && registrations.length === 0 && !fetchError ? "No registrations found." : ""}
                      {searchTerm && !isLoading && filteredRegistrations.length === 0 && registrations.length > 0 ? "No registrations match your search." : ""}
                      {searchParams.get('status') && !isLoading && filteredRegistrations.length === 0 && "No registrations match the current filter."}
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
