
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

// Data structure client sends to the server action for creating a registration
interface ClientRegistrationFormData extends Omit<Registration,
  'registrationId' | // Will be generated by Firestore
  'createdAt' | 'lastUpdatedAt' | // Will be set by server action
  'createdByRef' | 'lastUpdatedByRef' | // Will be set by server action using currentUserId
  'dob' | 'paymentDate' | 'uploadedAt' | // These are handled within nested structures or converted
  'owners' | 'proofOfOwnershipDocs' | // These have specific typing below
  'scaRegoNo' | 'interimRegoNo' | 'approvedAt' | 'effectiveDate' | 'expiryDate' | // Not set on creation
  'certificateGeneratedAt' | 'certificateFileName' | 'certificateFileUrl' // Not set on creation
> {
  owners: Array<Omit<Owner, 'dob'> & { dob: Date | string }>; 
  proofOfOwnershipDocs: Array<Omit<ProofOfOwnershipDoc, 'uploadedAt'> & { uploadedAt: Date | string | Timestamp }>; 
  paymentDate?: Date | string; 
}

export async function createRegistration(
  clientData: ClientRegistrationFormData,
  currentUserId: string
): Promise<{ success: boolean; registrationId?: string; error?: string }> {
  if (!currentUserId) {
    return { success: false, error: "User not authenticated. Cannot create registration." };
  }

  try {
    // Construct the object for Firestore, only including fields that have defined values
    // or are server-generated.
    const registrationDataForFirestore: { [key: string]: any } = {
      registrationType: clientData.registrationType,
      status: clientData.status, // "Draft" or "Submitted"
      owners: clientData.owners.map(owner => ({
        ...owner,
        dob: Timestamp.fromDate(new Date(owner.dob as string | Date)),
      })),
      proofOfOwnershipDocs: clientData.proofOfOwnershipDocs.map(docEntry => ({
        ...docEntry,
        uploadedAt: docEntry.uploadedAt instanceof Timestamp 
                      ? docEntry.uploadedAt 
                      : Timestamp.fromDate(new Date(docEntry.uploadedAt as string | Date)),
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
      safetyEquipIssued: clientData.safetyEquipIssued || false, // Default if undefined

      // Server-set fields
      createdByRef: doc(db, "users", currentUserId) as DocumentReference<User>,
      lastUpdatedByRef: doc(db, "users", currentUserId) as DocumentReference<User>,
      createdAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    };

    // Conditionally add optional fields from clientData if they are defined (not undefined)
    // Empty strings are considered defined and will be written. Null would also be written.
    // Undefined will cause the field to be omitted.
    if (clientData.previousScaRegoNo !== undefined) registrationDataForFirestore.previousScaRegoNo = clientData.previousScaRegoNo;
    if (clientData.paymentMethod !== undefined) registrationDataForFirestore.paymentMethod = clientData.paymentMethod;
    if (clientData.paymentReceiptNumber !== undefined) registrationDataForFirestore.paymentReceiptNumber = clientData.paymentReceiptNumber;
    if (clientData.bankStampRef !== undefined) registrationDataForFirestore.bankStampRef = clientData.bankStampRef;
    if (clientData.paymentAmount !== undefined) registrationDataForFirestore.paymentAmount = clientData.paymentAmount;
    if (clientData.paymentDate !== undefined && clientData.paymentDate !== null) { // check for null as well
      registrationDataForFirestore.paymentDate = Timestamp.fromDate(new Date(clientData.paymentDate as string | Date));
    }
    if (clientData.safetyCertNumber !== undefined) registrationDataForFirestore.safetyCertNumber = clientData.safetyCertNumber;
    if (clientData.safetyEquipReceiptNumber !== undefined) registrationDataForFirestore.safetyEquipReceiptNumber = clientData.safetyEquipReceiptNumber;
    if (clientData.distinguishingFeatures !== undefined) registrationDataForFirestore.distinguishingFeatures = clientData.distinguishingFeatures;
    
    if (clientData.propulsionOtherDesc !== undefined) registrationDataForFirestore.propulsionOtherDesc = clientData.propulsionOtherDesc;
    if (clientData.hullMaterialOtherDesc !== undefined) registrationDataForFirestore.hullMaterialOtherDesc = clientData.hullMaterialOtherDesc;
    if (clientData.craftUseOtherDesc !== undefined) registrationDataForFirestore.craftUseOtherDesc = clientData.craftUseOtherDesc;
    if (clientData.fuelTypeOtherDesc !== undefined) registrationDataForFirestore.fuelTypeOtherDesc = clientData.fuelTypeOtherDesc;
    if (clientData.vesselTypeOtherDesc !== undefined) registrationDataForFirestore.vesselTypeOtherDesc = clientData.vesselTypeOtherDesc;
    
    if (clientData.engineHorsepower !== undefined) registrationDataForFirestore.engineHorsepower = clientData.engineHorsepower;
    if (clientData.engineMake !== undefined) registrationDataForFirestore.engineMake = clientData.engineMake;
    if (clientData.engineSerialNumbers !== undefined) registrationDataForFirestore.engineSerialNumbers = clientData.engineSerialNumbers;

    // Conditionally set submittedAt
    if (clientData.status === "Submitted") {
      registrationDataForFirestore.submittedAt = Timestamp.now();
    }
    
    // Fields like scaRegoNo, interimRegoNo, approvedAt, effectiveDate, expiryDate,
    // certificateGeneratedAt, certificateFileName, certificateFileUrl are intentionally
    // OMITTED from registrationDataForFirestore as they are not set at this stage of creation.
    // Since they are optional in the Registration type, Firestore accepts their absence when adding a new document.

    const registrationsCol = collection(db, "registrations");
    const docRef = await addDoc(registrationsCol, registrationDataForFirestore);
    
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
