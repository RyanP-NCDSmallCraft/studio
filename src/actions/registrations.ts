
// src/actions/registrations.ts
'use server';

import { collection, getDocs, Timestamp, doc, type DocumentReference, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration, Owner, ProofOfOwnershipDoc, User, EngineDetail } from '@/types';

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
        dob: ensureSerializableDate(ownerData.dob),
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
        uploadedAt: ensureSerializableDate(docData.uploadedAt),
      });

      const mapEngineDetail = (engineData: any): EngineDetail => ({
        engineId: engineData.engineId || crypto.randomUUID(),
        make: engineData.make,
        horsepower: engineData.horsepower,
        serialNumber: engineData.serialNumber,
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
        craftMake: data.craftMake || "",
        craftModel: data.craftModel || "",
        craftYear: data.craftYear || new Date().getFullYear(),
        craftColor: data.craftColor || "",
        hullIdNumber: data.hullIdNumber || "",
        craftLength: data.craftLength || 0,
        lengthUnits: data.lengthUnits || 'm',
        passengerCapacity: data.passengerCapacity,
        distinguishingFeatures: data.distinguishingFeatures,
        craftImageUrl: data.craftImageUrl,
        engines: Array.isArray(data.engines) ? data.engines.map(mapEngineDetail) : [],
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
        certificateGeneratedAt: ensureSerializableDate(data.certificateGeneratedAt),
        certificateFileName: data.certificateFileName,
        certificateFileUrl: data.certificateFileUrl,
        lastUpdatedByRef: (data.lastUpdatedByRef instanceof DocumentReference) ? data.lastUpdatedByRef.id : data.lastUpdatedByRef,
        lastUpdatedAt: ensureSerializableDate(data.lastUpdatedAt),
        createdByRef: (data.createdByRef instanceof DocumentReference) ? data.createdByRef.id : data.createdByRef,
        createdAt: ensureSerializableDate(data.createdAt),
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


export interface RegistrationImportData {
  registrationType: "New" | "Renewal";
  previousScaRegoNo?: string;
  craftMake: string;
  craftModel: string;
  craftYear: string; // Expect string from CSV, convert to number
  craftColor: string;
  hullIdNumber: string;
  craftLength: string; // Expect string from CSV, convert to number
  lengthUnits: "m" | "ft";
  passengerCapacity?: string; // Expect string from CSV, convert to number
  distinguishingFeatures?: string;
  propulsionType: "Inboard" | "Outboard" | "Both" | "Sail" | "Other";
  propulsionOtherDesc?: string;
  hullMaterial: "Wood" | "Fiberglass" | "Metal" | "Inflatable" | "Other";
  hullMaterialOtherDesc?: string;
  craftUse: "Pleasure" | "Passenger" | "Fishing" | "Cargo" | "Mixed Use" | "Other";
  craftUseOtherDesc?: string;
  fuelType: "Electric" | "Petrol" | "Diesel" | "Other";
  fuelTypeOtherDesc?: string;
  vesselType: "OpenBoat" | "CabinCruiser" | "Sailboat" | "PWC" | "Other";
  vesselTypeOtherDesc?: string;
  engine1_make?: string;
  engine1_horsepower?: string; // Expect string from CSV, convert to number
  engine1_serialNumber?: string;
  engine2_make?: string;
  engine2_horsepower?: string; // Expect string from CSV, convert to number
  engine2_serialNumber?: string;
  owner1_role: "Primary" | "CoOwner";
  owner1_surname: string;
  owner1_firstName: string;
  owner1_dob: string; // Expect YYYY-MM-DD string
  owner1_sex: "Male" | "Female" | "Other";
  owner1_phone: string;
  owner1_email?: string;
  owner1_postalAddress: string;
  owner1_townDistrict: string;
  owner1_llg: string;
  owner1_wardVillage: string;
  owner2_role?: "CoOwner";
  owner2_surname?: string;
  owner2_firstName?: string;
  owner2_dob?: string; // Expect YYYY-MM-DD string
  owner2_sex?: "Male" | "Female" | "Other";
  owner2_phone?: string;
  owner2_email?: string;
  owner2_postalAddress?: string;
  owner2_townDistrict?: string;
  owner2_llg?: string;
  owner2_wardVillage?: string;
}

export async function importRegistrations_serverAction(
  records: RegistrationImportData[],
  currentUserId: string // Assuming you pass this from a client component with auth
): Promise<{ success: boolean; message: string; details?: { successful: number; failed: number; errors: string[] } }> {
  if (!currentUserId) {
    return { success: false, message: "User not authenticated for import." };
  }
  if (!records || records.length === 0) {
    return { success: false, message: "No records provided for import." };
  }

  const createdByRef = doc(db, "users", currentUserId) as DocumentReference<User>;
  const registrationsCol = collection(db, "registrations");
  let successfulCount = 0;
  let failedCount = 0;
  const errorMessages: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    try {
      const owners: Owner[] = [];
      // Owner 1 (mandatory)
      if (record.owner1_surname && record.owner1_firstName && record.owner1_dob && record.owner1_phone) {
        owners.push({
          ownerId: crypto.randomUUID(),
          role: record.owner1_role || "Primary",
          surname: record.owner1_surname,
          firstName: record.owner1_firstName,
          dob: Timestamp.fromDate(new Date(record.owner1_dob)),
          sex: record.owner1_sex || "Male",
          phone: record.owner1_phone,
          email: record.owner1_email ?? "", // Default to empty string
          postalAddress: record.owner1_postalAddress || "",
          townDistrict: record.owner1_townDistrict || "",
          llg: record.owner1_llg || "",
          wardVillage: record.owner1_wardVillage || "",
        });
      } else {
        throw new Error(`Row ${i + 1}: Missing required fields for Owner 1.`);
      }

      // Owner 2 (optional)
      if (record.owner2_surname && record.owner2_firstName && record.owner2_dob && record.owner2_phone) {
        owners.push({
          ownerId: crypto.randomUUID(),
          role: record.owner2_role || "CoOwner",
          surname: record.owner2_surname,
          firstName: record.owner2_firstName,
          dob: Timestamp.fromDate(new Date(record.owner2_dob)),
          sex: record.owner2_sex || "Male",
          phone: record.owner2_phone,
          email: record.owner2_email ?? "", // Default to empty string
          postalAddress: record.owner2_postalAddress ?? "",
          townDistrict: record.owner2_townDistrict ?? "",
          llg: record.owner2_llg ?? "",
          wardVillage: record.owner2_wardVillage ?? "",
        });
      }
      
      const engines: EngineDetail[] = [];
      if (record.engine1_make || record.engine1_horsepower || record.engine1_serialNumber) {
        engines.push({
          engineId: crypto.randomUUID(),
          make: record.engine1_make ?? "",
          horsepower: record.engine1_horsepower ? parseInt(record.engine1_horsepower, 10) : undefined,
          serialNumber: record.engine1_serialNumber ?? "",
        });
      }
      if (record.engine2_make || record.engine2_horsepower || record.engine2_serialNumber) {
         engines.push({
          engineId: crypto.randomUUID(),
          make: record.engine2_make ?? "",
          horsepower: record.engine2_horsepower ? parseInt(record.engine2_horsepower, 10) : undefined,
          serialNumber: record.engine2_serialNumber ?? "",
        });
      }


      const registrationDoc: Omit<Registration, "registrationId"> = {
        registrationType: record.registrationType || "New",
        previousScaRegoNo: record.previousScaRegoNo ?? "",
        status: "Draft", // Default status for imported records
        owners,
        proofOfOwnershipDocs: [], // Not handled in this CSV import
        craftMake: record.craftMake || "",
        craftModel: record.craftModel || "",
        craftYear: record.craftYear ? parseInt(record.craftYear, 10) : new Date().getFullYear(),
        craftColor: record.craftColor || "",
        hullIdNumber: record.hullIdNumber || "",
        craftLength: record.craftLength ? parseFloat(record.craftLength) : 0,
        lengthUnits: record.lengthUnits || "m",
        passengerCapacity: record.passengerCapacity ? parseInt(record.passengerCapacity, 10) : undefined,
        distinguishingFeatures: record.distinguishingFeatures ?? "",
        engines,
        propulsionType: record.propulsionType || "Outboard",
        propulsionOtherDesc: record.propulsionOtherDesc ?? "",
        hullMaterial: record.hullMaterial || "Fiberglass",
        hullMaterialOtherDesc: record.hullMaterialOtherDesc ?? "",
        craftUse: record.craftUse || "Pleasure",
        craftUseOtherDesc: record.craftUseOtherDesc ?? "",
        fuelType: record.fuelType || "Petrol",
        fuelTypeOtherDesc: record.fuelTypeOtherDesc ?? "",
        vesselType: record.vesselType || "OpenBoat",
        vesselTypeOtherDesc: record.vesselTypeOtherDesc ?? "",
        createdAt: Timestamp.now(),
        createdByRef: createdByRef,
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: createdByRef,
      };

      await addDoc(registrationsCol, registrationDoc);
      successfulCount++;
    } catch (error: any) {
      failedCount++;
      let errorMessage = `Row ${i + 2}: ${error.message || "Unknown error during import."}`;
      if (error.code === 'permission-denied') {
          errorMessage = `Row ${i + 2}: Firestore permission denied. This usually means the server action's request to Firestore was not recognized as an authenticated active user with the necessary role. Original: ${error.message}`;
      }
      errorMessages.push(errorMessage);
      console.error(`Error importing record at row ${i + 2}:`, error, record);
    }
  }

  const message = `Import complete. Successfully imported: ${successfulCount}. Failed: ${failedCount}.`;
  return {
    success: failedCount === 0,
    message,
    details: { successful: successfulCount, failed: failedCount, errors: errorMessages },
  };
}
    
