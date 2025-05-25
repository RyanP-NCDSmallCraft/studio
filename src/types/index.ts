
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
  craftUse: "Pleasure" | "Passenger" | "Fishing" | "Cargo" | "Mixed Use" | "Other";
  craftUseOtherDesc?: string;
  fuelType: "Electric" | "Petrol" | "Diesel" | "Other";
  fuelTypeOtherDesc?: string;
  vesselType: "OpenBoat" | "CabinCruiser" | "Sailboat" | "PWC" | "Other"; // Personal Water Craft
  vesselTypeOtherDesc?: string;

  // Engine Details
  engineHorsepower?: number;
  engineMake?: string;
  engineSerialNumbers?: string; // Could be one or more, comma-separated

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
  result: "Yes" | "No" | "N/A";
  comments?: string;
  category?: string;
}

export interface Inspection {
  inspectionId: string;
  registrationRef: DocumentReference<Registration>;
  registrationData?: { id: string, scaRegoNo?: string, hullIdNumber?: string, craftType?: string, craftMake?: string, craftModel?: string };
  inspectorRef?: DocumentReference<User>;
  inspectorData?: { id: string, displayName?: string };
  inspectionType: "Initial" | "Annual" | "Compliance" | "FollowUp";
  scheduledDate: Timestamp;
  inspectionDate?: Timestamp;
  status: "Scheduled" | "InProgress" | "PendingReview" | "Passed" | "Failed" | "Cancelled";
  overallResult?: "Pass" | "PassWithRecommendations" | "Fail" | "N/A";
  findings?: string;
  correctiveActions?: string;
  followUpRequired: boolean;
  checklistItems: ChecklistItemResult[];
  completedAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedByRef?: DocumentReference<User>;
  createdAt: Timestamp;
  createdByRef: DocumentReference<User>;
  lastUpdatedAt?: Timestamp;
  lastUpdatedByRef?: DocumentReference<User>;
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


// --- Operator Licensing Module Types ---

export interface Operator {
  operatorId: string; // Auto-generated Unique ID
  surname: string;
  firstName: string;
  dob: Timestamp; // Date of Birth
  age?: number; // Can be derived or manually entered
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
  bodyMarks?: string; // e.g., tattoo; scar etc.
  idSizePhotoUrl?: string; // Link to uploaded ID photo in Firebase Storage
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByRef?: DocumentReference<User>; // User who created this operator record
}

export interface OperatorLicenseAttachedDoc {
  docId: string; // Auto-generated or a unique ID for the attachment
  docType: "PoliceClearance" | "PreviousLicenseCopy" | "BirthCertificateCopy" | "NIDCardCopy" | "IDPhoto" | "Other";
  docOtherDescription?: string; // If docType is "Other"
  fileName: string;
  fileUrl: string; // Link to Firebase Storage
  uploadedAt: Timestamp;
  verifiedStatus: "Pending" | "Verified" | "Rejected" | "NotRequired";
  verifiedAt?: Timestamp;
  verifiedByRef?: DocumentReference<User>;
  notes?: string;
}

export interface OperatorLicense {
  licenseApplicationId: string; // Auto-generated Unique ID
  operatorRef: DocumentReference<Operator>;
  operatorData?: Partial<Operator>; // Denormalized for quick display
  applicationType: "New" | "Renewal";
  previousLicenseNumber?: string; // If applicationType is "Renewal"
  status: "Draft" | "Submitted" | "PendingReview" | "RequiresInfo" | "AwaitingTest" | "TestScheduled" | "TestPassed" | "TestFailed" | "Approved" | "Rejected" | "Expired" | "Revoked";
  submittedAt?: Timestamp;
  approvedAt?: Timestamp;
  issuedAt?: Timestamp;
  expiryDate?: Timestamp;
  // Office Use Only Fields
  assignedLicenseNumber?: string; // The official license number once issued
  receiptNo?: string;
  placeIssued?: string;
  methodOfPayment?: "Cash" | "Card" | "BankDeposit" | "Other";
  paymentBy?: string;
  paymentDate?: Timestamp;
  paymentAmount?: number;
  attachedDocuments: OperatorLicenseAttachedDoc[];
  competencyTestRef?: DocumentReference<CompetencyTest>;
  notes?: string; // General notes for the application
  createdByUserRef: DocumentReference<User>;
  lastUpdatedByRef?: DocumentReference<User>;
  createdAt: Timestamp;
  lastUpdatedAt: Timestamp;
}

export interface CompetencyTestTemplateQuestion {
  questionId: string;
  questionText: string;
  questionType: "MultipleChoice" | "TrueFalse" | "ShortAnswer";
  options?: string[]; // For MultipleChoice
  correctAnswer?: string | boolean; // For MultipleChoice/TrueFalse
  points?: number;
}

export interface CompetencyTestTemplate {
  templateId: string; // Auto-generated or predefined
  templateName: string;
  description?: string;
  applicableLicenseType: string; // e.g., "CaptainClass1", "CrewGeneral", "SkipperCoastal"
  questions: CompetencyTestTemplateQuestion[];
  passingScorePercentage: number;
  isActive: boolean;
  createdAt: Timestamp;
  createdByRef: DocumentReference<User>;
  version?: number;
}

export interface CompetencyTestAnswer {
  questionId: string;
  answerGiven: string | boolean;
  isCorrect?: boolean; // For auto-gradable questions
  scoreAwarded?: number;
}

export interface CompetencyTest {
  testId: string; // Auto-generated
  licenseApplicationRef: DocumentReference<OperatorLicense>;
  operatorRef: DocumentReference<Operator>;
  testTemplateRef: DocumentReference<CompetencyTestTemplate>;
  testTemplateVersion?: number; // To capture which version of template was used
  testDate: Timestamp;
  examinerRef: DocumentReference<User>; // User who administered/graded
  scoreAchieved?: number;
  percentageAchieved?: number;
  result: "Pass" | "Fail" | "PendingGrading";
  answers?: CompetencyTestAnswer[]; // Optional: for detailed review
  notes?: string; // Examiner's comments
  createdAt: Timestamp;
}
