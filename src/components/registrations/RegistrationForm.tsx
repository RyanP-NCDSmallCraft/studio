
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
import { Separator } from "@/components/ui/separator";
import type { Registration, Owner, ProofOfOwnershipDoc } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Users, FileUp, Trash2, PlusCircle } from "lucide-react";
import React, { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { OwnerManager } from "./OwnerManager";
import { FileUploadManager } from "./FileUploadManager";


// Define Zod schema for validation
const ownerSchema = z.object({
  ownerId: z.string().uuid().optional(), // Optional because it's generated on add
  role: z.enum(["Primary", "CoOwner"]),
  surname: z.string().min(1, "Surname is required"),
  firstName: z.string().min(1, "First name is required"),
  dob: z.date({ required_error: "Date of birth is required"}),
  sex: z.enum(["Male", "Female", "Other"]),
  phone: z.string().min(1, "Phone number is required"),
  fax: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
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
  uploadedAt: z.custom<Timestamp>(val => val instanceof Timestamp, "Invalid timestamp"),
});

const registrationFormSchema = z.object({
  registrationType: z.enum(["New", "Renewal"]),
  previousScaRegoNo: z.string().optional(),
  provinceOfRegistration: z.string().min(1, "Province is required"),
  
  owners: z.array(ownerSchema).min(1, "At least one owner is required").max(5, "Maximum of 5 owners"),
  proofOfOwnershipDocs: z.array(proofOfOwnershipDocSchema).min(1, "At least one proof of ownership document is required"),

  craftMake: z.string().min(1, "Craft make is required"),
  craftModel: z.string().min(1, "Craft model is required"),
  craftYear: z.number().int().min(1900, "Invalid year").max(new Date().getFullYear() + 1, "Invalid year"),
  craftColor: z.string().min(1, "Craft color is required"),
  hullIdNumber: z.string().min(1, "Hull ID number is required"),
  craftLength: z.number().positive("Length must be positive"),
  lengthUnits: z.enum(["m", "ft"]),
  distinguishingFeatures: z.string().optional(),
  
  propulsionType: z.enum(["Inboard", "Outboard", "Both", "Sail", "Other"]),
  propulsionOtherDesc: z.string().optional(),
  hullMaterial: z.enum(["Wood", "Fiberglass", "Metal", "Inflatable", "Other"]),
  hullMaterialOtherDesc: z.string().optional(),
  craftUse: z.enum(["Pleasure", "Passenger", "Fishing", "Cargo", "Other"]),
  craftUseOtherDesc: z.string().optional(),
  fuelType: z.enum(["Electric", "Gasoline", "Diesel", "Other"]),
  fuelTypeOtherDesc: z.string().optional(),
  vesselType: z.enum(["OpenBoat", "CabinCruiser", "Sailboat", "PWC", "Other"]),
  vesselTypeOtherDesc: z.string().optional(),

  // Payment fields (optional at draft stage)
  paymentMethod: z.enum(["Cash", "Card", "BankDeposit"]).optional(),
  paymentReceiptNumber: z.string().optional(),
  bankStampRef: z.string().optional(),
  paymentAmount: z.number().positive("Amount must be positive").optional(),
  paymentDate: z.date().optional(),

  // Safety cert fields (optional at draft stage)
  safetyCertNumber: z.string().optional(),
  safetyEquipIssued: z.boolean().optional(),
  safetyEquipReceiptNumber: z.string().optional(),
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
      ...existingRegistrationData,
      craftYear: existingRegistrationData.craftYear || undefined,
      craftLength: existingRegistrationData.craftLength || undefined,
      owners: existingRegistrationData.owners.map(o => ({...o, dob: o.dob.toDate()})), // Convert Timestamps to Dates
      proofOfOwnershipDocs: existingRegistrationData.proofOfOwnershipDocs, // Assuming these are already correct type or handled by FileUploadManager
      paymentDate: existingRegistrationData.paymentDate?.toDate(),
    }
  : {
      registrationType: "New",
      lengthUnits: "m",
      propulsionType: "Outboard",
      hullMaterial: "Fiberglass",
      craftUse: "Pleasure",
      fuelType: "Gasoline",
      vesselType: "OpenBoat",
      owners: [],
      proofOfOwnershipDocs: [],
      craftYear: new Date().getFullYear(),
    };

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationFormSchema),
    defaultValues,
    mode: "onChange", // Validate on change for better UX
  });

  const [owners, setOwners] = useState<Owner[]>(existingRegistrationData?.owners || []);
  const [proofDocs, setProofDocs] = useState<ProofOfOwnershipDoc[]>(existingRegistrationData?.proofOfOwnershipDocs || []);


  React.useEffect(() => {
    form.setValue("owners", owners as any); // Cast needed because Zod schema expects Date, but Firestore stores Timestamp
  }, [owners, form]);

  React.useEffect(() => {
    form.setValue("proofOfOwnershipDocs", proofDocs as any);
  }, [proofDocs, form]);

  const onSubmit = async (data: RegistrationFormValues, status: "Draft" | "Submitted") => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    // In a real app, convert Dates back to Timestamps for Firestore
    const submissionData = {
      ...data,
      owners: data.owners.map(o => ({...o, dob: Timestamp.fromDate(o.dob)})),
      paymentDate: data.paymentDate ? Timestamp.fromDate(data.paymentDate) : undefined,
      status,
      // createdByRef, lastUpdatedByRef, createdAt, lastUpdatedAt would be set on server or here
    };

    console.log("Submitting registration data:", submissionData);

    try {
      if (mode === "create") {
        // Add to Firestore: db.collection("registrations").add(submissionData)
        toast({ title: "Registration Saved", description: `Status: ${status}` });
        router.push("/registrations"); // Redirect to list page
      } else if (registrationId) {
        // Update in Firestore: db.collection("registrations").doc(registrationId).update(submissionData)
        toast({ title: "Registration Updated", description: `Status: ${status}` });
        router.push(`/registrations/${registrationId}`); // Redirect to detail page
      }
       router.refresh();
    } catch (error) {
      console.error("Error saving registration:", error);
      toast({ title: "Save Failed", description: "Could not save registration. Please try again.", variant: "destructive" });
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
            <FormField
              control={form.control}
              name="provinceOfRegistration"
              render={({ field }) => (
                <FormItem className={watchRegistrationType === "New" ? "md:col-span-2" : ""}>
                  <FormLabel>Province of Registration *</FormLabel>
                  <FormControl><Input placeholder="e.g., National Capital District" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        
        {/* Owners Section */}
        <OwnerManager owners={owners} setOwners={setOwners} form={form as any /* Pass form for triggering validation if needed */} />

        {/* Proof of Ownership */}
        <FileUploadManager title="Proof of Ownership Documents *" docs={proofDocs} setDocs={setProofDocs} storagePath="proof_of_ownership/" form={form as any} fieldName="proofOfOwnershipDocs" />


        {/* Craft Details */}
        <Card>
          <CardHeader><CardTitle>Craft Information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="craftMake" render={({ field }) => (<FormItem><FormLabel>Craft Make *</FormLabel><FormControl><Input placeholder="e.g., Yamaha" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="craftModel" render={({ field }) => (<FormItem><FormLabel>Craft Model *</FormLabel><FormControl><Input placeholder="e.g., FX Cruiser HO" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="craftYear" render={({ field }) => (<FormItem><FormLabel>Craft Year *</FormLabel><FormControl><Input type="number" placeholder="e.g., 2023" {...field} onChange={e => field.onChange(parseInt(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="craftColor" render={({ field }) => (<FormItem><FormLabel>Craft Color *</FormLabel><FormControl><Input placeholder="e.g., Blue/White" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="hullIdNumber" render={({ field }) => (<FormItem><FormLabel>Hull ID / Serial No. *</FormLabel><FormControl><Input placeholder="Enter HIN" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="craftLength" render={({ field }) => (<FormItem><FormLabel>Craft Length *</FormLabel><FormControl><Input type="number" placeholder="e.g., 3.5" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="lengthUnits" render={({ field }) => (<FormItem><FormLabel>Units *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="m">Meters (m)</SelectItem><SelectItem value="ft">Feet (ft)</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            </div>
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

            <FormField control={form.control} name="craftUse" render={({ field }) => (<FormItem><FormLabel>Craft Use *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Pleasure", "Passenger", "Fishing", "Cargo", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchCraftUse === "Other" && <FormField control={form.control} name="craftUseOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Craft Use Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}

            <FormField control={form.control} name="fuelType" render={({ field }) => (<FormItem><FormLabel>Fuel Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Electric", "Gasoline", "Diesel", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchFuelType === "Other" && <FormField control={form.control} name="fuelTypeOtherDesc" render={({ field }) => (<FormItem><FormLabel>Other Fuel Type Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}
            
            <FormField control={form.control} name="vesselType" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Vessel Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["OpenBoat", "CabinCruiser", "Sailboat", "PWC", "Other"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            {watchVesselType === "Other" && <FormField control={form.control} name="vesselTypeOtherDesc" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Other Vessel Type Desc. *</FormLabel><FormControl><Input placeholder="Specify other" {...field} /></FormControl><FormMessage /></FormItem>)} />}
          </CardContent>
        </Card>

        {/* Optional Sections: Payment and Safety (shown for completeness) */}
         <Card>
          <CardHeader><CardTitle>Payment Information (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="paymentMethod" render={({ field }) => (<FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select method"/></SelectTrigger></FormControl><SelectContent>{["Cash", "Card", "BankDeposit"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="paymentAmount" render={({ field }) => (<FormItem><FormLabel>Payment Amount</FormLabel><FormControl><Input type="number" placeholder="e.g., 150.00" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="paymentReceiptNumber" render={({ field }) => (<FormItem><FormLabel>Payment Receipt No.</FormLabel><FormControl><Input placeholder="Receipt number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="bankStampRef" render={({ field }) => (<FormItem><FormLabel>Bank Stamp Ref.</FormLabel><FormControl><Input placeholder="Bank stamp reference" {...field} /></FormControl><FormMessage /></FormItem>)} />
            {/* Payment Date: Use ShadCN DatePicker if needed */}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Safety Certificate (Optional)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="safetyCertNumber" render={({ field }) => (<FormItem><FormLabel>Safety Certificate No.</FormLabel><FormControl><Input placeholder="Certificate number" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="safetyEquipIssued" render={({ field }) => (<FormItem><FormLabel>Safety Equipment Issued?</FormLabel><Select onValueChange={val => field.onChange(val === "true")} defaultValue={field.value?.toString()}><FormControl><SelectTrigger><SelectValue placeholder="Select an option"/></SelectTrigger></FormControl><SelectContent><SelectItem value="true">Yes</SelectItem><SelectItem value="false">No</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="safetyEquipReceiptNumber" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Safety Equipment Receipt No.</FormLabel><FormControl><Input placeholder="Equipment receipt number" {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>


        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={() => form.handleSubmit((data) => onSubmit(data, "Draft"))()} disabled={form.formState.isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button type="button" onClick={() => form.handleSubmit((data) => onSubmit(data, "Submitted"))()} disabled={form.formState.isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Submit for Review
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}

