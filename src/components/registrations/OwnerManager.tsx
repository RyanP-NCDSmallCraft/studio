
"use client";
import React, { useState } from "react";
import type { Control, UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label"; // Not directly used in JSX, but kept for consistency if modalForm were to use it
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  // DialogTrigger, // DialogTrigger is not explicitly used as open state is managed
  DialogClose,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, Trash2, Edit, UserPlus, Building } from "lucide-react";
import type { Owner } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO, isValid } from "date-fns"; // parseISO for robust date string parsing
import { Badge } from "@/components/ui/badge";

const ownerModalSchema = z.object({
  role: z.enum(["Primary", "CoOwner"]),
  ownerType: z.enum(["Private", "Company"]),
  // Private
  surname: z.string().optional(),
  firstName: z.string().optional(),
  dobString: z.string().optional(),
  sex: z.enum(["Male", "Female", "Other"]).optional(),
  // Company
  companyName: z.string().optional(),
  companyRegNo: z.string().optional(),
  companyAddress: z.string().optional(),
  // Common
  phone: z.string().min(1, "Phone number is required"),
  fax: z.string().optional().default(""),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).default(""),
  postalAddress: z.string().optional().default(""),
  townDistrict: z.string().min(1, "Town/District is required"),
  llg: z.string().optional().default(""),
  wardVillage: z.string().optional().default(""),
}).superRefine((data, ctx) => {
    if (data.ownerType === 'Private') {
        if (!data.surname) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["surname"], message: "Surname is required for private owners." });
        if (!data.firstName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["firstName"], message: "First name is required for private owners." });
        if (!data.dobString || !isValid(parseISO(data.dobString))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dobString"], message: "A valid date of birth is required for private owners." });
        if (!data.sex) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["sex"], message: "Sex is required for private owners." });
    }
    if (data.ownerType === 'Company') {
        if (!data.companyName) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["companyName"], message: "Company name is required." });
    }
});

type OwnerModalFormValues = z.infer<typeof ownerModalSchema>;


interface OwnerManagerProps {
  owners: Owner[];
  setOwners: React.Dispatch<React.SetStateAction<Owner[]>>;
  form: UseFormReturn<any>; // Pass the main form
}

export function OwnerManager({ owners, setOwners, form: mainForm }: OwnerManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const modalForm = useForm<OwnerModalFormValues>({
    resolver: zodResolver(ownerModalSchema),
    defaultValues: { 
        role: "Primary",
        ownerType: "Private",
    }
  });

  const watchOwnerType = modalForm.watch("ownerType");
  
  const handleAddOwner = () => {
    setEditingOwner(null);
    setEditingIndex(null);
    modalForm.reset({
        role: "Primary",
        ownerType: "Private",
    });
    setIsModalOpen(true);
  };

  const handleEditOwner = (index: number) => {
    const owner = owners[index];
    setEditingOwner(owner);
    setEditingIndex(index);
    let dobToFormat: Date | string = owner.dob as any; 
    if (owner.dob && typeof (owner.dob as any).toDate === 'function') {
        dobToFormat = (owner.dob as any).toDate();
    }
    
    modalForm.reset({
        ...owner,
        fax: owner.fax || "",
        email: owner.email || "",
        postalAddress: owner.postalAddress || "",
        llg: owner.llg || "",
        wardVillage: owner.wardVillage || "",
        dobString: owner.dob && isValid(new Date(dobToFormat)) ? format(new Date(dobToFormat), "yyyy-MM-dd") : "",
        companyName: owner.companyName || "",
        companyRegNo: owner.companyRegNo || "",
        companyAddress: owner.companyAddress || "",
    });
    setIsModalOpen(true);
  };

  const handleRemoveOwner = (index: number) => {
    setOwners(prev => prev.filter((_, i) => i !== index));
  };

  const onModalSubmit = (data: OwnerModalFormValues) => {
    const ownerData: Owner = {
      ownerId: editingOwner?.ownerId || crypto.randomUUID(), 
      role: data.role,
      ownerType: data.ownerType,
      surname: data.surname,
      firstName: data.firstName,
      dob: data.dobString && isValid(parseISO(data.dobString)) ? parseISO(data.dobString) as any : undefined,
      sex: data.sex,
      companyName: data.companyName,
      companyRegNo: data.companyRegNo,
      companyAddress: data.companyAddress,
      phone: data.phone,
      fax: data.fax,
      email: data.email,
      postalAddress: data.postalAddress,
      townDistrict: data.townDistrict,
      llg: data.llg,
      wardVillage: data.wardVillage,
    };

    if (editingIndex !== null) {
      setOwners(prev => prev.map((o, i) => i === editingIndex ? ownerData : o));
    } else {
      setOwners(prev => [...prev, ownerData]);
    }
    setIsModalOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>Owner Information *</CardTitle>
            <CardDescription>Add at least one owner. Max 5 owners.</CardDescription>
        </div>
        <Button type="button" onClick={handleAddOwner} variant="outline" size="sm">
          <UserPlus className="mr-2 h-4 w-4" /> Add Owner
        </Button>
      </CardHeader>
      <CardContent>
        {mainForm.formState.errors.owners && typeof mainForm.formState.errors.owners === 'object' && 'message' in mainForm.formState.errors.owners && (
            <p className="text-sm font-medium text-destructive mb-2">
                {mainForm.formState.errors.owners.message as string}
            </p>
        )}
        {owners.length === 0 ? (
          <p className="text-sm text-muted-foreground">No owners added yet.</p>
        ) : (
          <ul className="space-y-3">
            {owners.map((owner, index) => (
              <li key={owner.ownerId || index} className="flex items-center justify-between p-3 border rounded-md bg-background">
                <div>
                  <div className="font-medium flex items-center gap-2">
                    {owner.ownerType === 'Company' ? <Building className="h-4 w-4 text-muted-foreground"/> : <UserPlus className="h-4 w-4 text-muted-foreground"/>}
                    {owner.ownerType === 'Company' ? owner.companyName : `${owner.firstName} ${owner.surname}`}
                    <Badge variant="secondary">{owner.role}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground pl-6">{owner.email || owner.phone}</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleEditOwner(index)} title="Edit Owner">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveOwner(index)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive" title="Remove Owner">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingOwner ? "Edit Owner" : "Add New Owner"}</DialogTitle>
              <DialogDescription>Fill in the details for the craft owner.</DialogDescription>
            </DialogHeader>
            <Form {...modalForm}>
              <form onSubmit={modalForm.handleSubmit(onModalSubmit)} className="space-y-4 py-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={modalForm.control} name="role" render={({ field }) => (<FormItem><FormLabel>Role *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Primary">Primary</SelectItem><SelectItem value="CoOwner">Co-Owner</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="ownerType" render={({ field }) => (<FormItem><FormLabel>Owner Type *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Private">Private Individual</SelectItem><SelectItem value="Company">Company</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                
                {watchOwnerType === "Private" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md">
                        <FormField control={modalForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input placeholder="John" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={modalForm.control} name="surname" render={({ field }) => (<FormItem><FormLabel>Surname *</FormLabel><FormControl><Input placeholder="Doe" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={modalForm.control} name="dobString" render={({ field }) => (<FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input type="date" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={modalForm.control} name="sex" render={({ field }) => (<FormItem><FormLabel>Sex *</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select..."/></SelectTrigger></FormControl><SelectContent>{["Male", "Female", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    </div>
                )}

                {watchOwnerType === "Company" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-md">
                        <FormField control={modalForm.control} name="companyName" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Company Name *</FormLabel><FormControl><Input placeholder="e.g., Global Marine Services Ltd." {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={modalForm.control} name="companyRegNo" render={({ field }) => (<FormItem><FormLabel>Company Reg. No.</FormLabel><FormControl><Input placeholder="e.g., 1-12345" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={modalForm.control} name="companyAddress" render={({ field }) => (<FormItem><FormLabel>Company Address</FormLabel><FormControl><Input placeholder="e.g., Sec 1, Lot 2, Gerehu" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <FormField control={modalForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Contact Phone *</FormLabel><FormControl><Input placeholder="e.g., +675 70000000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="fax" render={({ field }) => (<FormItem><FormLabel>Fax</FormLabel><FormControl><Input placeholder="Optional" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="contact@example.com" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="postalAddress" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Postal Address</FormLabel><FormControl><Input placeholder="P.O. Box 123, Waigani" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="townDistrict" render={({ field }) => (<FormItem><FormLabel>Town/District *</FormLabel><FormControl><Input placeholder="Port Moresby" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="llg" render={({ field }) => (<FormItem><FormLabel>LLG (Local Level Gov.)</FormLabel><FormControl><Input placeholder="NCD" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="wardVillage" render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel>Ward/Village</FormLabel><FormControl><Input placeholder="Waigani Village" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit">{editingOwner ? "Save Changes" : "Add Owner"}</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
