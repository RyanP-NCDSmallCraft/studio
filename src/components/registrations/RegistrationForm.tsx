
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import type { Registration, Owner, ProofOfOwnershipDoc, User, EngineDetail } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Trash2, PlusCircle, UploadCloud, Receipt, CheckCircle2, AlertCircle } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Timestamp, addDoc, collection, doc, type DocumentReference, updateDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { OwnerManager } from "./OwnerManager";
import { FileUploadManager } from "./FileUploadManager";
import { Separator } from "@/components/ui/separator";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";


// Define Zod schema for validation
const ownerSchema = z.object({
  ownerId: z.string().uuid().optional(),
  role: z.enum(["Primary", "CoOwner"]),
  ownerType: z.enum(["Private", "Company"]),
  // Private
  surname: z.string().optional(),
  firstName: z.string().optional(),
  dob: z.date().optional(),
  sex: z.enum(["Male", "Female", "Other"]).optional(),
  // Company
  companyName: z.string().optional(),
  companyRegNo: z.string().optional(),
  companyAddress: z.string().optional(),
  // Common
  phone: z.string().optional().default(""),
  fax: z.string().optional().default(""),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).default(""),
  postalAddress: z.string().optional().default(""),
  townDistrict: z.string().optional().default(""),
  llg: z.string().optional().default(""),
  wardVillage: z.string().optional().default(""),
});

const proofOfOwnershipDocSchema = z.object({
  docId: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required"),
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().url("Invalid URL"),
  uploadedAt: z.custom<Timestamp | Date | string>(val => val instanceof Timestamp || val instanceof Date || typeof val === 'string', "Invalid timestamp"),
});

const engineDetailSchema = z.object({
  engineId: z.string().uuid().optional(),
  make: z.string().optional().default(""),
  horsepower: z.number({ invalid_type_error: "Horsepower must be a number" }).positive("Horsepower must be positive").optional().nullable(),
  serialNumber: z.string().optional().default(""),
});

const registrationFormSchema = z.object({
  registrationType: z.enum(["New", "Renewal"]),
  previousScaRegoNo: z.string().optional().default(""),

  owners: z.array(ownerSchema).min(1, "At least one owner is required").max(5, "Maximum of 5 owners"),
  proofOfOwnershipDocs: z.array(proofOfOwnershipDocSchema).optional().default([]),

  craftMake: z.string().optional().default(""),
  craftModel: z.string().optional().default(""),
  craftYear: z.number({invalid_type_error: "Year must be a number"}).int().min(1900, "Invalid year").max(new Date().getFullYear() + 1, "Invalid year").optional().nullable(),
  craftColor: z.string().optional().default(""),
  hullIdNumber: z.string().optional().default(""),
  craftLength: z.number({invalid_type_error: "Length must be a number"}).min(0, "Length cannot be negative").optional().default(0),
  lengthUnits: z.enum(["m", "ft"]).optional().default("m"),
  passengerCapacity: z.number({invalid_type_error: "Capacity must be a number"}).int().positive("Passenger capacity must be a positive number").optional().nullable(),
  distinguishingFeatures: z.string().optional().default(""),
  craftImageUrl: z.string().url().optional().nullable(),

  engines: z.array(engineDetailSchema).optional().default([]),

  propulsionType: z.enum(["Inboard", "Outboard", "Both", "Sail", "Other"], {
    errorMap: () => ({ message: "Please select a propulsion type" }),
  }).optional().default("Outboard"),
  propulsionOtherDesc: z.string().optional().default(""),
  hullMaterial: z.enum(["Wood", "Fiberglass", "Metal", "Inflatable", "Other"], {
    errorMap: () => ({ message: "Please select a hull material" }),
  }).optional(),
  hullMaterialOtherDesc: z.string().optional().default(""),
  craftUse: z.enum(["Pleasure", "Passenger", "Fishing", "Cargo", "Mixed Use", "Other"], {
    errorMap: () => ({ message: "Please select the craft use" }),
  }).optional().default("Pleasure"),
  craftUseOtherDesc: z.string().optional().default(""),
  fuelType: z.enum(["Electric", "Petrol", "Diesel", "Other"], {
    errorMap: () => ({ message: "Please select a fuel type" }),
  }).optional().default("Petrol"),
  fuelTypeOtherDesc: z.string().optional().default(""),
  vesselType: z.enum(["OpenBoat", "CabinCruiser", "Sailboat", "PWC", "Other"], {
    errorMap: () => ({ message: "Please select a vessel type" }),
  }).optional(),
  vesselTypeOtherDesc: z.string().optional().default(""),

  paymentMethod: z.enum(["Cash", "Card", "BankDeposit", "EFTPOS"]).optional(),
  paymentReceiptNumber: z.string().optional().default(""),
  bankStampRef: z.string().optional().default(""),
  paymentAmount: z.number({invalid_type_error: "Amount must be a number"}).positive("Amount must be positive").optional().nullable(),
  paymentDate: z.date().optional().nullable(),
  paymentConfirmed: z.boolean().optional().default(false),

  safetyCertNumber: z.string().optional().default(""),
  safetyEquipIssued: z.boolean().optional().default(false),
  safetyEquipReceiptNumber: z.string().optional().default(""),
  status: z.enum(["Draft", "Submitted", "PendingReview", "Approved", "Rejected", "Expired", "RequiresInfo", "Suspended", "Revoked"]).optional(),

  effectiveDate: z.date().optional().nullable(),
  expiryDate: z.date().optional().nullable(),
}).superRefine((data, ctx) => {
  if (data.registrationType === "Renewal" && !data.previousScaRegoNo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["previousScaRegoNo"],
      message: "Previous SCA Rego No. is required for renewals.",
    });
  }
  if (data.propulsionType === "Other" && !data.propulsionOtherDesc) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["propulsionOtherDesc"], message: "Description is required if 'Other' selected." });
  }
  if (data.hullMaterial === "Other" && !data.hullMaterialOtherDesc) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["hullMaterialOtherDesc"], message: "Description is required if 'Other' selected." });
  }
  if (data.craftUse === "Other" && !data.craftUseOtherDesc) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["craftUseOtherDesc"], message: "Description is required if 'Other' selected." });
  }
  if (data.fuelType === "Other" && !data.fuelTypeOtherDesc) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fuelTypeOtherDesc"], message: "Description is required if 'Other' selected." });
  }
  if (data.vesselType === "Other" && !data.vesselTypeOtherDesc) {
     ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["vesselTypeOtherDesc"], message: "Description is required if 'Other' selected." });
  }
  // Payment is mandatory when submitting for review — enforced at submit time via submissionStatus param
  // (handled in onSubmit rather than here to allow Drafts without payment)
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

interface RegistrationFormProps {
  mode: "create" | "edit";
  registrationId?: string;
  existingRegistrationData?: Registration | null;
}

export function RegistrationForm({ mode, registrationId, existingRegistrationData }: RegistrationFormProps) {
  const { currentUser, isAdmin, isRegistrar } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(existingRegistrationData?.craftImageUrl || null);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);

  // Payment receipt file upload state
  const [selectedReceiptFile, setSelectedReceiptFile] = useState<File | null>(null);
  const [receiptUploadProgress, setReceiptUploadProgress] = useState<number | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(existingRegistrationData?.paymentReceiptUrl || null);
  const [existingReceiptFileName, setExistingReceiptFileName] = useState<string | null>(existingRegistrationData?.paymentReceiptFileName || null);
  const receiptFileInputRef = useRef<HTMLInputElement>(null);


  const defaultValues: Partial<RegistrationFormValues> = existingRegistrationData
  ? {
      registrationType: existingRegistrationData.registrationType || "New",
      previousScaRegoNo: existingRegistrationData.previousScaRegoNo || "",
      owners: (existingRegistrationData.owners || []).map(o => ({
        ...o,
        ownerId: o.ownerId || crypto.randomUUID(),
        role: o.role || "Primary",
        ownerType: o.ownerType || "Private",
        surname: o.surname || "",
        firstName: o.firstName || "",
        dob: o.dob instanceof Timestamp ? o.dob.toDate() : (o.dob ? new Date(o.dob as any) : undefined),
        sex: o.sex || undefined,
        companyName: o.companyName || "",
        companyRegNo: o.companyRegNo || "",
        companyAddress: o.companyAddress || "",
        phone: o.phone || "",
        fax: o.fax || "",
        email: o.email || "",
        postalAddress: o.postalAddress || "",
        townDistrict: o.townDistrict || "",
        llg: o.llg || "",
        wardVillage: o.wardVillage || "",
      })),
      proofOfOwnershipDocs: (existingRegistrationData.proofOfOwnershipDocs || []).map(d => ({
        ...d,
        docId: d.docId || crypto.randomUUID(),
        description: d.description || "",
        fileName: d.fileName || "",
        fileUrl: d.fileUrl || "",
        uploadedAt: d.uploadedAt instanceof Timestamp ? d.uploadedAt : (d.uploadedAt ? ( (d.uploadedAt as any) instanceof Date ? d.uploadedAt : new Date(d.uploadedAt as string)) : Timestamp.now() )
      })),
      craftMake: existingRegistrationData.craftMake || "",
      craftModel: existingRegistrationData.craftModel || "",
      craftYear: existingRegistrationData.craftYear ?? null,
      craftColor: existingRegistrationData.craftColor || "",
      hullIdNumber: existingRegistrationData.hullIdNumber || "",
      craftLength: typeof existingRegistrationData.craftLength === 'number' ? existingRegistrationData.craftLength : 0,
      lengthUnits: existingRegistrationData.lengthUnits || "m",
      passengerCapacity: existingRegistrationData.passengerCapacity ?? null,
      distinguishingFeatures: existingRegistrationData.distinguishingFeatures || "",
      craftImageUrl: existingRegistrationData.craftImageUrl || null,
      engines: (existingRegistrationData.engines || []).map(e => ({
        engineId: e.engineId || crypto.randomUUID(),
        make: e.make || "",
        horsepower: e.horsepower ?? null,
        serialNumber: e.serialNumber || "",
      })),
      propulsionType: existingRegistrationData.propulsionType || "Outboard",
      propulsionOtherDesc: existingRegistrationData.propulsionOtherDesc || "",
      hullMaterial: existingRegistrationData.hullMaterial || undefined,
      hullMaterialOtherDesc: existingRegistrationData.hullMaterialOtherDesc || "",
      craftUse: existingRegistrationData.craftUse || "Pleasure",
      craftUseOtherDesc: existingRegistrationData.craftUseOtherDesc || "",
      fuelType: existingRegistrationData.fuelType || "Petrol",
      fuelTypeOtherDesc: existingRegistrationData.fuelTypeOtherDesc || "",
      vesselType: existingRegistrationData.vesselType || undefined,
      vesselTypeOtherDesc: existingRegistrationData.vesselTypeOtherDesc || "",
      paymentMethod: existingRegistrationData.paymentMethod || undefined,
      paymentReceiptNumber: existingRegistrationData.paymentReceiptNumber || "",
      bankStampRef: existingRegistrationData.bankStampRef || "",
      paymentAmount: existingRegistrationData.paymentAmount ?? null,
      paymentDate: existingRegistrationData.paymentDate instanceof Timestamp ? existingRegistrationData.paymentDate.toDate() : (existingRegistrationData.paymentDate ? new Date(existingRegistrationData.paymentDate as any) : null),
      paymentConfirmed: existingRegistrationData.paymentConfirmed ?? false,
      safetyCertNumber: existingRegistrationData.safetyCertNumber || "",
      safetyEquipIssued: existingRegistrationData.safetyEquipIssued ?? false,
      safetyEquipReceiptNumber: existingRegistrationData.safetyEquipReceiptNumber || "",
      status: existingRegistrationData.status || "Draft",
      effectiveDate: existingRegistrationData.effectiveDate ? (existingRegistrationData.effectiveDate instanceof Timestamp ? existingRegistrationData.effectiveDate.toDate() : new Date(existingRegistrationData.effectiveDate as any)) : null,
      expiryDate: existingRegistrationData.expiryDate ? (existingRegistrationData.expiryDate instanceof Timestamp ? existingRegistrationData.expiryDate.toDate() : new Date(existingRegistrationData.expiryDate as any)) : null,
    }
  : {
      registrationType: "New",
      previousScaRegoNo: "",
      owners: [],
      proofOfOwnershipDocs: [],
      craftMake: "",
      craftModel: "",
      craftYear: null,
      craftColor: "",
      hullIdNumber: "",
      craftLength: 0,
      lengthUnits: "m",
      passengerCapacity: null,
      distinguishingFeatures: "",
      craftImageUrl: null,
      engines: [],
      propulsionType: "Outboard",
      propulsionOtherDesc: "",
      hullMaterial: undefined,
      hullMaterialOtherDesc: "",
      craftUse: "Pleasure",
      craftUseOtherDesc: "",
      fuelType: "Petrol",
      fuelTypeOtherDesc: "",
      vesselType: undefined,
      vesselTypeOtherDesc: "",
      paymentMethod: undefined,
      paymentReceiptNumber: "",
      bankStampRef: "",
      paymentAmount: null,
      paymentDate: null,
      paymentConfirmed: false,
      safetyCertNumber: "",
      safetyEquipIssued: false,
      safetyEquipReceiptNumber: "",
      status: "Draft",
      effectiveDate: null,
      expiryDate: null,
    };

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const { fields: engineFields, append: appendEngine, remove: removeEngine } = useFieldArray({
    control: form.control,
    name: "engines",
  });


  const [ownersData, setOwnersData] = useState<Owner[]>(() =>
    (defaultValues.owners || []).map(o => ({
      ...o,
      dob: o.dob instanceof Timestamp ? o.dob.toDate() : (o.dob ? new Date(o.dob as any) : undefined),
    })) as Owner[]
  );

  const [proofDocsData, setProofDocsData] = useState<ProofOfOwnershipDoc[]>(() =>
    (defaultValues.proofOfOwnershipDocs || []).map(d => ({
      ...d,
      uploadedAt: d.uploadedAt instanceof Timestamp ? d.uploadedAt : (d.uploadedAt ? ( (d.uploadedAt as any) instanceof Date ? d.uploadedAt : new Date(d.uploadedAt as string)) : Timestamp.now() )
    })) as ProofOfOwnershipDoc[]
  );


  useEffect(() => {
    form.setValue("owners", ownersData as any, { shouldValidate: true, shouldDirty: true });
  }, [ownersData, form]);

  useEffect(() => {
    form.setValue("proofOfOwnershipDocs", proofDocsData as any, { shouldValidate: true, shouldDirty: true });
  }, [proofDocsData, form]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImageFile(null);
      setImagePreviewUrl(existingRegistrationData?.craftImageUrl || null);
    }
  };


  const onSubmit = async (data: RegistrationFormValues, submissionStatus: "Draft" | "Submitted" | "Approved" | "Rejected") => {
    if (!currentUser?.userId) {
      toast({ title: "Authentication Error", description: "You must be logged in to create or edit a registration.", variant: "destructive" });
      return;
    }

    // Enforce mandatory payment fields when submitting for review
    if (submissionStatus === "Submitted") {
      const missingFields: string[] = [];
      if (!data.paymentMethod) missingFields.push("Payment Method");
      if (!data.paymentAmount || data.paymentAmount <= 0) missingFields.push("Payment Amount");
      if (!data.paymentDate) missingFields.push("Payment Date");
      if (missingFields.length > 0) {
        toast({
          title: "Payment Information Required",
          description: `Please complete payment details before submitting: ${missingFields.join(", ")}.`,
          variant: "destructive",
        });
        return;
      }
    }

    form.clearErrors();
    setImageUploadProgress(null);

    let finalCraftImageUrl = data.craftImageUrl; 

    if (selectedImageFile) {
      toast({ title: "Uploading Image...", description: "Please wait." });
      setImageUploadProgress(0);
      const imageFileName = `${Date.now()}_${selectedImageFile.name}`;
      const imagePath = `craft_images/${registrationId || Date.now()}/${imageFileName}`;
      const imageStorageRef = storageRef(storage, imagePath);

      try {
        const uploadTask = uploadBytesResumable(imageStorageRef, selectedImageFile);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setImageUploadProgress(progress);
            },
            (error) => {
              console.error("Image upload error:", error);
              reject(error);
            },
            async () => {
              finalCraftImageUrl = await getDownloadURL(uploadTask.snapshot.ref);
              form.setValue("craftImageUrl", finalCraftImageUrl); 
              resolve();
            }
          );
        });
        toast({ title: "Image Upload Successful", description: "Craft image has been uploaded." });
        setImageUploadProgress(100);
      } catch (error) {
        toast({ title: "Image Upload Failed", description: "Could not upload the craft image. Please try again.", variant: "destructive" });
        setImageUploadProgress(null);
        return; 
      }
    }

    // Upload payment receipt file if one is selected
    if (selectedReceiptFile) {
      toast({ title: "Uploading Receipt...", description: "Please wait." });
      setReceiptUploadProgress(0);
      const receiptFileName = `${Date.now()}_${selectedReceiptFile.name}`;
      const receiptPath = `payment_receipts/${registrationId || Date.now()}/${receiptFileName}`;
      const receiptStorageRef = storageRef(storage, receiptPath);

      try {
        const receiptUploadTask = uploadBytesResumable(receiptStorageRef, selectedReceiptFile);
        await new Promise<void>((resolve, reject) => {
          receiptUploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setReceiptUploadProgress(progress);
            },
            (error) => {
              console.error("Receipt upload error:", error);
              reject(error);
            },
            async () => {
              const downloadUrl = await getDownloadURL(receiptUploadTask.snapshot.ref);
              setExistingReceiptUrl(downloadUrl);
              setExistingReceiptFileName(selectedReceiptFile.name);
              setSelectedReceiptFile(null);
              resolve();
            }
          );
        });
        toast({ title: "Receipt Upload Successful", description: "Payment receipt has been uploaded." });
        setReceiptUploadProgress(100);
      } catch (error) {
        toast({ title: "Receipt Upload Failed", description: "Could not upload the payment receipt. Please try again.", variant: "destructive" });
        setReceiptUploadProgress(null);
        return;
      }
    }

    const registrationDataForFirestore: { [key: string]: any } = {
      registrationType: data.registrationType,
      status: submissionStatus,
      owners: data.owners.map(owner => ({
        ...owner,
        dob: owner.dob ? Timestamp.fromDate(owner.dob instanceof Date ? owner.dob : new Date(owner.dob as string)) : null,
        postalAddress: owner.postalAddress ?? "",
        llg: owner.llg ?? "",
        wardVillage: owner.wardVillage ?? "",
      })),
      proofOfOwnershipDocs: data.proofOfOwnershipDocs.map(docEntry => {
        let uploadedAtTimestamp: Timestamp;
        if (docEntry.uploadedAt instanceof Timestamp) {
          uploadedAtTimestamp = docEntry.uploadedAt;
        } else if (docEntry.uploadedAt instanceof Date) {
          uploadedAtTimestamp = Timestamp.fromDate(docEntry.uploadedAt);
        } else {
          uploadedAtTimestamp = Timestamp.fromDate(new Date(docEntry.uploadedAt as string));
        }
        return { ...docEntry, uploadedAt: uploadedAtTimestamp };
      }),
      craftMake: data.craftMake,
      craftModel: data.craftModel ?? "",
      craftYear: data.craftYear ?? null,
      craftColor: data.craftColor ?? "",
      hullIdNumber: data.hullIdNumber ?? "",
      craftLength: data.craftLength,
      lengthUnits: data.lengthUnits,
      passengerCapacity: data.passengerCapacity ?? null,
      craftImageUrl: finalCraftImageUrl ?? null,
      engines: (data.engines || []).map(engine => ({
        engineId: engine.engineId || crypto.randomUUID(),
        make: engine.make ?? "",
        horsepower: engine.horsepower ?? null,
        serialNumber: engine.serialNumber ?? "",
      })),
      propulsionType: data.propulsionType,
      hullMaterial: data.hullMaterial ?? null,
      craftUse: data.craftUse,
      fuelType: data.fuelType,
      vesselType: data.vesselType ?? null,
      safetyEquipIssued: data.safetyEquipIssued ?? false,
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      lastUpdatedAt: Timestamp.now(),

      previousScaRegoNo: data.previousScaRegoNo ?? "",
      paymentMethod: data.paymentMethod ?? null,
      paymentReceiptNumber: data.paymentReceiptNumber ?? "",
      bankStampRef: data.bankStampRef ?? "",
      paymentAmount: data.paymentAmount ?? null,
      paymentDate: data.paymentDate ? Timestamp.fromDate(data.paymentDate instanceof Date ? data.paymentDate : new Date(data.paymentDate as string)) : null,
      paymentConfirmed: data.paymentConfirmed ?? false,
      paymentReceiptUrl: existingReceiptUrl ?? null,
      paymentReceiptFileName: existingReceiptFileName ?? null,
      safetyCertNumber: data.safetyCertNumber ?? "",
      safetyEquipReceiptNumber: data.safetyEquipReceiptNumber ?? "",
      distinguishingFeatures: data.distinguishingFeatures ?? "",
      propulsionOtherDesc: data.propulsionOtherDesc ?? "",
      hullMaterialOtherDesc: data.hullMaterialOtherDesc ?? "",
      craftUseOtherDesc: data.craftUseOtherDesc ?? "",
      fuelTypeOtherDesc: data.fuelTypeOtherDesc ?? "",
      vesselTypeOtherDesc: data.vesselTypeOtherDesc ?? "",
      effectiveDate: data.effectiveDate ? Timestamp.fromDate(data.effectiveDate) : null,
      expiryDate: data.expiryDate ? Timestamp.fromDate(data.expiryDate) : null,
    };

    if (mode === "create") {
      registrationDataForFirestore.createdByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
      registrationDataForFirestore.createdAt = Timestamp.now();
    } else if (existingRegistrationData) {
      registrationDataForFirestore.createdAt = existingRegistrationData.createdAt instanceof Timestamp ? existingRegistrationData.createdAt : Timestamp.fromDate(new Date(existingRegistrationData.createdAt as any));
      registrationDataForFirestore.createdByRef = typeof existingRegistrationData.createdByRef === 'string' ? doc(db, "users", existingRegistrationData.createdByRef) : existingRegistrationData.createdByRef;
    }


    if (submissionStatus === "Submitted") {
      registrationDataForFirestore.submittedAt = Timestamp.now();
    }
    
    try {
      if (mode === "create") {
        const registrationsCol = collection(db, "registrations");
        const docRef = await addDoc(registrationsCol, registrationDataForFirestore);
        toast({ title: "Registration Saved", description: `Status: ${submissionStatus}. ID: ${docRef.id}` });
        router.push(`/registrations/${docRef.id}`);
      } else if (registrationId) {
        const regDocRef = doc(db, "registrations", registrationId);
        await updateDoc(regDocRef, registrationDataForFirestore);
        toast({ title: "Registration Updated", description: `Status: ${submissionStatus}.` });
        router.push(`/registrations/${registrationId}`);
      }
    } catch (error: any) {
      console.error("Error saving registration to Firestore:", error);
      const originalErrorMessage = error.message || "Unknown Firebase error";
      const originalErrorCode = error.code || "N/A";
      toast({
        title: "Save Failed",
        description: `Failed to save registration. Error: [${originalErrorCode}] ${originalErrorMessage}`,
        variant: "destructive"
      });
    } finally {
      setImageUploadProgress(null);
    }
  };

  const onValidationError = (errors: any) => {
    const errorFields = Object.keys(errors).join(", ");
    // Only log the keys or a safe representation of the errors to avoid circular reference crashes in Next.js dev server
    console.log("Validation Errors:", Object.keys(errors).reduce((acc, key) => {
      acc[key] = errors[key]?.message || "Invalid";
      return acc;
    }, {} as Record<string, any>));
    toast({
      title: "Validation Error",
      description: `Missing or invalid fields: ${errorFields}`,
      variant: "destructive",
    });
  };

  const watchPropulsionType = form.watch("propulsionType");
  const watchHullMaterial = form.watch("hullMaterial");
  const watchCraftUse = form.watch("craftUse");
  const watchFuelType = form.watch("fuelType");
  const watchVesselType = form.watch("vesselType");
  const watchRegistrationType = form.watch("registrationType");


  return (
    <Form {...form}>
      <form className="space-y-8">
        {/* Registration Type and Basic Info */}
        <Card>
          <CardHeader><CardTitle>Registration Details</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="registrationType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Registration Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="New">New Registration</SelectItem>
                      <SelectItem value="Renewal">Renewal</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchRegistrationType === "Renewal" && (
              <FormField
                control={form.control}
                name="previousScaRegoNo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Previous SCA Rego No. *</FormLabel>
                    <FormControl><Input placeholder="Enter previous SCA Rego No." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <OwnerManager owners={ownersData} setOwners={setOwnersData} form={form} />

        <FileUploadManager title="Proof of Ownership Documents *" docs={proofDocsData} setDocs={setProofDocsData} storagePath="registrations_proof_of_ownership/" form={form} fieldName="proofOfOwnershipDocs" />


        {/* Craft Details */}
        <Card>
          <CardHeader><CardTitle>Craft Information</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="craftMake" render={({ field }) => (<FormItem><FormLabel>Craft Make</FormLabel><FormControl><Input placeholder="e.g., Yamaha" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="craftModel" render={({ field }) => (<FormItem><FormLabel>Craft Model</FormLabel><FormControl><Input placeholder="e.g., FX Cruiser HO" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="craftYear" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Craft Year</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 2023"
                        {...field}
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                        onChange={e => {
                          const val = e.target.value;
                          field.onChange(val === '' || isNaN(parseInt(val, 10)) ? null : parseInt(val, 10));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="craftColor" render={({ field }) => (<FormItem><FormLabel>Craft Color</FormLabel><FormControl><Input placeholder="e.g., Blue/White" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="hullIdNumber" render={({ field }) => (<FormItem><FormLabel>Hull ID / Serial No.</FormLabel><FormControl><Input placeholder="Enter HIN" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="craftLength" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Craft Length</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 3.5"
                          {...field}
                          value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                          onChange={e => {
                            const val = e.target.value;
                            field.onChange(val === '' || isNaN(parseFloat(val)) ? 0 : parseFloat(val));
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="lengthUnits" render={({ field }) => (<FormItem><FormLabel>Units</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="m">Meters (m)</SelectItem><SelectItem value="ft">Feet (ft)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
              <FormField control={form.control} name="passengerCapacity" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passenger Capacity</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="e.g., 10"
                        {...field}
                        value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                        onChange={e => {
                          const val = e.target.value;
                           field.onChange(val === '' || isNaN(parseInt(val, 10)) ? null : parseInt(val, 10));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormItem className="md:col-span-2">
                <FormLabel>Craft Image</FormLabel>
                {imagePreviewUrl && (
                  <div className="mt-2 mb-2">
                    <Image src={imagePreviewUrl} alt="Craft preview" width={200} height={150} className="rounded-md object-cover aspect-video" data-ai-hint="boat" />
                  </div>
                )}
                <FormControl>
                  <Input type="file" accept="image/*" onChange={handleImageFileChange} />
                </FormControl>
                {imageUploadProgress !== null && imageUploadProgress < 100 && (
                  <Progress value={imageUploadProgress} className="w-full mt-2 h-2" />
                )}
                <FormDescription>Upload an image of the craft (max 5MB).</FormDescription>
                <FormMessage />
              </FormItem>

            </div>

            <Separator className="my-4" />

            <div>
              <h3 className="text-lg font-medium mb-3">Engine Details</h3>
              {engineFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border p-4 rounded-md mb-4 relative">
                  <FormField
                    control={form.control}
                    name={`engines.${index}.make`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Engine Make</FormLabel>
                        <FormControl><Input placeholder="e.g., Yamaha" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`engines.${index}.horsepower`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Horsepower (HP)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="e.g., 150"
                            {...field}
                            value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                            onChange={e => {
                              const val = e.target.value;
                              field.onChange(val === '' || isNaN(parseInt(val, 10)) ? null : parseInt(val, 10));
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`engines.${index}.serialNumber`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Serial Number</FormLabel>
                        <FormControl><Input placeholder="Engine S/N" {...field} value={field.value ?? ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => removeEngine(index)}
                    className="md:self-center mb-1"
                  >
                    <Trash2 className="h-4 w-4 mr-1 md:mr-2" /> Remove
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => appendEngine({ make: "", horsepower: undefined, serialNumber: "" })}
              >
                <PlusCircle className="mr-2 h-4 w-4" /> Add Engine
              </Button>
            </div>

            <Separator className="my-4" />
            <FormField control={form.control} name="distinguishingFeatures" render={({ field }) => (<FormItem><FormLabel>Distinguishing Features</FormLabel><FormControl><Textarea placeholder="e.g., Custom decals, Bimini top" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>


        {/* Propulsion, Hull, Use, Fuel, Vessel Type */}
        <Card>
          <CardHeader><CardTitle>Technical Specifications</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="propulsionType" render={({ field }) => (<FormItem><FormLabel>Propulsion Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select propulsion type..." /></SelectTrigger></FormControl><SelectContent>{["Inboard", "Outboard", "Both", "Sail", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormDescription>e.g. Outboard, Inboard, Sail</FormDescription><FormMessage /></FormItem>)} />
            {watchPropulsionType === "Other" && <FormField control={form.control} name="propulsionOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Propulsion Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="hullMaterial" render={({ field }) => (<FormItem><FormLabel>Hull Material</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select hull material..." /></SelectTrigger></FormControl><SelectContent>{["Wood", "Fiberglass", "Metal", "Inflatable", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormDescription>e.g. Fiberglass, Wood, Metal</FormDescription><FormMessage /></FormItem>)} />
            {watchHullMaterial === "Other" && <FormField control={form.control} name="hullMaterialOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Hull Material Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="craftUse" render={({ field }) => (<FormItem><FormLabel>Craft Use</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select craft use..." /></SelectTrigger></FormControl><SelectContent>{["Pleasure", "Passenger", "Fishing", "Cargo", "Mixed Use", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormDescription>e.g. Pleasure, Fishing, Mixed Use</FormDescription><FormMessage /></FormItem>)} />
            {watchCraftUse === "Other" && <FormField control={form.control} name="craftUseOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Craft Use Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="fuelType" render={({ field }) => (<FormItem><FormLabel>Fuel Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select fuel type..." /></SelectTrigger></FormControl><SelectContent>{["Electric", "Petrol", "Diesel", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormDescription>e.g. Petrol, Diesel, Electric</FormDescription><FormMessage /></FormItem>)} />
            {watchFuelType === "Other" && <FormField control={form.control} name="fuelTypeOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Fuel Type Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="vesselType" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Vessel Type</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select vessel type..." /></SelectTrigger></FormControl><SelectContent>{[{val: "OpenBoat", label: "Open Boat"}, {val: "CabinCruiser", label: "Cabin Cruiser"}, {val: "Sailboat", label: "Sailboat"}, {val: "PWC", label: "PWC (Jet Ski)"}, {val: "Other", label: "Other"}].map(item => <SelectItem key={item.val} value={item.val}>{item.label}</SelectItem>)}</SelectContent></Select><FormDescription>e.g. Open Boat, Cabin Cruiser, PWC</FormDescription><FormMessage /></FormItem>)} />
            {watchVesselType === "Other" && <FormField control={form.control} name="vesselTypeOtherDesc" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Other Vessel Type Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />}
          </CardContent>
        </Card>

        {(isAdmin || isRegistrar) && (
          <Card>
            <CardHeader><CardTitle>Administrative Dates (Optional Pre-set)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="effectiveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effective Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                        onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Can be set here or during approval.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value ? format(new Date(field.value), 'yyyy-MM-dd') : ''}
                        onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                      />
                    </FormControl>
                    <FormDescription>Can be set here or during approval.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        )}

         <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-amber-600" />
              Payment Information
              <span className="text-xs font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full ml-1">
                Required when submitting
              </span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Payment must be confirmed before a registration can be submitted for review or approved.
              You may upload an EFTPOS slip or bank transfer receipt.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method <span className="text-destructive">*</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select method"/></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Cash", "Card", "EFTPOS", "BankDeposit"].map(val => <SelectItem key={val} value={val}>{val === "BankDeposit" ? "Bank Deposit" : val}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount (Kina) <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="e.g., 150.00"
                      {...field}
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                      onChange={e => {
                        const val = e.target.value;
                        field.onChange(val === '' || isNaN(parseFloat(val)) ? null : parseFloat(val));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : null)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="paymentReceiptNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Receipt / Reference No.</FormLabel>
                  <FormControl><Input placeholder="e.g., RCP-00123 or transaction ref" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="bankStampRef" render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Stamp / Reference</FormLabel>
                  <FormControl><Input placeholder="Bank stamp or deposit reference" {...field} value={field.value ?? ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Receipt File Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Upload Payment Receipt <span className="text-xs text-muted-foreground">(EFTPOS slip or bank transfer receipt — PDF or image)</span></label>
              {existingReceiptUrl && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="text-green-800 font-medium">Receipt uploaded:</span>
                  <a href={existingReceiptUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate">{existingReceiptFileName || "View Receipt"}</a>
                  <button type="button" className="ml-auto text-destructive text-xs underline" onClick={() => { setExistingReceiptUrl(null); setExistingReceiptFileName(null); if (receiptFileInputRef.current) receiptFileInputRef.current.value = ""; }}>Remove</button>
                </div>
              )}
              {!existingReceiptUrl && (
                <div className="flex items-center gap-3 p-3 bg-muted/40 border-2 border-dashed border-muted-foreground/30 rounded-md">
                  <UploadCloud className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <input
                      ref={receiptFileInputRef}
                      type="file"
                      accept="image/*,application/pdf"
                      className="text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-muted-foreground/40 file:text-xs file:bg-muted file:text-muted-foreground hover:file:bg-accent cursor-pointer w-full"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        setSelectedReceiptFile(file || null);
                      }}
                    />
                    {selectedReceiptFile && (
                      <p className="text-xs text-muted-foreground mt-1">Selected: {selectedReceiptFile.name} ({(selectedReceiptFile.size / 1024).toFixed(1)} KB)</p>
                    )}
                  </div>
                </div>
              )}
              {receiptUploadProgress !== null && receiptUploadProgress < 100 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Uploading receipt... {Math.round(receiptUploadProgress)}%</p>
                  <Progress value={receiptUploadProgress} className="h-1" />
                </div>
              )}
            </div>

            {/* Payment Confirmed Checkbox */}
            <FormField
              control={form.control}
              name="paymentConfirmed"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border border-green-200 bg-green-50/50 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm font-semibold text-green-800">
                      Payment Confirmed / Verified
                    </FormLabel>
                    <FormDescription className="text-xs text-green-700">
                      Check this box to confirm that payment has been received and verified (e.g., cash counted, EFTPOS approved, or bank deposit confirmed).
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Safety Certificate (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="safetyCertNumber" render={({ field }) => (<FormItem><FormLabel>Safety Certificate No.</FormLabel><FormControl><Input placeholder="Certificate number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="safetyEquipIssued" render={({ field }) => (<FormItem><FormLabel>Safety Equipment Issued?</FormLabel><Select onValueChange={val => field.onChange(val === "true")} value={field.value === undefined || field.value === null ? "" : String(field.value)}><FormControl><SelectTrigger><SelectValue placeholder="Select an option"/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="safetyEquipReceiptNumber" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Safety Equipment Receipt No.</FormLabel><FormControl><Input placeholder="Equipment receipt number" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>


        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit((data) => onSubmit(data, "Draft"), onValidationError)} disabled={form.formState.isSubmitting || imageUploadProgress !== null && imageUploadProgress < 100}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, "Submitted"), onValidationError)} disabled={form.formState.isSubmitting || imageUploadProgress !== null && imageUploadProgress < 100}>
            <Send className="mr-2 h-4 w-4" /> {mode === 'create' ? 'Submit for Review' : 'Resubmit for Review'}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
