
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge }
from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Ship, Eye, Edit, Filter, Search, Loader2, AlertTriangle, MoreHorizontal, RefreshCw, CheckCircle, Clock, Ban, DollarSign, CalendarClock, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ShieldAlert, ShieldCheck, ShieldX, ClipboardList, Minus, Play } from "lucide-react";
import type { Registration, Owner, ProofOfOwnershipDoc, User, Inspection } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp, cn } from '@/lib/utils';
import { isValid } from 'date-fns';
import type { BadgeProps } from "@/components/ui/badge";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { collection, getDocs, query, where, Timestamp, DocumentReference, QueryConstraint, doc } from 'firebase/firestore';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

export type RegistrationInspectionStatus = "passed" | "certified" | "failed" | "scheduled" | "in-progress" | "pending-review" | "none";

export interface RegistrationInspectionInfo {
  status: RegistrationInspectionStatus;
  inspectionId?: string;
  latestDate?: Date;
}

export default function RegistrationsPage() {
  const { currentUser, isAdmin, isRegistrar, isSupervisor, isInspector, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [inspectionFilter, setInspectionFilter] = useState<"all" | "needed" | "passed" | "scheduled">("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(50);

  // Inspection status tracking: maps registrationId -> latest inspection info
  const [inspectionMap, setInspectionMap] = useState<Map<string, RegistrationInspectionInfo>>(new Map());

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
          uploadedAt: ensureSerializableDate(docData.uploadedAt) || new Date(),
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

      // Fetch all inspections to build the inspection status map
      try {
        const inspectionsColRef = collection(db, "inspections");
        const inspectionSnapshot = await getDocs(inspectionsColRef);
        const newInspectionMap = new Map<string, RegistrationInspectionInfo>();

        inspectionSnapshot.docs.forEach(inspDoc => {
          const inspData = inspDoc.data();

          // Resolve the registrationRef to an ID
          let regId: string | undefined;
          if (inspData.registrationRef instanceof DocumentReference) {
            regId = inspData.registrationRef.id;
          } else if (typeof inspData.registrationRef === 'string') {
            regId = inspData.registrationRef.startsWith('registrations/')
              ? inspData.registrationRef.replace('registrations/', '')
              : inspData.registrationRef;
          } else if (inspData.registrationRef?.id && typeof inspData.registrationRef.id === 'string') {
            regId = inspData.registrationRef.id;
          }

          if (!regId && inspData.registrationData?.id) {
            regId = inspData.registrationData.id;
          }

          if (!regId) return;

          // Map inspection status to our simplified status
          let inspStatus: RegistrationInspectionStatus;
          switch (inspData.status) {
            case "Passed": inspStatus = "passed"; break;
            case "Failed": inspStatus = "failed"; break;
            case "Scheduled": inspStatus = "scheduled"; break;
            case "InProgress": inspStatus = "in-progress"; break;
            case "PendingReview": inspStatus = "pending-review"; break;
            default: inspStatus = "none"; break;
          }

          // Skip cancelled inspections
          if (inspData.status === "Cancelled") return;

          const inspDate = ensureSerializableDate(inspData.inspectionDate || inspData.scheduledDate);
          const existing = newInspectionMap.get(regId);

          // Priority: passed > pending-review > in-progress > failed > scheduled > none
          const statusPriority: Record<RegistrationInspectionStatus, number> = {
            "passed": 6, "certified": 6, "pending-review": 5, "in-progress": 4,
            "failed": 3, "scheduled": 2, "none": 0,
          };

          if (!existing || statusPriority[inspStatus] > statusPriority[existing.status]) {
            newInspectionMap.set(regId, {
              status: inspStatus,
              inspectionId: inspDoc.id,
              latestDate: inspDate,
            });
          }
        });

        setInspectionMap(newInspectionMap);
        console.log("RegistrationsPage (Client): Built inspection map for", newInspectionMap.size, "registrations.");
      } catch (inspError: any) {
        console.warn("RegistrationsPage (Client): Could not fetch inspections for status indicators.", inspError.message);
        // Non-fatal: we still show registrations, just without inspection indicators
      }
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
    return (isRegistrar || isAdmin || isSupervisor) && !!regStatus && editableStatuses.includes(regStatus);
  };

  // Determine if a registration needs an inspection, is passed, or is in progress
  const getInspectionIndicator = useCallback((reg: Registration): {
    needsAttention: boolean;
    label: string;
    icon: React.ReactNode;
    variant: BadgeProps["variant"];
    className?: string;
    tooltip?: string;
    inspectionId?: string;
  } => {
    // For Draft registrations, inspection is not yet due
    if (reg.status === "Draft") {
      return {
        needsAttention: false,
        label: "Draft",
        icon: <Minus className="h-3 w-3 text-muted-foreground" />,
        variant: "outline",
        className: "text-muted-foreground border-dashed",
        tooltip: "Draft registration - inspection not yet required",
      };
    }

    // For Suspended, Revoked, Rejected
    if (reg.status === "Suspended" || reg.status === "Revoked" || reg.status === "Rejected") {
      return {
        needsAttention: false,
        label: "N/A",
        icon: <Minus className="h-3 w-3 text-muted-foreground" />,
        variant: "outline",
        className: "text-muted-foreground",
        tooltip: `Craft status is ${reg.status}`,
      };
    }

    const inspInfo = inspectionMap.get(reg.registrationId);

    if (inspInfo) {
      if (inspInfo.status === "passed") {
        return {
          needsAttention: false,
          label: "Passed",
          icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
          variant: "outline",
          className: "border-emerald-500/50 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-medium",
          tooltip: `Inspection passed${inspInfo.latestDate ? ` on ${inspInfo.latestDate.toLocaleDateString()}` : ""}`,
          inspectionId: inspInfo.inspectionId,
        };
      }
      if (inspInfo.status === "failed") {
        return {
          needsAttention: true,
          label: "Failed",
          icon: <ShieldX className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
          variant: "destructive",
          className: "bg-red-600 text-white font-medium",
          tooltip: "Inspection failed - re-inspection required",
          inspectionId: inspInfo.inspectionId,
        };
      }
      if (inspInfo.status === "scheduled") {
        return {
          needsAttention: false,
          label: "Scheduled",
          icon: <ClipboardList className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />,
          variant: "outline",
          className: "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium",
          tooltip: `Inspection scheduled${inspInfo.latestDate ? ` for ${inspInfo.latestDate.toLocaleDateString()}` : ""}`,
          inspectionId: inspInfo.inspectionId,
        };
      }
      if (inspInfo.status === "in-progress" || inspInfo.status === "pending-review") {
        return {
          needsAttention: false,
          label: inspInfo.status === "in-progress" ? "In Progress" : "Pending Review",
          icon: <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
          variant: "outline",
          className: "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium",
          tooltip: `Inspection is ${inspInfo.status === "in-progress" ? "in progress" : "pending supervisor review"}`,
          inspectionId: inspInfo.inspectionId,
        };
      }
    }

    // If no inspection doc, check if registration already has a safetyCertNumber
    if (reg.safetyCertNumber && reg.safetyCertNumber.trim() !== "") {
      return {
        needsAttention: false,
        label: "Certified",
        icon: <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />,
        variant: "outline",
        className: "border-emerald-500/40 bg-emerald-50/50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
        tooltip: `Safety Cert No: ${reg.safetyCertNumber}`,
      };
    }

    // If Expired registration with no current inspection
    if (reg.status === "Expired") {
      return {
        needsAttention: true,
        label: "Overdue",
        icon: <ShieldAlert className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />,
        variant: "destructive",
        className: "bg-red-600 text-white font-medium",
        tooltip: "Registration expired - requires full inspection renewal",
      };
    }

    // Craft has no inspection and needs one (Approved, Submitted, PendingReview, RequiresInfo)
    return {
      needsAttention: true,
      label: "Needs Inspection",
      icon: <ShieldAlert className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />,
      variant: "outline",
      className: "border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-semibold shadow-xs",
      tooltip: "Craft does not have a recorded inspection or safety certificate",
    };
  }, [inspectionMap]);

  // Determine row highlight class based on status + inspection
  const getRowClassName = (reg: Registration): string => {
    if (reg.status === "Expired") {
      return "bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100/70 dark:hover:bg-red-950/50 border-l-4 border-l-red-500 transition-colors";
    }
    const insp = getInspectionIndicator(reg);
    if (insp.needsAttention) {
      return "bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/40 border-l-4 border-l-amber-500 transition-colors";
    }
    return "border-l-4 border-l-transparent transition-colors";
  };

  const filteredRegistrations = useMemo(() => {
    return registrations.filter((reg) => {
      const insp = getInspectionIndicator(reg);

      if (inspectionFilter === "needed" && !insp.needsAttention) {
        return false;
      }
      if (inspectionFilter === "passed" && insp.label !== "Passed" && insp.label !== "Certified") {
        return false;
      }
      if (inspectionFilter === "scheduled" && insp.label !== "Scheduled" && insp.label !== "In Progress") {
        return false;
      }

      if (!searchTerm) return true;
      const lowercasedFilter = searchTerm.toLowerCase();
      const regoNo = reg.scaRegoNo || reg.interimRegoNo || reg.registrationId;
      const ownerName = getPrimaryOwnerName(reg.owners);
      return (
        regoNo.toLowerCase().includes(lowercasedFilter) ||
        (reg.craftMake && reg.craftMake.toLowerCase().includes(lowercasedFilter)) ||
        (reg.craftModel && reg.craftModel.toLowerCase().includes(lowercasedFilter)) ||
        ownerName.toLowerCase().includes(lowercasedFilter) ||
        (reg.status && reg.status.toLowerCase().includes(lowercasedFilter)) ||
        insp.label.toLowerCase().includes(lowercasedFilter) ||
        (reg.safetyCertNumber && reg.safetyCertNumber.toLowerCase().includes(lowercasedFilter))
      );
    });
  }, [searchTerm, registrations, inspectionFilter, getInspectionIndicator]);

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
    let needsInspection = 0;

    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    futureDate.setHours(23, 59, 59, 999);

    registrations.forEach(reg => {
      if (reg.status === 'Approved') approved++;
      if (reg.status === 'PendingReview' || reg.status === 'Submitted' || reg.status === 'RequiresInfo') pending++;
      if (reg.status === 'Suspended' || reg.status === 'Revoked' || reg.status === 'Expired') suspendedOrRevoked++;
      
      if (reg.status === 'Approved' && reg.expiryDate) {
         const expDate = reg.expiryDate instanceof Date ? reg.expiryDate : new Date(reg.expiryDate as any);
         if (isValid(expDate) && expDate <= futureDate) {
            expiringSoon++;
         }
      }

      const insp = getInspectionIndicator(reg);
      if (insp.needsAttention) {
        needsInspection++;
      }
    });

    return { approved, pending, expiringSoon, suspendedOrRevoked, needsInspection };
  }, [registrations, getInspectionIndicator]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, itemsPerPage, inspectionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRegistrations.length / itemsPerPage));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedRegistrations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRegistrations.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRegistrations, currentPage, itemsPerPage]);

  const totalCount = filteredRegistrations.length;
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endIndex = Math.min(currentPage * itemsPerPage, totalCount);

  const getPageNumbers = () => {
    const pages: (number | "ellipsis")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (currentPage > 3) {
        pages.push("ellipsis");
      }
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) {
        pages.push("ellipsis");
      }
      pages.push(totalPages);
    }
    return pages;
  };

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
          <Button
            type="button"
            variant={inspectionFilter === "needed" ? "default" : "outline"}
            className={cn(
              "transition-all gap-1.5 shrink-0",
              inspectionFilter === "needed"
                ? "bg-amber-600 hover:bg-amber-700 text-white border-amber-600 shadow-xs"
                : "border-amber-300/80 text-amber-800 dark:text-amber-300 dark:border-amber-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            )}
            onClick={() => setInspectionFilter(prev => prev === "needed" ? "all" : "needed")}
            title="Filter craft that require an inspection"
          >
            <ShieldAlert className="h-4 w-4 text-amber-500" />
            <span className="hidden sm:inline">Needs Inspection</span>
            <span className="sm:hidden">Uninspected</span>
            {stats.needsInspection > 0 && (
              <Badge
                variant="secondary"
                className={cn(
                  "px-1.5 py-0 text-[11px] font-bold rounded-full",
                  inspectionFilter === "needed"
                    ? "bg-amber-800 text-amber-100"
                    : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                )}
              >
                {stats.needsInspection}
              </Badge>
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filter
                {(statusFilter.length > 0 || inspectionFilter !== "all") && (
                  <>
                    <Separator orientation="vertical" className="mx-2 h-4" />
                    <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {statusFilter.length + (inspectionFilter !== "all" ? 1 : 0)}
                    </Badge>
                  </>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
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
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Filter by Inspection</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={inspectionFilter === "all"}
                onCheckedChange={() => setInspectionFilter("all")}
              >
                All Inspections
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={inspectionFilter === "needed"}
                onCheckedChange={(checked) => setInspectionFilter(checked ? "needed" : "all")}
              >
                Needs Inspection ({stats.needsInspection})
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={inspectionFilter === "passed"}
                onCheckedChange={(checked) => setInspectionFilter(checked ? "passed" : "all")}
              >
                Passed / Certified
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={inspectionFilter === "scheduled"}
                onCheckedChange={(checked) => setInspectionFilter(checked ? "scheduled" : "all")}
              >
                Scheduled / In Progress
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {(isRegistrar || isAdmin || isSupervisor) && (
            <Button asChild>
              <Link href="/registrations/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Registration
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle>Registration Overview</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
              <span>Manage and track all craft registrations.</span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Expired
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-normal">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Needs Inspection
              </span>
            </CardDescription>
          </div>
          {!isLoading && !fetchError && filteredRegistrations.length > 0 && (
            <Badge variant="outline" className="w-fit font-normal text-xs text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalCount} total)
            </Badge>
          )}
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
                  <TableHead>Inspection</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedRegistrations.length > 0 ? paginatedRegistrations.map((reg) => {
                  const insp = getInspectionIndicator(reg);
                  return (
                  <TableRow
                    key={reg.registrationId}
                    className={getRowClassName(reg)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {insp.needsAttention && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Inspection needed</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        <span>{reg.scaRegoNo || reg.interimRegoNo || reg.registrationId}</span>
                      </div>
                    </TableCell>
                    <TableCell>{reg.craftMake} {reg.craftModel}</TableCell>
                    <TableCell>{getPrimaryOwnerName(reg.owners)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(reg.status)}>{reg.status || "N/A"}</Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="inline-flex items-center">
                              <Badge
                                variant={insp.variant}
                                className={cn("gap-1 py-0.5 px-2 text-xs font-medium cursor-default", insp.className)}
                              >
                                {insp.icon}
                                <span>{insp.label}</span>
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          {insp.tooltip && (
                            <TooltipContent>
                              <p>{insp.tooltip}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
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

                          {insp.needsAttention && (isAdmin || isRegistrar || isSupervisor || isInspector) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/inspections/new?registrationId=${reg.registrationId}`}
                                  className="cursor-pointer flex items-center text-amber-700 dark:text-amber-400 font-medium"
                                >
                                  <ClipboardList className="mr-2 h-4 w-4" /> Schedule Inspection
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/inspections/conduct-new?registrationId=${reg.registrationId}`}
                                  className="cursor-pointer flex items-center text-emerald-700 dark:text-emerald-400 font-medium"
                                >
                                  <Play className="mr-2 h-4 w-4" /> Conduct Inspection
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}

                          {insp.inspectionId && (
                            <DropdownMenuItem asChild>
                              <Link
                                href={`/inspections/${insp.inspectionId}`}
                                className="cursor-pointer flex items-center"
                              >
                                <ShieldCheck className="mr-2 h-4 w-4" /> View Inspection
                              </Link>
                            </DropdownMenuItem>
                          )}
                          
                          {canEditRegistration(reg.status) && (
                            <DropdownMenuItem asChild>
                              <Link href={`/registrations/${reg.registrationId}/edit`} className="cursor-pointer flex items-center">
                                <Edit className="mr-2 h-4 w-4" /> Edit Registration
                              </Link>
                            </DropdownMenuItem>
                          )}

                          {(isAdmin || isRegistrar || isSupervisor) && ["Approved", "Expired"].includes(reg.status) && (
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
                  );
                }) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {!isLoading && registrations.length === 0 && !fetchError ? "No registrations found." : ""}
                      {searchTerm && !isLoading && filteredRegistrations.length === 0 && registrations.length > 0 ? "No registrations match your search." : ""}
                      {searchParams.get('status') && !isLoading && filteredRegistrations.length === 0 && "No registrations match the current filter."}
                      {inspectionFilter !== "all" && !isLoading && filteredRegistrations.length === 0 && "No registrations match the inspection filter."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {!isLoading && !fetchError && filteredRegistrations.length > 0 && (
          <CardFooter className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t p-4">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 text-sm text-muted-foreground w-full sm:w-auto text-center sm:text-left">
              <span>
                Showing <span className="font-medium text-foreground">{startIndex}</span> to{" "}
                <span className="font-medium text-foreground">{endIndex}</span> of{" "}
                <span className="font-medium text-foreground">{totalCount}</span> registrations
                {registrations.length > filteredRegistrations.length && (
                  <span className="ml-1 text-xs text-muted-foreground/80">
                    (filtered from {registrations.length} total)
                  </span>
                )}
              </span>

              <div className="flex items-center gap-2 justify-center">
                <span className="text-xs">Per page:</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(val) => setItemsPerPage(Number(val))}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue placeholder={String(itemsPerPage)} />
                  </SelectTrigger>
                  <SelectContent side="top">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-1 sm:space-x-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage <= 1}
                title="First page"
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage <= 1}
                title="Previous page"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              {/* Page numbers for desktop */}
              <div className="hidden md:flex items-center space-x-1">
                {getPageNumbers().map((page, index) =>
                  page === "ellipsis" ? (
                    <span
                      key={`ellipsis-${index}`}
                      className="px-2 py-1 text-sm text-muted-foreground select-none"
                    >
                      ...
                    </span>
                  ) : (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="icon"
                      className="h-8 w-8 text-xs"
                      onClick={() => setCurrentPage(page as number)}
                    >
                      {page}
                    </Button>
                  )
                )}
              </div>

              {/* Compact page indicator for mobile */}
              <span className="md:hidden text-xs text-muted-foreground px-2">
                Page {currentPage} of {totalPages}
              </span>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                title="Next page"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 hidden sm:inline-flex"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage >= totalPages}
                title="Last page"
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
