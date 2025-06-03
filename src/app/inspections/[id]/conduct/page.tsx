
"use client";
import { InspectionForm } from "@/components/inspections/InspectionForm";
import type { Inspection, Registration, User } from "@/types";
import { ClipboardList, Play, ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect, useCallback } from "react";
import { doc, getDoc, Timestamp, DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from "@/hooks/useAuth";
import { isValid } from "date-fns";

// Helper function to safely convert Firestore Timestamps or other date forms to JS Date objects
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
      console.warn('ConductInspectionPage: Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (isValid(parsedDate)) {
      return parsedDate;
    }
  }
  console.warn(`ConductInspectionPage: Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};


export default function ConductInspectionPage() {
  const params = useParams();
  const router = useRouter();
  const inspectionId = params.id as string;
  const { currentUser } = useAuth();

  const [existingInspection, setExistingInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInspectionDetails = useCallback(async () => {
    if (!inspectionId) {
      setError("Inspection ID is missing.");
      setLoading(false);
      return;
    }
    if (!currentUser) {
      setError("User not authenticated.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const inspectionDocRef = doc(db, "inspections", inspectionId);
      const inspectionSnap = await getDoc(inspectionDocRef);

      if (inspectionSnap.exists()) {
        const data = inspectionSnap.data();
        
        let registrationData: Inspection['registrationData'] = undefined;
        if (data.registrationRef) {
          try {
            let regRefPath: string;
            if (data.registrationRef instanceof DocumentReference) {
              regRefPath = data.registrationRef.path;
            } else if (typeof data.registrationRef === 'string') {
              regRefPath = data.registrationRef.startsWith('registrations/') ? data.registrationRef : `registrations/${data.registrationRef}`;
            } else if (data.registrationRef.id && typeof data.registrationRef.id === 'string') {
                regRefPath = `registrations/${data.registrationRef.id}`;
            } else {
              throw new Error("Malformed registrationRef in inspection document.");
            }
            
            const regDocSnap = await getDoc(doc(db, regRefPath));
            if (regDocSnap.exists()) {
              const regData = regDocSnap.data() as Registration;
              registrationData = {
                id: regDocSnap.id,
                scaRegoNo: regData.scaRegoNo,
                hullIdNumber: regData.hullIdNumber,
                craftType: regData.vesselType,
                craftMake: regData.craftMake,
                craftModel: regData.craftModel,
              };
            }
          } catch (regError) {
            console.warn("Failed to fetch linked registration:", regError);
          }
        }

        let inspectorData: Inspection['inspectorData'] = undefined;
        if (data.inspectorRef) {
          try {
            let inspRefPath: string;
            if (data.inspectorRef instanceof DocumentReference) {
                inspRefPath = data.inspectorRef.path;
            } else if (typeof data.inspectorRef === 'string') {
                inspRefPath = data.inspectorRef.startsWith('users/') ? data.inspectorRef : `users/${data.inspectorRef}`;
            } else if (data.inspectorRef.id && typeof data.inspectorRef.id === 'string') {
                inspRefPath = `users/${data.inspectorRef.id}`;
            } else {
                throw new Error("Malformed inspectorRef in inspection document.");
            }
            const inspectorDocSnap = await getDoc(doc(db, inspRefPath));
            if (inspectorDocSnap.exists()) {
              const inspData = inspectorDocSnap.data() as User;
              inspectorData = {
                id: inspectorDocSnap.id,
                displayName: inspData.displayName || inspData.email,
              };
            }
          } catch (inspError) {
            console.warn("Failed to fetch linked inspector:", inspError);
          }
        }
        
        const getRefId = (refField: any): string | undefined => {
            if (refField instanceof DocumentReference) return refField.id;
            if (typeof refField === 'string') return refField;
            if (refField && typeof refField.id === 'string') return refField.id;
            return undefined;
        };

        const fetchedInspection: Inspection = {
          inspectionId: inspectionSnap.id,
          registrationRef: getRefId(data.registrationRef) || data.registrationRef?.path,
          registrationData,
          inspectorRef: getRefId(data.inspectorRef) || data.inspectorRef?.path,
          inspectorData,
          inspectionType: data.inspectionType || 'Initial',
          scheduledDate: ensureSerializableDate(data.scheduledDate) as Date,
          inspectionDate: ensureSerializableDate(data.inspectionDate),
          status: data.status || 'Scheduled',
          overallResult: data.overallResult,
          findings: data.findings,
          correctiveActions: data.correctiveActions,
          followUpRequired: data.followUpRequired || false,
          checklistItems: data.checklistItems || [],
          completedAt: ensureSerializableDate(data.completedAt),
          reviewedAt: ensureSerializableDate(data.reviewedAt),
          reviewedByRef: getRefId(data.reviewedByRef) || data.reviewedByRef?.path,
          createdAt: ensureSerializableDate(data.createdAt) as Date,
          createdByRef: getRefId(data.createdByRef) || data.createdByRef?.path,
          lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
          lastUpdatedByRef: getRefId(data.lastUpdatedByRef) || data.lastUpdatedByRef?.path,
        };
        setExistingInspection(fetchedInspection);
      } else {
        setError("Inspection not found.");
      }
    } catch (err: any) {
      console.error("Error fetching inspection details for conduct page:", err);
      setError(err.message || "Failed to load inspection data.");
    } finally {
      setLoading(false);
    }
  }, [inspectionId, currentUser]);

  useEffect(() => {
    if (currentUser !== undefined) {
        fetchInspectionDetails();
    }
  }, [inspectionId, currentUser, fetchInspectionDetails]);

  const pageTitle = "Conduct Craft Inspection";
  const Icon = existingInspection?.status === "Scheduled" ? Play : ClipboardList;

  if (loading) {
    return (
      <div className="flex h-64 justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading inspection data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-10 w-10 text-destructive mb-2" />
        <p className="text-destructive text-lg">{error}</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">Go Back</Button>
      </div>
    );
  }

  if (!existingInspection && !loading) {
    return (
      <div className="text-center py-10 text-muted-foreground">
        <p>Inspection details could not be loaded.</p>
        <Button onClick={() => router.back()} className="mt-4" variant="outline">Go Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
         <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
        </Button>
        <Icon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">{pageTitle}</h1>
      </div>
      <InspectionForm
        mode="edit"
        usageContext="conduct"
        inspectionId={inspectionId}
        existingInspectionData={existingInspection}
      />
    </div>
  );
}
