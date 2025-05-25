
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Ship, Eye, Edit, Filter, Search, Loader2 } from "lucide-react";
import type { Registration, Owner } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge"; 
import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { getRegistrations } from "@/actions/registrations"; // Import Server Action
import { useToast } from "@/hooks/use-toast";

export default function RegistrationsPage() {
  const { currentUser, isAdmin, isRegistrar } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRegistrations() {
      setIsLoading(true);
      setFetchError(null);
      try {
        const fetchedRegistrations = await getRegistrations();
        setRegistrations(fetchedRegistrations);
      } catch (error) {
        console.error("Failed to load registrations:", error);
        setFetchError("Could not load registrations. Please try again.");
        toast({
          title: "Error Loading Registrations",
          description: (error as Error).message || "An unexpected error occurred.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }
    loadRegistrations();
  }, [toast]);

  const getStatusBadgeVariant = (status?: Registration["status"]): BadgeProps["variant"] => {
    switch (status) {
      case "Approved":
        return "default"; 
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

  const getPrimaryOwnerName = (owners: Owner[] | undefined): string => {
    if (!owners || owners.length === 0) return "N/A";
    const primaryOwner = owners.find(o => o.role === "Primary");
    return primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : `${owners[0].firstName} ${owners[0].surname}` ; // Fallback to first owner
  };

  const canEditRegistration = (regStatus?: Registration["status"]): boolean => {
    if (!currentUser) return false;
    const editableStatuses: Array<Registration["status"]> = ["Draft", "Submitted", "RequiresInfo"];
    return (isRegistrar || isAdmin) && !!regStatus && editableStatuses.includes(regStatus);
  };

  const filteredRegistrations = useMemo(() => {
    if (!searchTerm) return registrations;
    const lowercasedFilter = searchTerm.toLowerCase();
    return registrations.filter((reg) => {
      const regoNo = reg.scaRegoNo || reg.interimRegoNo || reg.registrationId;
      const ownerName = getPrimaryOwnerName(reg.owners);
      return (
        regoNo.toLowerCase().includes(lowercasedFilter) ||
        (reg.craftMake && reg.craftMake.toLowerCase().includes(lowercasedFilter)) ||
        (reg.craftModel && reg.craftModel.toLowerCase().includes(lowercasedFilter)) ||
        ownerName.toLowerCase().includes(lowercasedFilter) ||
        (reg.status && reg.status.toLowerCase().includes(lowercasedFilter))
      );
    });
  }, [searchTerm, registrations]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Ship className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Craft Registrations</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
           <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search registrations..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading registrations...</p>
            </div>
          ) : fetchError ? (
            <div className="text-center py-10 text-destructive">
              <p>{fetchError}</p>
              <Button onClick={() => {
                async function loadRegistrations() {
                    setIsLoading(true);
                    setFetchError(null);
                    try {
                        const fetchedRegistrations = await getRegistrations();
                        setRegistrations(fetchedRegistrations);
                    } catch (error) {
                        console.error("Failed to load registrations:", error);
                        setFetchError("Could not load registrations. Please try again.");
                        toast({
                        title: "Error Loading Registrations",
                        description: (error as Error).message || "An unexpected error occurred.",
                        variant: "destructive",
                        });
                    } finally {
                        setIsLoading(false);
                    }
                }
                loadRegistrations();
              }} className="mt-4">Retry</Button>
            </div>
          ) : (
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
                {filteredRegistrations.length > 0 ? filteredRegistrations.map((reg) => (
                  <TableRow key={reg.registrationId}>
                    <TableCell className="font-medium">
                      {reg.scaRegoNo || reg.interimRegoNo || reg.registrationId}
                    </TableCell>
                    <TableCell>{reg.craftMake} {reg.craftModel}</TableCell>
                    <TableCell>{getPrimaryOwnerName(reg.owners)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(reg.status)}>{reg.status || "N/A"}</Badge>
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
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {searchTerm ? "No registrations match your search." : "No registrations found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

