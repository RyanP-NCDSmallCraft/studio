
// src/actions/registrations.ts
'use server';

import { collection, getDocs, addDoc, Timestamp, doc, type DocumentReference } from 'firebase/firestore';
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
        dob: ensureSerializableDate(ownerData.dob) as Date,
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
        uploadedAt: ensureSerializableDate(docData.uploadedAt) as Date,
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
        lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt) as Date,
        createdByRef: (data.createdByRef as DocumentReference<User>)?.id,
        createdAt: ensureSerializableDate(data.createdAt) as Date,
      } as Registration;
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

// Data structure client sends to the server action for creating a registration
interface ClientRegistrationFormData extends Omit<Registration,
  'registrationId' | // Will be generated by Firestore
  'createdAt' | 'lastUpdatedAt' | // Will be set by server action
  'createdByRef' | 'lastUpdatedByRef' | // Will be set by server action using currentUserId
  'dob' | 'paymentDate' | 'uploadedAt' | // These are handled within nested structures
  'owners' | 'proofOfOwnershipDocs' | // These have specific typing below
  'scaRegoNo' | 'interimRegoNo' | 'approvedAt' | 'effectiveDate' | 'expiryDate' | // Not set on creation
  'certificateGeneratedAt' | 'certificateFileName' | 'certificateFileUrl' // Not set on creation
> {
  owners: Array<Omit<Owner, 'dob'> & { dob: Date | string }>; // Client sends JS Date or date string
  proofOfOwnershipDocs: Array<Omit<ProofOfOwnershipDoc, 'uploadedAt'> & { uploadedAt: Date | string | Timestamp }>; // Client sends JS Date/string or Timestamp
  paymentDate?: Date | string; // Client sends JS Date or date string
}

export async function createRegistration(
  clientData: ClientRegistrationFormData,
  currentUserId: string
): Promise<{ success: boolean; registrationId?: string; error?: string }> {
  if (!currentUserId) {
    return { success: false, error: "User not authenticated. Cannot create registration." };
  }

  try {
    // Prepare the data for Firestore, ensuring all date/time fields are Timestamps
    // and references are DocumentReference objects.
    const registrationToCreate: Omit<Registration, 'registrationId'> = {
      // Spread all fields from clientData that are direct properties of Registration
      registrationType: clientData.registrationType,
      previousScaRegoNo: clientData.previousScaRegoNo,
      status: clientData.status, // This will be "Draft" or "Submitted"
      paymentMethod: clientData.paymentMethod,
      paymentReceiptNumber: clientData.paymentReceiptNumber,
      bankStampRef: clientData.bankStampRef,
      paymentAmount: clientData.paymentAmount,
      safetyCertNumber: clientData.safetyCertNumber,
      safetyEquipIssued: clientData.safetyEquipIssued,
      safetyEquipReceiptNumber: clientData.safetyEquipReceiptNumber,
      craftMake: clientData.craftMake,
      craftModel: clientData.craftModel,
      craftYear: clientData.craftYear,
      craftColor: clientData.craftColor,
      hullIdNumber: clientData.hullIdNumber,
      craftLength: clientData.craftLength,
      lengthUnits: clientData.lengthUnits,
      distinguishingFeatures: clientData.distinguishingFeatures,
      propulsionType: clientData.propulsionType,
      propulsionOtherDesc: clientData.propulsionOtherDesc,
      hullMaterial: clientData.hullMaterial,
      hullMaterialOtherDesc: clientData.hullMaterialOtherDesc,
      craftUse: clientData.craftUse,
      craftUseOtherDesc: clientData.craftUseOtherDesc,
      fuelType: clientData.fuelType,
      fuelTypeOtherDesc: clientData.fuelTypeOtherDesc,
      vesselType: clientData.vesselType,
      vesselTypeOtherDesc: clientData.vesselTypeOtherDesc,
      engineHorsepower: clientData.engineHorsepower,
      engineMake: clientData.engineMake,
      engineSerialNumbers: clientData.engineSerialNumbers,

      // Convert nested dates to Timestamps
      owners: clientData.owners.map(owner => ({
        ...owner,
        dob: Timestamp.fromDate(new Date(owner.dob)),
      })),
      proofOfOwnershipDocs: clientData.proofOfOwnershipDocs.map(docEntry => ({
        ...docEntry,
        uploadedAt: docEntry.uploadedAt instanceof Timestamp 
                      ? docEntry.uploadedAt 
                      : Timestamp.fromDate(new Date(docEntry.uploadedAt)),
      })),
      paymentDate: clientData.paymentDate ? Timestamp.fromDate(new Date(clientData.paymentDate)) : undefined,
      
      // Server-set fields
      createdByRef: doc(db, "users", currentUserId) as DocumentReference<User>,
      lastUpdatedByRef: doc(db, "users", currentUserId) as DocumentReference<User>,
      createdAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),

      // Fields not set at initial creation
      scaRegoNo: undefined,
      interimRegoNo: undefined,
      submittedAt: clientData.status === "Submitted" ? Timestamp.now() : undefined, // Set submittedAt if status is Submitted
      approvedAt: undefined,
      effectiveDate: undefined,
      expiryDate: undefined,
      certificateGeneratedAt: undefined,
      certificateFileName: undefined,
      certificateFileUrl: undefined,
    };

    const registrationsCol = collection(db, "registrations");
    const docRef = await addDoc(registrationsCol, registrationToCreate);
    
    return { success: true, registrationId: docRef.id };
  } catch (error: any) {
    console.error("Error creating registration in Server Action:", error);
    const originalErrorMessage = error.message || "Unknown Firebase error";
    const originalErrorCode = error.code || "N/A";
    return {
      success: false,
      error: `Failed to create registration on server. Original error: [${originalErrorCode}] ${originalErrorMessage}`,
    };
  }
}
