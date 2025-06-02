
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, Ship, CalendarX, ClipboardList, UserCheck, Loader2 } from "lucide-react";
import React, { useState } from "react";
import { collection, getDocs, query, where, Timestamp, doc, getDoc, type DocumentReference } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Registration, Inspection, User, Owner } from '@/types';
import { formatFirebaseTimestamp, convertToCSV, downloadCSV } from '@/lib/utils';

interface ReportItem {
  title: string;
  description: string;
  reportKey: string;
  icon: React.ReactNode;
}

export default function InspectionReportsPage() {
  const { currentUser, isRegistrar, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loadingReport, setLoadingReport] = useState<string | null>(null);

  const reports: ReportItem[] = [
    { 
      title: "Current Registrations", 
      description: "Export a list of all currently active and approved craft registrations.", 
      reportKey: "current_registrations",
      icon: <Ship className="h-6 w-6 text-primary" />
    },
    { 
      title: "Expired Registrations", 
      description: "Export a list of all craft registrations that have expired.", 
      reportKey: "expired_registrations",
      icon: <CalendarX className="h-6 w-6 text-destructive" />
    },
    { 
      title: "Inspections Data", 
      description: "Export a comprehensive list of all completed inspections.", 
      reportKey: "inspections_data",
      icon: <ClipboardList className="h-6 w-6 text-primary" />
    },
    { 
      title: "Inspector Monitoring", 
      description: "Export a report on inspector activity and performance metrics.", 
      reportKey: "inspector_monitoring",
      icon: <UserCheck className="h-6 w-6 text-primary" />
    },
  ];

  const fetchCurrentRegistrationsForCSV = async () => {
    const q = query(collection(db, "registrations"), where("status", "==", "Approved"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(docSnap => {
      const data = docSnap.data() as Registration;
      const primaryOwner = data.owners.find(o => o.role === "Primary") || data.owners[0];
      return {
        RegistrationID: docSnap.id,
        SCARegoNo: data.scaRegoNo || "N/A",
        Status: data.status,
        CraftMake: data.craftMake,
        CraftModel: data.craftModel,
        CraftYear: data.craftYear,
        HullIDNumber: data.hullIdNumber,
        PrimaryOwnerName: primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : "N/A",
        PrimaryOwnerPhone: primaryOwner?.phone || "N/A",
        PrimaryOwnerEmail: primaryOwner?.email || "N/A",
        EffectiveDate: formatFirebaseTimestamp(data.effectiveDate, "yyyy-MM-dd"),
        ExpiryDate: formatFirebaseTimestamp(data.expiryDate, "yyyy-MM-dd"),
        LastUpdated: formatFirebaseTimestamp(data.lastUpdatedAt, "yyyy-MM-dd HH:mm"),
      };
    });
  };

  const fetchInspectionsDataForCSV = async () => {
    const snapshot = await getDocs(collection(db, "inspections"));
    const inspectionsData = await Promise.all(snapshot.docs.map(async (docSnap) => {
      const data = docSnap.data() as Inspection;
      let regoNo = "N/A", craftMakeModel = "N/A", inspectorName = "N/A";

      if (data.registrationRef) {
        const regRef = typeof data.registrationRef === 'string' ? doc(db, "registrations", data.registrationRef) : data.registrationRef;
        const regDoc = await getDoc(regRef as DocumentReference<Registration>);
        if (regDoc.exists()) {
          regoNo = regDoc.data()?.scaRegoNo || regDoc.id;
          craftMakeModel = `${regDoc.data()?.craftMake || ''} ${regDoc.data()?.craftModel || ''}`.trim();
        }
      }
      if (data.inspectorRef) {
         const inspectorRef = typeof data.inspectorRef === 'string' ? doc(db, "users", data.inspectorRef) : data.inspectorRef;
        const inspectorDoc = await getDoc(inspectorRef as DocumentReference<User>);
        if (inspectorDoc.exists()) {
          inspectorName = inspectorDoc.data()?.displayName || inspectorDoc.data()?.email || inspectorDoc.id;
        }
      }
      return {
        InspectionID: docSnap.id,
        RegistrationNo: regoNo,
        Craft: craftMakeModel,
        InspectionType: data.inspectionType,
        ScheduledDate: formatFirebaseTimestamp(data.scheduledDate, "yyyy-MM-dd"),
        InspectionDate: formatFirebaseTimestamp(data.inspectionDate, "yyyy-MM-dd"),
        Status: data.status,
        OverallResult: data.overallResult || "N/A",
        Inspector: inspectorName,
        Findings: data.findings || "",
        CorrectiveActions: data.correctiveActions || "",
        FollowUpRequired: data.followUpRequired ? "Yes" : "No",
        CompletedAt: formatFirebaseTimestamp(data.completedAt, "yyyy-MM-dd HH:mm"),
      };
    }));
    return inspectionsData;
  };


  const handleExportCSV = async (reportKey: string, reportTitle: string) => {
    setLoadingReport(reportKey);
    try {
      let dataToExport: any[] = [];
      let columns: string[] | undefined = undefined;

      switch (reportKey) {
        case "current_registrations":
          dataToExport = await fetchCurrentRegistrationsForCSV();
          columns = ["RegistrationID", "SCARegoNo", "Status", "CraftMake", "CraftModel", "CraftYear", "HullIDNumber", "PrimaryOwnerName", "PrimaryOwnerPhone", "PrimaryOwnerEmail", "EffectiveDate", "ExpiryDate", "LastUpdated"];
          break;
        case "inspections_data":
          dataToExport = await fetchInspectionsDataForCSV();
          columns = ["InspectionID", "RegistrationNo", "Craft", "InspectionType", "ScheduledDate", "InspectionDate", "Status", "OverallResult", "Inspector", "Findings", "CorrectiveActions", "FollowUpRequired", "CompletedAt"];
          break;
        case "expired_registrations":
          toast({ title: "Report Not Implemented", description: "Export for Expired Registrations is not yet available.", variant: "default" });
          setLoadingReport(null);
          return;
        case "inspector_monitoring":
           toast({ title: "Report Not Implemented", description: "Export for Inspector Monitoring is not yet available.", variant: "default" });
           setLoadingReport(null);
           return;
        default:
          toast({ title: "Unknown Report", description: "This report type is not recognized.", variant: "destructive" });
          setLoadingReport(null);
          return;
      }

      if (dataToExport.length === 0) {
        toast({ title: "No Data", description: `No data found for "${reportTitle}" report.`, variant: "default" });
        setLoadingReport(null);
        return;
      }

      const csvString = convertToCSV(dataToExport, columns);
      downloadCSV(csvString, `${reportKey}_${new Date().toISOString().split('T')[0]}.csv`);
      toast({ title: "Export Successful", description: `"${reportTitle}" report downloaded.` });

    } catch (error: any) {
      console.error("Error generating report:", error);
      toast({ title: "Export Failed", description: error.message || "Could not generate the report.", variant: "destructive" });
    } finally {
      setLoadingReport(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="sr-only">Loading user data...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Card><CardHeader><CardTitle>Error</CardTitle></CardHeader><CardContent><p>User not found. Please try logging in again.</p></CardContent></Card>
    );
  }

  if (!isRegistrar) { // Covers Admin too due to AuthProvider logic
    return (
      <Card><CardHeader><CardTitle>Access Denied</CardTitle></CardHeader><CardContent><p>You do not have permission to view this page.</p></CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-10 w-10 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">System Reports</h1>
            <p className="text-muted-foreground">
              Generate and export various data reports in CSV format.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2 xl:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.reportKey} className="shadow-md hover:shadow-lg transition-shadow flex flex-col">
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <div className="p-3 rounded-lg bg-muted flex items-center justify-center">
                {report.icon}
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{report.title}</CardTitle>
                <CardDescription className="mt-1">{report.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex-grow" />
            <CardFooter className="border-t pt-4">
              <Button 
                onClick={() => handleExportCSV(report.reportKey, report.title)} 
                className="w-full sm:w-auto ml-auto"
                variant="outline"
                disabled={loadingReport === report.reportKey}
              >
                {loadingReport === report.reportKey ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                {loadingReport === report.reportKey ? "Generating..." : "Export CSV"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
