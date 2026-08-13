
"use client";

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UploadCloud, List, AlertTriangle, CheckCircle, Loader2, Info, FileWarning, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { importRegistrations_serverAction, type RegistrationImportData } from '@/actions/registrations';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

const CSV_HEADERS = [
  "registrationType","previousScaRegoNo","craftMake","craftModel","craftYear","craftColor","hullIdNumber","craftLength","lengthUnits","passengerCapacity","distinguishingFeatures",
  "propulsionType","propulsionOtherDesc","hullMaterial","hullMaterialOtherDesc","craftUse","craftUseOtherDesc","fuelType","fuelTypeOtherDesc","vesselType","vesselTypeOtherDesc",
  "engine1_make","engine1_horsepower","engine1_serialNumber","engine2_make","engine2_horsepower","engine2_serialNumber",
  "owner1_role","owner1_ownerType","owner1_surname","owner1_firstName","owner1_dob","owner1_sex",
  "owner1_companyName","owner1_companyRegNo","owner1_companyAddress",
  "owner1_phone","owner1_email","owner1_postalAddress","owner1_townDistrict","owner1_llg","owner1_wardVillage",
  "owner2_role","owner2_ownerType","owner2_surname","owner2_firstName","owner2_dob","owner2_sex",
  "owner2_companyName","owner2_companyRegNo","owner2_companyAddress",
  "owner2_phone","owner2_email","owner2_postalAddress","owner2_townDistrict","owner2_llg","owner2_wardVillage"
];

/**
 * Robust CSV row parser that correctly handles:
 * - Quoted fields containing commas
 * - Quoted fields containing escaped quotes ("")
 * - Unquoted fields
 */
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

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
          setCsvContentPreview(text.substring(0, 600) + (text.length > 600 ? "..." : ""));
        };
        reader.readAsText(selectedFile.slice(0, 600));
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

    const headers = parseCSVRow(lines[0]);
    const missingHeaders = CSV_HEADERS.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      console.warn("CSV Headers Mismatch. Expected:", CSV_HEADERS, "Found:", headers);
      toast({
        title: "CSV Header Mismatch",
        description: `Missing columns: ${missingHeaders.join(', ')}. Please use the latest template.`,
        variant: "destructive",
        duration: 12000
      });
    }

    const dataRows = lines.slice(1).filter(line => line.trim() !== '');
    const records: RegistrationImportData[] = [];

    dataRows.forEach((line) => {
      const values = parseCSVRow(line);
      const record: any = {};
      headers.forEach((header, index) => {
        const val = values[index];
        record[header] = (val !== undefined && val !== '') ? val : undefined;
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
          toast({ title: "CSV Parsed Successfully", description: `${data.length} record(s) found. Review the data below and click Import when ready.` });
        } else if (text.trim() !== "" && data.length === 0) {
          toast({ title: "Parsing Issue", description: "Could not parse records from the CSV. Check the file format.", variant: "destructive" });
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

  const getOwner1DisplayName = (record: RegistrationImportData): string => {
    const ownerType = record.owner1_ownerType || (record.owner1_companyName ? 'Company' : 'Private');
    if (ownerType === 'Company') {
      return record.owner1_companyName || '(Company name missing)';
    }
    const name = [record.owner1_firstName, record.owner1_surname].filter(Boolean).join(' ');
    return name || '(Name missing)';
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

      {/* Prominent Warning Banner */}
      <Alert className="border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/30">
        <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-800 dark:text-amber-300 font-semibold text-base">
          Important — Read Before Importing
        </AlertTitle>
        <AlertDescription className="text-amber-700 dark:text-amber-400 mt-2 space-y-2">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>
              <strong>Use the latest template.</strong> The CSV template has been updated to support both <strong>Private</strong> and <strong>Company</strong> owners. Re-download it if you have an older version.
            </li>
            <li>
              <strong>Date format:</strong> All dates (e.g. Date of Birth) must be in <strong>YYYY-MM-DD</strong> format (e.g. <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">1985-06-15</code>).
            </li>
            <li>
              <strong>Owner type:</strong> Set <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">owner1_ownerType</code> to <strong>Private</strong> or <strong>Company</strong>. Private owners require: Surname, First Name, DOB, Sex. Company owners require: Company Name.
            </li>
            <li>
              <strong>Fields with commas</strong> (e.g. addresses) must be enclosed in double quotes: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">"123 Main St, Town"</code>.
            </li>
            <li>
              All imported records will be created as <strong>Draft</strong> status and must be reviewed and submitted individually.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Prepare &amp; Upload CSV File</CardTitle>
          <CardDescription>
            Download the template, fill it with your registration data, and upload it here.
            <Button variant="link" onClick={downloadCSVTemplate} className="p-0 h-auto ml-1 text-sm font-semibold">
              ↓ Download CSV Template
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input type="file" accept=".csv" onChange={handleFileChange} />
          {csvContentPreview && (
            <div className="mt-2 p-2 border rounded-md bg-muted max-h-36 overflow-auto text-xs">
              <p className="font-semibold mb-1">CSV File Preview (first ~600 characters):</p>
              <pre className="whitespace-pre-wrap break-all">{csvContentPreview}</pre>
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
            <CardTitle>Step 2: Review Parsed Data</CardTitle>
            <CardDescription>
              Verify the data below was parsed correctly before importing. Only the first 5 records are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pre-import data accuracy warning */}
            <Alert className="border border-blue-400 bg-blue-50 dark:bg-blue-950/30">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertTitle className="text-blue-800 dark:text-blue-300 font-semibold">
                Verify Data Accuracy Before Proceeding
              </AlertTitle>
              <AlertDescription className="text-blue-700 dark:text-blue-400 text-sm mt-1">
                Check that each column below contains the correct data. If values appear in the wrong columns, the CSV may not be correctly formatted.
                This is especially important for <strong>address fields</strong> — ensure any addresses containing commas are enclosed in double quotes in your file.
                Importing incorrect data cannot be automatically reversed.
              </AlertDescription>
            </Alert>

            <ScrollArea className="w-full whitespace-nowrap rounded-md border">
              <div className="max-h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Row</TableHead>
                      <TableHead>Craft Make</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>HIN</TableHead>
                      <TableHead>Owner 1</TableHead>
                      <TableHead>Owner Type</TableHead>
                      <TableHead>Reg. Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 5).map((record, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground text-xs">{index + 2}</TableCell>
                        <TableCell>{record.craftMake || <span className="text-destructive text-xs">Missing</span>}</TableCell>
                        <TableCell>{record.craftModel}</TableCell>
                        <TableCell>{record.craftYear}</TableCell>
                        <TableCell>{record.hullIdNumber}</TableCell>
                        <TableCell className="font-medium">{getOwner1DisplayName(record)}</TableCell>
                        <TableCell>
                          <Badge variant={record.owner1_ownerType === 'Company' ? 'secondary' : 'outline'} className="text-xs">
                            {record.owner1_ownerType || 'Private'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{record.registrationType || 'New'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-300 text-xs dark:bg-yellow-900/30 dark:text-yellow-300">
                            Draft
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </CardContent>
          <CardFooter className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted-foreground">
              Total records parsed: <strong>{parsedData.length}</strong>
              {parsedData.length > 5 && ` (${parsedData.length - 5} more not shown in preview)`}
            </p>
            <Alert className="border border-red-400 bg-red-50 dark:bg-red-950/30 w-full">
              <FileWarning className="h-4 w-4 text-red-600 dark:text-red-400" />
              <AlertTitle className="text-red-800 dark:text-red-300 font-semibold">Final Check — This action cannot be easily undone</AlertTitle>
              <AlertDescription className="text-red-700 dark:text-red-400 text-sm">
                Confirm the preview looks correct before clicking Import. All {parsedData.length} record(s) will be added to the system as Drafts. 
                Incorrect records will need to be manually deleted.
              </AlertDescription>
            </Alert>
            <Button onClick={handleImportData} disabled={isImporting || isParsing} className="w-full sm:w-auto">
              {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
              {isImporting ? 'Importing...' : `Import All ${parsedData.length} Records`}
            </Button>
          </CardFooter>
        </Card>
      )}

      {importResult && (
        <Card className={importResult.success ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-destructive bg-red-50 dark:bg-red-950/20'}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult.success ? <CheckCircle className="text-green-600" /> : <AlertTriangle className="text-destructive" />}
              Import {importResult.success ? 'Successful' : 'Completed with Errors'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{importResult.message}</p>
            {importResult.details && (
              <div className="mt-3 text-sm space-y-1">
                <p>✅ Successfully imported: <strong>{importResult.details.successful}</strong></p>
                <p>❌ Failed to import: <strong>{importResult.details.failed}</strong></p>
                {importResult.details.errors && importResult.details.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="font-semibold mb-1">Error Details:</p>
                    <Textarea
                      readOnly
                      value={importResult.details.errors.join('\n')}
                      rows={Math.min(10, importResult.details.errors.length)}
                      className="text-xs bg-muted font-mono"
                    />
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
