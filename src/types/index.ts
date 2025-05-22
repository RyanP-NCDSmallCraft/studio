
import type { Timestamp, DocumentReference } from "firebase/firestore";

export interface User {
  userId: string;
  email: string;
  displayName?: string;
  role: "Admin" | "Registrar" | "Inspector" | "Supervisor" | "ReadOnly";
  createdAt: Timestamp;
  isActive: boolean;
}

export interface Owner {
  ownerId: string;
  role: "Primary" | "CoOwner";
  surname: string;
  firstName: string;
  dob: Timestamp;
  sex: "Male" | "Female" | "Other";
  phone: string;
  fax?: string;
  email?: string;
  postalAddress: string;
  townDistrict: string;
  llg: string; // Local Level Government
  wardVillage: string;
}

export interface ProofOfOwnershipDoc {
  docId: string;
  description: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Timestamp;
}

export interface Registration {
  registrationId: string;
  scaRegoNo?: string;
  interimRegoNo?: string;
  registrationType: "New" | "Renewal";
  previousScaRegoNo?: string;
  status: "Draft" | "Submitted" | "PendingReview" | "Approved" | "Rejected" | "Expired" | "RequiresInfo";
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  effectiveDate?: Timestamp;
  expiryDate?: Timestamp;
  provinceOfRegistration?: string;
  paymentMethod?: "Cash" | "Card" | "BankDeposit";
  paymentReceiptNumber?: string;
  bankStampRef?: string;
  paymentAmount?: number;
  paymentDate?: Timestamp;
  safetyCertNumber?: string;
  safetyEquipIssued?: boolean;
  safetyEquipReceiptNumber?: string;
  owners: Owner[];
  proofOfOwnershipDocs: ProofOfOwnershipDoc[];
  craftMake: string;
  craftModel: string;
  craftYear: number;
  craftColor: string;
  hullIdNumber: string;
  craftLength: number;
  lengthUnits: "m" | "ft";
  distinguishingFeatures?: string;
  propulsionType: "Inboard" | "Outboard" | "Both" | "Sail" | "Other";
  propulsionOtherDesc?: string;
  hullMaterial: "Wood" | "Fiberglass" | "Metal" | "Inflatable" | "Other";
  hullMaterialOtherDesc?: string;
  craftUse: "Pleasure" | "Passenger" | "Fishing" | "Cargo" | "Other";
  craftUseOtherDesc?: string;
  fuelType: "Electric" | "Petrol" | "Diesel" | "Other"; // Changed Gasoline to Petrol
  fuelTypeOtherDesc?: string;
  vesselType: "OpenBoat" | "CabinCruiser" | "Sailboat" | "PWC" | "Other"; // Personal Water Craft
  vesselTypeOtherDesc?: string;
  certificateGeneratedAt?: Timestamp;
  certificateFileName?: string;
  certificateFileUrl?: string;
  lastUpdatedByRef?: DocumentReference<User>;
  lastUpdatedAt: Timestamp;
  createdByRef: DocumentReference<User>;
  createdAt: Timestamp;
}

export interface ChecklistItemResult {
  itemId: string;
  itemDescription: string;
  result: "Pass" | "Fail" | "N/A";
  comments?: string;
  evidenceUrls?: string[];
}

export interface Inspection {
  inspectionId: string;
  registrationRef: DocumentReference<Registration>;
  inspectorRef?: DocumentReference<User>;
  inspectionType: "Initial" | "Annual" | "Compliance" | "FollowUp";
  scheduledDate?: Timestamp;
  inspectionDate?: Timestamp;
  status: "Scheduled" | "InProgress" | "Completed" | "Passed" | "Failed" | "PendingReview" | "Cancelled";
  overallResult?: "Pass" | "Fail" | "N/A";
  findings: string; // General comments/summary
  correctiveActions?: string;
  followUpRequired: boolean;
  checklistItems: ChecklistItemResult[];
  completedAt?: Timestamp;
  createdAt: Timestamp;
  createdByRef: DocumentReference<User>;
}

export interface ChecklistTemplateItem {
  itemId: string;
  itemDescription: string;
  category?: string;
  order: number;
}

export interface ChecklistTemplate {
  templateId: string;
  name: string;
  inspectionType: "Initial" | "Annual" | "Compliance" | "FollowUp";
  items: ChecklistTemplateItem[];
  isActive: boolean;
  createdAt: Timestamp;
  createdByRef: DocumentReference<User>;
}

// For GenAI flow
export type { SuggestChecklistItemsInput, SuggestChecklistItemsOutput } from '@/ai/flows/suggest-checklist-items';
