
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
import { PlusCircle, Trash2, Edit, UserPlus } from "lucide-react";
import type { Owner } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, parseISO, isValid } from "date-fns"; // parseISO for robust date string parsing
import { Badge } from "@/components/ui/badge";

// Simplified Zod schema for the modal form
const ownerModalSchema = z.object({
  role: z.enum(["Primary", "CoOwner"]),
  surname: z.string().min(1, "Surname is required"),
  firstName: z.string().min(1, "First name is required"),
  dobString: z.string().min(1, "Date of birth is required").refine(val => {
    const date = parseISO(val); // Use parseISO for better compatibility
    return isValid(date);
  }, { message: "Invalid date format. Use YYYY-MM-DD."}),
  sex: z.enum(["Male", "Female", "Other"]),
  phone: z.string().min(1, "Phone number is required"),
  fax: z.string().optional().default(""),
  email: z.string().email("Invalid email address").optional().or(z.literal("")).default(""),
  postalAddress: z.string().optional().default(""), // Made optional
  townDistrict: z.string().min(1, "Town/District is required"),
  llg: z.string().optional().default(""), // Made optional
  wardVillage: z.string().optional().default(""), // Made optional
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
        surname: "",
        firstName: "",
        dobString: "",
        sex: "Male",
        phone: "",
        fax: "",
        email: "",
        postalAddress: "",
        townDistrict: "",
        llg: "",
        wardVillage: "",
    }
  });
  
  const handleAddOwner = () => {
    setEditingOwner(null);
    setEditingIndex(null);
    modalForm.reset({
        role: "Primary",
        surname: "",
        firstName: "",
        dobString: "",
        sex: "Male",
        phone: "",
        fax: "",
        email: "",
        postalAddress: "",
        townDistrict: "",
        llg: "",
        wardVillage: "",
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
        dobString: isValid(new Date(dobToFormat)) ? format(new Date(dobToFormat), "yyyy-MM-dd") : "",
    });
    setIsModalOpen(true);
  };

  const handleRemoveOwner = (index: number) => {
    setOwners(prev => prev.filter((_, i) => i !== index));
  };

  const onModalSubmit = (data: OwnerModalFormValues) => {
    const dobDate = parseISO(data.dobString); 
    if (!isValid(dobDate)) {
        modalForm.setError("dobString", { type: "manual", message: "Invalid date entered." });
        return;
    }

    const ownerData: Owner = {
      ...data,
      ownerId: editingOwner?.ownerId || crypto.randomUUID(), 
      dob: dobDate as any, 
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
                  <div className="font-medium">{owner.firstName} {owner.surname} <Badge variant="secondary">{owner.role}</Badge></div>
                  <p className="text-xs text-muted-foreground">{owner.email || owner.phone}</p>
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
                  <FormField control={modalForm.control} name="firstName" render={({ field }) => (<FormItem><FormLabel>First Name *</FormLabel><FormControl><Input placeholder="John" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="surname" render={({ field }) => (<FormItem><FormLabel>Surname *</FormLabel><FormControl><Input placeholder="Doe" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="dobString" render={({ field }) => (<FormItem><FormLabel>Date of Birth *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="sex" render={({ field }) => (<FormItem><FormLabel>Sex *</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent>{["Male", "Female", "Other"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone *</FormLabel><FormControl><Input placeholder="e.g., +675 70000000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="fax" render={({ field }) => (<FormItem><FormLabel>Fax</FormLabel><FormControl><Input placeholder="Optional" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
                  <FormField control={modalForm.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="john.doe@example.com" {...field} value={field.value ?? ""} /></FormControl><FormMessage /></FormItem>)} />
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

