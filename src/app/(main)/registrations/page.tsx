
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Ship, Eye, Edit, Filter } from "lucide-react";
import type { Registration } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { format } from 'date-fns';

// Placeholder data - in a real app, this would come from Firestore
const placeholderRegistrations: Registration[] = [
  {
    registrationId: "REG001",
    scaRegoNo: "SCA123",
    owners: [{ ownerId: "owner1", role: "Primary", surname: "Smith", firstName: "John", dob: new Date() as any, sex: "Male", phone: "123", postalAddress: "1 Street", townDistrict: "Town", llg: "LLG A", wardVillage: "Village 1" }],
    craftMake: "Yamaha",
    craftModel: "WaveRunner",
    status: "Approved",
    createdAt: new Date() as any, // Firestore Timestamp
    lastUpdatedAt: new Date() as any,
    createdByRef: {} as any, 
    registrationType: "New",
    craftYear: 2022,
    craftColor: "Blue",
    hullIdNumber: "YAM12345X122",
    craftLength: 3.5,
    lengthUnits: "m",
    propulsionType: "Outboard",
    hullMaterial: "Fiberglass",
    craftUse: "Pleasure",
    fuelType: "Gasoline",
    vesselType: "PWC",
    proofOfOwnershipDocs: [],
  },
  {
    registrationId: "REG002",
    interimRegoNo: "INT456",
    owners: [{ ownerId: "owner2", role: "Primary", surname: "Doe", firstName: "Jane", dob: new Date() as any, sex: "Female", phone: "456", postalAddress: "2 Avenue", townDistrict: "City", llg: "LLG B", wardVillage: "Village 2" }],
    craftMake: "Bayliner",
    craftModel: "Element E18",
    status: "PendingReview",
    createdAt: new Date() as any,
    lastUpdatedAt: new Date() as any,
    createdByRef: {} as any,
    registrationType: "New",
    craftYear: 2023,
    craftColor: "White",
    hullIdNumber: "BAY67890Y223",
    craftLength: 18,
    lengthUnits: "ft",
    propulsionType: "Outboard",
    hullMaterial: "Fiberglass",
    craftUse: "Pleasure",
    fuelType: "Gasoline",
    vesselType: "OpenBoat",
    proofOfOwnershipDocs: [],
  },
];

export default function RegistrationListPage() {
  const { isRegistrar } = useAuth();

  const getStatusBadgeVariant = (status: Registration["status"]) => {
    switch (status) {
      case "Approved": return "default"; // Default is primary, which is blue
      case "PendingReview": return "secondary";
      case "Submitted": return "secondary";
      case "Rejected": return "destructive";
      case "Draft": return "outline";
      case "Expired": return "destructive";
      case "RequiresInfo": return "outline"; // Use outline like draft for info needed
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Ship className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Craft Registrations</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          {isRegistrar && (
            <Button asChild>
              <Link href="/registrations/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Registration
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Registration Overview</CardTitle>
          <CardDescription>Manage and track all craft registrations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rego No.</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Craft Make/Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {placeholderRegistrations.map((reg) => (
                <TableRow key={reg.registrationId}>
                  <TableCell>{reg.scaRegoNo || reg.interimRegoNo || "N/A"}</TableCell>
                  <TableCell>{reg.owners[0]?.firstName} {reg.owners[0]?.surname}</TableCell>
                  <TableCell>{reg.craftMake} {reg.craftModel}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(reg.status)}>{reg.status}</Badge>
                  </TableCell>
                  <TableCell>{reg.submittedAt ? format(reg.submittedAt.toDate(), "PP") : (reg.createdAt ? format(reg.createdAt.toDate(), "PP") : "N/A")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild title="View Details">
                      <Link href={`/registrations/${reg.registrationId}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {(isRegistrar && (reg.status === "Draft" || reg.status === "RequiresInfo" || reg.status === "Submitted")) && (
                       <Button variant="ghost" size="icon" asChild title="Edit Registration">
                        <Link href={`/registrations/${reg.registrationId}/edit`}><Edit className="h-4 w-4" /></Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
       {placeholderRegistrations.length === 0 && (
        <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No registrations found.
            </CardContent>
        </Card>
      )}
    </div>
  );
}
