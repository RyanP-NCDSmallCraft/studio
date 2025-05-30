
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import type { Registration, Owner, ProofOfOwnershipDoc, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react"; 
import React, { useState } from "react";
import { Timestamp, addDoc, collection, doc, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import { OwnerManager } from "./OwnerManager";
import { FileUploadManager } from "./FileUploadManager";
// Removed: import { createRegistration } from '@/actions/registrations';


// Define Zod schema for validation
const ownerSchema = z.object({
  ownerId: z.string().uuid().optional(), 
  role: z.enum(["Primary", "CoOwner"]),
  surname: z.string().min(1, "Surname is required"),
  firstName: z.string().min(1, "First name is required"),
  dob: z.date({ required_error: "Date of birth is required"}),
  sex: z.enum(["Male", "Female", "Other"]),
  phone: z.string().min(1, "Phone number is required"),
  fax: z.string().optional().default(""),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).default(""),
  postalAddress: z.string().min(1, "Postal address is required"),
  townDistrict: z.string().min(1, "Town/District is required"),
  llg: z.string().min(1, "LLG is required"),
  wardVillage: z.string().min(1, "Ward/Village is required"),
});

const proofOfOwnershipDocSchema = z.object({
  docId: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required"),
  fileName: z.string().min(1, "File name is required"),
  fileUrl: z.string().url("Invalid URL"),
  uploadedAt: z.custom<Timestamp | Date | string>(val => val instanceof Timestamp || val instanceof Date || typeof val === 'string', "Invalid timestamp"),
});

const registrationFormSchema = z.object({
  registrationType: z.enum(["New", "Renewal"]),
  previousScaRegoNo: z.string().optional().default(""),
  
  owners: z.array(ownerSchema).min(1, "At least one owner is required").max(5, "Maximum of 5 owners"),
  proofOfOwnershipDocs: z.array(proofOfOwnershipDocSchema).min(1, "At least one proof of ownership document is required"),

  craftMake: z.string().min(1, "Craft make is required"),
  craftModel: z.string().min(1, "Craft model is required"),
  craftYear: z.number({invalid_type_error: "Year must be a number"}).int().min(1900, "Invalid year").max(new Date().getFullYear() + 1, "Invalid year"),
  craftColor: z.string().min(1, "Craft color is required"),
  hullIdNumber: z.string().min(1, "Hull ID number is required"),
  craftLength: z.number({invalid_type_error: "Length must be a number"}).positive("Length must be positive"),
  lengthUnits: z.enum(["m", "ft"]),
  distinguishingFeatures: z.string().optional().default(""),
  
  propulsionType: z.enum(["Inboard", "Outboard", "Both", "Sail", "Other"]),
  propulsionOtherDesc: z.string().optional().default(""),
  hullMaterial: z.enum(["Wood", "Fiberglass", "Metal", "Inflatable", "Other"]),
  hullMaterialOtherDesc: z.string().optional().default(""),
  craftUse: z.enum(["Pleasure", "Passenger", "Fishing", "Cargo", "Mixed Use", "Other"]),
  craftUseOtherDesc: z.string().optional().default(""),
  fuelType: z.enum(["Electric", "Petrol", "Diesel", "Other"]), 
  fuelTypeOtherDesc: z.string().optional().default(""),
  vesselType: z.enum(["OpenBoat", "CabinCruiser", "Sailboat", "PWC", "Other"]),
  vesselTypeOtherDesc: z.string().optional().default(""),

  engineHorsepower: z.number({invalid_type_error: "Horsepower must be a number"}).positive("Horsepower must be positive").optional(),
  engineMake: z.string().optional().default(""),
  engineSerialNumbers: z.string().optional().default(""),

  paymentMethod: z.enum(["Cash", "Card", "BankDeposit"]).optional(),
  paymentReceiptNumber: z.string().optional().default(""),
  bankStampRef: z.string().optional().default(""),
  paymentAmount: z.number({invalid_type_error: "Amount must be a number"}).positive("Amount must be positive").optional(),
  paymentDate: z.date().optional(),

  safetyCertNumber: z.string().optional().default(""),
  safetyEquipIssued: z.boolean().optional().default(false),
  safetyEquipReceiptNumber: z.string().optional().default(""),
  status: z.enum(["Draft", "Submitted", "PendingReview", "Approved", "Rejected", "Expired", "RequiresInfo"]).optional(), 
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
});

type RegistrationFormValues = z.infer<typeof registrationFormSchema>;

interface RegistrationFormProps {
  mode: "create" | "edit";
  registrationId?: string;
  existingRegistrationData?: Registration | null;
}

export function RegistrationForm({ mode, registrationId, existingRegistrationData }: RegistrationFormProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const defaultValues: Partial<RegistrationFormValues> = existingRegistrationData
  ? { 
      registrationType: existingRegistrationData.registrationType || "New",
      previousScaRegoNo: existingRegistrationData.previousScaRegoNo || "",
      owners: (existingRegistrationData.owners || []).map(o => ({
        ...o,
        ownerId: o.ownerId || crypto.randomUUID(),
        role: o.role || "Primary",
        surname: o.surname || "",
        firstName: o.firstName || "",
        dob: o.dob instanceof Timestamp ? o.dob.toDate() : (o.dob ? new Date(o.dob as any) : new Date()),
        sex: o.sex || "Male",
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
        uploadedAt: d.uploadedAt instanceof Timestamp ? d.uploadedAt : (d.uploadedAt ? ( (d.uploadedAt as any) instanceof Date ? d.uploadedAt : new Date(d.uploadedAt as string)) : Timestamp.now()),
      })),
      craftMake: existingRegistrationData.craftMake || "",
      craftModel: existingRegistrationData.craftModel || "",
      craftYear: existingRegistrationData.craftYear || new Date().getFullYear(),
      craftColor: existingRegistrationData.craftColor || "",
      hullIdNumber: existingRegistrationData.hullIdNumber || "",
      craftLength: typeof existingRegistrationData.craftLength === 'number' ? existingRegistrationData.craftLength : 0,
      lengthUnits: existingRegistrationData.lengthUnits || "m",
      distinguishingFeatures: existingRegistrationData.distinguishingFeatures || "",
      propulsionType: existingRegistrationData.propulsionType || "Outboard",
      propulsionOtherDesc: existingRegistrationData.propulsionOtherDesc || "",
      hullMaterial: existingRegistrationData.hullMaterial || "Fiberglass",
      hullMaterialOtherDesc: existingRegistrationData.hullMaterialOtherDesc || "",
      craftUse: existingRegistrationData.craftUse || "Pleasure",
      craftUseOtherDesc: existingRegistrationData.craftUseOtherDesc || "",
      fuelType: existingRegistrationData.fuelType || "Petrol",
      fuelTypeOtherDesc: existingRegistrationData.fuelTypeOtherDesc || "",
      vesselType: existingRegistrationData.vesselType || "OpenBoat",
      vesselTypeOtherDesc: existingRegistrationData.vesselTypeOtherDesc || "",
      engineHorsepower: existingRegistrationData.engineHorsepower === undefined ? undefined : (existingRegistrationData.engineHorsepower || undefined),
      engineMake: existingRegistrationData.engineMake || "",
      engineSerialNumbers: existingRegistrationData.engineSerialNumbers || "",
      paymentMethod: existingRegistrationData.paymentMethod || undefined,
      paymentReceiptNumber: existingRegistrationData.paymentReceiptNumber || "",
      bankStampRef: existingRegistrationData.bankStampRef || "",
      paymentAmount: existingRegistrationData.paymentAmount === undefined ? undefined : (existingRegistrationData.paymentAmount || undefined),
      paymentDate: existingRegistrationData.paymentDate instanceof Timestamp ? existingRegistrationData.paymentDate.toDate() : (existingRegistrationData.paymentDate ? new Date(existingRegistrationData.paymentDate as any) : undefined),
      safetyCertNumber: existingRegistrationData.safetyCertNumber || "",
      safetyEquipIssued: existingRegistrationData.safetyEquipIssued === undefined ? false : existingRegistrationData.safetyEquipIssued,
      safetyEquipReceiptNumber: existingRegistrationData.safetyEquipReceiptNumber || "",
      status: existingRegistrationData.status || "Draft",
    }
  : { 
      registrationType: "New",
      previousScaRegoNo: "",
      owners: [],
      proofOfOwnershipDocs: [],
      craftMake: "",
      craftModel: "",
      craftYear: new Date().getFullYear(),
      craftColor: "",
      hullIdNumber: "",
      craftLength: 0, 
      lengthUnits: "m",
      distinguishingFeatures: "",
      propulsionType: "Outboard",
      propulsionOtherDesc: "",
      hullMaterial: "Fiberglass",
      hullMaterialOtherDesc: "",
      craftUse: "Pleasure",
      craftUseOtherDesc: "",
      fuelType: "Petrol", 
      fuelTypeOtherDesc: "",
      vesselType: "OpenBoat",
      vesselTypeOtherDesc: "",
      engineHorsepower: undefined,
      engineMake: "",
      engineSerialNumbers: "",
      paymentMethod: undefined, 
      paymentReceiptNumber: "",
      bankStampRef: "",
      paymentAmount: undefined, 
      paymentDate: undefined, 
      safetyCertNumber: "",
      safetyEquipIssued: false, 
      safetyEquipReceiptNumber: "",
      status: "Draft",
    };

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues, 
    mode: "onChange",
  });

  const [ownersData, setOwnersData] = useState<Owner[]>(() => 
    (defaultValues.owners || []).map(o => ({
      ...o,
      dob: o.dob instanceof Timestamp ? o.dob.toDate() : (o.dob ? new Date(o.dob as any) : new Date()),
    })) as Owner[]
  );
  
  const [proofDocsData, setProofDocsData] = useState<ProofOfOwnershipDoc[]>(() => 
    (defaultValues.proofOfOwnershipDocs || []).map(d => ({
      ...d,
      uploadedAt: d.uploadedAt instanceof Timestamp ? d.uploadedAt : (d.uploadedAt ? ( (d.uploadedAt as any) instanceof Date ? d.uploadedAt : new Date(d.uploadedAt as string)) : Timestamp.now() )
    })) as ProofOfOwnershipDoc[]
  );


  React.useEffect(() => {
    form.setValue("owners", ownersData as any); 
  }, [ownersData, form]);

  React.useEffect(() => {
    form.setValue("proofOfOwnershipDocs", proofDocsData as any);
  }, [proofDocsData, form]);

  const onSubmit = async (data: RegistrationFormValues, submissionStatus: "Draft" | "Submitted") => {
    if (!currentUser?.userId) {
      toast({ title: "Authentication Error", description: "You must be logged in to create a registration.", variant: "destructive" });
      return;
    }
    
    form.clearErrors(); 

    const registrationDataForFirestore: { [key: string]: any } = {
      registrationType: data.registrationType,
      status: submissionStatus,
      owners: data.owners.map(owner => ({
        ...owner,
        dob: Timestamp.fromDate(owner.dob instanceof Date ? owner.dob : new Date(owner.dob as string)),
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
      craftModel: data.craftModel,
      craftYear: data.craftYear,
      craftColor: data.craftColor,
      hullIdNumber: data.hullIdNumber,
      craftLength: data.craftLength,
      lengthUnits: data.lengthUnits,
      propulsionType: data.propulsionType,
      hullMaterial: data.hullMaterial,
      craftUse: data.craftUse,
      fuelType: data.fuelType,
      vesselType: data.vesselType,
      safetyEquipIssued: data.safetyEquipIssued || false,

      createdByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      createdAt: Timestamp.now(),
      lastUpdatedAt: Timestamp.now(),
    };

    // Add optional fields only if they have a value
    if (data.previousScaRegoNo) registrationDataForFirestore.previousScaRegoNo = data.previousScaRegoNo;
    if (data.paymentMethod) registrationDataForFirestore.paymentMethod = data.paymentMethod;
    if (data.paymentReceiptNumber) registrationDataForFirestore.paymentReceiptNumber = data.paymentReceiptNumber;
    if (data.bankStampRef) registrationDataForFirestore.bankStampRef = data.bankStampRef;
    if (data.paymentAmount !== undefined && data.paymentAmount !== null) registrationDataForFirestore.paymentAmount = data.paymentAmount;
    if (data.paymentDate) registrationDataForFirestore.paymentDate = Timestamp.fromDate(data.paymentDate instanceof Date ? data.paymentDate : new Date(data.paymentDate));
    if (data.safetyCertNumber) registrationDataForFirestore.safetyCertNumber = data.safetyCertNumber;
    if (data.safetyEquipReceiptNumber) registrationDataForFirestore.safetyEquipReceiptNumber = data.safetyEquipReceiptNumber;
    if (data.distinguishingFeatures) registrationDataForFirestore.distinguishingFeatures = data.distinguishingFeatures;
    
    if (data.propulsionOtherDesc) registrationDataForFirestore.propulsionOtherDesc = data.propulsionOtherDesc;
    if (data.hullMaterialOtherDesc) registrationDataForFirestore.hullMaterialOtherDesc = data.hullMaterialOtherDesc;
    if (data.craftUseOtherDesc) registrationDataForFirestore.craftUseOtherDesc = data.craftUseOtherDesc;
    if (data.fuelTypeOtherDesc) registrationDataForFirestore.fuelTypeOtherDesc = data.fuelTypeOtherDesc;
    if (data.vesselTypeOtherDesc) registrationDataForFirestore.vesselTypeOtherDesc = data.vesselTypeOtherDesc;
    
    if (data.engineHorsepower !== undefined && data.engineHorsepower !== null) registrationDataForFirestore.engineHorsepower = data.engineHorsepower;
    if (data.engineMake) registrationDataForFirestore.engineMake = data.engineMake;
    if (data.engineSerialNumbers) registrationDataForFirestore.engineSerialNumbers = data.engineSerialNumbers;

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
        // TODO: Implement update logic using setDoc or updateDoc with registrationId
        console.log("Updating registration (placeholder):", registrationId, registrationDataForFirestore);
        toast({ title: "Update (Simulated)", description: "Registration update successful (placeholder)." });
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
    }
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
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="craftMake" render={({ field }) => (<FormItem><FormLabel>Craft Make *</FormLabel><FormControl><Input placeholder="e.g., Yamaha" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="craftModel" render={({ field }) => (<FormItem><FormLabel>Craft Model *</FormLabel><FormControl><Input placeholder="e.g., FX Cruiser HO" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="craftYear" render={({ field }) => (
                <FormItem>
                  <FormLabel>Craft Year *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 2023" 
                      {...field} 
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                      onChange={e => {
                        const val = e.target.value;
                        field.onChange(val === '' || isNaN(parseInt(val, 10)) ? undefined : parseInt(val, 10));
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
            <FormField control={form.control} name="craftColor" render={({ field }) => (<FormItem><FormLabel>Craft Color *</FormLabel><FormControl><Input placeholder="e.g., Blue/White" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="hullIdNumber" render={({ field }) => (<FormItem><FormLabel>Hull ID / Serial No. *</FormLabel><FormControl><Input placeholder="Enter HIN" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
            <FormField control={form.control} name="craftLength" render={({ field }) => (
                <FormItem>
                  <FormLabel>Craft Length *</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="e.g., 3.5" 
                      {...field} 
                       value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                      onChange={e => {
                        const val = e.target.value;
                        field.onChange(val === '' || isNaN(parseFloat(val)) ? undefined : parseFloat(val));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
              <FormField control={form.control} name="lengthUnits" render={({ field }) => (<FormItem><FormLabel>Units *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="m">Meters (m)</SelectItem><SelectItem value="ft">Feet (ft)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="engineHorsepower" render={({ field }) => (
                <FormItem>
                  <FormLabel>Engine Horsepower</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="e.g., 150" 
                      {...field} 
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                      onChange={e => {
                        const val = e.target.value;
                        field.onChange(val === '' || isNaN(parseInt(val, 10)) ? undefined : parseInt(val, 10));
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
            <FormField control={form.control} name="engineMake" render={({ field }) => (<FormItem><FormLabel>Engine Make</FormLabel><FormControl><Input placeholder="e.g., Yamaha, Mercury" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="engineSerialNumbers" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Engine Serial Number(s)</FormLabel><FormControl><Input placeholder="Enter serial number(s)" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="distinguishingFeatures" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Distinguishing Features</FormLabel><FormControl><Textarea placeholder="e.g., Custom decals, Bimini top" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        {/* Propulsion, Hull, Use, Fuel, Vessel Type */}
        <Card>
          <CardHeader><CardTitle>Technical Specifications</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="propulsionType" render={({ field }) => (<FormItem><FormLabel>Propulsion Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Inboard", "Outboard", "Both", "Sail", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchPropulsionType === "Other" && <FormField control={form.control} name="propulsionOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Propulsion Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}
            
            <FormField control={form.control} name="hullMaterial" render={({ field }) => (<FormItem><FormLabel>Hull Material *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Wood", "Fiberglass", "Metal", "Inflatable", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchHullMaterial === "Other" && <FormField control={form.control} name="hullMaterialOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Hull Material Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="craftUse" render={({ field }) => (<FormItem><FormLabel>Craft Use *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Pleasure", "Passenger", "Fishing", "Cargo", "Mixed Use", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchCraftUse === "Other" && <FormField control={form.control} name="craftUseOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Craft Use Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="fuelType" render={({ field }) => (<FormItem><FormLabel>Fuel Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Electric", "Petrol", "Diesel", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchFuelType === "Other" && <FormField control={form.control} name="fuelTypeOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Fuel Type Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}
            
            <FormField control={form.control} name="vesselType" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Vessel Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["OpenBoat", "CabinCruiser", "Sailboat", "PWC", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchVesselType === "Other" && <FormField control={form.control} name="vesselTypeOtherDesc" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Other Vessel Type Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}
          </CardContent>
        </Card>

         <Card>
          <CardHeader><CardTitle>Payment Information (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="paymentMethod" render={({ field }) => (<FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select method"/></SelectTrigger></FormControl><SelectContent>{["Cash", "Card", "BankDeposit"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="paymentAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      step="0.01" 
                      placeholder="e.g., 150.00" 
                      {...field} 
                      value={field.value === undefined || field.value === null || isNaN(Number(field.value)) ? '' : Number(field.value)}
                      onChange={e => {
                        const val = e.target.value;
                         field.onChange(val === '' || isNaN(parseFloat(val)) ? undefined : parseFloat(val));
                      }} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} 
            />
            <FormField control={form.control} name="paymentReceiptNumber" render={({ field }) => (<FormItem><FormLabel>Payment Receipt No.</FormLabel><FormControl><Input placeholder="Receipt number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="bankStampRef" render={({ field }) => (<FormItem><FormLabel>Bank Stamp Ref.</FormLabel><FormControl><Input placeholder="Bank stamp reference" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="paymentDate" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Safety Certificate (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="safetyCertNumber" render={({ field }) => (<FormItem><FormLabel>Safety Certificate No.</FormLabel><FormControl><Input placeholder="Certificate number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="safetyEquipIssued" render={({ field }) => (<FormItem><FormLabel>Safety Equipment Issued?</FormLabel><Select onValueChange={val => field.onChange(val === "true")} value={field.value === undefined || field.value === null ? "" : String(field.value)}><FormControl><SelectTrigger><SelectValue placeholder="Select an option"/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="safetyEquipReceiptNumber" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Safety Equipment Receipt No.</FormLabel><FormControl><Input placeholder="Equipment receipt number" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>


        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit((data) => onSubmit(data, "Draft"))} disabled={form.formState.isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, "Submitted"))} disabled={form.formState.isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Submit for Review
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}

    