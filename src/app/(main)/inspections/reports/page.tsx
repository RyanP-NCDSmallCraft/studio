
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, Ship, CalendarX, ClipboardList, UserCheck, Loader2 } from "lucide-react";

export default function InspectionReportsPage() {
  const { currentUser, isRegistrar, loading } = useAuth(); // isRegistrar from useAuth covers Admin too
  const { toast } = useToast();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="sr-only">Loading user data...</p>
      </div>
    );
  }

  if (!currentUser) {
    // This case should ideally be handled by the main layout redirecting to login
    return (
      <Card>
        <CardHeader><CardTitle>Error</CardTitle></CardHeader>
        <CardContent><p>User not found. Please try logging in again.</p></CardContent>
      </Card>
    );
  }

  // Role-based access: Admin and Registrar only (isRegistrar covers both roles)
  if (!isRegistrar) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Access Denied</CardTitle>
        </CardHeader>
        <CardContent>
          <p>You do not have permission to view this page. This section is accessible by Administrators and Registrars only.</p>
        </CardContent>
      </Card>
    );
  }

  const handleExportCSV = (reportName: string) => {
    toast({
      title: "Export Initiated (Placeholder)",
      description: `Generating CSV for "${reportName}" report. This is a placeholder; actual export functionality needs to be implemented.`,
    });
    // In a real app, this would trigger data fetching and CSV generation/download.
  };

  const reports = [
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
            <CardContent className="flex-grow" /> {/* Spacer to push footer down */}
            <CardFooter className="border-t pt-4">
              <Button 
                onClick={() => handleExportCSV(report.title)} 
                className="w-full sm:w-auto ml-auto"
                variant="outline"
              >
                <Download className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
