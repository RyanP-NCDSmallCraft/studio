
"use client";
import { InfringementForm } from "@/components/infringements/InfringementForm";
import { AlertOctagon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function NewInfringementPage() {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" size="icon" onClick={() => router.push('/infringements')} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Infringements</span>
        </Button>
        <AlertOctagon className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold">Issue New Infringement Notice</h1>
      </div>
      <InfringementForm mode="create" />
    </div>
  );
}
