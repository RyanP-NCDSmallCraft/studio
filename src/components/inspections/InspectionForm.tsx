
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
import { Save, Send, Ship, User as UserIcon, CalendarDays, Trash2, PlusCircle, Lightbulb, Loader2, ImageUp, Settings, Play, Info, ChevronsUpDown, Check, X, ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Timestamp, addDoc, updateDoc, collection, getDocs, doc, query, where, type DocumentReference } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { suggestChecklistItems } from "@/ai/flows/suggest-checklist-items";
import Link from "next/link";
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { formatFirebaseTimestamp } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";


const checklistItemSchema = z.object({
  itemId: z.string(),
  itemDescription: z.string().min(1, "Description is required"),
  category: z.string().optional(),
  result: z.enum(["Yes", "No", "N/A", "Pending"]),
  comments: z.string().optional(),
  photoUrl: z.string().optional(),
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
});


type InspectionFormValues = z.infer<typeof inspectionFormSchema>;

// NCD Small Craft Inspection Checklist Items
const ncdChecklistTemplateItems: Array<Omit<ChecklistItemResultType, 'result' | 'comments' | 'photoUrl'> & {order?: number}> = [
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
  { itemId: "C_3_b", itemDescription: "Flotation & Buoyancy: Air compartments (if used for buoyancy) marked with \"Caution...\" label?", category: "C.Construction: Flotation & Buoyancy" },
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
  items: ncdChecklistTemplateItems.map(item => ({ ...item, result: "Pending", comments: "" })) as any,
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
  label: string;
  scaRegoNo?: string;
  craftDetails?: string;
  craftType?: string;
  craftMake?: string;
  craftModel?: string;
  craftYear?: number;
  craftUse?: string; // e.g. "Passenger" | "Fishing" | "Cargo" — used to auto-detect commercial
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
  const fileInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<number, number | null>>({});

  // Stepper state for conduct flow
  type ConductStep = 'A' | 'B' | 'C' | 'extras' | 'assessment';
  const initialStep = (existingInspectionData?.lastConductStep as ConductStep | undefined) || 'A';
  const [currentConductStep, setCurrentConductStep] = useState<ConductStep>(initialStep);
  const [showCommercial, setShowCommercial] = useState(false);
  const [showOutOfSight, setShowOutOfSight] = useState(false);
  const [showNightTravel, setShowNightTravel] = useState(false);

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
      checklistItems: (existingInspectionData.checklistItems || []).map(item => ({...item, category: item.category || ncdChecklistTemplate.items.find(t => t.itemId === item.itemId)?.category, result: item.result || "Pending" })),
      findings: existingInspectionData.findings || "",
      correctiveActions: existingInspectionData.correctiveActions || "",
      followUpRequired: existingInspectionData.followUpRequired || false,
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

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "checklistItems",
  });

  const watchInspectionType = form.watch("inspectionType");
  const watchInspectionDate = form.watch("inspectionDate");
  const watchRegistrationRefId = form.watch("registrationRefId");
  const watchChecklistItems = form.watch("checklistItems");


  useEffect(() => {
    console.log("InspectionForm Effect: Context:", usageContext, "Mode:", mode, "Fields length:", fields.length, "Existing items:", existingInspectionData?.checklistItems?.length);
    if (usageContext === 'conduct' && (mode === 'create' || (mode === 'edit' && (!existingInspectionData?.checklistItems || existingInspectionData.checklistItems.length === 0)))) {
        console.log("InspectionForm: Attempting to load NCD default checklist.");
        const ncdItemsToLoad = ncdChecklistTemplate.items.map(templateItem => ({
            itemId: templateItem.itemId,
            itemDescription: templateItem.itemDescription,
            category: templateItem.category,
            result: "Pending" as "Yes" | "No" | "N/A" | "Pending", 
            comments: "",
            photoUrl: "",
        }));
        form.setValue("checklistItems", ncdItemsToLoad as any);
        console.log("InspectionForm: NCD checklist loaded with", ncdItemsToLoad.length, "items.");
    }
}, [mode, usageContext, existingInspectionData, form, fields.length]); 

  // Auto-detect commercial craft from linked registration's craftUse
  useEffect(() => {
    if (usageContext !== 'conduct') return;
    const commercialUseTypes = ['Passenger', 'Fishing', 'Cargo'];
    const linked = registrationsForSelect.find(r => r.value === watchRegistrationRefId);
    if (linked?.craftUse && commercialUseTypes.includes(linked.craftUse)) {
      setShowCommercial(true);
    }
  }, [watchRegistrationRefId, registrationsForSelect, usageContext]);


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
            craftUse: data.craftUse,
          };
        });
        setRegistrationsForSelect(regs);
      } catch (error) {
        console.error("Error fetching registrations for select:", error);
        toast({ title: "Error", description: "Could not load registrations for selection.", variant: "destructive" });
      }
      setLoadingRegistrations(false);
    };

    fetchRegs();
  }, [toast]);


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
          const q = query(usersCol, where("isActive", "==", true), where("role", "in", ["Inspector", "Admin", "Supervisor", "Registrar"]));
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

  const handleChecklistPhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const currentItem = fields[index];
    setUploadProgress(prev => ({ ...prev, [index]: 0 }));

    const photoPath = `inspections/${inspectionId || `new_${Date.now()}`}/checklist_${currentItem.itemId}_${Date.now()}`;
    const photoStorageRef = storageRef(storage, photoPath);
    const uploadTask = uploadBytesResumable(photoStorageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(prev => ({ ...prev, [index]: progress }));
      },
      (error) => {
        console.error("Checklist photo upload error:", error);
        toast({ title: "Upload Failed", description: `Could not upload photo for item: ${currentItem.itemDescription}`, variant: "destructive" });
        setUploadProgress(prev => ({ ...prev, [index]: null }));
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        update(index, { ...currentItem, photoUrl: downloadURL });
        setUploadProgress(prev => ({ ...prev, [index]: 100 }));
        toast({ title: "Photo Uploaded", description: `Photo added for item: ${currentItem.itemDescription}`});
      }
    );
  };


  const onSubmit = async (data: InspectionFormValues, action: "schedule" | "saveProgress" | "submitReview") => {
    if (!currentUser?.userId) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }

    let finalStatus: Inspection['status'];
    let submissionPayload: Partial<InspectionFormValues> = { ...data };

    const baseInspectionData = {
      registrationRef: data.registrationRefId ? doc(db, "registrations", data.registrationRefId) : null,
      inspectorRef: data.inspectorRefId ? doc(db, "users", data.inspectorRefId) as DocumentReference<User> : undefined,
      inspectionType: data.inspectionType,
      scheduledDate: Timestamp.fromDate(new Date(data.scheduledDate)),
      followUpRequired: data.followUpRequired || false,
      lastUpdatedAt: Timestamp.now(),
      lastUpdatedByRef: doc(db, "users", currentUser.userId) as DocumentReference<User>,
    };

    if (action === "schedule") {
        if (mode === "edit" && existingInspectionData?.status === "Passed" && existingInspectionData?.registrationRef !== data.registrationRefId) {
            finalStatus = "PendingReview"; // Reset status if linking a new registration to a passed inspection
            toast({ title: "Status Reset", description: "Inspection status has been reset to 'PendingReview' due to registration change."});
        } else {
            finalStatus = "Scheduled";
        }

      const schedulePayload: Partial<Inspection> = {
        ...baseInspectionData,
        status: finalStatus,
        // When re-scheduling, we don't clear out conducted inspection data, we just update schedule-related fields.
        // If it was already passed, changing rego resets it to pending review, but keeps conducted data.
      };
      
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
        lastConductStep: currentConductStep, // persist step position
      } as any;


    } else if (action === "submitReview") {
      if (!data.inspectionDate) {
         toast({ title: "Missing Information", description: "Please set the Actual Inspection Date.", variant: "destructive"});
        return;
      }
      if (!data.findings || !data.overallResult) {
        toast({ title: "Missing Information", description: "Please provide Overall Findings and an Overall Result to submit for review.", variant: "destructive"});
        return;
      }
      const hasPendingItems = data.checklistItems?.some(item => item.result === "Pending" || !item.result);
      if (hasPendingItems) {
        toast({ title: "Incomplete Checklist", description: "Please answer all checklist items (Yes, No, or N/A) before submitting.", variant: "destructive"});
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
        lastConductStep: 'A', // reset step on final submission
      } as any;
    } else {
      toast({ title: "Error", description: "Invalid action.", variant: "destructive" });
      return;
    }
    
    // Add creation timestamp only for new documents
    if (mode === 'create' && !submissionPayload.createdAt) {
      submissionPayload.createdAt = Timestamp.now();
      submissionPayload.createdByRef = doc(db, "users", currentUser.userId) as DocumentReference<User>;
    } else if (mode === 'edit' && existingInspectionData) {
       submissionPayload.createdAt = existingInspectionData.createdAt;
       submissionPayload.createdByRef = existingInspectionData.createdByRef;
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

  // --- Stepper helpers ---
  const getStepProgress = (stepKey: string) => {
    const currentItems = watchChecklistItems && watchChecklistItems.length > 0 ? watchChecklistItems : fields;
    const stepItems = currentItems.filter(f => {
      const cat = (f as any).category as string | undefined;
      if (stepKey === 'A') return cat?.startsWith('A.');
      if (stepKey === 'B') return cat?.startsWith('B.');
      if (stepKey === 'C') return cat?.startsWith('C.');
      if (stepKey === 'extras') return cat === 'AI Suggested' || cat === 'Custom';
      return false;
    });
    const answered = stepItems.filter(f => f.result !== 'Pending' && !!f.result).length;
    return { total: stepItems.length, answered };
  };

  // Returns true when a step is before the current one and still has unanswered items
  const hasStepWarning = (stepKey: string, currentIdx: number, stepIdx: number) => {
    if (stepKey === 'assessment') return false;
    if (stepIdx >= currentIdx) return false; // only flag steps already passed
    const prog = getStepProgress(stepKey);
    return prog.total > 0 && prog.answered < prog.total;
  };

  const conductStepsList: { key: string; label: string; sublabel: string }[] = [
    { key: 'A', label: 'Schedule A', sublabel: 'Marking & Load Lines' },
    { key: 'B', label: 'Schedule B', sublabel: 'Safety Standards' },
    { key: 'C', label: 'Schedule C', sublabel: 'Construction' },
    { key: 'extras', label: 'Additional', sublabel: 'Custom & AI Items' },
    { key: 'assessment', label: 'Assessment', sublabel: 'Overall Result' },
  ];

  const conductStepOrder: string[] = ['A', 'B', 'C', 'extras', 'assessment'];

  const handleStepNext = () => {
    const idx = conductStepOrder.indexOf(currentConductStep);
    if (idx < conductStepOrder.length - 1) setCurrentConductStep(conductStepOrder[idx + 1] as any);
  };
  const handleStepBack = () => {
    const idx = conductStepOrder.indexOf(currentConductStep);
    if (idx > 0) setCurrentConductStep(conductStepOrder[idx - 1] as any);
  };

  // Reusable checklist item card renderer
  const renderChecklistItem = (item: typeof fields[number] & { originalIndex: number }) => {
    const originalIndex = item.originalIndex;
    return (
      <Card key={item.id} className="p-4 bg-card shadow-sm">
        <p className="font-medium mb-3 text-sm leading-snug">{item.itemDescription}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 items-start">
          <FormField
            control={form.control}
            name={`checklistItems.${originalIndex}.result`}
            render={({ field: resultField }) => (
              <FormItem className="space-y-1">
                <FormLabel className="text-xs font-semibold">Result *</FormLabel>
                <FormControl>
                  <RadioGroup onValueChange={resultField.onChange} defaultValue={resultField.value} className="flex space-x-4 items-center pt-1">
                    {(["Yes", "No", "N/A"] as const).map((val) => (
                      <FormItem key={`${item.itemId}-${originalIndex}-${val}`} className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value={val} id={`${item.itemId}-${originalIndex}-${val.toLowerCase()}`} className="h-5 w-5" /></FormControl>
                        <Label htmlFor={`${item.itemId}-${originalIndex}-${val.toLowerCase()}`} className={`font-medium text-sm cursor-pointer ${val === "Yes" ? "text-green-600" : val === "No" ? "text-red-600" : "text-muted-foreground"}`}>{val}</Label>
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
                <FormLabel className="text-xs font-semibold">Notes</FormLabel>
                <FormControl><Textarea placeholder="Optional comments" {...commentsField} rows={1} className="text-sm" /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="mt-3 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" className="text-xs h-8" onClick={() => fileInputRefs.current[originalIndex]?.click()}>
              <ImageUp className="mr-1 h-3 w-3" /> Upload Photo
            </Button>
            <Input type="file" accept="image/*" className="hidden" ref={el => fileInputRefs.current[originalIndex] = el} onChange={(e) => handleChecklistPhotoUpload(e, originalIndex)} />
            {uploadProgress[originalIndex] !== null && uploadProgress[originalIndex] !== undefined && uploadProgress[originalIndex]! < 100 && (
              <Progress value={uploadProgress[originalIndex]} className="w-24 h-1.5" />
            )}
            {item.photoUrl && (
              <div className="relative group">
                <a href={item.photoUrl} target="_blank" rel="noopener noreferrer">
                  <Image src={item.photoUrl} alt={`Photo for ${item.itemDescription}`} width={40} height={40} className="h-10 w-10 object-cover rounded-md border" />
                </a>
                <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => update(originalIndex, { ...item, photoUrl: undefined })}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          {item.itemId?.startsWith("custom_") && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(originalIndex)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive text-xs h-8">
              <Trash2 className="mr-1 h-3 w-3" /> Remove
            </Button>
          )}
        </div>
      </Card>
    );
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
                  <FormLabel>Linked Craft Registration {usageContext === 'conduct' && '(Optional)'}</FormLabel>
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
                           disabled={loadingRegistrations}
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

            <FormField control={form.control} name="inspectionType" render={({ field }) => (<FormItem><FormLabel>Inspection Type *</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={usageContext === 'conduct' && mode === 'edit'}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Initial", "Annual", "Compliance", "FollowUp"].map(val => <SelectItem key={val} value={val}>{val}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="scheduledDate" render={({ field }) => (<FormItem><FormLabel>Scheduled Date *</FormLabel><FormControl><Input type="date" {...field} value={field.value ? format(field.value instanceof Date ? field.value : new Date(field.value), 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
           {usageContext === "conduct" && (
             <FormField control={form.control} name="inspectionDate" render={({ field }) => (<FormItem><FormLabel>Actual Inspection Date *</FormLabel><FormControl><Input type="date" {...field} value={field.value ? format(field.value instanceof Date ? field.value : new Date(field.value), 'yyyy-MM-dd') : ''} onChange={e => field.onChange(e.target.value ? new Date(e.target.value) : undefined)} /></FormControl><FormMessage /></FormItem>)} />
           )}
          </CardContent>
        </Card>

        {usageContext === "conduct" && (
          <>
            {/* ── Stepper Nav ── */}
            <nav aria-label="Inspection steps" className="overflow-x-auto pb-1">
              <ol className="flex items-center gap-1 min-w-max">
                {conductStepsList.map((step, idx) => {
                  const isActive = currentConductStep === step.key;
                  const stepIdx = conductStepOrder.indexOf(currentConductStep);
                  const isBefore = stepIdx > idx;
                  const hasWarning = hasStepWarning(step.key, stepIdx, idx);
                  const prog = step.key !== 'assessment' ? getStepProgress(step.key) : null;
                  return (
                    <React.Fragment key={step.key}>
                      <li className="relative">
                        <button
                          type="button"
                          onClick={() => setCurrentConductStep(step.key as any)}
                          className={cn(
                            "flex flex-col items-center px-3 py-2 rounded-xl border-2 transition-all duration-200 min-w-[80px] text-center gap-0.5",
                            isActive
                              ? "bg-primary text-primary-foreground border-primary shadow-lg scale-[1.04]"
                              : hasWarning
                              ? "bg-red-50 text-red-700 border-red-400 dark:bg-red-950/60 dark:text-red-300 dark:border-red-600"
                              : isBefore
                              ? "bg-green-50 text-green-700 border-green-400 dark:bg-green-950/60 dark:text-green-300 dark:border-green-600"
                              : "bg-card text-muted-foreground border-muted hover:border-muted-foreground/40"
                          )}
                        >
                          {isBefore && !hasWarning
                            ? <CheckCircle className="h-4 w-4 text-green-500" />
                            : <span className={cn("text-xs font-bold", isActive && "text-primary-foreground", hasWarning && "text-red-600 dark:text-red-400")}>{idx + 1}</span>
                          }
                          <span className="text-xs font-semibold leading-tight">{step.label}</span>
                          <span className="text-[10px] leading-tight opacity-70">{step.sublabel}</span>
                          {prog && prog.total > 0 && (
                            <span className={cn(
                              "text-[10px] font-medium px-1.5 rounded-full mt-0.5",
                              prog.answered === prog.total
                                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                : hasWarning
                                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                                : isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                            )}>
                              {prog.answered}/{prog.total}
                            </span>
                          )}
                        </button>
                        {hasWarning && (
                           <div className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-[10px] font-bold shadow-sm">
                             !
                           </div>
                        )}
                      </li>
                      {idx < conductStepsList.length - 1 && (
                        <li aria-hidden className="text-muted-foreground flex-shrink-0">
                          <ChevronRight className="h-4 w-4" />
                        </li>
                      )}
                    </React.Fragment>
                  );
                })}
              </ol>
            </nav>

            {/* ── Schedule A ── */}
            {currentConductStep === 'A' && (
              <Card className="shadow-md">
                <CardHeader className="border-b bg-muted/20 pb-3">
                  <CardTitle className="text-base">Schedule A — Marking &amp; Load Line Requirements</CardTitle>
                  <CardDescription>Check registration number and load line markings comply with Schedule 1.</CardDescription>
                  {(() => { const p = getStepProgress('A'); return p.total > 0 ? <><div className="flex justify-between text-xs text-muted-foreground mt-2"><span>Progress</span><span>{p.answered}/{p.total} answered</span></div><Progress value={(p.answered/p.total)*100} className="h-1.5 mt-1"/></> : null; })()}
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {(groupedChecklistItems['A'] || []).map(item => renderChecklistItem(item))}
                  {(!groupedChecklistItems['A'] || groupedChecklistItems['A'].length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No Schedule A items loaded.</p>}
                </CardContent>
              </Card>
            )}

            {/* ── Schedule B ── */}
            {currentConductStep === 'B' && (
              <Card className="shadow-md">
                <CardHeader className="border-b bg-muted/20 pb-3">
                  <CardTitle className="text-base">Schedule B — Safety Standards</CardTitle>
                  <CardDescription>Verify safety equipment. Optional sections apply based on craft type and intended operation.</CardDescription>
                  {(() => { const p = getStepProgress('B'); return p.total > 0 ? <><div className="flex justify-between text-xs text-muted-foreground mt-2"><span>Progress</span><span>{p.answered}/{p.total} answered</span></div><Progress value={(p.answered/p.total)*100} className="h-1.5 mt-1"/></> : null; })()}
                </CardHeader>
                <CardContent className="p-4 space-y-5">
                  {/* B1 – All Registered Craft */}
                  <div>
                    <h3 className="text-sm font-semibold border-b pb-1 mb-3">B1. For ALL Registered Craft</h3>
                    <div className="space-y-3">{(groupedChecklistItems['B'] || []).filter(i => ((i as any).category as string)?.includes('All Registered Craft')).map(item => renderChecklistItem(item))}</div>
                  </div>
                  {/* B2 – Out of Sight of Land (toggle) */}
                  <div className="border rounded-lg overflow-hidden">
                    <div role="button" tabIndex={0} onClick={() => setShowOutOfSight(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left cursor-pointer">
                      <div>
                        <span className="text-sm font-semibold">B2. Travelling Out of Sight of Land</span>
                        <p className="text-xs text-muted-foreground">Enable if craft will operate beyond sight of land</p>
                      </div>
                      <Switch checked={showOutOfSight} onCheckedChange={setShowOutOfSight} onClick={e => e.stopPropagation()} />
                    </div>
                    {showOutOfSight && (
                      <div className="p-3 space-y-3 border-t">{(groupedChecklistItems['B'] || []).filter(i => ((i as any).category as string)?.includes('Out of Sight of Land')).map(item => renderChecklistItem(item))}</div>
                    )}
                  </div>
                  {/* B3 – Night Travel (toggle) */}
                  <div className="border rounded-lg overflow-hidden">
                    <div role="button" tabIndex={0} onClick={() => setShowNightTravel(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left cursor-pointer">
                      <div>
                        <span className="text-sm font-semibold">B3. Night Travel</span>
                        <p className="text-xs text-muted-foreground">Enable if craft will operate at night</p>
                      </div>
                      <Switch checked={showNightTravel} onCheckedChange={setShowNightTravel} onClick={e => e.stopPropagation()} />
                    </div>
                    {showNightTravel && (
                      <div className="p-3 space-y-3 border-t">{(groupedChecklistItems['B'] || []).filter(i => ((i as any).category as string)?.includes('Night Travel')).map(item => renderChecklistItem(item))}</div>
                    )}
                  </div>
                  {/* B4 – Commercial (toggle) */}
                  <div className="border-2 rounded-lg overflow-hidden border-amber-200 dark:border-amber-800">
                    <div role="button" tabIndex={0} onClick={() => setShowCommercial(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/30 transition-colors text-left cursor-pointer">
                      <div>
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">B4. Commercial Small Craft (Licensed)</span>
                        <p className="text-xs text-muted-foreground">Enable for commercially licensed passenger/cargo/fishing craft</p>
                      </div>
                      <Switch checked={showCommercial} onCheckedChange={setShowCommercial} onClick={e => e.stopPropagation()} />
                    </div>
                    {showCommercial && (
                      <div className="p-3 space-y-3 border-t border-amber-200 dark:border-amber-800">{(groupedChecklistItems['B'] || []).filter(i => ((i as any).category as string)?.includes('Commercial Craft')).map(item => renderChecklistItem(item))}</div>
                    )}
                  </div>
                  {/* B5 – Exemptions */}
                  <div>
                    <h3 className="text-sm font-semibold border-b pb-1 mb-3">B5. Safety Standards Exemptions</h3>
                    <div className="space-y-3">{(groupedChecklistItems['B'] || []).filter(i => ((i as any).category as string)?.includes('Exemptions')).map(item => renderChecklistItem(item))}</div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── Schedule C ── */}
            {currentConductStep === 'C' && (
              <Card className="shadow-md">
                <CardHeader className="border-b bg-muted/20 pb-3">
                  <CardTitle className="text-base">Schedule C — Construction Standards</CardTitle>
                  <CardDescription>Visual checks on observable construction aspects. Many standards require detailed assessment or certification.</CardDescription>
                  {(() => { const p = getStepProgress('C'); return p.total > 0 ? <><div className="flex justify-between text-xs text-muted-foreground mt-2"><span>Progress</span><span>{p.answered}/{p.total} answered</span></div><Progress value={(p.answered/p.total)*100} className="h-1.5 mt-1"/></> : null; })()}
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {(groupedChecklistItems['C'] || []).map(item => renderChecklistItem(item))}
                  {(!groupedChecklistItems['C'] || groupedChecklistItems['C'].length === 0) && <p className="text-sm text-muted-foreground text-center py-4">No Schedule C items loaded.</p>}
                </CardContent>
              </Card>
            )}

            {/* ── Additional / Extras ── */}
            {currentConductStep === 'extras' && (
              <Card className="shadow-md">
                <CardHeader className="border-b bg-muted/20 pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Additional Items</CardTitle>
                      <CardDescription>AI-suggested and custom craft-specific checklist items.</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button type="button" variant="outline" size="sm" onClick={handleAISuggestions} disabled={isAISuggesting || !form.getValues("registrationRefId")}>
                        {isAISuggesting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-1 h-4 w-4" />} AI Suggest
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => append({ itemId: `custom_${Date.now()}`, itemDescription: "New Custom Item", category: "Custom", result: "N/A", comments: "" })}>
                        <PlusCircle className="mr-1 h-4 w-4" /> Add Item
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {[...(groupedChecklistItems['AI Suggested'] || []), ...(groupedChecklistItems['Custom'] || [])].map(item => renderChecklistItem(item))}
                  {((!groupedChecklistItems['AI Suggested'] || groupedChecklistItems['AI Suggested'].length === 0) && (!groupedChecklistItems['Custom'] || groupedChecklistItems['Custom'].length === 0)) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <PlusCircle className="mx-auto h-8 w-8 mb-2 opacity-30" />
                      <p className="text-sm">No additional items yet. Use AI suggestions or add a custom item above.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── Assessment ── */}
            {currentConductStep === 'assessment' && (
              <Card className="shadow-md">
                <CardHeader className="border-b bg-muted/20 pb-3">
                  <CardTitle className="text-base">Overall Assessment</CardTitle>
                  <CardDescription>Summarize your findings and provide the overall inspection outcome.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-6 p-6">
                  <FormField control={form.control} name="findings" render={({ field }) => (<FormItem><FormLabel>Inspector Summary / Recommendations *</FormLabel><FormControl><Textarea placeholder="Summarize inspection findings and any recommendations" {...field} rows={4} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="correctiveActions" render={({ field }) => (<FormItem><FormLabel>Corrective Actions Required (if any)</FormLabel><FormControl><Textarea placeholder="Detail any corrective actions needed based on 'No' answers or critical findings" {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={form.control} name="followUpRequired" render={({ field }) => (<FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 shadow-sm"><div className="space-y-0.5"><FormLabel>Follow-up Inspection Required?</FormLabel></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)} />
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
                      <FormDescription>This is the inspector&apos;s final assessment for this inspection event.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ── Step Navigation ── */}
            <div className="flex items-center justify-between pt-2 pb-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleStepBack}
                disabled={currentConductStep === 'A'}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={form.handleSubmit((data) => onSubmit(data, "saveProgress"))}
                  disabled={form.formState.isSubmitting}
                >
                  <Save className="mr-2 h-4 w-4" /> Save Progress
                </Button>
                {currentConductStep !== 'assessment' ? (
                  <Button type="button" onClick={handleStepNext}>
                    Next <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={form.handleSubmit(
                      (data) => onSubmit(data, "submitReview"),
                      (errors) => {
                        console.error("Validation Errors:", errors);
                        toast({ title: "Form Validation Error", description: "Please check the form for errors. Ensure all required fields (like dates and inspector) are filled.", variant: "destructive" });
                      }
                    )}
                    disabled={form.formState.isSubmitting}
                  >
                    <Send className="mr-2 h-4 w-4" /> Submit for Review
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        <CardFooter className="flex justify-end gap-4 p-0 pt-8">
          {usageContext === "schedule" && (
            <Button type="button" onClick={form.handleSubmit((data) => onSubmit(data, "schedule"))} disabled={form.formState.isSubmitting}>
              <CalendarDays className="mr-2 h-4 w-4" /> {mode === "create" ? "Schedule Inspection" : "Update Schedule"}
            </Button>
          )}
        </CardFooter>
      </form>
    </Form>
  );
}


