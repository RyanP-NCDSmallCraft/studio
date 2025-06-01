
"use client";

import { OperatorLicenseForm } from "@/components/operator-licenses/OperatorLicenseForm";
import { Contact, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function NewOperatorLicensePage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/operator-licenses')} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Operator Licenses</span>
        </Button>
        <Contact className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">New Operator License Application</h1>
      </div>
      <OperatorLicenseForm mode="create" />
    </div>
  );
}

    
