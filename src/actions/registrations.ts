
// src/actions/registrations.ts
'use server';

import { collection, getDocs, Timestamp, doc, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration, Owner, ProofOfOwnershipDoc, User } from '@/types';

// Helper function to safely convert a Firestore Timestamp, JS Date, or Firestore-like object to a JS Date object.
// Returns undefined if input is null/undefined or cannot be converted.
const ensureSerializableDate = (dateValue: any): Date | undefined => {
  if (!dateValue) return undefined;
  if (dateValue instanceof Timestamp) {
    return dateValue.toDate();
  }
  if (dateValue instanceof Date) {
    return dateValue; // Already a JS Date
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


export async function getRegistrations(): Promise<Registration[]> {
  try {
    const registrationsCol = collection(db, "registrations");
    const registrationSnapshot = await getDocs(registrationsCol);

    const registrations = registrationSnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();

      const mapOwner = (ownerData: any): Owner => ({
        ownerId: ownerData.ownerId || '',
        role: ownerData.role || 'Primary',
        surname: ownerData.surname || '',
        firstName: ownerData.firstName || '',
        dob: ensureSerializableDate(ownerData.dob), // Will be Date | undefined
        sex: ownerData.sex || 'Male',
        phone: ownerData.phone || '',
        fax: ownerData.fax,
        email: ownerData.email,
        postalAddress: ownerData.postalAddress || '',
        townDistrict: ownerData.townDistrict || '',
        llg: ownerData.llg || '',
        wardVillage: ownerData.wardVillage || '',
      });

      const mapProofDoc = (docData: any): ProofOfOwnershipDoc => ({
        docId: docData.docId || '',
        description: docData.description || '',
        fileName: docData.fileName || '',
        fileUrl: docData.fileUrl || '',
        uploadedAt: ensureSerializableDate(docData.uploadedAt), // Will be Date | undefined
      });

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
        lastUpdatedByRef: (data.lastUpdatedByRef as DocumentReference<User>)?.id, 
        lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
        createdByRef: (data.createdByRef as DocumentReference<User>)?.id,
        createdAt: ensureSerializableDate(data.createdAt),
      } as Registration; // Cast to Registration, understanding dates are now Date | undefined
    });
    return registrations;
  } catch (error: any) {
    const originalErrorMessage = error.message || "Unknown Firebase error";
    const originalErrorCode = error.code || "N/A";
    console.error(
      `Error fetching registrations in Server Action. Original Error Code: ${originalErrorCode}, Message: ${originalErrorMessage}`,
      error 
    );
    throw new Error(
      `Failed to fetch registrations from server. Original error: [${originalErrorCode}] ${originalErrorMessage}`
    );
  }
}

// The createRegistration Server Action is removed as the logic is now handled client-side
// in RegistrationForm.tsx for direct Firestore interaction with client auth context.
// If server-side creation is strictly needed in the future, it would require
// more robust authentication (e.g., ID token verification with Firebase Admin SDK).

/*
// This interface would be used if createRegistration was still a server action
interface ClientRegistrationFormData extends Omit<Registration,
  'registrationId' | // Will be generated by Firestore
  'createdAt' | 'lastUpdatedAt' | // Will be set by server action
  'createdByRef' | 'lastUpdatedByRef' | // Will be set by server action using currentUserId
  'owners' | 'proofOfOwnershipDocs' | // These have specific typing below for what client sends
  'scaRegoNo' | 'interimRegoNo' | 'approvedAt' | 'effectiveDate' | 'expiryDate' | // Not set on creation
  'certificateGeneratedAt' | 'certificateFileName' | 'certificateFileUrl' // Not set on creation
> {
  owners: Array<Omit<Owner, 'dob'> & { dob: Date | string }>; 
  proofOfOwnershipDocs: Array<Omit<ProofOfOwnershipDoc, 'uploadedAt'> & { uploadedAt: Date | string }>; 
  paymentDate?: Date | string; 
}

export async function createRegistration(
  clientData: ClientRegistrationFormData,
  currentUserId: string
): Promise<{ success: boolean; registrationId?: string; error?: string }> {
  if (!currentUserId) {
    return { success: false, error: "User not authenticated. Cannot create registration." };
  }
  console.log("Server Action createRegistration: Received clientData:", clientData);
  console.log("Server Action createRegistration: Current User ID:", currentUserId);


  try {
    const registrationDataForFirestore: { [key: string]: any } = {
      registrationType: clientData.registrationType,
      status: clientData.status, 
      owners: clientData.owners.map(owner => ({
        ...owner,
        // Ensure dob is a Firestore Timestamp
        dob: owner.dob instanceof Timestamp ? owner.dob : Timestamp.fromDate(new Date(owner.dob as string | Date)),
      })),
      proofOfOwnershipDocs: clientData.proofOfOwnershipDocs.map(docEntry => ({
        ...docEntry,
        // Ensure uploadedAt is a Firestore Timestamp
        uploadedAt: docEntry.uploadedAt instanceof Timestamp ? docEntry.uploadedAt : Timestamp.fromDate(new Date(docEntry.uploadedAt as string | Date)),
      })),
      craftMake: clientData.craftMake,
      craftModel: clientData.craftModel,
      craftYear: clientData.craftYear,
      craftColor: clientData.craftColor,
      hullIdNumber: clientData.hullIdNumber,
      craftLength: clientData.craftLength,
      lengthUnits: clientData.lengthUnits,
      propulsionType: clientData.propulsionType,
      hullMaterial: clientData.hullMaterial,
      craftUse: clientData.craftUse,
      fuelType: clientData.fuelType,
      vesselType: clientData.vesselType,
      safetyEquipIssued: clientData.safetyEquipIssued || false, 

      // --- Fields set by the server ---
      createdByRef: doc(db, "users", currentUserId) as DocumentReference<User>,
      lastUpdatedByRef: doc(db, "users", currentUserId) as DocumentReference<User>,
      createdAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    };

    // Conditionally add optional fields to avoid Firestore 'undefined' value errors
    if (clientData.previousScaRegoNo !== undefined) registrationDataForFirestore.previousScaRegoNo = clientData.previousScaRegoNo;
    if (clientData.paymentMethod !== undefined) registrationDataForFirestore.paymentMethod = clientData.paymentMethod;
    if (clientData.paymentReceiptNumber !== undefined) registrationDataForFirestore.paymentReceiptNumber = clientData.paymentReceiptNumber;
    if (clientData.bankStampRef !== undefined) registrationDataForFirestore.bankStampRef = clientData.bankStampRef;
    if (clientData.paymentAmount !== undefined && clientData.paymentAmount !== null) registrationDataForFirestore.paymentAmount = clientData.paymentAmount;
    
    if (clientData.paymentDate !== undefined && clientData.paymentDate !== null) { 
      registrationDataForFirestore.paymentDate = clientData.paymentDate instanceof Timestamp ? clientData.paymentDate : Timestamp.fromDate(new Date(clientData.paymentDate as string | Date));
    }
    if (clientData.safetyCertNumber !== undefined) registrationDataForFirestore.safetyCertNumber = clientData.safetyCertNumber;
    if (clientData.safetyEquipReceiptNumber !== undefined) registrationDataForFirestore.safetyEquipReceiptNumber = clientData.safetyEquipReceiptNumber;
    if (clientData.distinguishingFeatures !== undefined) registrationDataForFirestore.distinguishingFeatures = clientData.distinguishingFeatures;
    
    if (clientData.propulsionOtherDesc !== undefined) registrationDataForFirestore.propulsionOtherDesc = clientData.propulsionOtherDesc;
    if (clientData.hullMaterialOtherDesc !== undefined) registrationDataForFirestore.hullMaterialOtherDesc = clientData.hullMaterialOtherDesc;
    if (clientData.craftUseOtherDesc !== undefined) registrationDataForFirestore.craftUseOtherDesc = clientData.craftUseOtherDesc;
    if (clientData.fuelTypeOtherDesc !== undefined) registrationDataForFirestore.fuelTypeOtherDesc = clientData.fuelTypeOtherDesc;
    if (clientData.vesselTypeOtherDesc !== undefined) registrationDataForFirestore.vesselTypeOtherDesc = clientData.vesselTypeOtherDesc;
    
    if (clientData.engineHorsepower !== undefined && clientData.engineHorsepower !== null) registrationDataForFirestore.engineHorsepower = clientData.engineHorsepower;
    if (clientData.engineMake !== undefined) registrationDataForFirestore.engineMake = clientData.engineMake;
    if (clientData.engineSerialNumbers !== undefined) registrationDataForFirestore.engineSerialNumbers = clientData.engineSerialNumbers;

    if (clientData.status === "Submitted") {
      registrationDataForFirestore.submittedAt = Timestamp.now();
    }
    
    console.log("Server Action createRegistration: Data to be written to Firestore:", JSON.stringify(registrationDataForFirestore, null, 2));

    const registrationsCol = collection(db, "registrations");
    const docRef = await addDoc(registrationsCol, registrationDataForFirestore);
    
    console.log("Server Action createRegistration: Document written with ID:", docRef.id);
    return { success: true, registrationId: docRef.id };

  } catch (error: any) {
    console.error("Server Action createRegistration: Error creating registration:", error);
    const originalErrorMessage = error.message || "Unknown Firebase error";
    const originalErrorCode = error.code || "N/A";
    return {
      success: false,
      error: `Failed to create registration on server. Original error: [${originalErrorCode}] ${originalErrorMessage}`,
    };
  }
}
*/


    