
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
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
import type { Operator, OperatorLicense, OperatorLicenseAttachedDoc } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, UserCircle, FileText, UploadCloud } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { format, parseISO, isValid } from 'date-fns';

const attachedDocSchema = z.object({
  docId: z.string().optional(),
  docType: z.enum(["PoliceClearance", "PreviousLicenseCopy", "BirthCertificateCopy", "NIDCardCopy", "IDPhoto", "Other"]),
  docOtherDescription: z.string().optional(),
  fileName: z.string().optional(), // Optional as file might not be uploaded yet
  fileUrl: z.string().url().optional(),
  uploadedAt: z.custom<Timestamp>().optional(),
  file: z.any().optional(), // For the HTML file input
});

const operatorLicenseFormSchema = z.object({
  applicationType: z.enum(["New", "Renewal"]),
  previousLicenseNumber: z.string().optional(),

  // Operator details
  surname: z.string().min(1, "Surname is required"),
  firstName: z.string().min(1, "First name is required"),
  dobString: z.string().min(1, "Date of birth is required").refine(val => isValid(parseISO(val)), { message: "Invalid date format. Use YYYY-MM-DD."}),
  age: z.number().optional(), // Consider making this derived or optional
  sex: z.enum(["Male", "Female", "Other"]),
  placeOfOriginTown: z.string().min(1, "Town is required"),
  placeOfOriginDistrict: z.string().min(1, "District is required"),
  placeOfOriginLLG: z.string().min(1, "LLG is required"),
  placeOfOriginVillage: z.string().min(1, "Village is required"),
  phoneMobile: z.string().min(1, "Mobile phone is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  postalAddress: z.string().min(1, "Postal address is required"),
  heightCm: z.number().positive("Height must be positive").optional(),
  eyeColor: z.string().optional(),
  skinColor: z.string().optional(),
  hairColor: z.string().optional(),
  weightKg: z.number().positive("Weight must be positive").optional(),
  bodyMarks: z.string().optional(),
  
  idSizePhoto: z.any().refine(file => file instanceof File || typeof file === 'string', "ID Photo is required for new applications or if changing photo.").optional(), // File or existing URL

  // Attached Documents (simplified for now)
  docPoliceClearance: z.any().optional(),
  docPreviousLicenseCopy: z.any().optional(),
  docBirthCertificateCopy: z.any().optional(),
  docNIDCardCopy: z.any().optional(),

  // Office Use Only - these will be disabled for applicants
  // assignedLicenseNumber: z.string().optional(),
  // receiptNo: z.string().optional(),
  // placeIssued: z.string().optional(),
  // methodOfPayment: z.enum(["Cash", "Card", "BankDeposit", "Other"]).optional(),
  // paymentBy: z.string().optional(),
  // paymentDateString: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format." }),
  // paymentAmount: z.number().positive().optional(),
  // issuedAtString: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format." }),
  // expiryDateString: z.string().optional().refine(val => !val || isValid(parseISO(val)), { message: "Invalid date format." }),
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
  existingLicenseData?: Partial<OperatorLicense>; // Includes operatorData potentially
  existingOperatorData?: Partial<Operator>;
}

export function OperatorLicenseForm({
  mode,
  licenseApplicationId,
  existingLicenseData,
  existingOperatorData,
}: OperatorLicenseFormProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  // Combine existing data for default values
  const combinedData = { ...existingOperatorData, ...existingLicenseData };

  const defaultValues: Partial<OperatorLicenseFormValues> = {
    applicationType: combinedData?.applicationType || "New",
    previousLicenseNumber: combinedData?.previousLicenseNumber || "",
    surname: combinedData?.surname || "",
    firstName: combinedData?.firstName || "",
    dobString: combinedData?.dob ? format(combinedData.dob.toDate(), "yyyy-MM-dd") : "",
    age: combinedData?.age || undefined,
    sex: combinedData?.sex || "Male",
    placeOfOriginTown: combinedData?.placeOfOriginTown || "",
    placeOfOriginDistrict: combinedData?.placeOfOriginDistrict || "",
    placeOfOriginLLG: combinedData?.placeOfOriginLLG || "",
    placeOfOriginVillage: combinedData?.placeOfOriginVillage || "",
    phoneMobile: combinedData?.phoneMobile || "",
    email: combinedData?.email || "",
    postalAddress: combinedData?.postalAddress || "",
    heightCm: combinedData?.heightCm || undefined,
    eyeColor: combinedData?.eyeColor || "",
    skinColor: combinedData?.skinColor || "",
    hairColor: combinedData?.hairColor || "",
    weightKg: combinedData?.weightKg || undefined,
    bodyMarks: combinedData?.bodyMarks || "",
    idSizePhoto: combinedData?.idSizePhotoUrl || undefined, // For displaying existing photo URL or handling new file
    // Simplified document placeholders
    docPoliceClearance: undefined, 
    docPreviousLicenseCopy: undefined,
    docBirthCertificateCopy: undefined,
    docNIDCardCopy: undefined,
  };

  const form = useForm<OperatorLicenseFormValues>({
    resolver: zodResolver(operatorLicenseFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const watchApplicationType = form.watch("applicationType");

  const onSubmit = async (data: OperatorLicenseFormValues, status: OperatorLicense["status"]) => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    
    // Basic placeholder submission logic
    console.log("Form Data:", data);
    console.log("Submission Status:", status);
    
    // In a real app:
    // 1. Handle file uploads for idSizePhoto and attachedDocuments (upload to Firebase Storage, get URLs)
    // 2. Create/Update Operator document in 'operators' collection
    // 3. Create/Update OperatorLicense document in 'operatorLicenses' collection

    toast({
      title: mode === "create" ? "Application Saved (Simulated)" : "Application Updated (Simulated)",
      description: `Status: ${status}`,
    });

    if (status === "Submitted") {
      router.push("/operator-licenses"); // Redirect to list after submission
    } else if (mode === "edit" && licenseApplicationId) {
      router.push(`/operator-licenses/${licenseApplicationId}`); // Redirect to detail view after saving draft
    }
     router.refresh();
  };
  
  const documentTypes: Array<{ key: keyof OperatorLicenseFormValues; label: string; required?: boolean; forRenewalOnly?: boolean }> = [
    { key: "docPoliceClearance", label: "Police Clearance", required: true },
    { key: "docPreviousLicenseCopy", label: "Copy of Operator's License", forRenewalOnly: true },
    { key: "docBirthCertificateCopy", label: "Copy of Birth Certificate / NID Card", required: true },
    // { key: "docNIDCardCopy", label: "Copy of NID Card", required: true }, // Merged with birth cert for simplicity
  ];


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
                     <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    <FormControl><Input placeholder="Enter previous license number" {...field} /></FormControl>
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
            <FormField control={form.control} name="sex" render={({ field }) => (<FormItem><FormLabel>Sex *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Male", "Female", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginTown" render={({ field }) => (<FormItem><FormLabel>Place of Origin: Town *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginDistrict" render={({ field }) => (<FormItem><FormLabel>District *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginLLG" render={({ field }) => (<FormItem><FormLabel>LLG *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="placeOfOriginVillage" render={({ field }) => (<FormItem><FormLabel>Village *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="phoneMobile" render={({ field }) => (<FormItem><FormLabel>Mobile Phone *</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="postalAddress" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Postal Address *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Physical Characteristics</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="heightCm" render={({ field }) => (<FormItem><FormLabel>Height (cm)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || undefined)} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="eyeColor" render={({ field }) => (<FormItem><FormLabel>Colour of Eyes</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="skinColor" render={({ field }) => (<FormItem><FormLabel>Colour of Skin</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="hairColor" render={({ field }) => (<FormItem><FormLabel>Colour of Hair</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="weightKg" render={({ field }) => (<FormItem><FormLabel>Weight (kg)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || undefined)} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="bodyMarks" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Any body marks (e.g., tattoo, scar)</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>ID Photo Upload</CardTitle></CardHeader>
          <CardContent>
             <FormField
                control={form.control}
                name="idSizePhoto"
                render={({ field: { onChange, value, ...rest } }) => (
                  <FormItem>
                    <FormLabel>Passport-size Photo *</FormLabel>
                    <FormControl>
                      <Input type="file" accept="image/*" onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)} {...rest} />
                    </FormControl>
                    {typeof value === 'string' && value && <FormDescription>Current photo: <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">View Photo</a>. Upload a new one to replace it.</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader><CardTitle>Document Attachments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {documentTypes.map((docType) => {
              if (docType.forRenewalOnly && watchApplicationType !== "Renewal") {
                return null;
              }
              return (
                <FormField
                  key={docType.key}
                  control={form.control}
                  name={docType.key as any} /* Casting as any for dynamic name */
                  render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                      <FormLabel>{docType.label} {docType.required ? "*" : ""}</FormLabel>
                      <FormControl>
                        <Input type="file" onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)} {...rest} />
                      </FormControl>
                      {/* Placeholder for showing existing uploaded file */}
                      {typeof value === 'string' && value && <FormDescription>Current file: {value}</FormDescription>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              );
            })}
          </CardContent>
        </Card>


        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit(data => onSubmit(data, "Draft"))} disabled={form.formState.isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button type="button" onClick={form.handleSubmit(data => onSubmit(data, "Submitted"))} disabled={form.formState.isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Submit Application
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}

    