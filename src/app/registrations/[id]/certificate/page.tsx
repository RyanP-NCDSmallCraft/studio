
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Registration } from "@/types";
import { FileSpreadsheet, Download, Sailboat, ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { formatFirebaseTimestamp } from '@/lib/utils';
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import Image from "next/image"; // Added import for Image

// Placeholder data
const placeholderRegistration: Registration = {
  registrationId: "REG001",
  scaRegoNo: "SCA123",
  owners: [{ ownerId: "owner1", role: "Primary", surname: "Smith", firstName: "John", dob: new Date(1980,5,15) as any, sex: "Male", phone: "123", postalAddress: "1 Street", townDistrict: "Town", llg: "LLG A", wardVillage: "Village 1" }],
  craftMake: "Yamaha",
  craftModel: "FX Cruiser HO",
  craftYear: 2022,
  hullIdNumber: "YAM12345X122",
  craftLength: 3.56,
  lengthUnits: "m",
  effectiveDate: new Date() as any,
  expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)) as any,
  // Fill other required fields for Registration type if necessary for display
  registrationType: "New", status: "Approved", craftColor: "Blue", propulsionType: "Inboard", hullMaterial: "Fiberglass", craftUse: "Pleasure", fuelType: "Gasoline", vesselType: "PWC", proofOfOwnershipDocs: [], createdAt: new Date() as any, lastUpdatedAt: new Date() as any, createdByRef: {} as any
};


export default function CertificatePreviewPage() {
  const params = useParams();
  const router = useRouter();
  const registrationId = params.id as string;
  const registration = placeholderRegistration; // In real app, fetch by ID
  const { toast } = useToast();

  if (!registration) {
    return <p>Loading certificate data...</p>;
  }
  
  const handleDownloadPlaceholder = () => {
    toast({
      title: "Download Initiated (Placeholder)",
      description: "In a real application, a PDF certificate would be downloaded.",
    });
    // Here you would trigger the actual download if a URL exists, or trigger a generation function
    if (registration.certificateFileUrl) {
        window.open(registration.certificateFileUrl, '_blank');
    } else {
        // Potentially trigger a cloud function to generate and then download
        console.log("Triggering certificate generation for", registrationId);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
         <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-2 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Certificate Preview</h1>
        </div>
        <Button onClick={handleDownloadPlaceholder}>
          <Download className="mr-2 h-4 w-4" /> Download Placeholder
        </Button>
      </div>

      <Card className="shadow-lg p-6 md:p-10 certificate-preview relative overflow-hidden" data-ai-hint="document certificate">
        {/* Background watermark/logo */}
        <Sailboat className="absolute inset-0 m-auto h-1/2 w-1/2 text-primary/5 opacity-30 z-0" />
        
        <div className="relative z-10">
          <header className="text-center border-b-2 border-primary pb-4 mb-6">
            <Image 
              src="https://ncdsmallcraft.com/images/114/11667247/LOGO-NCDCRB-small.png" 
              alt="NCDCRB Logo" 
              width={64} 
              height={64} 
              className="mx-auto mb-2 h-16 w-16"
            />
            <h2 className="text-4xl font-bold text-primary">Certificate of Registration</h2>
            <p className="text-muted-foreground text-lg">Small Craft Safety Program</p>
          </header>

          <CardContent className="space-y-6 text-lg">
            <div className="text-center mb-8">
              <p className="text-xl">This is to certify that the craft detailed below is registered:</p>
              <p className="text-5xl font-bold text-primary mt-2">{registration.scaRegoNo || "PENDING"}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <h3 className="font-semibold text-primary mb-1">Registered Owner(s):</h3>
                {registration.owners.map(o => <p key={o.ownerId}>{o.firstName} {o.surname} ({o.role})</p>)}
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">Owner Address:</h3>
                <p>{registration.owners[0]?.postalAddress}, {registration.owners[0]?.wardVillage}, {registration.owners[0]?.llg}, {registration.owners[0]?.townDistrict}</p>
              </div>
            </div>
            
            <Separator className="my-6" />

            <h3 className="text-2xl font-semibold text-primary mb-3 text-center">Craft Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <p><strong>Make:</strong> {registration.craftMake}</p>
              <p><strong>Model:</strong> {registration.craftModel}</p>
              <p><strong>Year:</strong> {registration.craftYear}</p>
              <p><strong>Hull ID (HIN):</strong> {registration.hullIdNumber}</p>
              <p><strong>Length:</strong> {registration.craftLength}{registration.lengthUnits}</p>
              <p><strong>Color:</strong> {registration.craftColor}</p>
              <p><strong>Vessel Type:</strong> {registration.vesselType}</p>
              <p><strong>Propulsion:</strong> {registration.propulsionType}</p>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <h3 className="font-semibold text-primary mb-1">Date of Issue:</h3>
                <p>{formatFirebaseTimestamp(registration.effectiveDate, "MMMM dd, yyyy")}</p>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-1">Expiry Date:</h3>
                <p>{formatFirebaseTimestamp(registration.expiryDate, "MMMM dd, yyyy")}</p>
              </div>
            </div>
            
            <div className="mt-10 text-center">
                <p className="text-sm text-muted-foreground">Official Stamp / Signature Area</p>
                <div className="h-20 w-40 border border-dashed border-muted-foreground mx-auto mt-2 rounded-md flex items-center justify-center text-muted-foreground">
                    [Stamp Here]
                </div>
            </div>
          </CardContent>
          
          <footer className="mt-10 pt-4 border-t text-center text-xs text-muted-foreground">
            <p>This certificate is issued under the authority of the RegoCraft National Maritime Safety Authority (Placeholder).</p>
            <p>RegoCraft &copy; {new Date().getFullYear()}</p>
          </footer>
        </div>
      </Card>
    </div>
  );
}
