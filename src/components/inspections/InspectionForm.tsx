
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
import type { Inspection, ChecklistItemResult, ChecklistTemplate, ChecklistTemplateItem, SuggestChecklistItemsInput, User } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Ship, User as UserIcon, CalendarDays, Trash2, PlusCircle, Lightbulb, Loader2, ImageUp } from "lucide-react"; // Renamed User from lucide-react to UserIcon
import React, { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { suggestChecklistItems } from "@/ai/flows/suggest-checklist-items";
import Link from "next/link";
import { format } from 'date-fns';

const checklistItemSchema = z.object({
  itemId: z.string(),
  itemDescription: z.string().min(1, "Description is required"),
  result: z.enum(["Pass", "Fail", "N/A"]),
  comments: z.string().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),
});

const inspectionFormSchema = z.object({
  registrationRefId: z.string().min(1, "Registration ID is required"),
  inspectorRefId: z.string().min(1, "Inspector assignment is required"), // Made required
  inspectionType: z.enum(["Initial", "Annual", "Compliance", "FollowUp"]),
  scheduledDate: z.date().optional(),
  inspectionDate: z.date().optional(),
  findings: z.string().min(1, "Overall findings are required"),
  correctiveActions: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  checklistItems: z.array(checklistItemSchema),
  overallResult: z.enum(["Pass", "Fail", "N/A"]).optional(),
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

// Placeholder data for checklist templates
const placeholderChecklistTemplates: ChecklistTemplate[] = [
  {
    templateId: "TPL001", name: "Initial Safety Inspection", inspectionType: "Initial", isActive: true, createdAt: new Date() as any, createdByRef: {} as any,
    items: [
      { itemId: "tpl_chk01", itemDescription: "Hull Integrity Check", order: 1, category: "Hull" },
      { itemId: "tpl_chk02", itemDescription: "Life Jackets (min quantity & condition)", order: 2, category: "Safety Gear" },
      { itemId: "tpl_chk03", itemDescription: "Fire Extinguisher (charged & accessible)", order: 3, category: "Safety Gear" },
      { itemId: "tpl_chk04", itemDescription: "Navigation Lights", order: 4, category: "Electrical" },
      { itemId: "tpl_chk05", itemDescription: "Anchor and Rode", order: 5, category: "Equipment" },
      { itemId: "tpl_chk06", itemDescription: "First Aid Kit", order: 6, category: "Safety Gear" },
      { itemId: "tpl_chk07", itemDescription: "Bilge Pump/Bailing Device", order: 7, category: "Equipment" },
      { itemId: "tpl_chk08", itemDescription: "Sound Producing Device (Horn/Whistle)", order: 8, category: "Safety Gear" },
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

// Mock inspectors for the select dropdown
const mockInspectorsForSelect: Array<Pick<User, 'userId' | 'displayName'>> = [
  { userId: "USER001", displayName: "Admin User" },
  { userId: "USER002", displayName: "Inspector Bob" },
  { userId: "USER003", displayName: "Registrar Ray" },
  { userId: "USER004", displayName: "Supervisor Sue" },
  // Add more users as needed, especially those with an "Inspector" role
];


interface InspectionFormProps {
  mode: "create" | "edit";
  inspectionId?: string;
  existingInspectionData?: Inspection | null;
  prefilledRegistrationId?: string;
}

export function InspectionForm({ mode, inspectionId, existingInspectionData, prefilledRegistrationId }: InspectionFormProps) {
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
      initialInspectorId = currentUser.userId; // Auto-assign for pure inspectors
    }
    // If canAssignInspector, it remains "" - they must select one, triggering validation if not selected
  }


  const defaultValues: Partial<InspectionFormValues> = existingInspectionData
  ? { // Edit mode
      ...existingInspectionData,
      registrationRefId: existingInspectionData.registrationRef.id,
      inspectorRefId: initialInspectorId,
      scheduledDate: existingInspectionData.scheduledDate?.toDate(),
      inspectionDate: existingInspectionData.inspectionDate?.toDate(),
      checklistItems: existingInspectionData.checklistItems.map(item => ({...item, evidenceUrls: item.evidenceUrls || [] })),
    }
  : { // Create mode
      inspectionType: "Initial",
      followUpRequired: false,
      checklistItems: [],
      registrationRefId: prefilledRegistrationId || "",
      inspectorRefId: initialInspectorId,
      findings: "",
      correctiveActions: "",
      overallResult: undefined,
      scheduledDate: undefined,
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
    if (mode === 'create' && !existingInspectionData) { 
        const template = placeholderChecklistTemplates.find(t => t.inspectionType === watchInspectionType);
        if (template) {
            const newItems = template.items.map(item => ({
                itemId: item.itemId,
                itemDescription: item.itemDescription,
                result: "N/A" as "N/A", 
                comments: "",
                evidenceUrls: [],
            }));
            form.setValue("checklistItems", newItems);
        } else {
            form.setValue("checklistItems", []);
        }
    }
  }, [watchInspectionType, mode, form, existingInspectionData]);


  const handleAISuggestions = async () => {
    setIsAISuggesting(true);
    try {
      const craftDetails: SuggestChecklistItemsInput = {
        craftMake: "SampleMake", 
        craftModel: "SampleModel",
        craftYear: 2020,
        craftType: "OpenBoat",
        registrationHistory: "No prior issues.",
      };
      const suggestions = await suggestChecklistItems(craftDetails);
      const newChecklistItems: ChecklistItemResult[] = suggestions.map((desc, index) => ({
        itemId: `ai_sugg_${Date.now()}_${index}`,
        itemDescription: desc,
        result: "N/A",
        comments: "",
        evidenceUrls: [],
      }));
      
      const existingDescriptions = new Set(fields.map(f => f.itemDescription));
      newChecklistItems.forEach(newItem => {
        if (!existingDescriptions.has(newItem.itemDescription)) {
          append(newItem);
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


  const onSubmit = async (data: InspectionFormValues, status: "InProgress" | "Completed") => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    
    let finalStatus: Inspection['status'] = status;
    if (status === "Completed" && !data.overallResult) {
        toast({ title: "Missing Information", description: "Please provide an Overall Result to complete the inspection.", variant: "destructive"});
        return;
    }
    if (status === "Completed" && data.overallResult) {
        finalStatus = data.overallResult === "Pass" ? "Passed" : data.overallResult === "Fail" ? "Failed" : "Completed";
    }


    const submissionData = {
      ...data,
      scheduledDate: data.scheduledDate ? Timestamp.fromDate(data.scheduledDate) : undefined,
      inspectionDate: data.inspectionDate ? Timestamp.fromDate(data.inspectionDate) : undefined,
      status: finalStatus,
    };

    console.log("Submitting inspection data (placeholder):", submissionData);
    try {
      if (mode === "create") {
        toast({ title: "Inspection Saved (Placeholder)", description: `Status: ${finalStatus}` });
        router.push("/inspections");
      } else if (inspectionId) {
        toast({ title: "Inspection Updated (Placeholder)", description: `Status: ${finalStatus}` });
        router.push(`/inspections/${inspectionId}`);
      }
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
          <CardHeader><CardTitle>Inspection Details</CardTitle></CardHeader>
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
                canAssignInspector ? (
                  <FormItem>
                    <FormLabel>Assign Inspector *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
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
                  <FormLabel>Scheduled Date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="inspectionDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Inspection Date</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ? format(field.value, 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Checklist</CardTitle>
            <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleAISuggestions} disabled={isAISuggesting}>
                    {isAISuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                    Suggest Items (AI)
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: `custom_${Date.now()}`, itemDescription: "", result: "N/A", comments: "", evidenceUrls: [] })}>
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
                      <FormControl><Input placeholder="Checklist item description" {...descField} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name={`checklistItems.${index}.result`}
                    render={({ field: resultField }) => (
                        <FormItem>
                        <FormLabel>Result *</FormLabel>
                        <Select onValueChange={resultField.onChange} defaultValue={resultField.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>{["Pass", "Fail", "N/A"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent>
                        </Select>
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
                <div className="mt-2">
                    <FormLabel className="text-xs">Evidence URLs (comma-separated)</FormLabel>
                     <FormField
                        control={form.control}
                        name={`checklistItems.${index}.evidenceUrls`}
                        render={({ field: evidenceField }) => (
                           <Input 
                            placeholder="https://url1.com, https://url2.com" 
                            value={Array.isArray(evidenceField.value) ? evidenceField.value.join(', ') : ''}
                            onChange={e => {
                                const urls = e.target.value.split(',').map(url => url.trim()).filter(url => url);
                                evidenceField.onChange(urls);
                            }}
                            />
                        )}
                        />
                    <Button type="button" size="sm" variant="outline" className="mt-1" disabled><ImageUp className="mr-2 h-3 w-3" /> Upload (UI Only)</Button>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)} className="mt-2 text-destructive hover:text-destructive-foreground hover:bg-destructive">
                  <Trash2 className="mr-1 h-4 w-4" /> Remove Item
                </Button>
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
                  <FormLabel>Overall Result (Set when completing)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select overall result" /></SelectTrigger></FormControl>
                    <SelectContent>{["Pass", "Fail", "N/A"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent>
                  </Select>
                  <FormDescription>This determines the final status if you 'Complete Inspection'.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          <Button type="button" variant="outline" onClick={form.handleSubmit((data) => onSubmit(data, "InProgress"))} disabled={form.formState.isSubmitting}>
            <Save className="mr-2 h-4 w-4" /> Save Progress
          </Button>
          <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, "Completed"))} disabled={form.formState.isSubmitting}>
            <Send className="mr-2 h-4 w-4" /> Complete Inspection
          </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
