
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Ship, Eye, Edit, Filter } from "lucide-react";
import type { Registration, Owner } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge"; // For variant type

// Placeholder data - replace with actual Firestore data fetching
const placeholderRegistrations: Registration[] = [
  {
    registrationId: "REG001",
    scaRegoNo: "SCA123",
    registrationType: "New",
    status: "Approved",
    owners: [{ ownerId: "owner1", role: "Primary", surname: "Smith", firstName: "John" } as Owner],
    craftMake: "Yamaha",
    craftModel: "FX Cruiser HO",
    craftYear: 2022,
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) as any, // Expires in 1 year
    // --- Fill other required fields for Registration type ---
    hullIdNumber: "YAM12345X122", craftColor: "Blue", craftLength: 3.56, lengthUnits: "m",
    propulsionType: "Inboard", hullMaterial: "Fiberglass", craftUse: "Pleasure", fuelType: "Gasoline", vesselType: "PWC",
    proofOfOwnershipDocs: [], createdAt: new Date() as any, lastUpdatedAt: new Date() as any, createdByRef: {} as any,
  },
  {
    registrationId: "REG002",
    interimRegoNo: "INT456",
    registrationType: "New",
    status: "Submitted",
    owners: [{ ownerId: "owner2", role: "Primary", surname: "Doe", firstName: "Jane" } as Owner],
    craftMake: "Sea-Doo",
    craftModel: "RXT-X 300",
    craftYear: 2023,
    // --- Fill other required fields for Registration type ---
    hullIdNumber: "SEA78901Y223", craftColor: "Red", craftLength: 3.45, lengthUnits: "m",
    propulsionType: "Inboard", hullMaterial: "Fiberglass", craftUse: "Pleasure", fuelType: "Gasoline", vesselType: "PWC",
    proofOfOwnershipDocs: [], createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) as any, lastUpdatedAt: new Date() as any, createdByRef: {} as any,
  },
  {
    registrationId: "REG003",
    scaRegoNo: "SCA789",
    registrationType: "Renewal",
    status: "Expired",
    owners: [{ ownerId: "owner3", role: "Primary", surname: "Brown", firstName: "Jim" } as Owner],
    craftMake: "Quintrex",
    craftModel: "420 Renegade",
    craftYear: 2018,
    expiryDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) as any, // Expired 1 month ago
    // --- Fill other required fields for Registration type ---
    hullIdNumber: "QTRXABCCZ118", craftColor: "Silver", craftLength: 4.2, lengthUnits: "m",
    propulsionType: "Outboard", hullMaterial: "Metal", craftUse: "Fishing", fuelType: "Gasoline", vesselType: "OpenBoat",
    proofOfOwnershipDocs: [], createdAt: new Date() as any, lastUpdatedAt: new Date() as any, createdByRef: {} as any,
  },
   {
    registrationId: "REG004",
    registrationType: "New",
    status: "Draft",
    owners: [{ ownerId: "owner4", role: "Primary", surname: "Wilson", firstName: "Pat" } as Owner],
    craftMake: "Boston Whaler",
    craftModel: "130 Super Sport",
    craftYear: 2024,
    // --- Fill other required fields for Registration type ---
    hullIdNumber: "BWUSSK001D424", craftColor: "White", craftLength: 4.14, lengthUnits: "m",
    propulsionType: "Outboard", hullMaterial: "Fiberglass", craftUse: "Pleasure", fuelType: "Gasoline", vesselType: "OpenBoat",
    proofOfOwnershipDocs: [], createdAt: new Date() as any, lastUpdatedAt: new Date() as any, createdByRef: {} as any,
  }
];

export default function RegistrationsPage() {
  const { currentUser, isAdmin, isRegistrar } = useAuth();
  // In a real app, registrations would be fetched from Firestore
  // const { data: registrations, isLoading, error } = useQuery(...)
  const registrations = placeholderRegistrations; // Using placeholder data

  const getStatusBadgeVariant = (status: Registration["status"]): BadgeProps["variant"] => {
    switch (status) {
      case "Approved":
        return "default"; // Typically success, primary color
      case "Submitted":
      case "PendingReview":
        return "secondary";
      case "Rejected":
      case "Expired":
        return "destructive";
      case "Draft":
      case "RequiresInfo":
        return "outline";
      default:
        return "outline";
    }
  };

  const getPrimaryOwnerName = (owners: Owner[]): string => {
    const primaryOwner = owners.find(o => o.role === "Primary");
    return primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : "N/A";
  };

  const canEditRegistration = (regStatus: Registration["status"]): boolean => {
    if (!currentUser) return false;
    const editableStatuses: Registration["status"][] = ["Draft", "Submitted", "RequiresInfo"];
    return (isRegistrar || isAdmin) && editableStatuses.includes(regStatus);
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
          {(isRegistrar || isAdmin) && (
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
                <TableHead>Craft Make/Model</TableHead>
                <TableHead>Primary Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {registrations.map((reg) => (
                <TableRow key={reg.registrationId}>
                  <TableCell className="font-medium">
                    {reg.scaRegoNo || reg.interimRegoNo || reg.registrationId}
                  </TableCell>
                  <TableCell>{reg.craftMake} {reg.craftModel}</TableCell>
                  <TableCell>{getPrimaryOwnerName(reg.owners)}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(reg.status)}>{reg.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {reg.status === "Approved" && reg.expiryDate 
                      ? formatFirebaseTimestamp(reg.expiryDate, "PP") 
                      : "N/A"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild title="View Details">
                      <Link href={`/registrations/${reg.registrationId}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {canEditRegistration(reg.status) && (
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
      {registrations.length === 0 && (
        <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
                No registrations found.
            </CardContent>
        </Card>
      )}
    </div>
  );
}
