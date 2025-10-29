
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
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { Inspection, ChecklistItemResult as ChecklistItemResultType, ChecklistTemplate, SuggestChecklistItemsInput, User, Registration } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { Save, Send, Ship, User as UserIcon, CalendarDays, Trash2, PlusCircle, Lightbulb, Loader2, ImageUp, Settings, Play, Info, ChevronsUpDown, Check } from "lucide-react";
import React, { useState, useEffect } from "react";
import { Timestamp, addDoc, updateDoc, collection, getDocs, doc, query, where, type DocumentReference } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { suggestChecklistItems } from "@/ai/flows/suggest-checklist-items";
import Link from "next/link";
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatFirebaseTimestamp } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";


const checklistItemSchema = z.object({
  itemId: z.string(),
  itemDescription: z.string().min(1, "Description is required"),
  category: z.string().optional(),
  result: z.enum(["Yes", "No", "N/A"]),
  comments: z.string().optional(),
});

const inspectionFormSchema = z.object({
  registrationRefId: z.string().optional(),
  inspectorRefId: z.string().min(1, "Inspector assignment is required"),
  inspectionType: z.enum(["Initial", "Annual", "Compliance", "FollowUp"]),
  scheduledDate: z.date({ required_error: "Scheduled date is required" }),
  inspectionDate: z.date().optional(),
  findings: z.string().optional(),
  correctiveActions: z.string().optional(),
  followUpRequired: z.boolean().default(false),
  checklistItems: z.array(checklistItemSchema).optional().default([]),
  overallResult: z.enum(["Pass", "PassWithRecommendations", "Fail", "N/A"]).optional(),
}).refine(data => {
    // In schedule mode, registration must be selected.
    if (typeof window !== 'undefined' && window.location.pathname.includes('/inspections/new')) {
        return !!data.registrationRefId;
    }
    return true;
}, {
    message: "A craft registration must be linked to schedule an inspection.",
    path: ["registrationRefId"],
});


type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

// NCD Small Craft Inspection Checklist Items
const ncdChecklistTemplateItems: Array<Omit<ChecklistItemResultType, 'result' | 'comments'> & {order?: number}> = [
  // A. Marking and Load Line Requirements (Schedule 1)
  { itemId: "A_1_a", itemDescription: "Registration Number Marking: Legibly & permanently printed on BOTH sides?", category: "A. Marking: Registration Number" },
  { itemId: "A_1_b", itemDescription: "Registration Number Marking: Located approx. 120cm from bow center, near top of hull?", category: "A. Marking: Registration Number" },
  { itemId: "A_1_c", itemDescription: "Registration Number Marking: Letters/Numbers at least 10cm high?", category: "A. Marking: Registration Number" },
  { itemId: "A_1_d", itemDescription: "Registration Number Marking: Stroke of letters/numbers at least 2cm wide?", category: "A. Marking: Registration Number" },
  { itemId: "A_2_a", itemDescription: "Load Line Marking (if commercial/open craft): Legibly & permanently marked on BOTH sides?", category: "A. Marking: Load Line" },
  { itemId: "A_2_b", itemDescription: "Load Line Marking (if commercial/open craft): Located at craft mid-length?", category: "A. Marking: Load Line" },
  { itemId: "A_2_c", itemDescription: "Load Line Marking (if commercial/open craft): Is it a triangle shape?", category: "A. Marking: Load Line" },
  { itemId: "A_2_d", itemDescription: "Load Line Marking (if commercial/open craft): Triangle approx. 100mm high?", category: "A. Marking: Load Line" },
  { itemId: "A_2_e", itemDescription: "Load Line Marking (if commercial/open craft): Triangle base approx. 20mm?", category: "A. Marking: Load Line" },
  { itemId: "A_2_f", itemDescription: "Load Line Marking (if commercial/open craft): Triangle inverted (point down)?", category: "A. Marking: Load Line" },
  { itemId: "A_2_g", itemDescription: "Load Line Marking (if commercial/open craft): Point of triangle >= 300mm from top edge of hull?", category: "A. Marking: Load Line" },
  { itemId: "A_3", itemDescription: "Marking and Load Line: Exemption Notice Presented (if applicable)?", category: "A. Marking: Exemptions" },

  // B. Safety Standards (Schedule 3)
  { itemId: "B_1_a", itemDescription: "For ALL Registered Craft: ISO 12402 compliant Lifejackets (sufficient for all persons, incl. children sizes)?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_b", itemDescription: "For ALL Registered Craft: Pair of oars or paddles?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_c", itemDescription: "For ALL Registered Craft: Functioning waterproof torch?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_d", itemDescription: "For ALL Registered Craft: Mirror or similar signalling device?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_e", itemDescription: "For ALL Registered Craft: Anchor with at least 20 meters of rope?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_f", itemDescription: "For ALL Registered Craft: Sea anchor/tarpaulin with deployment rope?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_g", itemDescription: "For ALL Registered Craft: Bucket or bailer?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_h", itemDescription: "For ALL Registered Craft: First aid kit present?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_i", itemDescription: "For ALL Registered Craft: Fire extinguisher (if enclosed hull craft)?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_j", itemDescription: "For ALL Registered Craft: Engine (if fitted) appears maintained & functional?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_k", itemDescription: "For ALL Registered Craft: Basic engine tools/spares (e.g., sparkplug, tool if petrol engine)?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_l", itemDescription: "For ALL Registered Craft: Sail or tarpaulin (bright color) for alternative use?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_1_m", itemDescription: "For ALL Registered Craft: Sufficient fuel observed for intended short journey/operation?", category: "B. Safety: All Registered Craft" },
  { itemId: "B_2_a", itemDescription: "For Craft Traveling OUT OF SIGHT OF LAND: Reliable compass OR mobile phone with emergency call capability?", category: "B. Safety: Out of Sight of Land" },
  { itemId: "B_2_b", itemDescription: "For Craft Traveling OUT OF SIGHT OF LAND: Emergency food and water (sufficient for persons/24hrs)?", category: "B. Safety: Out of Sight of Land" },
  { itemId: "B_2_c", itemDescription: "For Craft Traveling OUT OF SIGHT OF LAND: Reserve fuel supply (25% of journey needs)?", category: "B. Safety: Out of Sight of Land" },
  { itemId: "B_3_a", itemDescription: "For Craft Traveling AT NIGHT: Bright light(s) visible from all directions?", category: "B. Safety: Night Travel" },
  { itemId: "B_3_b", itemDescription: "For Craft Traveling AT NIGHT: Other navigation lights (as required/approved)?", category: "B. Safety: Night Travel" },
  { itemId: "B_4_a", itemDescription: "For COMMERCIAL Small Craft (Licensed): Reliable compass OR GPS (device or phone)?", category: "B. Safety: Commercial Craft" },
  { itemId: "B_4_b", itemDescription: "For COMMERCIAL Small Craft (Licensed): Emergency food and water (sufficient for persons/24hrs)? (Covered above but confirm)", category: "B. Safety: Commercial Craft" },
  { itemId: "B_4_c", itemDescription: "For COMMERCIAL Small Craft (Licensed): Whistle or horn?", category: "B. Safety: Commercial Craft" },
  { itemId: "B_5", itemDescription: "Safety Standards: Exemption Notice Presented (if applicable)?", category: "B. Safety: Exemptions" },

  // C. Construction Standards (Schedule 2 - Simplified Visual Checks)
  { itemId: "C_1_a", itemDescription: "General Condition: Hull appears sound, no obvious major damage/leaks?", category: "C. Construction: General Condition" },
  { itemId: "C_2_a", itemDescription: "Builder's Plate (if fitted/required): Builder's Plate visible and legible?", category: "C. Construction: Builder's Plate" },
  { itemId: "C_2_b", itemDescription: "Builder's Plate (if fitted/required): Plate shows max power, load, persons capacity?", category: "C. Construction: Builder's Plate" },
  { itemId: "C_2_c", itemDescription: "Builder's Plate (if fitted/required): Plate shows constructor's serial number & completion date?", category: "C. Construction: Builder's Plate" },
  { itemId: "C_3_a", itemDescription: "Flotation & Buoyancy: Evidence of built-in flotation (material/air chambers)?", category: "C. Construction: Flotation & Buoyancy" },
  { itemId: "C_3_b", itemDescription: "Flotation & Buoyancy: Air compartments (if used for buoyancy) marked with \"Caution...\" label?", category: "C. Construction: Flotation & Buoyancy" },
  { itemId: "C_4_a", itemDescription: "Hull Integrity & Fittings: Bilge pump functional OR bucket/bailer present?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_b", itemDescription: "Hull Integrity & Fittings: Drain plugs appear secure, in good condition, and lockable?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_c", itemDescription: "Hull Integrity & Fittings: Deck surfaces intended for walking appear slip-resistant?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_d", itemDescription: "Hull Integrity & Fittings: Toe rail or similar on outboard edges of deck?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_e", itemDescription: "Hull Integrity & Fittings: Transom appears sound and able to support engine?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_f", itemDescription: "Hull Integrity & Fittings: Motor well (if present) appears watertight to hull & drains properly?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_g", itemDescription: "Hull Integrity & Fittings: Hardware/fittings (cleats, etc.) secure, good condition, no sharp edges?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_4_h", itemDescription: "Hull Integrity & Fittings: Bow eye suitable for towing, secure, above waterline?", category: "C. Construction: Hull Integrity & Fittings" },
  { itemId: "C_5_a", itemDescription: "Visibility: Sufficient area of hull painted NMSA approved marine orange?", category: "C. Construction: Visibility" },
  { itemId: "C_6_a", itemDescription: "Fire Safety (Enclosed / Inboard): Fire extinguisher(s) properly mounted & accessible? (If required by type)", category: "C. Construction: Fire Safety" },
  { itemId: "C_6_b", itemDescription: "Fire Safety (Enclosed / Inboard): Discharge port for extinguisher into inboard engine compartment (if applicable)?", category: "C. Construction: Fire Safety" },
  { itemId: "C_7", itemDescription: "Construction Standards: Exemption Notice Presented (if applicable)?", category: "C. Construction: Exemptions & Certifications" },
  { itemId: "C_8", itemDescription: "Construction Standards: Construction Certification Presented (if post Oct 2016 commercial)?", category: "C. Construction: Exemptions & Certifications" },
];


const ncdChecklistTemplate: ChecklistTemplate = {
  templateId: "NCD_SCA_COMPREHENSIVE_V1",
  name: "NCD Small Craft Inspection Checklist (Comprehensive)",
  inspectionType: "Initial", 
  isActive: true,
  createdAt: Timestamp.now(),
  createdByRef: {} as any, 
  items: ncdChecklistTemplateItems.map(item => ({ ...item, result: "N/A", comments: "" })) as any,
};

interface InspectionFormProps {
  mode: "create" | "edit";
  usageContext: "schedule" | "conduct";
  inspectionId?: string;
  existingInspectionData?: Inspection | null;
  prefilledRegistrationId?: string;
}

interface RegistrationSelectItem {
  value: string; // Firestore document ID
  label: string; // Concatenated string for display e.g., "NCD-123 / Yamaha WaveRunner"
  scaRegoNo?: string;
  craftDetails?: string;
  craftType?: string; // To help with dynamic checklist items later
  craftMake?: string;
  craftModel?: string;
  craftYear?: number;
}

export function InspectionForm({ mode, usageContext, inspectionId, existingInspectionData, prefilledRegistrationId }: InspectionFormProps) {
  const { currentUser, isAdmin, isRegistrar, isSupervisor, isInspector } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [isAISuggesting, setIsAISuggesting] = useState(false);
  const [registrationsForSelect, setRegistrationsForSelect] = useState<RegistrationSelectItem[]>([]);
  const [loadingRegistrations, setLoadingRegistrations] = useState(false);
  const [openRegistrationPopover, setOpenRegistrationPopover] = useState(false);
  
  const [availableInspectors, setAvailableInspectors] = useState<Array<Pick<User, 'userId' | 'displayName' | 'email'>>>([]);
  const [loadingInspectors, setLoadingInspectors] = useState(false);

  const canAssignInspector = isAdmin || isRegistrar || isSupervisor;

  let initialInspectorId = "";
  if (existingInspectionData?.inspectorRef && typeof existingInspectionData.inspectorRef !== 'string') {
    initialInspectorId = existingInspectionData.inspectorRef.id;
  } else if (existingInspectionData?.inspectorRef && typeof existingInspectionData.inspectorRef === 'string') {
    initialInspectorId = existingInspectionData.inspectorRef;
  } else if (mode === 'create') {
    if (!canAssignInspector && isInspector && currentUser?.userId) {
      initialInspectorId = currentUser.userId;
    }
  }
  
  const defaultValues: Partial<InspectionFormValues> = existingInspectionData
  ? {
      ...existingInspectionData,
      registrationRefId: (typeof existingInspectionData.registrationRef === 'string' ? existingInspectionData.registrationRef : (existingInspectionData.registrationRef as DocumentReference)?.id) || "",
      inspectorRefId: initialInspectorId || "",
      scheduledDate: existingInspectionData.scheduledDate
        ? (existingInspectionData.scheduledDate instanceof Timestamp ? existingInspectionData.scheduledDate.toDate() : new Date(existingInspectionData.scheduledDate as any))
        : new Date(), 
      inspectionDate: existingInspectionData.inspectionDate
        ? (existingInspectionData.inspectionDate instanceof Timestamp ? existingInspectionData.inspectionDate.toDate() : new Date(existingInspectionData.inspectionDate as any))
        : (usageContext === 'conduct' ? new Date() : undefined),
      checklistItems: (existingInspectionData.checklistItems || []).map(item => ({...item, category: item.category || ncdChecklistTemplate.items.find(t => t.itemId === item.itemId)?.category, result: item.result || "N/A" })),
      findings: existingInspectionData.findings || "",
      correctiveActions: existingInspectionData.correctiveActions || "",
      overallResult: existingInspectionData.overallResult || undefined,
    }
  : {
      inspectionType: "Initial",
      followUpRequired: false,
      checklistItems: [],
      registrationRefId: prefilledRegistrationId || "",
      inspectorRefId: initialInspectorId || "",
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
    console.log("InspectionForm Effect: Context:", usageContext, "Mode:", mode, "Fields length:", fields.length, "Existing items:", existingInspectionData?.checklistItems?.length);
    if (usageContext === 'conduct' && (mode === 'create' || (mode === 'edit' && (!existingInspectionData?.checklistItems || existingInspectionData.checklistItems.length === 0)))) {
        console.log("InspectionForm: Attempting to load NCD default checklist.");
        const ncdItemsToLoad = ncdChecklistTemplate.items.map(templateItem => ({
            itemId: templateItem.itemId,
            itemDescription: templateItem.itemDescription,
            category: templateItem.category,
            result: "N/A" as "Yes" | "No" | "N/A", 
            comments: "",
        }));
        form.setValue("checklistItems", ncdItemsToLoad);
        console.log("InspectionForm: NCD checklist loaded with", ncdItemsToLoad.length, "items.");
    }
}, [mode, usageContext, existingInspectionData, form, fields.length]); 


  useEffect(() => {
    const fetchRegs = async () => {
      if (!db) {
        console.error("InspectionForm: Firestore db instance is not available for fetching registrations.");
        return;
      }
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
            craftType: data.vesselType,
            craftMake: data.craftMake,
            craftModel: data.craftModel,
            craftYear: data.craftYear,
          };
        });
        setRegistrationsForSelect(regs);
      } catch (error) {
        console.error("Error fetching registrations for select:", error);
        toast({ title: "Error", description: "Could not load registrations for selection.", variant: "destructive" });
      }
      setLoadingRegistrations(false);
    };

    if (usageContext === 'schedule' && (mode === 'create' || (mode === 'edit' && !form.getValues('registrationRefId')))) {
      fetchRegs();
    }
  }, [usageContext, mode, form, toast]);


  useEffect(() => {
    const fetchAndSetInspectors = async () => {
      if (canAssignInspector) {
        if (!db) {
          console.error("InspectionForm: DB not available for fetching inspectors.");
          setAvailableInspectors([]);
          return;
        }
        setLoadingInspectors(true);
        try {
          const usersCol = collection(db, "users");
          const q = query(usersCol, where("isActive", "==", true), where("role", "in", ["Inspector", "Admin", "Supervisor"]));
          const querySnapshot = await getDocs(q);
          const inspectorsData = querySnapshot.docs.map(docSnap => {
            const data = docSnap.data() as User;
            return {
              userId: docSnap.id,
              displayName: data.displayName || data.email || 'Unnamed User',
              email: data.email || '',
            };
          });
          setAvailableInspectors(inspectorsData);
        } catch (error) {
          console.error("Error fetching eligible inspectors:", error);
          toast({ title: "Error Loading Inspectors", description: "Could not load the list of available inspectors.", variant: "destructive" });
          setAvailableInspectors([]); 
        } finally {
          setLoadingInspectors(false);
        }
      } else { 
        if (mode === 'create' && isInspector && currentUser?.userId) {
          const self = { userId: currentUser.userId, displayName: currentUser.displayName || currentUser.email!, email: currentUser.email! };
          setAvailableInspectors([self]);
          if (form.getValues('inspectorRefId') !== currentUser.userId) {
            form.setValue('inspectorRefId', currentUser.userId);
          }
        } else if (mode === 'edit' && existingInspectionData?.inspectorRef) {
          const inspId = typeof existingInspectionData.inspectorRef === 'string' 
            ? existingInspectionData.inspectorRef 
            : (existingInspectionData.inspectorRef as DocumentReference)?.id;
          const inspName = existingInspectionData.inspectorData?.displayName || (inspId ? `User ID: ${inspId}` : 'N/A');
          if (inspId) {
            setAvailableInspectors([{ userId: inspId, displayName: inspName, email: '' }]);
          } else {
            setAvailableInspectors([]);
          }
        } else {
          setAvailableInspectors([]);
        }
      }
    };
    fetchAndSetInspectors();
  }, [db, canAssignInspector, mode, isInspector, currentUser, toast, existingInspectionData, form ]);


  const handleAISuggestions = async () => {
    setIsAISuggesting(true);
    try {
      const currentRegId = form.getValues("registrationRefId");
      if (!currentRegId) {
        toast({ title: "Missing Craft Link", description: "Link a registration to get AI suggestions based on craft type.", variant: "destructive" });
        setIsAISuggesting(false);
        return;
      }
      
      const linkedReg = registrationsForSelect.find(r => r.value === currentRegId) || 
                        (existingInspectionData?.registrationData 
                            ? { 
                                craftMake: existingInspectionData.registrationData.craftMake,
                                craftModel: existingInspectionData.registrationData.craftModel,
                                craftYear: existingInspectionData.registrationData.craftMake ? new Date().getFullYear() -2 : undefined, 
                                craftType: existingInspectionData.registrationData.craftType,
                              } 
                            : null);

      if (!linkedReg) {
        toast({ title: "Craft Data Missing", description: "Could not retrieve details for the linked craft.", variant: "destructive" });
        setIsAISuggesting(false);
        return;
      }

      const craftDetailsInput: SuggestChecklistItemsInput = {
        craftMake: linkedReg.craftMake || "GenericCraft",
        craftModel: linkedReg.craftModel || "ModelX",
        craftYear: linkedReg.craftYear || new Date().getFullYear() - 2, 
        craftType: linkedReg.craftType || "OpenBoat", 
        registrationHistory: "No prior issues noted.", 
      };

      const suggestions = await suggestChecklistItems(craftDetailsInput);
      const newChecklistItems = suggestions.map((desc, index) => ({
        itemId: `ai_sugg_${Date.now()}_${index}`,
        itemDescription: desc,
        category: "AI Suggested", 
        result: "N/A" as "Yes" | "No" | "N/A", 
        comments: "",
      }));

      const existingDescriptions = new Set(fields.map(f => f.itemDescription));
      newChecklistItems.forEach(newItem => {
        if (!existingDescriptions.has(newItem.itemDescription)) {
          append(newItem as ChecklistItemResultType & { category?: string });
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
    if (!currentUser?.userId) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    let finalStatus: Inspection['status'];
    let submissionPayload: Partial<InspectionFormValues> = { ...data };

    const baseInspectionData: Omit<Inspection, 
      'inspectionId' | 
      'createdAt' | 'createdByRef' | 
      'inspectionDate' | 'findings' | 'correctiveActions' | 'overallResult' | 
      'completedAt' | 'reviewedAt' | 'reviewedByRef' | 'checklistItems'
    > & {
      registrationRef?: string | null;
      inspectorRef?: string;
      scheduledDate: Date;
    } = {
      registrationRef: data.registrationRefId || null,
      inspectorRef: data.inspectorRefId,
      inspectionType: data.inspectionType,
      scheduledDate: data.scheduledDate, 
      followUpRequired: data.followUpRequired || false,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      status: "Scheduled" 
    };


    if (action === "schedule") {
      finalStatus = "Scheduled";
      const schedulePayload: Partial<Inspection> = {
        registrationRef: data.registrationRefId ? doc(db, "registrations", data.registrationRefId) as DocumentReference<Registration> : null,
        inspectorRef: data.inspectorRefId ? doc(db, "users", data.inspectorRefId) as DocumentReference<User> : undefined,
        inspectionType: data.inspectionType,
        scheduledDate: Timestamp.fromDate(new Date(data.scheduledDate)),
        status: finalStatus,
        followUpRequired: false,
        checklistItems: [],
        findings: null,
        correctiveActions: null,
        overallResult: null,
        inspectionDate: null,
        completedAt: null,
        reviewedAt: null,
        reviewedByRef: null,
        lastUpdatedAt: Timestamp.now(),
        lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
      };
      if (mode === 'create') {
        schedulePayload.createdAt = Timestamp.now();
        schedulePayload.createdByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
      } else if (mode === 'edit' && existingInspectionData) {
         schedulePayload.createdAt = existingInspectionData.createdAt as Timestamp; 
         schedulePayload.createdByRef = existingInspectionData.createdByRef as DocumentReference<User>; 
      }
      submissionPayload = schedulePayload as any;

    } else if (action === "saveProgress") {
      finalStatus = "InProgress";
      if (!data.inspectionDate) { 
        data.inspectionDate = new Date(); 
      }
       submissionPayload = {
        ...baseInspectionData,
        status: finalStatus,
        inspectionDate: data.inspectionDate ? Timestamp.fromDate(new Date(data.inspectionDate)) : null,
        findings: data.findings || null,
        correctiveActions: data.correctiveActions || null,
        overallResult: data.overallResult || null,
        followUpRequired: data.followUpRequired,
        checklistItems: data.checklistItems || [],
        registrationRef: data.registrationRefId ? doc(db, "registrations", data.registrationRefId) as DocumentReference<Registration> : null,
        inspectorRef: data.inspectorRefId ? doc(db, "users", data.inspectorRefId) as DocumentReference<User> : undefined,
        scheduledDate: Timestamp.fromDate(new Date(data.scheduledDate)),
      } as any;
      if (mode === 'create' && !existingInspectionData?.createdAt) { 
        (submissionPayload as Partial<Inspection>).createdAt = Timestamp.now();
        (submissionPayload as Partial<Inspection>).createdByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
      } else if (existingInspectionData) {
        (submissionPayload as Partial<Inspection>).createdAt = existingInspectionData.createdAt as Timestamp;
        (submissionPayload as Partial<Inspection>).createdByRef = existingInspectionData.createdByRef as DocumentReference<User>;
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
      submissionPayload = {
        ...baseInspectionData,
        status: finalStatus,
        inspectionDate: data.inspectionDate ? Timestamp.fromDate(new Date(data.inspectionDate)) : null,
        findings: data.findings || null,
        correctiveActions: data.correctiveActions || null,
        overallResult: data.overallResult || null,
        followUpRequired: data.followUpRequired,
        checklistItems: data.checklistItems || [],
        completedAt: Timestamp.now(), 
        registrationRef: data.registrationRefId ? doc(db, "registrations", data.registrationRefId) as DocumentReference<Registration> : null,
        inspectorRef: data.inspectorRefId ? doc(db, "users", data.inspectorRefId) as DocumentReference<User> : undefined,
        scheduledDate: Timestamp.fromDate(new Date(data.scheduledDate)),
      } as any;
       if (mode === 'create' && !existingInspectionData?.createdAt) {
        (submissionPayload as Partial<Inspection>).createdAt = Timestamp.now();
        (submissionPayload as Partial<Inspection>).createdByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
      } else if (existingInspectionData) {
        (submissionPayload as Partial<Inspection>).createdAt = existingInspectionData.createdAt as Timestamp;
        (submissionPayload as Partial<Inspection>).createdByRef = existingInspectionData.createdByRef as DocumentReference<User>;
      }


    } else {
      toast({ title: "Error", description: "Invalid action.", variant: "destructive" });
      return;
    }

    console.log("Submitting inspection data:", { id: inspectionId || `new_insp_${Date.now()}`, ...submissionPayload });
    try {
      if (mode === "create") {
        const docRef = await addDoc(collection(db, "inspections"), submissionPayload as Inspection);
        toast({ title: `Inspection ${action === "schedule" ? "Scheduled" : (action === "saveProgress" ? "Saved" : "Submitted")}`, description: `ID: ${docRef.id}, Status: ${finalStatus}` });
        router.push(action === "schedule" ? "/inspections" : `/inspections/${docRef.id}`);
      } else if (inspectionId) {
        await updateDoc(doc(db, "inspections", inspectionId), submissionPayload as Partial<Inspection>);
        toast({ title: `Inspection ${action === "schedule" ? "Schedule Updated" : (action === "saveProgress" ? "Progress Saved" : "Submitted for Review")}`, description: `Status: ${finalStatus}` });
        router.push(`/inspections/${inspectionId}`);
      }
      router.refresh(); 
    } catch (error: any) {
      console.error("Error saving inspection:", error);
      const errorMessage = error.message || "Could not save inspection.";
      const errorCode = error.code || "N/A";
      toast({ title: "Save Failed", description: `[${errorCode}] ${errorMessage}`, variant: "destructive" });
    }
  };
  
  const getAssignedInspectorName = () => {
    const inspectorId = form.getValues("inspectorRefId");
    if (!inspectorId) return "Not Assigned";
    const foundInspector = availableInspectors.find(insp => insp.userId === inspectorId);
    if (foundInspector) return foundInspector.displayName;
    if (existingInspectionData?.inspectorData?.id === inspectorId) return existingInspectionData.inspectorData.displayName;
    return inspectorId; // Fallback to ID if name not found
  };

  const selectedRegistrationDisplay = registrationsForSelect.find(
    (reg) => reg.value === watchRegistrationRefId
  );

  const currentRegistrationScaRegoNo = selectedRegistrationDisplay?.scaRegoNo || existingInspectionData?.registrationData?.scaRegoNo || watchRegistrationRefId || "N/A";
  const currentRegistrationHullId = selectedRegistrationDisplay?.craftDetails ? selectedRegistrationDisplay.craftDetails.split('(HIN: ')[1]?.slice(0,-1) : existingInspectionData?.registrationData?.hullIdNumber || "N/A (Link craft)";
  const currentCraftType = selectedRegistrationDisplay?.craftType || existingInspectionData?.registrationData?.craftType || "N/A (Link craft)";

  const categoryTitles: Record<string, string> = {
    A: "A. Marking and Load Line Requirements (Schedule 1)",
    B: "B. Safety Standards (Schedule 3)",
    C: "C. Construction Standards (Schedule 2 - Simplified Visual Checks)",
    "AI Suggested": "AI Suggested Items",
    "Custom": "Custom Items",
  };
  const mainCategoriesOrder = ['A', 'B', 'C', "AI Suggested", "Custom"]; 

  const groupedChecklistItems: Record<string, Array<typeof fields[number] & { originalIndex: number }>> = {};
  
  fields.forEach((fieldItem, index) => {
    const itemCategoryFull = (fieldItem as any).category as string | undefined; 
    let mainCategoryKey = "Custom"; 

    if (itemCategoryFull) {
        if (itemCategoryFull.startsWith("A.")) mainCategoryKey = "A";
        else if (itemCategoryFull.startsWith("B.")) mainCategoryKey = "B";
        else if (itemCategoryFull.startsWith("C.")) mainCategoryKey = "C";
        else if (itemCategoryFull === "AI Suggested") mainCategoryKey = "AI Suggested";
    }
  
    if (!groupedChecklistItems[mainCategoryKey]) {
      groupedChecklistItems[mainCategoryKey] = [];
    }
    groupedChecklistItems[mainCategoryKey].push({ ...fieldItem, originalIndex: index });
  });


  return (
    <Form {...form}>
      <form className="space-y-8">

        {usageContext === 'conduct' && (
          <Card>
            <CardHeader>
                <CardTitle>Inspection Context</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div><strong>Inspector:</strong> {getAssignedInspectorName()}</div>
                <div><strong>Date of Inspection:</strong> {watchInspectionDate ? formatFirebaseTimestamp(watchInspectionDate, "PP") : "Not set"}</div>
                <div><strong>Craft Rego No. (SCA):</strong> {currentRegistrationScaRegoNo}</div>
                <div><strong>Hull ID No.:</strong> {currentRegistrationHullId}</div>
                <div><strong>Craft Type:</strong> {currentCraftType}</div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>{usageContext === "schedule" ? (mode === "create" ? "Schedule New Inspection" : "Update Inspection Schedule") : "Inspection Details"}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="registrationRefId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Linked Craft Registration {usageContext === 'schedule' ? '*' : '(Optional)'}</FormLabel>
                  <Popover open={openRegistrationPopover} onOpenChange={setOpenRegistrationPopover}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={openRegistrationPopover}
                          className={cn(
                            "w-full justify-between",
                            !field.value && "text-muted-foreground"
                          )}
                           disabled={!!prefilledRegistrationId || (mode === 'edit' && usageContext === 'conduct')}
                        >
                          {field.value
                            ? registrationsForSelect.find(
                                (reg) => reg.value === field.value
                              )?.label || field.value
                            : "Select Registration..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 max-h-[300px] overflow-y-auto">
                      <Command>
                        <CommandInput placeholder="Search by Rego No, Make, Model..." disabled={loadingRegistrations} />
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
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    reg.value === field.value
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
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
                  {field.value && (mode === 'edit' || prefilledRegistrationId) && 
                    <FormDescription>
                      <Link href={`/registrations/${field.value}`} target="_blank" className="text-xs text-primary hover:underline">
                        View selected registration details <Ship className="inline h-3 w-3 ml-1"/>
                      </Link>
                    </FormDescription>
                  }
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
                      disabled={loadingInspectors}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingInspectors ? "Loading..." : "Select an inspector"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                         {loadingInspectors && <SelectItem value="loading" disabled>Loading inspectors...</SelectItem>}
                         {!loadingInspectors && availableInspectors.length === 0 && <SelectItem value="no_inspectors" disabled>No inspectors available</SelectItem>}
                         {!loadingInspectors && availableInspectors.map((inspector) => (
                          <SelectItem key={inspector.userId} value={inspector.userId}>
                            {inspector.displayName || inspector.email}
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
                        value={getAssignedInspectorName()}
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
                  <Select onValueChange={field.onChange} value={field.value} disabled={usageContext === 'conduct' && mode === 'edit'}>
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
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: `custom_${Date.now()}`, itemDescription: "New Custom Item", category: "Custom", result: "N/A", comments: "" })}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Custom Item
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {mainCategoriesOrder.map(mainCatKey => {
                        const itemsInCategory = groupedChecklistItems[mainCatKey];
                        if (!itemsInCategory || itemsInCategory.length === 0) return null;
                        
                        return (
                            <Card key={mainCatKey} className="mt-4 mb-2 shadow-md">
                            <CardHeader className="py-3 px-4 bg-muted/30 rounded-t-md border-b">
                                <CardTitle className="text-base font-semibold">{categoryTitles[mainCatKey as keyof typeof categoryTitles]}</CardTitle>
                                {mainCatKey === 'B' && <CardDescription className="text-xs">Note: Some items depend on craft type/operation.</CardDescription>}
                                {mainCatKey === 'C' && <CardDescription className="text-xs">Note: Many construction standards require detailed assessment or certification. This focuses on observable aspects.</CardDescription>}
                            </CardHeader>
                            <CardContent className="space-y-2 p-3">
                                {itemsInCategory.map((item) => {
                                const originalIndex = item.originalIndex;
                                return (
                                    <Card key={item.id} className="p-3 bg-card shadow-sm">
                                        <p className="font-medium mb-2 text-sm">{item.itemDescription}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2 items-start">
                                        <FormField
                                        control={form.control}
                                        name={`checklistItems.${originalIndex}.result`}
                                        render={({ field: resultField }) => (
                                            <FormItem className="space-y-1">
                                            <FormLabel className="text-xs">Result *</FormLabel>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={resultField.onChange}
                                                defaultValue={resultField.value}
                                                className="flex space-x-3 items-center pt-1"
                                                >
                                                {(["Yes", "No", "N/A"] as const).map((val) => (
                                                    <FormItem key={`${item.itemId}-${originalIndex}-${val}`} className="flex items-center space-x-1.5 space-y-0">
                                                    <FormControl>
                                                        <RadioGroupItem value={val} id={`${item.itemId}-${originalIndex}-${val.toLowerCase()}`} />
                                                    </FormControl>
                                                    <Label htmlFor={`${item.itemId}-${originalIndex}-${val.toLowerCase()}`} className={`font-normal text-xs ${val === "Yes" ? "text-green-600" : val === "No" ? "text-red-600" : "text-muted-foreground"}`}>
                                                        {val}
                                                    </Label>
                                                    </FormItem>
                                                ))}
                                                </RadioGroup>
                                            </FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                        <FormField
                                        control={form.control}
                                        name={`checklistItems.${originalIndex}.comments`}
                                        render={({ field: commentsField }) => (
                                            <FormItem>
                                            <FormLabel className="text-xs">Notes / Photo Ref.</FormLabel>
                                            <FormControl><Textarea placeholder="Optional comments" {...commentsField} rows={1} className="text-sm" /></FormControl>
                                            <FormMessage />
                                            </FormItem>
                                        )}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between items-center">
                                        <Button type="button" size="xs" variant="outline" className="text-xs py-1 px-2 h-auto" disabled><ImageUp className="mr-1 h-3 w-3" /> Upload Photo</Button>
                                        {item.itemId?.startsWith("custom_") && (
                                            <Button type="button" variant="ghost" size="xs" onClick={() => remove(originalIndex)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive text-xs py-1 px-2 h-auto">
                                                <Trash2 className="mr-1 h-3 w-3" /> Remove
                                            </Button>
                                        )}
                                    </div>
                                    </Card>
                                );
                                })}
                            </CardContent>
                            </Card>
                        );
                        })}
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
