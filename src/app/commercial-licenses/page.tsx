"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CommercialLicensesPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
        </Button>
        <Briefcase className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Commercial Licenses</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            This section is under construction. Functionality to manage commercial craft licenses will be available here shortly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>This area will allow you to:</p>
          <ul className="list-disc list-inside ml-4 mt-2 text-sm text-muted-foreground">
            <li>Create and manage new commercial license applications for specific crafts.</li>
            <li>Link commercial licenses to existing craft registrations.</li>
            <li>Track the status of commercial licenses (e.g., Active, Expired).</li>
            <li>Handle renewals and amendments.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
