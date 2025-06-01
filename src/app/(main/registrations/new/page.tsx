
"use client";
import { RegistrationForm } from "@/components/registrations/RegistrationForm";
import { Ship, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function NewRegistrationPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/registrations')} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Registrations</span>
        </Button>
        <Ship className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">New Craft Registration</h1>
      </div>
      <RegistrationForm mode="create" />
    </div>
  );
}

