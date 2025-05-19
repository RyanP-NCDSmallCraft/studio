
import { RegistrationForm } from "@/components/registrations/RegistrationForm";
import { Ship } from "lucide-react";

export default function NewRegistrationPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-2">
        <Ship className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">New Craft Registration</h1>
      </div>
      <RegistrationForm mode="create" />
    </div>
  );
}
