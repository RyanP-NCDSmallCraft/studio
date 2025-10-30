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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import type { CommercialLicense, Registration, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Ship, ChevronsUpDown, Check, CalendarIcon } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Timestamp, addDoc, collection, doc, getDocs, DocumentReference, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO, isValid, addYears } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Calendar } from "@/components/ui/calendar";

const commercialLicenseFormSchema = z.object({
  registrationRefId: z.string().min(1, "Craft registration is required"),
  licenseType: z.enum(["Passenger", "Fishing", "Cargo", "MixedUse", "Other"]),
  licenseTypeOtherDesc: z.string().optional(),
  issuedAt: z.date({ required_error: "Issue date is required" }),
  expiryDate: z.date({ required_error: "Expiry date is required" }),
  conditions: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.licenseType === "Other" && !data.licenseTypeOtherDesc) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["licenseTypeOtherDesc"],
      message: "Description is required for 'Other' license type.",
    });
  }
  if (data.expiryDate <= data.issuedAt) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "Expiry date must be after the issue date.",
    });
  }
});

type CommercialLicenseFormValues = z.infer<typeof commercialLicenseFormSchema>;

interface RegistrationSelectItem {
  value: string;
  label: string;
  scaRegoNo?: string;
  craftDetails?: string;
}

interface CommercialLicenseFormProps {
  mode: "create" | "edit";
  licenseId?: string;
  existingLicenseData?: CommercialLicense | null;
}

export function CommercialLicenseForm({ mode, licenseId, existingLicenseData }: CommercialLicenseFormProps) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [registrations, setRegistrations] = useState<RegistrationSelectItem[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [openRegistrationPopover, setOpenRegistrationPopover] = useState(false);

  const defaultValues: Partial<CommercialLicenseFormValues> = existingLicenseData
    ? {
        registrationRefId: typeof existingLicenseData.registrationRef === 'string' ? existingLicenseData.registrationRef : (existingLicenseData.registrationRef as DocumentReference).id,
        licenseType: existingLicenseData.licenseType,
        licenseTypeOtherDesc: existingLicenseData.licenseTypeOtherDesc,
        issuedAt: existingLicenseData.issuedAt instanceof Timestamp ? existingLicenseData.issuedAt.toDate() : new Date(existingLicenseData.issuedAt as any),
        expiryDate: existingLicenseData.expiryDate instanceof Timestamp ? existingLicenseData.expiryDate.toDate() : new Date(existingLicenseData.expiryDate as any),
        conditions: existingLicenseData.conditions,
      }
    : {
        licenseType: "Passenger",
        issuedAt: new Date(),
        expiryDate: addYears(new Date(), 1),
      };

  const form = useForm<CommercialLicenseFormValues>({
    resolver: zodResolver(commercialLicenseFormSchema),
    defaultValues,
  });

  const watchLicenseType = form.watch("licenseType");

  useEffect(() => {
    const fetchRegistrations = async () => {
      setLoadingRegistrations(true);
      try {
        const querySnapshot = await getDocs(collection(db, "registrations"));
        const regsData = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data() as Registration;
          return {
            value: docSnap.id,
            label: `${data.scaRegoNo || 'Draft/Pending'} - ${data.craftMake} ${data.craftModel}`,
            scaRegoNo: data.scaRegoNo,
            craftDetails: `${data.craftMake} ${data.craftModel} (HIN: ${data.hullIdNumber || 'N/A'})`,
          };
        });
        setRegistrations(regsData);
      } catch (error) {
        console.error("Error fetching registrations:", error);
        toast({ title: "Error", description: "Failed to load craft registrations.", variant: "destructive" });
      }
      setLoadingRegistrations(false);
    };
    fetchRegistrations();
  }, [toast]);

  const onSubmit = async (data: CommercialLicenseFormValues, status: "Draft" | "Active") => {
    if (!currentUser) return;

    let registrationDataForLicense: CommercialLicense['registrationData'] = undefined;
    if (data.registrationRefId) {
        const regDoc = await getDoc(doc(db, "registrations", data.registrationRefId));
        if (regDoc.exists()) {
            const reg = regDoc.data() as Registration;
            registrationDataForLicense = {
                id: regDoc.id,
                scaRegoNo: reg.scaRegoNo,
                craftMake: reg.craftMake,
                craftModel: reg.craftModel,
            };
        }
    }

    const payload: Partial<Omit<CommercialLicense, 'commercialLicenseId' | 'licenseNumber'>> & { createdByRef?: any, lastUpdatedByRef?: any } = {
      registrationRef: doc(db, "registrations", data.registrationRefId) as DocumentReference<Registration>,
      registrationData: registrationDataForLicense,
      licenseType: data.licenseType,
      licenseTypeOtherDesc: data.licenseTypeOtherDesc,
      status,
      issuedAt: Timestamp.fromDate(data.issuedAt),
      expiryDate: Timestamp.fromDate(data.expiryDate),
      conditions: data.conditions,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId),
    };

    try {
      if (mode === "create") {
        payload.createdByRef = doc(db, "users", currentUser.userId);
        payload.createdAt = Timestamp.now();
        payload.licenseNumber = `CL-${Date.now().toString().slice(-6)}`; // Simple unique license number

        const docRef = await addDoc(collection(db, "commercialLicenses"), payload);
        toast({ title: "License Created", description: `Commercial license has been saved as ${status}.` });
        router.push(`/commercial-licenses`);
      } else if (licenseId) {
        await updateDoc(doc(db, "commercialLicenses", licenseId), payload);
        toast({ title: "License Updated", description: "Commercial license details have been updated." });
        router.push(`/commercial-licenses`);
      }
      router.refresh();
    } catch (error: any) {
      console.error("Error saving commercial license:", error);
      toast({ title: "Save Failed", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>License Details</CardTitle>
            <FormDescription>Fill in the details for the new commercial license.</FormDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="registrationRefId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Linked Craft Registration *</FormLabel>
                  <Popover open={openRegistrationPopover} onOpenChange={setOpenRegistrationPopover}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                          disabled={loadingRegistrations}
                        >
                          {field.value ? registrations.find(reg => reg.value === field.value)?.label : "Select Craft..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-[300px] overflow-y-auto">
                      <Command>
                        <CommandInput placeholder="Search Rego No, Make, Model..." />
                        <CommandList>
                          {loadingRegistrations && <CommandItem>Loading...</CommandItem>}
                          <CommandEmpty>No registration found.</CommandEmpty>
                          <CommandGroup>
                            {registrations.map(reg => (
                              <CommandItem
                                value={reg.label}
                                key={reg.value}
                                onSelect={() => {
                                  form.setValue("registrationRefId", reg.value);
                                  setOpenRegistrationPopover(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", reg.value === field.value ? "opacity-100" : "opacity-0")} />
                                 <div>
                                    <div>{reg.scaRegoNo}</div>
                                    <div className="text-xs text-muted-foreground">{reg.craftDetails}</div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {field.value && <FormDescription><Link href={`/registrations/${field.value}`} target="_blank" className="text-primary text-xs hover:underline">View selected craft</Link></FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="licenseType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>License Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select license type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Passenger">Passenger</SelectItem>
                      <SelectItem value="Fishing">Fishing</SelectItem>
                      <SelectItem value="Cargo">Cargo</SelectItem>
                      <SelectItem value="MixedUse">Mixed Use</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchLicenseType === "Other" && (
              <FormField
                control={form.control}
                name="licenseTypeOtherDesc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Other License Type Description *</FormLabel>
                    <FormControl><Input placeholder="Specify other license type" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                    control={form.control}
                    name="issuedAt"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Date of Issue *</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="expiryDate"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Expiry Date *</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                                >
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
              control={form.control}
              name="conditions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conditions / Restrictions</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Daylight hours only, not to exceed 10 nautical miles from shore." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit(data => onSubmit(data, "Draft"))} disabled={form.formState.isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> Save as Draft
          </Button>
          <Button type="button" onClick={form.handleSubmit(data => onSubmit(data, "Active"))} disabled={form.formState.isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Issue License
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
