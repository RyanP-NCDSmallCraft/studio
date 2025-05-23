
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
import { Switch } from "@/components/ui/switch";
import type { Inspection, ChecklistItemResult, ChecklistTemplate, SuggestChecklistItemsInput, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Ship, User as UserIcon, CalendarDays, Trash2, PlusCircle, Lightbulb, Loader2, ImageUp, Settings, Play } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { suggestChecklistItems } from "@/ai/flows/suggest-checklist-items";
import Link from "next/link";
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

const checklistItemSchema = z.object({
  itemId: z.string(),
  itemDescription: z.string().min(1, "Description is required"),
  result: z.enum(["Pass", "Fail", "N/A"]),
  comments: z.string().optional(),
});

const inspectionFormSchema = z.object({
  registrationRefId: z.string().min(1, "Registration ID is required"),
  inspectorRefId: z.string().min(1, "Inspector assignment is required"),
  inspectionType: z.enum(["Initial", "Annual", "Compliance", "FollowUp"]),
  scheduledDate: z.date({ required_error: "Scheduled date is required" }), // Made required for scheduling
  inspectionDate: z.date().optional(), // Actual date inspector conducts it
  findings: z.string().optional(), // Optional initially, required for "conduct" submission
  correctiveActions: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  checklistItems: z.array(checklistItemSchema).optional().default([]),
  overallResult: z.enum(["Pass", "Fail", "N/A"]).optional(), // Inspector's assessment
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

const placeholderChecklistTemplates: ChecklistTemplate[] = [
  {
    templateId: "PNGSCA_SCH3_T1_ALL",
    name: "Standard Safety Inspection (PNG Small Craft Act Schedule 3)",
    inspectionType: "Initial",
    isActive: true,
    createdAt: new Date() as any,
    createdByRef: {} as any,
    items: [
      { itemId: "sch3_a", itemDescription: "Lifejackets (ISO 12402 compliant, correctly sized for all persons including children)", order: 1, category: "Safety Equipment" },
      { itemId: "sch3_b", itemDescription: "Pair of oars or paddles", order: 2, category: "Safety Equipment" },
      { itemId: "sch3_c", itemDescription: "Functioning waterproof torch", order: 3, category: "Safety Equipment" },
      { itemId: "sch3_d", itemDescription: "Mirror or similar device for signalling", order: 4, category: "Safety Equipment" },
      { itemId: "sch3_e", itemDescription: "Anchor with rope (min 20 meters)", order: 5, category: "Safety Equipment" },
      { itemId: "sch3_f", itemDescription: "Sea anchor/drogue (e.g., tarpaulin) with rope for deployment", order: 6, category: "Safety Equipment" },
      { itemId: "sch3_g", itemDescription: "Bucket or bailer", order: 7, category: "Safety Equipment" },
      { itemId: "sch3_h", itemDescription: "First aid kit", order: 8, category: "Safety Equipment" },
      { itemId: "sch3_i", itemDescription: "Fire extinguisher (for enclosed hull craft)", order: 9, category: "Safety Equipment" },
      { itemId: "sch3_j", itemDescription: "Properly functioning and maintained engine (if fitted)", order: 10, category: "Craft Condition" },
      { itemId: "sch3_k", itemDescription: "Engine tools and spare parts (incl. sparkplug & tool, if petrol engine fitted)", order: 11, category: "Craft Condition" },
      { itemId: "sch3_l", itemDescription: "Sail or tarpaulin (bright orange/yellow) for alternative propulsion/shelter/visibility", order: 12, category: "Safety Equipment" },
      { itemId: "sch3_m", itemDescription: "Sufficient fuel for the proposed journey (as per regulations)", order: 13, category: "Craft Condition" },
    ]
  },
   { 
    templateId: "TPL002", name: "Annual Renewal Inspection", inspectionType: "Annual", isActive: true, createdAt: new Date() as any, createdByRef: {} as any,
    items: [
      { itemId: "tpl_annual_01", itemDescription: "Verify Registration Documents", order: 1, category: "Documentation" },
      { itemId: "tpl_annual_02", itemDescription: "Check Engine Condition", order: 2, category: "Engine" },
      { itemId: "tpl_annual_03", itemDescription: "Inspect Steering System", order: 3, category: "Mechanical" },
    ]
  }
];

const mockInspectorsForSelect: Array<Pick<User, 'userId' | 'displayName'>> = [
  { userId: "USER001", displayName: "Admin User (Inspector)" },
  { userId: "USER002", displayName: "Inspector Bob" },
  { userId: "USER003", displayName: "Registrar Ray (Inspector)" },
  { userId: "USER004", displayName: "Supervisor Sue (Inspector)" },
];


interface InspectionFormProps {
  mode: "create" | "edit";
  usageContext: "schedule" | "conduct"; // New prop to differentiate form usage
  inspectionId?: string;
  existingInspectionData?: Inspection | null;
  prefilledRegistrationId?: string;
}

export function InspectionForm({ mode, usageContext, inspectionId, existingInspectionData, prefilledRegistrationId }: InspectionFormProps) {
  const { currentUser, isAdmin, isRegistrar, isSupervisor, isInspector } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isAISuggesting, setIsAISuggesting] = useState(false);

  const canAssignInspector = isAdmin || isRegistrar || isSupervisor;

  let initialInspectorId = "";
  if (existingInspectionData?.inspectorRef?.id) {
    initialInspectorId = existingInspectionData.inspectorRef.id;
  } else if (mode === 'create') {
    if (!canAssignInspector && isInspector && currentUser?.userId) {
      initialInspectorId = currentUser.userId; 
    }
  }

  const defaultValues: Partial<InspectionFormValues> = existingInspectionData
  ? { 
      ...existingInspectionData,
      registrationRefId: existingInspectionData.registrationRef.id,
      inspectorRefId: initialInspectorId,
      scheduledDate: existingInspectionData.scheduledDate?.toDate(),
      inspectionDate: existingInspectionData.inspectionDate?.toDate(),
      checklistItems: (existingInspectionData.checklistItems || []).map(item => ({...item, result: item.result || "N/A" })),
      findings: existingInspectionData.findings || "",
      correctiveActions: existingInspectionData.correctiveActions || "",
      overallResult: existingInspectionData.overallResult || undefined,
    }
  : { 
      inspectionType: "Initial",
      followUpRequired: false,
      checklistItems: [],
      registrationRefId: prefilledRegistrationId || "",
      inspectorRefId: initialInspectorId,
      findings: "",
      correctiveActions: "",
      overallResult: undefined,
      scheduledDate: new Date(), // Default to today for scheduling
      inspectionDate: undefined,
    };

  const form = useForm<InspectionFormValues>({
    resolver: zodResolver(inspectionFormSchema),
    defaultValues,
  });
  
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "checklistItems",
  });

  const watchInspectionType = form.watch("inspectionType");

  useEffect(() => {
    // Auto-populate checklist for "conduct" mode when creating or when type changes
    if (usageContext === 'conduct' && (mode === 'create' || (mode === 'edit' && !existingInspectionData?.checklistItems?.length)) ) {
        const template = placeholderChecklistTemplates.find(t => t.inspectionType === watchInspectionType);
        if (template) {
            const newItems = template.items.map(item => ({
                itemId: item.itemId,
                itemDescription: item.itemDescription,
                result: "N/A" as "N/A", 
                comments: "",
            }));
            form.setValue("checklistItems", newItems);
        } else {
            form.setValue("checklistItems", []);
        }
    }
  }, [watchInspectionType, mode, form, existingInspectionData, usageContext]);


  const handleAISuggestions = async () => {
    setIsAISuggesting(true);
    try {
      const currentRegId = form.getValues("registrationRefId");
      if (!currentRegId) {
        toast({ title: "Missing Craft Link", description: "Link a registration to get AI suggestions based on craft type.", variant: "destructive" });
        setIsAISuggesting(false);
        return;
      }
      // Placeholder: In a real app, fetch craft details using currentRegId to pass to AI
      let craftDetailsInput: SuggestChecklistItemsInput = {
        craftMake: "GenericCraft", // Replace with actual fetched data
        craftModel: "ModelX", // Replace with actual fetched data
        craftYear: new Date().getFullYear() - 2, // Replace with actual fetched data
        craftType: "OpenBoat", // Replace with actual fetched data
        registrationHistory: "No prior issues noted.", // Replace with actual fetched data
      };
      
      const suggestions = await suggestChecklistItems(craftDetailsInput);
      const newChecklistItems: Omit<ChecklistItemResult, "evidenceUrls">[] = suggestions.map((desc, index) => ({
        itemId: `ai_sugg_${Date.now()}_${index}`,
        itemDescription: desc,
        result: "N/A",
        comments: "",
      }));
      
      const existingDescriptions = new Set(fields.map(f => f.itemDescription));
      newChecklistItems.forEach(newItem => {
        if (!existingDescriptions.has(newItem.itemDescription)) {
          append(newItem as ChecklistItemResult);
        }
      });

      toast({ title: "AI Suggestions Added", description: `${newChecklistItems.filter(ni => !existingDescriptions.has(ni.itemDescription)).length} new items added to checklist.` });
    } catch (error) {
      console.error("AI suggestion error:", error);
      toast({ title: "AI Suggestion Failed", description: "Could not get suggestions.", variant: "destructive" });
    } finally {
      setIsAISuggesting(false);
    }
  };


  const onSubmit = async (data: InspectionFormValues, action: "schedule" | "saveProgress" | "submitReview") => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    
    let finalStatus: Inspection['status'];
    let submissionPayload = { ...data };

    if (action === "schedule") {
      finalStatus = "Scheduled";
      // For scheduling, we only care about a few fields
      submissionPayload = {
        registrationRefId: data.registrationRefId,
        inspectorRefId: data.inspectorRefId,
        inspectionType: data.inspectionType,
        scheduledDate: data.scheduledDate,
        followUpRequired: false, // Default for scheduling
        checklistItems: [], // Empty for scheduling
      } as any; // Cast as any to bypass stricter type checking for partial object
    } else if (action === "saveProgress") {
      finalStatus = "InProgress";
    } else if (action === "submitReview") {
      if (!data.findings || !data.overallResult) {
        toast({ title: "Missing Information", description: "Please provide Overall Findings and an Overall Result to submit for review.", variant: "destructive"});
        return;
      }
      finalStatus = "PendingReview";
    } else {
      toast({ title: "Error", description: "Invalid action.", variant: "destructive" });
      return;
    }

    const fullSubmissionData: Partial<Inspection> = {
      ...submissionPayload,
      scheduledDate: submissionPayload.scheduledDate ? Timestamp.fromDate(submissionPayload.scheduledDate) : undefined,
      inspectionDate: submissionPayload.inspectionDate ? Timestamp.fromDate(submissionPayload.inspectionDate) : undefined,
      status: finalStatus,
      // Ensure these are part of the payload if not scheduling
      ...(action !== "schedule" && { 
        findings: submissionPayload.findings,
        correctiveActions: submissionPayload.correctiveActions,
        overallResult: submissionPayload.overallResult,
        followUpRequired: submissionPayload.followUpRequired,
        checklistItems: submissionPayload.checklistItems,
      }),
      // Timestamps and user refs
      ...(mode === 'create' && { createdAt: Timestamp.now(), createdByRef: currentUser?.userId as any }), // Simulate doc ref
      ...(mode === 'edit' && existingInspectionData && { createdAt: existingInspectionData.createdAt, createdByRef: existingInspectionData.createdByRef }),
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: currentUser?.userId as any, // Simulate doc ref
      ...(action === "submitReview" && { completedAt: Timestamp.now() }),
    };


    console.log("Submitting inspection data (placeholder):", { id: inspectionId || `new_insp_${Date.now()}`, ...fullSubmissionData });
    try {
      if (mode === "create") {
        toast({ title: `Inspection ${action === "schedule" ? "Scheduled" : "Saved"} (Placeholder)`, description: `Status: ${finalStatus}` });
      } else if (inspectionId) {
        toast({ title: "Inspection Updated (Placeholder)", description: `Status: ${finalStatus}` });
      }
      router.push(action === "schedule" ? "/inspections" : inspectionId ? `/inspections/${inspectionId}` : "/inspections");
      router.refresh();
    } catch (error) {
      console.error("Error saving inspection:", error);
      toast({ title: "Save Failed", description: "Could not save inspection.", variant: "destructive" });
    }
  };

  return (
    <Form {...form}>
      <form className="space-y-8">
        <Card>
          <CardHeader><CardTitle>{usageContext === "schedule" ? "Schedule New Inspection" : "Inspection Details"}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="registrationRefId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Linked Craft Registration ID *</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl><Input placeholder="Enter Registration ID" {...field} disabled={!!prefilledRegistrationId || mode === 'edit'} /></FormControl>
                    {field.value && <Button variant="outline" size="sm" asChild><Link href={`/registrations/${field.value}`} target="_blank"><Ship className="h-4 w-4"/></Link></Button>}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inspectorRefId"
              render={({ field }) => (
                canAssignInspector || (mode === 'edit' && !!existingInspectionData?.inspectorRef) ? ( // Allow select if can assign OR if editing existing with inspector
                  <FormItem>
                    <FormLabel>Assign Inspector *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      disabled={!canAssignInspector && mode === 'edit'} // Disable if editing and not assigner
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an inspector" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {mockInspectorsForSelect.map((inspector) => (
                          <SelectItem key={inspector.userId} value={inspector.userId}>
                            {inspector.displayName || inspector.userId}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Select the user who will perform this inspection.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                ) : (
                  <FormItem>
                    <FormLabel>Inspector</FormLabel>
                    <FormControl>
                      <Input
                        value={
                          field.value
                            ? (mockInspectorsForSelect.find(u => u.userId === field.value)?.displayName || field.value)
                            : (currentUser?.displayName || currentUser?.email || "N/A")
                        }
                        disabled
                      />
                    </FormControl>
                    <FormDescription>
                      {mode === 'create' && isInspector && !canAssignInspector 
                        ? "Auto-assigned to you." 
                        : "Assigned Inspector."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )
              )}
            />

            <FormField control={form.control} name="inspectionType" render={({ field }) => (
                <FormItem>
                  <FormLabel>Inspection Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>{["Initial", "Annual", "Compliance", "FollowUp"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="scheduledDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled Date *</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
           {usageContext === "conduct" && (
             <FormField control={form.control} name="inspectionDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Inspection Date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
           )}
          </CardContent>
        </Card>

        {usageContext === "conduct" && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Checklist</CardTitle>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleAISuggestions} disabled={isAISuggesting || !form.getValues("registrationRefId")}>
                        {isAISuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                        Suggest Items (AI)
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: `custom_${Date.now()}`, itemDescription: "", result: "N/A", comments: "" })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Item
                    </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.map((item, index) => (
                  <Card key={item.id} className="p-4 bg-muted/30">
                    <FormField
                      control={form.control}
                      name={`checklistItems.${index}.itemDescription`}
                      render={({ field: descField }) => (
                        <FormItem className="mb-2">
                          <FormLabel>Item #{index + 1}: Description *</FormLabel>
                          <FormControl><Textarea placeholder="Checklist item description" {...descField} rows={2} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                      <FormField
                        control={form.control}
                        name={`checklistItems.${index}.result`}
                        render={({ field: resultField }) => (
                          <FormItem className="space-y-2">
                            <FormLabel>Result *</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={resultField.onChange}
                                value={resultField.value}
                                className="flex space-x-4 items-center pt-1"
                              >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Pass" id={`pass-${item.id}`} />
                                  </FormControl>
                                  <Label htmlFor={`pass-${item.id}`} className="font-normal text-green-600">Pass</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="Fail" id={`fail-${item.id}`} />
                                  </FormControl>
                                  <Label htmlFor={`fail-${item.id}`} className="font-normal text-red-600">Fail</Label>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value="N/A" id={`na-${item.id}`} />
                                  </FormControl>
                                  <Label htmlFor={`na-${item.id}`} className="font-normal text-muted-foreground">N/A</Label>
                                </FormItem>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`checklistItems.${index}.comments`}
                        render={({ field: commentsField }) => (
                          <FormItem>
                            <FormLabel>Comments</FormLabel>
                            <FormControl><Textarea placeholder="Optional comments" {...commentsField} rows={1} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="mt-3">
                        <Button type="button" size="sm" variant="outline" className="mt-2" disabled><ImageUp className="mr-2 h-3 w-3" /> Upload Photo Evidence (UI Only)</Button>
                    </div>
                    <div className="mt-3 text-right">
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive">
                        <Trash2 className="mr-1 h-4 w-4" /> Remove Item
                      </Button>
                    </div>
                  </Card>
                ))}
                {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No checklist items. Add items manually or use AI suggestions.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Overall Assessment</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-6">
                <FormField control={form.control} name="findings" render={({ field }) => (<FormItem><FormLabel>Overall Findings / General Comments *</FormLabel><FormControl><Textarea placeholder="Summarize inspection findings" {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="correctiveActions" render={({ field }) => (<FormItem><FormLabel>Corrective Actions Required (if any)</FormLabel><FormControl><Textarea placeholder="Detail any corrective actions needed" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="followUpRequired" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Follow-up Inspection Required?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="overallResult" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inspector's Overall Result *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select overall result" /></SelectTrigger></FormControl>
                        <SelectContent>{["Pass", "Fail", "N/A"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent>
                      </Select>
                      <FormDescription>This is the inspector's assessment.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </>
        )}

        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          {usageContext === "schedule" && (
            <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, "schedule"))} disabled={form.formState.isSubmitting}>
              <CalendarDays className="mr-2 h-4 w-4" /> Schedule Inspection
            </Button>
          )}
          {usageContext === "conduct" && (
            <>
              <Button type="button" variant="outline" onClick={form.handleSubmit((data) => onSubmit(data, "saveProgress"))} disabled={form.formState.isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> Save Progress
              </Button>
              <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, "submitReview"))} disabled={form.formState.isSubmitting}>
                <Send className="mr-2 h-4 w-4" /> Submit for Review
              </Button>
            </>
          )}
        </CardFooter>
      </form>
    </Form>
  );
}
