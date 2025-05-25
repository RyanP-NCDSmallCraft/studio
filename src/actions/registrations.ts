// src/actions/registrations.ts
'use server';

import { collection, getDocs, Timestamp, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration, Owner, ProofOfOwnershipDoc, User } from '@/types';

export async function getRegistrations(): Promise<Registration[]> {
  try {
    const registrationsCol = collection(db, "registrations");
    const registrationSnapshot = await getDocs(registrationsCol);

    const registrations = registrationSnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();

      // Helper to ensure a field is a Firestore Timestamp or convert it
      const ensureTimestamp = (field: any): Timestamp | undefined => {
        if (!field) return undefined;
        if (field instanceof Timestamp) return field;
        // If it's an object from Firestore that looks like a Timestamp (e.g., { seconds: ..., nanoseconds: ... })
        if (typeof field === 'object' && field !== null && typeof field.seconds === 'number' && typeof field.nanoseconds === 'number') {
          return new Timestamp(field.seconds, field.nanoseconds);
        }
        // If it's a JS Date object
        if (field instanceof Date) {
          return Timestamp.fromDate(field);
        }
        // If it's a string or number that can be parsed into a Date
        const date = new Date(field);
        if (!isNaN(date.getTime())) {
          return Timestamp.fromDate(date);
        }
        console.warn(`Could not convert field to Timestamp:`, field);
        return undefined;
      };

      const mapOwner = (ownerData: any): Owner => ({
        ownerId: ownerData.ownerId || '',
        role: ownerData.role || 'Primary',
        surname: ownerData.surname || '',
        firstName: ownerData.firstName || '',
        dob: ensureTimestamp(ownerData.dob) || Timestamp.now(), // Default if invalid
        sex: ownerData.sex || 'Male',
        phone: ownerData.phone || '',
        fax: ownerData.fax,
        email: ownerData.email,
        postalAddress: ownerData.postalAddress || '',
        townDistrict: ownerData.townDistrict || '',
        llg: ownerData.llg || '',
        wardVillage: ownerData.wardVillage || '',
      });

      return {
        registrationId: docSnapshot.id,
        scaRegoNo: data.scaRegoNo,
        interimRegoNo: data.interimRegoNo,
        registrationType: data.registrationType || 'New',
        previousScaRegoNo: data.previousScaRegoNo,
        status: data.status || 'Draft',
        submittedAt: ensureTimestamp(data.submittedAt),
        approvedAt: ensureTimestamp(data.approvedAt),
        effectiveDate: ensureTimestamp(data.effectiveDate),
        expiryDate: ensureTimestamp(data.expiryDate),
        paymentMethod: data.paymentMethod,
        paymentReceiptNumber: data.paymentReceiptNumber,
        bankStampRef: data.bankStampRef,
        paymentAmount: data.paymentAmount,
        paymentDate: ensureTimestamp(data.paymentDate),
        safetyCertNumber: data.safetyCertNumber,
        safetyEquipIssued: data.safetyEquipIssued || false,
        safetyEquipReceiptNumber: data.safetyEquipReceiptNumber,
        owners: Array.isArray(data.owners) ? data.owners.map(mapOwner) : [],
        proofOfOwnershipDocs: (data.proofOfOwnershipDocs || []).map((doc: any) => ({
            ...doc,
            uploadedAt: ensureTimestamp(doc.uploadedAt) || Timestamp.now()
        })) as ProofOfOwnershipDoc[],
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
        certificateGeneratedAt: ensureTimestamp(data.certificateGeneratedAt),
        certificateFileName: data.certificateFileName,
        certificateFileUrl: data.certificateFileUrl,
        lastUpdatedByRef: data.lastUpdatedByRef as DocumentReference<User> | undefined,
        lastUpdatedAt: ensureTimestamp(data.lastUpdatedAt) || Timestamp.now(),
        createdByRef: data.createdByRef as DocumentReference<User>, // Assuming this will exist
        createdAt: ensureTimestamp(data.createdAt) || Timestamp.now(),
      } as Registration;
    });
    return registrations;
  } catch (error) {
    console.error("Error fetching registrations in Server Action:", error);
    // Optionally, rethrow or return a specific error structure
    // For now, let's rethrow so the client can catch it
    throw new Error("Failed to fetch registrations from server.");
  }
}
