
import type { Timestamp, DocumentReference } from "firebase/firestore";

export type UserRole = "Admin" | "Registrar" | "Inspector" | "Supervisor" | "ReadOnly";

export interface User {
  userId: string;
  email: string;
  displayName?: string;
  fullname?: string;
  role: UserRole;
  createdAt: Timestamp | Date | string;
  isActive: boolean;
  lastUpdatedAt?: Timestamp | Date | string;
}

export interface Owner {
  ownerId: string;
  role: "Primary" | "CoOwner";
  surname: string;
  firstName: string;
  dob: Timestamp | Date | string;
  sex: "Male" | "Female" | "Other";
  phone: string;
  fax?: string;
  email?: string;
  postalAddress: string;
  townDistrict: string;
  llg: string;
  wardVillage: string;
}

export interface ProofOfOwnershipDoc {
  docId: string;
  description: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Timestamp | Date | string;
}

export interface EngineDetail {
  engineId?: string; // Optional UUID for react key
  make?: string;
  horsepower?: number;
  serialNumber?: string;
}

export interface Registration {
  registrationId: string;
  scaRegoNo?: string;
  interimRegoNo?: string;
  registrationType: "New" | "Renewal";
  previousScaRegoNo?: string;
  status: "Draft" | "Submitted" | "PendingReview" | "Approved" | "Rejected" | "Expired" | "RequiresInfo" | "Suspended" | "Revoked";
  submittedAt?: Timestamp | Date | string;
  approvedAt?: Timestamp | Date | string;
  effectiveDate?: Timestamp | Date | string;
  expiryDate?: Timestamp | Date | string;
  paymentMethod?: "Cash" | "Card" | "BankDeposit";
  paymentReceiptNumber?: string;
  bankStampRef?: string;
  paymentAmount?: number;
  paymentDate?: Timestamp | Date | string;
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
  passengerCapacity?: number;
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
  craftImageUrl?: string; // Added for craft image

  engines?: EngineDetail[];

  certificateGeneratedAt?: Timestamp | Date | string;
  certificateFileName?: string;
  certificateFileUrl?: string;

  suspensionReason?: string;
  suspensionStartDate?: Timestamp | Date | string;
  suspensionEndDate?: Timestamp | Date | string;
  revocationReason?: string;
  revokedAt?: Timestamp | Date | string;

  lastUpdatedByRef: string | DocumentReference<User>;
  lastUpdatedAt: Timestamp | Date | string;
  createdByRef: string | DocumentReference<User>;
  createdAt: Timestamp | Date | string;
}

export interface ChecklistItemResult {
  itemId: string;
  itemDescription: string;
  result: "Yes" | "No" | "N/A";
  comments?: string;
  category?: string;
}

export interface Inspection {
  inspectionId: string;
  registrationRef: string | DocumentReference<Registration>;
  registrationData?: {
    id: string;
    scaRegoNo?: string;
    hullIdNumber?: string;
    craftType?: string;
    craftMake?: string;
    craftModel?: string;
    craftImageUrl?: string; // Added for craft image in inspection context
  };
  inspectorRef?: string | DocumentReference<User>;
  inspectorData?: {
    id: string;
    displayName?: string;
  };
  inspectionType: "Initial" | "Annual" | "Compliance" | "FollowUp";
  scheduledDate: Timestamp | Date | string;
  inspectionDate?: Timestamp | Date | string;
  status: "Scheduled" | "InProgress" | "PendingReview" | "Passed" | "Failed" | "Cancelled";
  overallResult?: "Pass" | "PassWithRecommendations" | "Fail" | "N/A";
  findings?: string | null;
  correctiveActions?: string | null;
  followUpRequired: boolean;
  checklistItems: ChecklistItemResult[];
  completedAt?: Timestamp | Date | string;
  reviewedAt?: Timestamp | Date | string;
  reviewedByRef?: string | DocumentReference<User>;
  createdAt: Timestamp | Date | string;
  createdByRef: string | DocumentReference<User>;
  lastUpdatedAt?: Timestamp | Date | string;
  lastUpdatedByRef?: string | DocumentReference<User>;
}

export interface ChecklistTemplateItem {
  itemId: string;
  itemDescription: string;
  category?: string;
  order?: number;
}

export interface ChecklistTemplate {
  templateId: string;
  name: string;
  inspectionType: "Initial" | "Annual" | "Compliance" | "FollowUp";
  items: ChecklistTemplateItem[];
  isActive: boolean;
  createdAt: Timestamp | Date | string;
  createdByRef: DocumentReference<User> | string;
}


export type { SuggestChecklistItemsInput, SuggestChecklistItemsOutput } from '@/ai/flows/suggest-checklist-items';



export interface Operator {
  operatorId: string;
  surname: string;
  firstName: string;
  dob: Timestamp | Date | string;
  age?: number;
  sex: "Male" | "Female" | "Other";
  placeOfOriginTown: string;
  placeOfOriginDistrict: string;
  placeOfOriginLLG: string;
  placeOfOriginVillage: string;
  phoneMobile: string;
  email?: string;
  postalAddress: string;
  heightCm?: number;
  eyeColor?: string;
  skinColor?: string;
  hairColor?: string;
  weightKg?: number;
  bodyMarks?: string;
  idSizePhotoUrl?: string;
  createdAt: Timestamp | Date | string;
  updatedAt: Timestamp | Date | string;
  createdByRef?: DocumentReference<User> | string;
}

export interface OperatorLicenseAttachedDoc {
  docId: string;
  docType: "PoliceClearance" | "PreviousLicenseCopy" | "BirthCertificateCopy" | "NIDCardCopy" | "IDPhoto" | "Other";
  docOtherDescription?: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: Timestamp | Date | string;
  verifiedStatus: "Pending" | "Verified" | "Rejected" | "NotRequired";
  verifiedAt?: Timestamp | Date | string;
  verifiedByRef?: DocumentReference<User> | string;
  notes?: string;
}

export interface OperatorLicense {
  licenseApplicationId: string;
  operatorRef: DocumentReference<Operator> | string;
  operatorData?: Partial<Operator>;
  applicationType: "New" | "Renewal";
  previousLicenseNumber?: string;
  status: "Draft" | "Submitted" | "PendingReview" | "RequiresInfo" | "AwaitingTest" | "TestScheduled" | "TestPassed" | "TestFailed" | "Approved" | "Rejected" | "Expired" | "Revoked";
  submittedAt?: Timestamp | Date | string;
  approvedAt?: Timestamp | Date | string;
  issuedAt?: Timestamp | Date | string;
  expiryDate?: Timestamp | Date | string;

  assignedLicenseNumber?: string;
  receiptNo?: string;
  placeIssued?: string;
  methodOfPayment?: "Cash" | "Card" | "BankDeposit" | "Other";
  paymentBy?: string;
  paymentDate?: Timestamp | Date | string;
  paymentAmount?: number;
  attachedDocuments: OperatorLicenseAttachedDoc[];
  competencyTestRef?: DocumentReference<CompetencyTest> | string;
  notes?: string;
  createdByUserRef: DocumentReference<User> | string;
  lastUpdatedByRef?: DocumentReference<User> | string;
  createdAt: Timestamp | Date | string;
  lastUpdatedAt: Timestamp | Date | string;
}

export interface CompetencyTestTemplateQuestion {
  questionId: string;
  questionText: string;
  questionType: "MultipleChoice" | "TrueFalse" | "ShortAnswer";
  options?: string[];
  correctAnswer?: string | boolean;
  points?: number;
}

export interface CompetencyTestTemplate {
  templateId: string;
  templateName: string;
  description?: string;
  applicableLicenseType: string;
  questions: CompetencyTestTemplateQuestion[];
  passingScorePercentage: number;
  isActive: boolean;
  createdAt: Timestamp | Date | string;
  createdByRef: DocumentReference<User> | string;
  version?: number;
}

export interface CompetencyTestAnswer {
  questionId: string;
  answerGiven: string | boolean;
  isCorrect?: boolean;
  scoreAwarded?: number;
}

export interface CompetencyTest {
  testId: string;
  licenseApplicationRef: DocumentReference<OperatorLicense> | string;
  operatorRef: DocumentReference<Operator> | string;
  testTemplateRef: DocumentReference<CompetencyTestTemplate> | string;
  testTemplateVersion?: number;
  testDate: Timestamp | Date | string;
  examinerRef: DocumentReference<User> | string;
  scoreAchieved?: number;
  percentageAchieved?: number;
  result: "Pass" | "Fail" | "PendingGrading";
  answers?: CompetencyTestAnswer[];
  notes?: string;
  createdAt: Timestamp | Date | string;
}


export interface InfringementItemDetail {
  itemId: string; // e.g., "UNREG_CRAFT"
  description: string; // e.g., "Operating an unregistered craft"
  points?: number;
  notes?: string;
}

export interface Infringement {
  infringementId: string;
  registrationRef: string | DocumentReference<Registration>;
  registrationData?: {
    id: string;
    scaRegoNo?: string;
    hullIdNumber?: string;
    craftMake?: string;
    craftModel?: string;
    ownerName?: string; // Primary owner's name
  };
  issuedByRef: string | DocumentReference<User>;
  issuedByData?: {
    id: string;
    displayName?: string;
  };
  issuedAt: Timestamp | Date | string;
  locationDescription?: string; // e.g., "Koki Market Jetty"
  infringementItems: InfringementItemDetail[];
  totalPoints?: number;
  status: "Draft" | "Issued" | "PendingReview" | "Approved" | "Voided" | "Paid" | "Overdue"; // 'Paid' might change to 'Resolved' or similar
  officerNotes?: string;
  paymentDetails?: { // This might become 'resolutionDetails' if not monetary
    receiptNumber?: string;
    paymentDate?: Timestamp | Date | string;
    paymentMethod?: "Cash" | "Card" | "BankDeposit" | "Other";
    amountPaid?: number; // May be deprecated if not monetary
  };
  dueDate?: Timestamp | Date | string;
  approvedByRef?: string | DocumentReference<User>;
  approvedAt?: Timestamp | Date | string;
  voidedReason?: string;
  createdAt: Timestamp | Date | string;
  createdByRef: string | DocumentReference<User>;
  lastUpdatedAt?: Timestamp | Date | string;
  lastUpdatedByRef?: string | DocumentReference<User>;
}

    
