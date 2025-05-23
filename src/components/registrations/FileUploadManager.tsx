
"use client";
import React, { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useForm } from "react-hook-form"; // Added import
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, Trash2, Edit, FileUp, Download } from "lucide-react";
import type { ProofOfOwnershipDoc } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Timestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
// import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
// import { storage } from "@/lib/firebase"; // Assuming storage is exported from ts

// Simplified Zod schema for the modal form
const docModalSchema = z.object({
  description: z.string().min(1, "Description is required"),
  file: z.any().refine(file => file instanceof File, "File is required.").optional(), // Optional only if editing and not changing file
});
type DocModalFormValues = z.infer<typeof docModalSchema>;

interface FileUploadManagerProps {
  title: string;
  docs: ProofOfOwnershipDoc[];
  setDocs: React.Dispatch<React.SetStateAction<ProofOfOwnershipDoc[]>>;
  storagePath: string; // e.g., "proof_of_ownership/"
  form: UseFormReturn<any>; // Main form for error display
  fieldName: string; // Field name in the main form schema, e.g., "proofOfOwnershipDocs"
}

export function FileUploadManager({ title, docs, setDocs, storagePath, form: mainForm, fieldName }: FileUploadManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<ProofOfOwnershipDoc | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const modalForm = useForm<DocModalFormValues>({
    resolver: zodResolver(docModalSchema),
  });

  const handleAddDoc = () => {
    setEditingDoc(null);
    setEditingIndex(null);
    modalForm.reset({ description: "" });
    setIsModalOpen(true);
  };

  const handleEditDoc = (index: number) => {
    const doc = docs[index];
    setEditingDoc(doc);
    setEditingIndex(index);
    modalForm.reset({ description: doc.description }); // File input not pre-filled for edit
    setIsModalOpen(true);
  };

  const handleRemoveDoc = (index: number) => {
    // In a real app, also delete from Firebase Storage
    setDocs(prev => prev.filter((_, i) => i !== index));
  };

  const onModalSubmit = async (data: DocModalFormValues) => {
    setUploading(true);
    const fileToUpload = data.file;

    if (!fileToUpload && !editingDoc) { // No file and not editing (meaning new doc)
        toast({ title: "File Required", description: "Please select a file to upload.", variant: "destructive" });
        setUploading(false);
        return;
    }

    // Placeholder for actual Firebase Storage upload
    // For now, simulate upload and use a placeholder URL
    const simulateUpload = async (file: File): Promise<{fileName: string, fileUrl: string}> => {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate delay
        // const storageRef = ref(storage, `${storagePath}${Date.now()}_${file.name}`);
        // const uploadTask = uploadBytesResumable(storageRef, file);
        // await uploadTask;
        // const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        // return { fileName: file.name, fileUrl: downloadURL };
        return { fileName: file.name, fileUrl: `https://placehold.co/100x100.png?text=${encodeURIComponent(file.name)}` };
    };

    try {
        let fileInfo = editingDoc ? { fileName: editingDoc.fileName, fileUrl: editingDoc.fileUrl } : { fileName: "", fileUrl: ""};
        
        if (fileToUpload) {
            fileInfo = await simulateUpload(fileToUpload);
        } else if (!editingDoc) { // Should not happen due to check above, but safeguard
             toast({ title: "Error", description: "No file provided for new document.", variant: "destructive" });
             setUploading(false);
             return;
        }


        const docData: ProofOfOwnershipDoc = {
            docId: editingDoc?.docId || crypto.randomUUID(),
            description: data.description,
            fileName: fileInfo.fileName,
            fileUrl: fileInfo.fileUrl,
            uploadedAt: Timestamp.now(),
        };

        if (editingIndex !== null) {
            setDocs(prev => prev.map((d, i) => (i === editingIndex ? docData : d)));
            toast({ title: "Document Updated", description: docData.fileName });
        } else {
            setDocs(prev => [...prev, docData]);
            toast({ title: "Document Uploaded", description: docData.fileName });
        }
        setIsModalOpen(false);
    } catch (error) {
        console.error("Upload error:", error);
        toast({ title: "Upload Failed", description: "Could not upload file. Please try again.", variant: "destructive" });
    } finally {
        setUploading(false);
    }
  };

  const formError = mainForm.formState.errors[fieldName];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>Upload relevant documents (e.g., bill of sale, ID).</CardDescription>
        </div>
        <Button type="button" onClick={handleAddDoc} variant="outline" size="sm">
          <FileUp className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </CardHeader>
      <CardContent>
        {formError && typeof formError === 'object' && 'message' in formError && (
            <p className="text-sm font-medium text-destructive mb-2">
                {formError.message as string}
            </p>
        )}
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((doc, index) => (
              <li key={doc.docId || index} className="flex items-center justify-between p-3 border rounded-md bg-background">
                <div>
                  <p className="font-medium">{doc.description}</p>
                  <p className="text-xs text-muted-foreground">{doc.fileName} (Uploaded: {format(doc.uploadedAt.toDate(), "PPp")})</p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" asChild title="Download Document">
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleEditDoc(index)} title="Edit Description">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveDoc(index)} className="text-destructive hover:text-destructive-foreground hover:bg-destructive" title="Remove Document">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingDoc ? "Edit Document Info" : "Upload New Document"}</DialogTitle>
              <DialogDescription>Provide a description and select the file.</DialogDescription>
            </DialogHeader>
            <Form {...modalForm}>
              <form onSubmit={modalForm.handleSubmit(onModalSubmit)} className="space-y-4 py-2">
                <FormField control={modalForm.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description *</FormLabel><FormControl><Input placeholder="e.g., Bill of Sale" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={modalForm.control} name="file" render={({ field: { onChange, value, ...rest } }) => (
                    <FormItem>
                        <FormLabel>{editingDoc ? "Replace File (Optional)" : "File *"}</FormLabel>
                        <FormControl><Input type="file" onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)} {...rest} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                {editingDoc && <p className="text-xs text-muted-foreground">Current file: {editingDoc.fileName}. Uploading a new file will replace it.</p>}
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="outline" disabled={uploading}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={uploading}>
                        {uploading ? "Uploading..." : (editingDoc ? "Save Changes" : "Upload Document")}
                    </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
