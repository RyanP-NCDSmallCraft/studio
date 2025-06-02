
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray, Controller } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import type { Infringement, InfringementItemDetail, Registration, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Ship, CalendarDays, DollarSign, PlusCircle, Trash2, ChevronsUpDown, Check } from "lucide-react";
import React, { useState, useEffect, useCallback } from "react";
import { Timestamp, addDoc, collection, doc, getDocs, DocumentReference, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { format, parseISO, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

const infringementItemDetailSchema = z.object({
  itemId: z.string(),
  description: z.string(),
  points: z.number().optional(),
  notes: z.string().optional(),
  selected: z.boolean().default(false), // To track selection in the form
});

const infringementFormSchema = z.object({
  registrationRefId: z.string().min(1, "Craft registration is required"),
  issuedAt: z.date({ required_error: "Date of infringement is required" }),
  locationDescription: z.string().min(1, "Location is required"),
  infringementItems: z.array(infringementItemDetailSchema).min(1, "At least one infringement item must be selected.")
    .refine(items => items.some(item => item.selected), {
      message: "At least one infringement item must be selected.",
      path: ["infringementItems"],
    }),
  officerNotes: z.string().optional(),
});

type InfringementFormValues = z.infer<typeof infringementFormSchema>;

interface RegistrationSelectItem {
  value: string;
  label: string;
  scaRegoNo?: string;
  craftDetails?: string;
}

const PREDEFINED_INFRINGEMENT_ITEMS: Omit<InfringementItemDetail, 'notes' | 'selected'>[] = [
  { itemId: "UNREG_CRAFT", description: "Operating an unregistered craft", points: 30 },
  { itemId: "NO_SAFETY_EQUIP", description: "Insufficient/no safety equipment on board", points: 20 },
  { itemId: "OVERLOADING", description: "Overloading the craft (exceeding capacity)", points: 25 },
  { itemId: "RECKLESS_OP", description: "Reckless operation of craft", points: 40 },
  { itemId: "SPEEDING_ZONE", description: "Speeding in a restricted zone", points: 10 },
  { itemId: "NO_LICENSE", description: "Operating without a valid license (if required)", points: 30 },
  { itemId: "ENV_POLLUTION", description: "Discharging pollutants into water", points: 50 },
  { itemId: "FAIL_COMPLY_DIRECTION", description: "Failing to comply with lawful direction", points: 15 },
  { itemId: "IMPROPER_MARKINGS", description: "Improper craft markings/identification", points: 10 },
];


export function InfringementForm({ mode, infringementId, existingInfringementData }: {
  mode: "create" | "edit";
  infringementId?: string;
  existingInfringementData?: Infringement | null;
}) {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [registrationsForSelect, setRegistrationsForSelect] = useState<RegistrationSelectItem[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [openRegistrationPopover, setOpenRegistrationPopover] = useState(false);

  const form = useForm<InfringementFormValues>({
    resolver: zodResolver(infringementFormSchema),
    defaultValues: {
      registrationRefId: existingInfringementData?.registrationRef ? (typeof existingInfringementData.registrationRef === 'string' ? existingInfringementData.registrationRef : (existingInfringementData.registrationRef as DocumentReference).id) : "",
      issuedAt: existingInfringementData?.issuedAt ? (existingInfringementData.issuedAt instanceof Timestamp ? existingInfringementData.issuedAt.toDate() : new Date(existingInfringementData.issuedAt as any)) : new Date(),
      locationDescription: existingInfringementData?.locationDescription || "",
      infringementItems: PREDEFINED_INFRINGEMENT_ITEMS.map(item => ({
        ...item,
        notes: existingInfringementData?.infringementItems.find(ei => ei.itemId === item.itemId)?.notes || "",
        selected: existingInfringementData?.infringementItems.some(ei => ei.itemId === item.itemId) || false,
      })),
      officerNotes: existingInfringementData?.officerNotes || "",
    },
  });

  const { fields, update } = useFieldArray({
    control: form.control,
    name: "infringementItems",
  });

  const watchRegistrationRefId = form.watch("registrationRefId");

  useEffect(() => {
    const fetchRegs = async () => {
      if (!db) return;
      setLoadingRegistrations(true);
      try {
        const querySnapshot = await getDocs(collection(db, "registrations"));
        const regs = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data() as Registration;
          return {
            value: docSnap.id,
            label: `${data.scaRegoNo || 'Draft/Pending Rego'} - ${data.craftMake} ${data.craftModel}`,
            scaRegoNo: data.scaRegoNo || 'Draft/Pending Rego',
            craftDetails: `${data.craftMake} ${data.craftModel} (HIN: ${data.hullIdNumber || 'N/A'})`,
          };
        });
        setRegistrationsForSelect(regs);
      } catch (error) {
        console.error("Error fetching registrations:", error);
        toast({ title: "Error", description: "Could not load registrations.", variant: "destructive" });
      }
      setLoadingRegistrations(false);
    };
    fetchRegs();
  }, [toast]);

  const onSubmit = async (data: InfringementFormValues, status: "Draft" | "Issued") => {
    if (!currentUser?.userId) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    const selectedItems = data.infringementItems.filter(item => item.selected).map(({selected, ...item}) => item);
    if (selectedItems.length === 0) {
        form.setError("infringementItems", { message: "At least one infringement item must be selected." });
        return;
    }

    const totalPoints = selectedItems.reduce((sum, item) => sum + (item.points || 0), 0);

    let registrationDataForInfringement: Infringement['registrationData'] = undefined;
    if (data.registrationRefId) {
        const regDoc = await getDoc(doc(db, "registrations", data.registrationRefId));
        if (regDoc.exists()) {
            const reg = regDoc.data() as Registration;
            const primaryOwner = reg.owners.find(o => o.role === "Primary") || reg.owners[0];
            registrationDataForInfringement = {
                id: regDoc.id,
                scaRegoNo: reg.scaRegoNo,
                hullIdNumber: reg.hullIdNumber,
                craftMake: reg.craftMake,
                craftModel: reg.craftModel,
                ownerName: primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : 'N/A',
            };
        }
    }


    const infringementPayload: Partial<Infringement> = {
      registrationRef: doc(db, "registrations", data.registrationRefId) as DocumentReference<Registration>,
      registrationData: registrationDataForInfringement,
      issuedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      issuedByData: { id: currentUser.userId, displayName: currentUser.displayName || currentUser.email },
      issuedAt: Timestamp.fromDate(data.issuedAt),
      locationDescription: data.locationDescription,
      infringementItems: selectedItems,
      totalPoints,
      status,
      officerNotes: data.officerNotes,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
    };

    try {
      if (mode === "create") {
        const finalPayload = {
            ...infringementPayload,
            createdAt: Timestamp.now(),
            createdByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
        };
        const docRef = await addDoc(collection(db, "infringements"), finalPayload);
        toast({ title: `Infringement ${status}`, description: `Infringement ID: ${docRef.id} created.` });
        router.push(`/infringements/${docRef.id}`);
      } else if (infringementId) {
        await updateDoc(doc(db, "infringements", infringementId), infringementPayload);
        toast({ title: "Infringement Updated", description: `Status: ${status}` });
        router.push(`/infringements/${infringementId}`);
      }
      router.refresh();
    } catch (error: any) {
      console.error("Error saving infringement:", error);
      toast({ title: "Save Failed", description: error.message || "Could not save infringement.", variant: "destructive" });
    }
  };

  const selectedRegistrationDisplay = registrationsForSelect.find(
    (reg) => reg.value === watchRegistrationRefId
  );

  return (
    <Form {...form}>
      <form className="space-y-8">
        <Card>
          <CardHeader><CardTitle>{mode === "create" ? "Issue New Infringement" : "Edit Infringement"}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="registrationRefId"
              render={({ field }) => (
                <FormItem className="flex flex-col md:col-span-2">
                  <FormLabel>Select Craft Registration *</FormLabel>
                  <Popover open={openRegistrationPopover} onOpenChange={setOpenRegistrationPopover}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                        >
                          {field.value ? registrationsForSelect.find(reg => reg.value === field.value)?.label : "Select Craft..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-[300px] overflow-y-auto">
                      <Command>
                        <CommandInput placeholder="Search Rego No, Make, Model..." disabled={loadingRegistrations} />
                        <CommandList>
                          {loadingRegistrations && <CommandItem>Loading registrations...</CommandItem>}
                          <CommandEmpty>No registration found.</CommandEmpty>
                          <CommandGroup>
                            {registrationsForSelect.map((reg) => (
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
                  {field.value &&
                    <FormDescription>
                      <Link href={`/registrations/${field.value}`} target="_blank" className="text-xs text-primary hover:underline">
                        View selected registration <Ship className="inline h-3 w-3 ml-1"/>
                      </Link>
                    </FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="issuedAt" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Infringement *</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} value={field.value ? format(field.value instanceof Date ? field.value : new Date(field.value), "yyyy-MM-dd'T'HH:mm") : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="locationDescription" render={({ field }) => (
                <FormItem>
                  <FormLabel>Location of Infringement *</FormLabel>
                  <FormControl><Input placeholder="e.g., Koki Market Jetty, Near Ela Beach" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Infringement Items *</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {fields.map((item, index) => (
              <Card key={item.id} className="p-4">
                <FormField
                  control={form.control}
                  name={`infringementItems.${index}.selected`}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            update(index, { ...item, selected: !!checked });
                          }}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none w-full">
                        <FormLabel className={cn("font-normal", field.value && "font-semibold")}>
                          {item.description} (Points: {item.points || 0})
                        </FormLabel>
                        {field.value && (
                          <FormField
                            control={form.control}
                            name={`infringementItems.${index}.notes`}
                            render={({ field: notesField }) => (
                              <FormItem className="mt-2">
                                <FormControl>
                                  <Textarea placeholder="Add specific notes for this item..." {...notesField} rows={2} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                      </div>
                    </FormItem>
                  )}
                />
              </Card>
            ))}
             {form.formState.errors.infringementItems && form.formState.errors.infringementItems.message && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.infringementItems.message}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Officer Notes</CardTitle></CardHeader>
          <CardContent>
            <FormField control={form.control} name="officerNotes" render={({ field }) => (
                <FormItem>
                  <FormControl><Textarea placeholder="Overall notes or observations about the infringement" {...field} rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit(data => onSubmit(data, "Draft"))} disabled={form.formState.isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> Save Draft
          </Button>
          <Button type="button" onClick={form.handleSubmit(data => onSubmit(data, "Issued"))} disabled={form.formState.isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Issue Infringement
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
