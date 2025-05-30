
'use server';

import { collection, getDocs, doc, getDoc, Timestamp, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Inspection, Registration, User } from '@/types';

// Helper function to safely convert Firestore Timestamps or other date forms to JS Date objects
// This is crucial for ensuring data sent to client components is serializable.
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue; // Already a JS Date
  }
  // Handle Firestore-like {seconds, nanoseconds} objects if they come from somewhere else
  if (typeof dateValue === 'object' && dateValue !== null && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
    try {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    } catch (e) {
      console.warn('Failed to convert object to Timestamp then to Date:', dateValue, e);
      return undefined;
    }
  }
  // Handle ISO strings or numbers (timestamps)
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    const parsedDate = new Date(dateValue);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }
  console.warn(`Could not convert field to a serializable Date:`, dateValue);
  return undefined;
};

export async function getInspections(): Promise<Inspection[]> {
  try {
    const inspectionsCol = collection(db, "inspections");
    const inspectionSnapshot = await getDocs(inspectionsCol);

    const inspectionsPromises = inspectionSnapshot.docs.map(async (docSnapshot) => {
      const data = docSnapshot.data();

      let registrationData: Inspection['registrationData'] = undefined;
      if (data.registrationRef instanceof DocumentReference) {
        try {
          const regDocSnap = await getDoc(data.registrationRef as DocumentReference<Registration>);
          if (regDocSnap.exists()) {
            const regData = regDocSnap.data();
            registrationData = {
              id: regDocSnap.id,
              scaRegoNo: regData.scaRegoNo,
              hullIdNumber: regData.hullIdNumber,
              craftMake: regData.craftMake,
              craftModel: regData.craftModel,
              craftType: regData.vesselType, // Assuming vesselType maps to craftType for display
            };
          }
        } catch (regError) {
          console.warn(`Failed to fetch related registration ${data.registrationRef.id}:`, regError);
        }
      } else if (typeof data.registrationRef === 'string') { // Handle if it's already an ID string
        registrationData = { id: data.registrationRef }; // Minimal data
      }


      let inspectorData: Inspection['inspectorData'] = undefined;
      if (data.inspectorRef instanceof DocumentReference) {
         try {
          const inspectorDocSnap = await getDoc(data.inspectorRef as DocumentReference<User>);
          if (inspectorDocSnap.exists()) {
            const inspData = inspectorDocSnap.data();
            inspectorData = {
              id: inspectorDocSnap.id,
              displayName: inspData.displayName || inspData.email,
            };
          }
        } catch (inspError) {
          console.warn(`Failed to fetch related inspector ${data.inspectorRef.id}:`, inspError);
        }
      } else if (typeof data.inspectorRef === 'string') {
        inspectorData = { id: data.inspectorRef }; // Minimal data
      }


      return {
        inspectionId: docSnapshot.id,
        registrationRef: (data.registrationRef as DocumentReference<Registration>)?.id || data.registrationRef,
        registrationData,
        inspectorRef: (data.inspectorRef as DocumentReference<User>)?.id || data.inspectorRef,
        inspectorData,
        inspectionType: data.inspectionType || 'Initial',
        scheduledDate: ensureSerializableDate(data.scheduledDate),
        inspectionDate: ensureSerializableDate(data.inspectionDate),
        status: data.status || 'Scheduled',
        overallResult: data.overallResult,
        findings: data.findings,
        correctiveActions: data.correctiveActions,
        followUpRequired: data.followUpRequired || false,
        checklistItems: data.checklistItems || [],
        completedAt: ensureSerializableDate(data.completedAt),
        reviewedAt: ensureSerializableDate(data.reviewedAt),
        reviewedByRef: (data.reviewedByRef as DocumentReference<User>)?.id || data.reviewedByRef,
        createdAt: ensureSerializableDate(data.createdAt),
        createdByRef: (data.createdByRef as DocumentReference<User>)?.id || data.createdByRef,
        lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
        lastUpdatedByRef: (data.lastUpdatedByRef as DocumentReference<User>)?.id || data.lastUpdatedByRef,
      } as Inspection; // Cast, understanding dates are now Date | undefined
    });

    const inspections = await Promise.all(inspectionsPromises);
    return inspections.filter(inspection => inspection !== null) as Inspection[];

  } catch (error: any) {
    const originalErrorMessage = error.message || "Unknown Firebase error";
    const originalErrorCode = error.code || "N/A";
    console.error(
      `Error fetching inspections in Server Action. Original Error Code: ${originalErrorCode}, Message: ${originalErrorMessage}`,
      error
    );
    throw new Error(
      `Failed to fetch inspections from server. Original error: [${originalErrorCode}] ${originalErrorMessage}`
    );
  }
}
