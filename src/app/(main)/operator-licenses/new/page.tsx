
"use client";

import { OperatorLicenseForm } from "@/components/operator-licenses/OperatorLicenseForm";
import { Contact } from "lucide-react";

export default function NewOperatorLicensePage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2">
        <Contact className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">New Operator License Application</h1>
      </div>
      <OperatorLicenseForm mode="create" />
    </div>
  );
}

    