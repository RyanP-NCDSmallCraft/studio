
"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UploadCloud, List, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { importRegistrations_serverAction, type RegistrationImportData } from '@/actions/registrations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area'; // Added ScrollArea import

const CSV_HEADERS = [
  "registrationType","previousScaRegoNo","craftMake","craftModel","craftYear","craftColor","hullIdNumber","craftLength","lengthUnits","passengerCapacity","distinguishingFeatures",
  "propulsionType","propulsionOtherDesc","hullMaterial","hullMaterialOtherDesc","craftUse","craftUseOtherDesc","fuelType","fuelTypeOtherDesc","vesselType","vesselTypeOtherDesc",
  "engine1_make","engine1_horsepower","engine1_serialNumber","engine2_make","engine2_horsepower","engine2_serialNumber",
  "owner1_role","owner1_surname","owner1_firstName","owner1_dob","owner1_sex","owner1_phone","owner1_email","owner1_postalAddress","owner1_townDistrict","owner1_llg","owner1_wardVillage",
  "owner2_role","owner2_surname","owner2_firstName","owner2_dob","owner2_sex","owner2_phone","owner2_email","owner2_postalAddress","owner2_townDistrict","owner2_llg","owner2_wardVillage"
];

export default function ImportRegistrationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser, isAdmin, isRegistrar, loading: authLoading } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<RegistrationImportData[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; details?: { successful: number; failed: number; errors: string[] } } | null>(null);
  const [csvContentPreview, setCsvContentPreview] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setParsedData([]);
        setImportResult(null);
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          setCsvContentPreview(text.substring(0, 500) + (text.length > 500 ? "..." : ""));
        };
        reader.readAsText(selectedFile.slice(0, 500));
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select a CSV file.",
          variant: "destructive",
        });
        setFile(null);
        setCsvContentPreview("");
      }
    }
  };

  const parseCSV = useCallback((csvText: string): RegistrationImportData[] => {
    const lines = csvText.split(/\r\n|\n/);
    if (lines.length < 2) {
      toast({ title: "CSV Error", description: "CSV file must contain a header row and at least one data row.", variant: "destructive" });
      return [];
    }

    const headers = lines[0].split(',').map(h => h.trim());
    const missingHeaders = CSV_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0 && headers.length !== CSV_HEADERS.length) {
      console.warn("CSV Headers Mismatch. Expected:", CSV_HEADERS, "Found:", headers);
      toast({ title: "CSV Header Mismatch", description: `Ensure your CSV headers match the template. Missing/extra: ${missingHeaders.join(', ')} or unexpected header count.`, variant: "destructive", duration: 10000 });
    }
    
    const dataRows = lines.slice(1).filter(line => line.trim() !== '');
    const records: RegistrationImportData[] = [];

    dataRows.forEach((line) => {
      const values = line.split(',');
      const record: any = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ? values[index].trim() : undefined;
      });
      records.push(record as RegistrationImportData);
    });
    return records;
  }, [toast]);

  const handleParseFile = () => {
    if (!file) {
      toast({ title: "No File", description: "Please select a CSV file to parse.", variant: "destructive" });
      return;
    }
    setIsParsing(true);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        const data = parseCSV(text);
        if (data.length > 0) {
          setParsedData(data);
          toast({ title: "CSV Parsed", description: `${data.length} records found. Review and click Import.` });
        } else if (text.trim() !== "" && data.length === 0) {
           const lines = text.split(/\r\n|\n/);
           if (lines.length < 2) { /* Already handled by parseCSV */ }
           else {
            toast({ title: "Parsing Issue", description: "Could not parse records from the CSV. Check format.", variant: "destructive" });
           }
        }
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast({ title: "Parsing Error", description: `Failed to parse CSV. ${error instanceof Error ? error.message : 'Unknown error'}`, variant: "destructive" });
      }
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  const handleImportData = async () => {
    if (!currentUser?.userId) {
        toast({ title: "Authentication Error", description: "You must be logged in to import data.", variant: "destructive" });
        return;
    }
    if (parsedData.length === 0) {
      toast({ title: "No Data", description: "No data to import. Please parse a file first.", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    setImportResult(null);
    try {
      const result = await importRegistrations_serverAction(parsedData, currentUser.userId);
      setImportResult(result);
      if (result.success) {
        toast({ title: "Import Successful", description: result.message });
      } else {
        toast({ title: "Import Failed", description: result.message, variant: "destructive", duration: 10000 });
      }
    } catch (error) {
      console.error("Error importing data:", error);
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during import.";
      setImportResult({ success: false, message: `Client-side error: ${errorMessage}` });
      toast({ title: "Import Error", description: errorMessage, variant: "destructive" });
    }
    setIsImporting(false);
  };
  
  const downloadCSVTemplate = () => {
    const csvContent = CSV_HEADERS.join(',') + '\n';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'regocraft_import_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading user data...</p>
      </div>
    );
  }

  if (!currentUser || (!isAdmin && !isRegistrar)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive" /> Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to access the import registrations feature. This page is restricted to Administrators and Registrars.</p>
          <Button onClick={() => router.back()} className="mt-4">Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/registrations')} className="mr-2 h-9 w-9">
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to Registrations</span>
        </Button>
        <UploadCloud className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Import Registrations</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Prepare & Upload CSV File</CardTitle>
          <CardDescription>
            Download the template, fill it with your registration data, and upload it here.
            Ensure dates (like DOB) are in YYYY-MM-DD format. All other fields are text or numbers as appropriate.
            <Button variant="link" onClick={downloadCSVTemplate} className="p-0 h-auto ml-1 text-sm">Download CSV Template</Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv" onChange={handleFileChange} />
          {csvContentPreview && (
            <div className="mt-2 p-2 border rounded-md bg-muted h-32 overflow-auto text-xs">
              <p className="font-semibold mb-1">CSV File Preview (first 500 characters):</p>
              <pre>{csvContentPreview}</pre>
            </div>
          )}
          <Button onClick={handleParseFile} disabled={!file || isParsing || isImporting}>
            {isParsing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <List className="mr-2 h-4 w-4" />}
            {isParsing ? 'Parsing...' : 'Parse CSV File'}
          </Button>
        </CardContent>
      </Card>

      {parsedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Review Parsed Data (First 5 Records)</CardTitle>
            <CardDescription>
              Verify that the data from your CSV has been parsed correctly. If it looks good, proceed to import.
              Only the first 5 records are shown for preview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <div className="max-h-96"> {/* Added max-height for vertical scroll if needed */}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Craft Make</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>HIN</TableHead>
                      <TableHead>Owner 1</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 5).map((record, index) => (
                      <TableRow key={index}>
                        <TableCell>{record.craftMake}</TableCell>
                        <TableCell>{record.craftModel}</TableCell>
                        <TableCell>{record.hullIdNumber}</TableCell>
                        <TableCell>{record.owner1_firstName} {record.owner1_surname}</TableCell>
                        <TableCell><Badge variant="outline">To be Imported as Draft</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">Total records parsed: {parsedData.length}</p>
            <Button onClick={handleImportData} disabled={isImporting || isParsing} className="w-full sm:w-auto">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isImporting ? 'Importing...' : `Import All ${parsedData.length} Records`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {importResult && (
        <Card className={importResult.success ? 'border-green-500' : 'border-destructive'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? <CheckCircle className="text-green-500" /> : <AlertTriangle className="text-destructive" />}
              Import {importResult.success ? 'Successful' : 'Failed'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>{importResult.message}</p>
            {importResult.details && (
              <div className="mt-2 text-sm">
                <p>Successfully imported: {importResult.details.successful}</p>
                <p>Failed to import: {importResult.details.failed}</p>
                {importResult.details.errors && importResult.details.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">Error Details:</p>
                    <Textarea readOnly value={importResult.details.errors.join('\n')} rows={Math.min(10, importResult.details.errors.length)} className="text-xs bg-muted" />
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
