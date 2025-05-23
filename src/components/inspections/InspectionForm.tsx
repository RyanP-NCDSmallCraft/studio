
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
import { Save, Send, Ship, User as UserIcon, CalendarDays, Trash2, PlusCircle, Lightbulb, Loader2, ImageUp, Settings, Play, Info } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Timestamp } from "firebase/firestore";
import { suggestChecklistItems } from "@/ai/flows/suggest-checklist-items";
import Link from "next/link";
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatFirebaseTimestamp } from "@/lib/utils";


const checklistItemSchema = z.object({
  itemId: z.string(),
  itemDescription: z.string().min(1, "Description is required"),
  result: z.enum(["Yes", "No", "N/A"]),
  comments: z.string().optional(),
});

const inspectionFormSchema = z.object({
  registrationRefId: z.string().min(1, "Registration ID is required"),
  inspectorRefId: z.string().min(1, "Inspector assignment is required"),
  inspectionType: z.enum(["Initial", "Annual", "Compliance", "FollowUp"]),
  scheduledDate: z.date({ required_error: "Scheduled date is required" }),
  inspectionDate: z.date().optional(),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  checklistItems: z.array(checklistItemSchema).optional().default([]),
  overallResult: z.enum(["Pass", "PassWithRecommendations", "Fail", "N/A"]).optional(),
});

type InspectionFormValues = z.infer<typeof inspectionFormSchema>;


const ncdChecklistTemplate: ChecklistTemplate = {
  templateId: "NCD_SCA_COMPREHENSIVE_V1",
  name: "NCD Small Craft Inspection Checklist (Comprehensive)",
  inspectionType: "Initial",
  isActive: true,
  createdAt: Timestamp.now(), // Placeholder
  createdByRef: {} as any, // Placeholder
  items: [
    // A. Marking and Load Line Requirements (Schedule 1)
    { itemId: "A_1_a", itemDescription: "Registration Number Marking: Legibly & permanently printed on BOTH sides?", category: "A. Marking: Registration Number", order: 10 },
    { itemId: "A_1_b", itemDescription: "Registration Number Marking: Located approx. 120cm from bow center, near top of hull?", category: "A. Marking: Registration Number", order: 20 },
    { itemId: "A_1_c", itemDescription: "Registration Number Marking: Letters/Numbers at least 10cm high?", category: "A. Marking: Registration Number", order: 30 },
    { itemId: "A_1_d", itemDescription: "Registration Number Marking: Stroke of letters/numbers at least 2cm wide?", category: "A. Marking: Registration Number", order: 40 },
    { itemId: "A_2_a", itemDescription: "Load Line Marking (if commercial/open craft): Legibly & permanently marked on BOTH sides?", category: "A. Marking: Load Line", order: 50 },
    { itemId: "A_2_b", itemDescription: "Load Line Marking (if commercial/open craft): Located at craft mid-length?", category: "A. Marking: Load Line", order: 60 },
    { itemId: "A_2_c", itemDescription: "Load Line Marking (if commercial/open craft): Is it a triangle shape?", category: "A. Marking: Load Line", order: 70 },
    { itemId: "A_2_d", itemDescription: "Load Line Marking (if commercial/open craft): Triangle approx. 100mm high?", category: "A. Marking: Load Line", order: 80 },
    { itemId: "A_2_e", itemDescription: "Load Line Marking (if commercial/open craft): Triangle base approx. 20mm?", category: "A. Marking: Load Line", order: 90 },
    { itemId: "A_2_f", itemDescription: "Load Line Marking (if commercial/open craft): Triangle inverted (point down)?", category: "A. Marking: Load Line", order: 100 },
    { itemId: "A_2_g", itemDescription: "Load Line Marking (if commercial/open craft): Point of triangle >= 300mm from top edge of hull?", category: "A. Marking: Load Line", order: 110 },
    { itemId: "A_3", itemDescription: "Marking and Load Line: Exemption Notice Presented (if applicable)?", category: "A. Marking: Exemptions", order: 120 },

    // B. Safety Standards (Schedule 3)
    { itemId: "B_1_a", itemDescription: "For ALL Craft: ISO 12402 compliant Lifejackets (sufficient for all persons, incl. children sizes)?", category: "B. Safety: All Craft", order: 200 },
    { itemId: "B_1_b", itemDescription: "For ALL Craft: Pair of oars or paddles?", category: "B. Safety: All Craft", order: 210 },
    { itemId: "B_1_c", itemDescription: "For ALL Craft: Functioning waterproof torch?", category: "B. Safety: All Craft", order: 220 },
    { itemId: "B_1_d", itemDescription: "For ALL Craft: Mirror or similar signalling device?", category: "B. Safety: All Craft", order: 230 },
    { itemId: "B_1_e", itemDescription: "For ALL Craft: Anchor with at least 20 meters of rope?", category: "B. Safety: All Craft", order: 240 },
    { itemId: "B_1_f", itemDescription: "For ALL Craft: Sea anchor/tarpaulin with deployment rope?", category: "B. Safety: All Craft", order: 250 },
    { itemId: "B_1_g", itemDescription: "For ALL Craft: Bucket or bailer?", category: "B. Safety: All Craft", order: 260 },
    { itemId: "B_1_h", itemDescription: "For ALL Craft: First aid kit present?", category: "B. Safety: All Craft", order: 270 },
    { itemId: "B_1_i", itemDescription: "For ALL Craft: Fire extinguisher (if enclosed hull craft)?", category: "B. Safety: All Craft", order: 280 },
    { itemId: "B_1_j", itemDescription: "For ALL Craft: Engine (if fitted) appears maintained & functional?", category: "B. Safety: All Craft", order: 290 },
    { itemId: "B_1_k", itemDescription: "For ALL Craft: Basic engine tools/spares (e.g., sparkplug, tool if petrol engine)?", category: "B. Safety: All Craft", order: 300 },
    { itemId: "B_1_l", itemDescription: "For ALL Craft: Sail or tarpaulin (bright color) for alternative use?", category: "B. Safety: All Craft", order: 310 },
    { itemId: "B_1_m", itemDescription: "For ALL Craft: Sufficient fuel observed for intended short journey/operation?", category: "B. Safety: All Craft", order: 320 },
    { itemId: "B_2_a", itemDescription: "OUT OF SIGHT OF LAND: Reliable compass OR mobile phone with emergency call capability?", category: "B. Safety: Out of Sight of Land", order: 330 },
    { itemId: "B_2_b", itemDescription: "OUT OF SIGHT OF LAND: Emergency food and water (sufficient for persons/24hrs)?", category: "B. Safety: Out of Sight of Land", order: 340 },
    { itemId: "B_2_c", itemDescription: "OUT OF SIGHT OF LAND: Reserve fuel supply (25% of journey needs)?", category: "B. Safety: Out of Sight of Land", order: 350 },
    { itemId: "B_3_a", itemDescription: "NIGHT TRAVEL: Bright light(s) visible from all directions?", category: "B. Safety: Night Travel", order: 360 },
    { itemId: "B_3_b", itemDescription: "NIGHT TRAVEL: Other navigation lights (as required/approved)?", category: "B. Safety: Night Travel", order: 370 },
    { itemId: "B_4_a", itemDescription: "COMMERCIAL Craft: Reliable compass OR GPS (device or phone)?", category: "B. Safety: Commercial Craft", order: 380 },
    { itemId: "B_4_b", itemDescription: "COMMERCIAL Craft: Emergency food and water (sufficient for persons/24hrs)?", category: "B. Safety: Commercial Craft", order: 390 },
    { itemId: "B_4_c", itemDescription: "COMMERCIAL Craft: Whistle or horn?", category: "B. Safety: Commercial Craft", order: 400 },
    { itemId: "B_5", itemDescription: "Safety Standards: Exemption Notice Presented (if applicable)?", category: "B. Safety: Exemptions", order: 410 },

    // C. Construction Standards (Schedule 2 - Simplified Visual Checks)
    { itemId: "C_1_a", itemDescription: "General Condition: Hull appears sound, no obvious major damage/leaks?", category: "C. Construction: General Condition", order: 500 },
    { itemId: "C_2_a", itemDescription: "Builder's Plate: Visible and legible (if fitted/required)?", category: "C. Construction: Builder's Plate", order: 510 },
    { itemId: "C_2_b", itemDescription: "Builder's Plate: Shows max power, load, persons capacity (if fitted/required)?", category: "C. Construction: Builder's Plate", order: 520 },
    { itemId: "C_2_c", itemDescription: "Builder's Plate: Shows constructor's serial number & completion date (if fitted/required)?", category: "C. Construction: Builder's Plate", order: 530 },
    { itemId: "C_3_a", itemDescription: "Flotation: Evidence of built-in flotation (material/air chambers)?", category: "C. Construction: Flotation & Buoyancy", order: 540 },
    { itemId: "C_3_b", itemDescription: "Flotation: Air compartments (if used for buoyancy) marked with \"Caution...\" label?", category: "C. Construction: Flotation & Buoyancy", order: 550 },
    { itemId: "C_4_a", itemDescription: "Hull & Fittings: Bilge pump functional OR bucket/bailer present?", category: "C. Construction: Hull Integrity & Fittings", order: 560 },
    { itemId: "C_4_b", itemDescription: "Hull & Fittings: Drain plugs appear secure, in good condition, and lockable?", category: "C. Construction: Hull Integrity & Fittings", order: 570 },
    { itemId: "C_4_c", itemDescription: "Hull & Fittings: Deck surfaces intended for walking appear slip-resistant?", category: "C. Construction: Hull Integrity & Fittings", order: 580 },
    { itemId: "C_4_d", itemDescription: "Hull & Fittings: Toe rail or similar on outboard edges of deck?", category: "C. Construction: Hull Integrity & Fittings", order: 590 },
    { itemId: "C_4_e", itemDescription: "Hull & Fittings: Transom appears sound and able to support engine?", category: "C. Construction: Hull Integrity & Fittings", order: 600 },
    { itemId: "C_4_f", itemDescription: "Hull & Fittings: Motor well (if present) appears watertight to hull & drains properly?", category: "C. Construction: Hull Integrity & Fittings", order: 610 },
    { itemId: "C_4_g", itemDescription: "Hull & Fittings: Hardware/fittings (cleats, etc.) secure, good condition, no sharp edges?", category: "C. Construction: Hull Integrity & Fittings", order: 620 },
    { itemId: "C_4_h", itemDescription: "Hull & Fittings: Bow eye suitable for towing, secure, above waterline?", category: "C. Construction: Hull Integrity & Fittings", order: 630 },
    { itemId: "C_5_a", itemDescription: "Visibility: Sufficient area of hull painted NMSA approved marine orange?", category: "C. Construction: Visibility", order: 640 },
    { itemId: "C_6_a", itemDescription: "Fire Safety: Fire extinguisher(s) properly mounted & accessible? (If required by type for Enclosed / Inboard)", category: "C. Construction: Fire Safety", order: 650 },
    { itemId: "C_6_b", itemDescription: "Fire Safety: Discharge port for extinguisher into inboard engine compartment (if applicable)?", category: "C. Construction: Fire Safety", order: 660 },
    { itemId: "C_7", itemDescription: "Construction Standards: Exemption Notice Presented (if applicable)?", category: "C. Construction: Exemptions & Certifications", order: 670 },
    { itemId: "C_8", itemDescription: "Construction Standards: Construction Certification Presented (if post Oct 2016 commercial)?", category: "C. Construction: Exemptions & Certifications", order: 680 },
  ]
};


const placeholderChecklistTemplates: ChecklistTemplate[] = [
  ncdChecklistTemplate,
   {
    templateId: "TPL002_Annual", name: "Annual Renewal Inspection (Simplified)", inspectionType: "Annual", isActive: true, createdAt: Timestamp.now(), createdByRef: {} as any,
    items: [
      { itemId: "annual_01", itemDescription: "Verify Registration Documents are current.", category: "Documentation", order: 1 },
      { itemId: "annual_02", itemDescription: "Visual Check of Engine Condition and Mountings.", category: "Engine", order: 2 },
      { itemId: "annual_03", itemDescription: "Inspect Steering System for play and smooth operation.", category: "Mechanical", order: 3 },
      { itemId: "annual_04", itemDescription: "Check Lifejackets condition and quantity.", category: "Safety Equipment", order: 4 },
      { itemId: "annual_05", itemDescription: "Check Fire Extinguisher charge and accessibility (if applicable).", category: "Safety Equipment", order: 5 },
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
  usageContext: "schedule" | "conduct";
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
      scheduledDate: existingInspectionData.scheduledDate
        ? (existingInspectionData.scheduledDate instanceof Timestamp ? existingInspectionData.scheduledDate.toDate() : new Date(existingInspectionData.scheduledDate))
        : new Date(), 
      inspectionDate: existingInspectionData.inspectionDate
        ? (existingInspectionData.inspectionDate instanceof Timestamp ? existingInspectionData.inspectionDate.toDate() : new Date(existingInspectionData.inspectionDate))
        : (usageContext === 'conduct' ? new Date() : undefined),
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
      scheduledDate: new Date(),
      inspectionDate: usageContext === 'conduct' ? new Date() : undefined,
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
  const watchInspectionDate = form.watch("inspectionDate");
  const watchRegistrationRefId = form.watch("registrationRefId");


  useEffect(() => {
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
      
      let craftDetailsInput: SuggestChecklistItemsInput = {
        craftMake: existingInspectionData?.registrationData?.craftMake || "GenericCraft",
        craftModel: existingInspectionData?.registrationData?.craftModel || "ModelX",
        craftYear: new Date().getFullYear() - 2, 
        craftType: existingInspectionData?.registrationData?.craftType || "OpenBoat", 
        registrationHistory: "No prior issues noted.", 
      };

      const suggestions = await suggestChecklistItems(craftDetailsInput);
      const newChecklistItems = suggestions.map((desc, index) => ({
        itemId: `ai_sugg_${Date.now()}_${index}`,
        itemDescription: desc,
        result: "N/A" as "N/A", 
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
      submissionPayload = {
        registrationRefId: data.registrationRefId,
        inspectorRefId: data.inspectorRefId,
        inspectionType: data.inspectionType,
        scheduledDate: data.scheduledDate,
        followUpRequired: false,
        checklistItems: [],
        findings: undefined,
        correctiveActions: undefined,
        overallResult: undefined,
        inspectionDate: undefined,
      } as any; 
    } else if (action === "saveProgress") {
      finalStatus = "InProgress";
       if (!data.inspectionDate) { 
        submissionPayload.inspectionDate = new Date();
      }
    } else if (action === "submitReview") {
      if (!data.inspectionDate) {
         toast({ title: "Missing Information", description: "Please set the Actual Inspection Date.", variant: "destructive"});
        return;
      }
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
      scheduledDate: submissionPayload.scheduledDate ? Timestamp.fromDate(new Date(submissionPayload.scheduledDate)) : undefined,
      inspectionDate: submissionPayload.inspectionDate ? Timestamp.fromDate(new Date(submissionPayload.inspectionDate)) : undefined,
      status: finalStatus,
      ...(action !== "schedule" && {
        findings: submissionPayload.findings,
        correctiveActions: submissionPayload.correctiveActions,
        overallResult: submissionPayload.overallResult,
        followUpRequired: submissionPayload.followUpRequired,
        checklistItems: submissionPayload.checklistItems,
      }),
      ...(mode === 'create' && { createdAt: Timestamp.now(), createdByRef: currentUser?.userId as any }), 
      ...(mode === 'edit' && existingInspectionData && { createdAt: existingInspectionData.createdAt, createdByRef: existingInspectionData.createdByRef }),
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: currentUser?.userId as any, 
      ...(action === "submitReview" && { completedAt: Timestamp.now() }),
    };


    console.log("Submitting inspection data (placeholder):", { id: inspectionId || `new_insp_${Date.now()}`, ...fullSubmissionData });
    try {
      if (mode === "create") {
        toast({ title: `Inspection ${action === "schedule" ? "Scheduled" : "Saved"} (Placeholder)`, description: `Status: ${finalStatus}` });
        router.push(action === "schedule" ? "/inspections" : `/inspections`); 
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
  
  const currentInspectorName = () => {
    if(existingInspectionData?.inspectorData?.displayName) return existingInspectionData.inspectorData.displayName;
    if(form.getValues("inspectorRefId")) {
        const selected = mockInspectorsForSelect.find(i => i.userId === form.getValues("inspectorRefId"));
        if(selected) return selected.displayName;
    }
    if(currentUser?.displayName) return currentUser.displayName;
    return "N/A";
  }

  const currentRegistrationScaRegoNo = existingInspectionData?.registrationData?.scaRegoNo || watchRegistrationRefId || "N/A";
  const currentRegistrationHullId = existingInspectionData?.registrationData?.hullIdNumber || "N/A (Link craft)";
  const currentCraftType = existingInspectionData?.registrationData?.craftType || "N/A (Link craft)";


  return (
    <Form {...form}>
      <form className="space-y-8">

        {usageContext === 'conduct' && (
          <Card>
            <CardHeader>
                <CardTitle>Inspection Context</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><strong>Inspector:</strong> {currentInspectorName()}</div>
                <div><strong>Date of Inspection:</strong> {watchInspectionDate ? formatFirebaseTimestamp(watchInspectionDate, "PP") : "Not set"}</div>
                <div><strong>Craft Rego No. (SCA):</strong> {currentRegistrationScaRegoNo}</div>
                <div><strong>Hull ID No.:</strong> {currentRegistrationHullId}</div>
                <div><strong>Craft Type:</strong> {currentCraftType}</div>
            </CardContent>
          </Card>
        )}

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
                canAssignInspector || (mode === 'edit' && !!existingInspectionData?.inspectorRef) ? (
                  <FormItem>
                    <FormLabel>Assign Inspector *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      disabled={!canAssignInspector && mode === 'edit' && usageContext !== 'schedule'}
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
                  <FormControl><Input type="date" {...field} value={field.value ? format(field.value instanceof Date ? field.value : new Date(field.value), 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
           {usageContext === "conduct" && (
             <FormField control={form.control} name="inspectionDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Inspection Date *</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ? format(field.value instanceof Date ? field.value : new Date(field.value), 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl>
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
                  <Card key={item.id} className="p-4 bg-muted/20">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 items-start">
                       <FormField
                        control={form.control}
                        name={`checklistItems.${index}.result`}
                        render={({ field: resultField }) => (
                          <FormItem className="space-y-2">
                            <FormLabel>Result *</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={resultField.onChange}
                                    defaultValue={resultField.value}
                                    className="flex space-x-4 items-center pt-1"
                                >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <RadioGroupItem value="Yes" id={`yes-${item.itemId}-${index}`} />
                                        <Label htmlFor={`yes-${item.itemId}-${index}`} className="font-normal text-green-600">Yes</Label>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <RadioGroupItem value="No" id={`no-${item.itemId}-${index}`} />
                                        <Label htmlFor={`no-${item.itemId}-${index}`} className="font-normal text-red-600">No</Label>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <RadioGroupItem value="N/A" id={`na-${item.itemId}-${index}`} />
                                        <Label htmlFor={`na-${item.itemId}-${index}`} className="font-normal text-muted-foreground">N/A</Label>
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
                            <FormLabel>Notes / Photo Ref.</FormLabel>
                            <FormControl><Textarea placeholder="Optional comments or photo reference" {...commentsField} rows={1} /></FormControl>
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
                {fields.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No checklist items. Add items manually, use AI suggestions, or select an inspection type that populates a template.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Overall Assessment</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 gap-6">
                <FormField control={form.control} name="findings" render={({ field }) => (<FormItem><FormLabel>Inspector Summary / Recommendations *</FormLabel><FormControl><Textarea placeholder="Summarize inspection findings and any recommendations" {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="correctiveActions" render={({ field }) => (<FormItem><FormLabel>Corrective Actions Required (if any)</FormLabel><FormControl><Textarea placeholder="Detail any corrective actions needed based on 'No' answers or critical findings" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="followUpRequired" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm"><div className="space-y-0.5"><FormLabel>Follow-up Inspection Required?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
                <FormField control={form.control} name="overallResult" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Overall Inspection Outcome *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select overall outcome" /></SelectTrigger></FormControl>
                        <SelectContent>
                            <SelectItem value="Pass">Pass</SelectItem>
                            <SelectItem value="PassWithRecommendations">Pass with Recommendations</SelectItem>
                            <SelectItem value="Fail">Fail</SelectItem>
                            <SelectItem value="N/A">N/A (Assessment Pending)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>This is the inspector's final assessment for this inspection event.</FormDescription>
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
              <CalendarDays className="mr-2 h-4 w-4" /> {mode === "create" ? "Schedule Inspection" : "Update Schedule"}
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


    