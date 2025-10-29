
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller, useFieldArray } from "react-hook-form"; // Added useFieldArray
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
import type { Operator, CommercialLicense, CommercialLicenseAttachedDoc, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, UserCircle, FileText, UploadCloud, PlusCircle, Trash2, ImageUp } from "lucide-react"; // Added ImageUp
import React, { useState, useEffect } from "react";
import { Timestamp, doc, setDoc, addDoc, collection, DocumentReference, serverTimestamp, updateDoc } from "firebase/firestore";
import { getStorage, ref as storageRefFirebase, uploadBytesResumable, getDownloadURL } from "firebase/storage"; // Explicit import for storageRef
import { db, storage } from "@/lib/firebase";
import { format, parseISO, isValid } from 'date-fns';
import Image from "next/image"; // For image preview
import { Progress } from "@/components/ui/progress"; // For upload progress

const attachedDocSchema = z.object({
  docId: z.string().optional(),
  docType: z.enum(["PoliceClearance", "PreviousLicenseCopy", "BirthCertificateCopy", "NIDCardCopy", "IDPhoto", "Other"]),
  docOtherDescription: z.string().optional(),
  fileName: z.string().min(1, "File name is required for uploaded documents."),
  fileUrl: z.string().url("Valid URL required.").min(1, "File URL is required."),
  uploadedAt: z.custom<Timestamp>().default(() => Timestamp.now()),
});

const operatorLicenseFormSchema = z.object({
  applicationType: z.enum(["New", "Renewal"]),
  previousLicenseNumber: z.string().optional(),

  operatorId: z.string().optional(),
  surname: z.string().min(1, "Surname is required"),
  firstName: z.string().min(1, "First name is required"),
  dobString: z.string().min(1, "Date of birth is required").refine(val => isValid(parseISO(val)), { message: "Invalid date format. Use YYYY-MM-DD."}),
  sex: z.enum(["Male", "Female", "Other"]),
  placeOfOriginTown: z.string().min(1, "Town is required"),
  placeOfOriginDistrict: z.string().min(1, "District is required"),
  placeOfOriginLLG: z.string().min(1, "LLG is required"),
  placeOfOriginVillage: z.string().min(1, "Village is required"),
  phoneMobile: z.string().min(1, "Mobile phone is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  postalAddress: z.string().min(1, "Postal address is required"),
  heightCm: z.number().positive("Height must be positive").optional().nullable(),
  eyeColor: z.string().optional(),
  skinColor: z.string().optional(),
  hairColor: z.string().optional(),
  weightKg: z.number().positive("Weight must be positive").optional().nullable(),
  bodyMarks: z.string().optional(),
  idSizePhotoUrl: z.string().url("Valid URL for photo required").optional().or(z.literal("")),
  
  attachedDocuments: z.array(attachedDocSchema).optional().default([]),

  assignedLicenseNumber: z.string().optional(),
  receiptNo: z.string().optional(),
  placeIssued: z.string().optional(),
  methodOfPayment: z.enum(["Cash", "Card", "BankDeposit", "Other"]).optional(),
  paymentBy: z.string().optional(),
  paymentDateString: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format for payment date." }),
  paymentAmount: z.number().positive("Payment amount must be positive").optional().nullable(),
  issuedAtString: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format for issue date." }),
  expiryDateString: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format for expiry date." }),
  licenseClass: z.string().optional(),
  restrictions: z.string().optional(),
  notes: z.string().optional(),

}).superRefine((data, ctx) => {
  if (data.applicationType === "Renewal" && !data.previousLicenseNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["previousLicenseNumber"],
      message: "Previous License No. is required for renewals.",
    });
  }
});

type OperatorLicenseFormValues = z.infer<typeof operatorLicenseFormSchema>;

interface OperatorLicenseFormProps {
  mode: "create" | "edit";
  licenseApplicationId?: string;
  existingLicenseData?: Partial<CommercialLicense>;
  existingOperatorData?: Partial<Operator>;
}

const licenseClassOptions = [
  "Commercial Passenger Small Craft",
  "Commercial Fishing Small Craft",
  "Commercial Cargo Small Craft",
  "Commercial Mixed Use Small Craft",
  "Other"
];

export function OperatorLicenseForm({
  mode,
  licenseApplicationId,
  existingLicenseData,
  existingOperatorData,
}: OperatorLicenseFormProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [selectedIdPhotoFile, setSelectedIdPhotoFile] = useState<File | null>(null);
  const [idPhotoPreviewUrl, setIdPhotoPreviewUrl] = useState<string | null>(existingOperatorData?.idSizePhotoUrl || null);
  const [idPhotoUploadProgress, setIdPhotoUploadProgress] = useState<number | null>(null);


  const combinedData = { ...existingOperatorData, ...existingLicenseData };

  const defaultValues: Partial<OperatorLicenseFormValues> = {
    operatorId: existingOperatorData?.operatorId ?? undefined,
    applicationType: combinedData?.applicationType || "New",
    previousLicenseNumber: combinedData?.previousLicenseNumber ?? "",
    surname: combinedData?.surname ?? "",
    firstName: combinedData?.firstName ?? "",
    dobString: combinedData?.dob ? format( (combinedData.dob instanceof Timestamp ? combinedData.dob.toDate() : new Date(combinedData.dob as any)), "yyyy-MM-dd") : "",
    sex: combinedData?.sex || "Male",
    placeOfOriginTown: combinedData?.placeOfOriginTown ?? "",
    placeOfOriginDistrict: combinedData?.placeOfOriginDistrict ?? "",
    placeOfOriginLLG: combinedData?.placeOfOriginLLG ?? "",
    placeOfOriginVillage: combinedData?.placeOfOriginVillage ?? "",
    phoneMobile: combinedData?.phoneMobile ?? "",
    email: combinedData?.email ?? "",
    postalAddress: combinedData?.postalAddress ?? "",
    heightCm: combinedData?.heightCm ?? null,
    eyeColor: combinedData?.eyeColor ?? "",
    skinColor: combinedData?.skinColor ?? "",
    hairColor: combinedData?.hairColor ?? "",
    weightKg: combinedData?.weightKg ?? null,
    bodyMarks: combinedData?.bodyMarks ?? "",
    idSizePhotoUrl: combinedData?.idSizePhotoUrl ?? "",
    attachedDocuments: (combinedData?.attachedDocuments || []).map(doc => ({
        ...doc,
        uploadedAt: doc.uploadedAt instanceof Timestamp ? doc.uploadedAt : Timestamp.fromDate(new Date(doc.uploadedAt as string)),
    })),
    assignedLicenseNumber: combinedData?.assignedLicenseNumber ?? "",
    receiptNo: combinedData?.receiptNo ?? "",
    placeIssued: combinedData?.placeIssued ?? "",
    methodOfPayment: combinedData?.methodOfPayment ?? undefined,
    paymentBy: combinedData?.paymentBy ?? "",
    paymentDateString: combinedData?.paymentDate ? format((combinedData.paymentDate instanceof Timestamp ? combinedData.paymentDate.toDate() : new Date(combinedData.paymentDate as any)), "yyyy-MM-dd") : "",
    paymentAmount: combinedData?.paymentAmount ?? null,
    issuedAtString: combinedData?.issuedAt ? format((combinedData.issuedAt instanceof Timestamp ? combinedData.issuedAt.toDate() : new Date(combinedData.issuedAt as any)), "yyyy-MM-dd") : "",
    expiryDateString: combinedData?.expiryDate ? format((combinedData.expiryDate instanceof Timestamp ? combinedData.expiryDate.toDate() : new Date(combinedData.expiryDate as any)), "yyyy-MM-dd") : "",
    licenseClass: combinedData?.licenseClass ?? "",
    restrictions: combinedData?.restrictions ?? "",
    notes: combinedData?.notes ?? "",
  };

  const form = useForm<OperatorLicenseFormValues>({
    resolver: zodResolver(operatorLicenseFormSchema),
    defaultValues,
    mode: "onChange",
  });

  useEffect(() => {
    // Initialize preview URL if existing data has it
    if (existingOperatorData?.idSizePhotoUrl) {
      setIdPhotoPreviewUrl(existingOperatorData.idSizePhotoUrl);
    }
  }, [existingOperatorData?.idSizePhotoUrl]);

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "attachedDocuments",
  });

  const watchApplicationType = form.watch("applicationType");

  const handleIdPhotoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedIdPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdPhotoPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
      // Clear the form's idSizePhotoUrl field value as we will get it from upload
      form.setValue("idSizePhotoUrl", ""); 
    } else {
      setSelectedIdPhotoFile(null);
      // Revert to existing image URL if available, otherwise null
      setIdPhotoPreviewUrl(existingOperatorData?.idSizePhotoUrl || null);
    }
  };

  const onSubmit = async (data: OperatorLicenseFormValues, submissionStatus: CommercialLicense["status"]) => {
    if (!currentUser?.userId) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    
    let finalIdSizePhotoUrl = data.idSizePhotoUrl; // Start with existing or form-provided URL (if any)

    if (selectedIdPhotoFile) {
      toast({ title: "Uploading ID Photo...", description: "Please wait." });
      setIdPhotoUploadProgress(0);
      const photoFileName = `${Date.now()}_${selectedIdPhotoFile.name}`;
      // Use operatorId if available and in edit mode, otherwise use a timestamp for uniqueness
      const operatorContextId = data.operatorId || (mode === 'edit' ? licenseApplicationId : Date.now().toString());
      const photoPath = `operator_photos/${operatorContextId}/${photoFileName}`;
      const photoStorageRef = storageRefFirebase(storage, photoPath);

      try {
        const uploadTask = uploadBytesResumable(photoStorageRef, selectedIdPhotoFile);
        await new Promise<void>((resolve, reject) => {
          uploadTask.on('state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setIdPhotoUploadProgress(progress);
            },
            (error) => {
              console.error("ID Photo upload error:", error);
              reject(error);
            },
            async () => {
              finalIdSizePhotoUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve();
            }
          );
        });
        toast({ title: "ID Photo Upload Successful" });
        setIdPhotoUploadProgress(100);
      } catch (error) {
        toast({ title: "ID Photo Upload Failed", description: "Could not upload ID photo. Please try again.", variant: "destructive" });
        setIdPhotoUploadProgress(null);
        return; // Stop submission if photo upload fails
      }
    }


    try {
      let operatorId = data.operatorId || (mode === 'edit' && existingOperatorData?.operatorId ? existingOperatorData.operatorId : undefined);
      const operatorDocData: Omit<Operator, 'operatorId' | 'createdAt' | 'updatedAt' | 'createdByRef' | 'lastUpdatedByRef'> & { createdAt?: Timestamp, updatedAt?: Timestamp, createdByRef?: DocumentReference<User>, lastUpdatedByRef?: DocumentReference<User>, idSizePhotoUrl: string } = {
        surname: data.surname,
        firstName: data.firstName,
        dob: Timestamp.fromDate(parseISO(data.dobString)),
        sex: data.sex,
        placeOfOriginTown: data.placeOfOriginTown,
        placeOfOriginDistrict: data.placeOfOriginDistrict,
        placeOfOriginLLG: data.placeOfOriginLLG,
        placeOfOriginVillage: data.placeOfOriginVillage,
        phoneMobile: data.phoneMobile,
        email: data.email ?? "",
        postalAddress: data.postalAddress,
        heightCm: data.heightCm ?? null,
        eyeColor: data.eyeColor ?? "",
        skinColor: data.skinColor ?? "",
        hairColor: data.hairColor ?? "",
        weightKg: data.weightKg ?? null,
        bodyMarks: data.bodyMarks ?? "",
        idSizePhotoUrl: finalIdSizePhotoUrl ?? "",
      };

      if (mode === 'create' || !operatorId) {
        operatorDocData.createdAt = Timestamp.now();
        operatorDocData.createdByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
        const operatorColRef = collection(db, "operators");
        const newOperatorDocRef = await addDoc(operatorColRef, operatorDocData);
        operatorId = newOperatorDocRef.id;
        form.setValue("operatorId", operatorId);
      } else {
        operatorDocData.updatedAt = Timestamp.now();
        operatorDocData.lastUpdatedByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
        const operatorDocRef = doc(db, "operators", operatorId!);
        await updateDoc(operatorDocRef, operatorDocData);
      }
      const finalOperatorRef = doc(db, "operators", operatorId!) as DocumentReference<Operator>;

      const licenseDocData: Partial<CommercialLicense> = {
        operatorRef: finalOperatorRef,
        applicationType: data.applicationType,
        previousLicenseNumber: data.previousLicenseNumber ?? "",
        status: submissionStatus,
        assignedLicenseNumber: data.assignedLicenseNumber ?? "",
        receiptNo: data.receiptNo ?? "",
        placeIssued: data.placeIssued ?? "",
        methodOfPayment: data.methodOfPayment ?? null,
        paymentBy: data.paymentBy ?? "",
        paymentAmount: data.paymentAmount ?? null,
        attachedDocuments: data.attachedDocuments.map(d => {
            const uploadedAtTs = d.uploadedAt instanceof Timestamp ? d.uploadedAt : Timestamp.fromDate(new Date(d.uploadedAt as any));
            return {...d, uploadedAt: uploadedAtTs};
        }),
        notes: data.notes ?? "",
        licenseClass: data.licenseClass ?? "", 
        restrictions: data.restrictions ?? "",
      };
      
      licenseDocData.submittedAt = (submissionStatus === "Submitted")
        ? Timestamp.now()
        : (mode === 'edit' && existingLicenseData?.submittedAt
            ? (existingLicenseData.submittedAt instanceof Timestamp ? existingLicenseData.submittedAt : Timestamp.fromDate(new Date(existingLicenseData.submittedAt as any)))
            : null);

      licenseDocData.approvedAt = (mode === 'edit' && existingLicenseData?.approvedAt)
        ? (existingLicenseData.approvedAt instanceof Timestamp ? existingLicenseData.approvedAt : Timestamp.fromDate(new Date(existingLicenseData.approvedAt as any)))
        : null;

      licenseDocData.issuedAt = data.issuedAtString
        ? Timestamp.fromDate(parseISO(data.issuedAtString))
        : (mode === 'edit' && existingLicenseData?.issuedAt ? (existingLicenseData.issuedAt instanceof Timestamp ? existingLicenseData.issuedAt : Timestamp.fromDate(new Date(existingLicenseData.issuedAt as any))) : null);

      licenseDocData.expiryDate = data.expiryDateString
        ? Timestamp.fromDate(parseISO(data.expiryDateString))
        : (mode === 'edit' && existingLicenseData?.expiryDate ? (existingLicenseData.expiryDate instanceof Timestamp ? existingLicenseData.expiryDate : Timestamp.fromDate(new Date(existingLicenseData.expiryDate as any))) : null);

      licenseDocData.paymentDate = data.paymentDateString
        ? Timestamp.fromDate(parseISO(data.paymentDateString))
        : (mode === 'edit' && existingLicenseData?.paymentDate ? (existingLicenseData.paymentDate instanceof Timestamp ? existingLicenseData.paymentDate : Timestamp.fromDate(new Date(existingLicenseData.paymentDate as any))) : null);
      
      let finalLicenseApplicationId = licenseApplicationId;

      if (mode === 'create') {
        const licenseColRef = collection(db, "operatorLicenseApplications");
        const finalLicenseDataForCreate = {
            ...licenseDocData,
            createdAt: Timestamp.now(),
            createdByUserRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
            lastUpdatedAt: Timestamp.now(),
            lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
        };
        const newLicenseDocRef = await addDoc(licenseColRef, finalLicenseDataForCreate as CommercialLicense);
        finalLicenseApplicationId = newLicenseDocRef.id;
        toast({ title: "Application Saved", description: `Status: ${submissionStatus}. ID: ${finalLicenseApplicationId}` });
        router.push(`/commercial-licenses/${finalLicenseApplicationId}`);
      } else if (finalLicenseApplicationId) {
        const licenseDocRef = doc(db, "operatorLicenseApplications", finalLicenseApplicationId);
        const finalLicenseDataForUpdate = {
            ...licenseDocData,
            lastUpdatedAt: Timestamp.now(),
            lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
        };
        await updateDoc(licenseDocRef, finalLicenseDataForUpdate);
        toast({ title: "Application Updated", description: `Status: ${submissionStatus}.` });
        router.push(`/commercial-licenses/${finalLicenseApplicationId}`);
      }
      router.refresh();

    } catch (error: any) {
      console.error("Error saving commercial license:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save commercial license.", variant: "destructive" });
    } finally {
        setIdPhotoUploadProgress(null); // Reset progress after attempt
    }
  };
  
  const documentTypes: Array<CommercialLicenseAttachedDoc['docType']> = ["PoliceClearance", "PreviousLicenseCopy", "BirthCertificateCopy", "NIDCardCopy", "IDPhoto", "Other"];

  return (
    <Form {...form}>
      <form className="space-y-8">
        <Card>
          <CardHeader><CardTitle>Application Type</CardTitle></CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="applicationType"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormControl>
                     <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="New">New Application</SelectItem>
                          <SelectItem value="Renewal">Renewal</SelectItem>
                        </SelectContent>
                      </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {watchApplicationType === "Renewal" && (
              <FormField
                control={form.control}
                name="previousLicenseNumber"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>Previous License Number *</FormLabel>
                    <FormControl><Input placeholder="Enter previous license number" {...field} value={field.value ?? ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Applicant Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="surname" render={({ field }) => (<FormItem><FormLabel>Surname *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="dobString" render={({ field }) => (<FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="sex" render={({ field }) => (<FormItem><FormLabel>Sex *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Male", "Female", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginTown" render={({ field }) => (<FormItem><FormLabel>Place of Origin: Town *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginDistrict" render={({ field }) => (<FormItem><FormLabel>District *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginLLG" render={({ field }) => (<FormItem><FormLabel>LLG *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginVillage" render={({ field }) => (<FormItem><FormLabel>Village *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="phoneMobile" render={({ field }) => (<FormItem><FormLabel>Mobile Phone *</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="postalAddress" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Postal Address *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Physical Characteristics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="heightCm" render={({ field }) => (<FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="eyeColor" render={({ field }) => (<FormItem><FormLabel>Colour of Eyes</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="skinColor" render={({ field }) => (<FormItem><FormLabel>Colour of Skin</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="hairColor" render={({ field }) => (<FormItem><FormLabel>Colour of Hair</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="weightKg" render={({ field }) => (<FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="bodyMarks" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Any body marks (e.g., tattoo, scar)</FormLabel><FormControl><Textarea {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ID Photo</CardTitle></CardHeader>
          <CardContent>
            <FormItem>
              <FormLabel htmlFor="id-photo-upload">Passport-size Photo</FormLabel>
              {idPhotoPreviewUrl && (
                <div className="mt-2 mb-2 w-32 h-40 relative border rounded-md overflow-hidden" data-ai-hint="person portrait">
                  <Image src={idPhotoPreviewUrl} alt="ID Photo Preview" layout="fill" objectFit="cover" />
                </div>
              )}
              <FormControl>
                <Input id="id-photo-upload" type="file" accept="image/*" onChange={handleIdPhotoFileChange} className="mt-1" />
              </FormControl>
              {idPhotoUploadProgress !== null && idPhotoUploadProgress < 100 && (
                  <Progress value={idPhotoUploadProgress} className="w-full mt-2 h-2" />
              )}
              {idPhotoUploadProgress === 100 && <p className="text-xs text-green-600 mt-1">Upload complete. Image will be saved with form.</p>}
              <FormDescription>Upload a clear, passport-style photo of the applicant.</FormDescription>
              <FormMessage>{/* This will show errors for idSizePhotoUrl if any after schema validation, e.g. if URL required by schema but not uploaded */}</FormMessage>
            </FormItem>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Document Attachments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {fields.map((item, index) => (
              <div key={item.id} className="p-4 border rounded-md space-y-3">
                <FormField
                  control={form.control}
                  name={`attachedDocuments.${index}.docType`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Document Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {documentTypes.map(type => <SelectItem key={type} value={type}>{type.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.watch(`attachedDocuments.${index}.docType`) === "Other" && (
                  <FormField control={form.control} name={`attachedDocuments.${index}.docOtherDescription`} render={({ field }) => (<FormItem><FormLabel>Other Description *</FormLabel><FormControl><Input placeholder="Specify document type" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                )}
                <FormField control={form.control} name={`attachedDocuments.${index}.fileName`} render={({ field }) => (<FormItem><FormLabel>File Name *</FormLabel><FormControl><Input placeholder="document.pdf" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name={`attachedDocuments.${index}.fileUrl`} render={({ field }) => (<FormItem><FormLabel>File URL *</FormLabel><FormControl><Input type="url" placeholder="https://placehold.co/100x100.png?text=DOC" {...field} /></FormControl><FormDescription>Placeholder for actual file upload.</FormDescription><FormMessage /></FormItem>)} />
                <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}><Trash2 className="mr-2 h-4 w-4" /> Remove Document</Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ docId: crypto.randomUUID(), docType: "Other", fileName: "", fileUrl: "https://placehold.co/100x100.png?text=DOC", uploadedAt: Timestamp.now() })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Document
            </Button>
          </CardContent>
        </Card>

        <Card>
            <CardHeader><CardTitle>Office Use Only</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <FormField control={form.control} name="assignedLicenseNumber" render={({ field }) => (<FormItem><FormLabel>Assigned License No.</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="receiptNo" render={({ field }) => (<FormItem><FormLabel>Receipt No.</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="placeIssued" render={({ field }) => (<FormItem><FormLabel>Place Issued</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="methodOfPayment" render={({ field }) => (<FormItem><FormLabel>Method of Payment</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{["Cash", "Card", "BankDeposit", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="paymentBy" render={({ field }) => (<FormItem><FormLabel>Payment By</FormLabel><FormControl><Input {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="paymentDateString" render={({ field }) => (<FormItem><FormLabel>Payment Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="paymentAmount" render={({ field }) => (<FormItem><FormLabel>Payment Amount</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ""} onChange={e => field.onChange(e.target.value === "" ? null : parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="issuedAtString" render={({ field }) => (<FormItem><FormLabel>Date Issued</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="expiryDateString" render={({ field }) => (<FormItem><FormLabel>Expiry Date</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                 <FormField
                    control={form.control}
                    name="licenseClass"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>License Class</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Select license class..." /></SelectTrigger></FormControl>
                          <SelectContent>
                            {licenseClassOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                 <FormField control={form.control} name="restrictions" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Restrictions</FormLabel><FormControl><Textarea placeholder="e.g., Daylight hours only" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
            </CardContent>
        </Card>
        
        <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>General Notes</FormLabel><FormControl><Textarea placeholder="Any other relevant notes for this application" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />


        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit(data => onSubmit(data, "Draft"))} disabled={form.formState.isSubmitting || (idPhotoUploadProgress !== null && idPhotoUploadProgress < 100)}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button type="button" onClick={form.handleSubmit(data => onSubmit(data, "Submitted"))} disabled={form.formState.isSubmitting || (idPhotoUploadProgress !== null && idPhotoUploadProgress < 100)}>
            <Send className="mr-2 h-4 w-4" /> {mode === "create" ? "Submit Application" : "Update & Submit"}
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
