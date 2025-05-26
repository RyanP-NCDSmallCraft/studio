
"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Ship, Eye, Edit, Filter, Search, Loader2, AlertTriangle } from "lucide-react";
import type { Registration, Owner } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge";
import React, { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { getRegistrations } from "@/actions/registrations";
import { useToast } from "@/hooks/use-toast";

export default function RegistrationsPage() {
  const { currentUser, isAdmin, isRegistrar, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRegistrations() {
      if (authLoading) {
        setIsLoading(true);
        return;
      }
      if (!currentUser) {
        setRegistrations([]);
        setIsLoading(false);
        setFetchError("Please log in to view registrations.");
        return;
      }

      setIsLoading(true);
      setFetchError(null);
      try {
        const fetchedRegistrations = await getRegistrations();
        setRegistrations(fetchedRegistrations);
      } catch (error) {
        const errorMessage = (error as Error).message || "An unexpected error occurred while fetching registrations.";
        console.error("Failed to load registrations:", errorMessage, error);
        setFetchError(errorMessage);
        toast({
          title: "Error Loading Registrations",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    }

    loadRegistrations();
  }, [currentUser, authLoading, toast]);

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
    return primaryOwner ? `${primaryOwner.firstName} ${primaryOwner.surname}` : `${owners[0].firstName} ${owners[0].surname}`;
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

  const retryLoadRegistrations = () => {
    if (!authLoading && currentUser) {
      async function load() {
        setIsLoading(true);
        setFetchError(null);
        try {
          const fetchedRegistrations = await getRegistrations();
          setRegistrations(fetchedRegistrations);
        } catch (error) {
          const errorMessage = (error as Error).message || "An unexpected error occurred on retry.";
          console.error("Failed to load registrations on retry:", errorMessage, error);
          setFetchError(errorMessage);
          toast({
            title: "Error Loading Registrations",
            description: errorMessage,
            variant: "destructive",
          });
        } finally {
          setIsLoading(false);
        }
      }
      load();
    } else if (!authLoading && !currentUser) {
      setFetchError("Please log in to retry fetching registrations.");
    }
  };

  if (authLoading || (isLoading && !fetchError && currentUser)) {
    return (
      <div className="flex h-64 justify-center items-center py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading registrations...</p>
      </div>
    );
  }

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
              disabled={!currentUser}
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
          {fetchError ? (
            <div className="text-center py-10">
              {fetchError.includes("permission-denied") || fetchError.includes("Missing or insufficient permissions") ? (
                <div className="text-destructive space-y-2 p-4 border border-destructive/50 rounded-md bg-destructive/10">
                  <div className="flex justify-center items-center mb-2">
                    <AlertTriangle className="h-10 w-10 mr-2" />
                    <h3 className="text-xl font-semibold">Permission Denied</h3>
                  </div>
                  <p>Could not load registrations due to missing Firestore permissions.</p>
                  <p>
                    Please check your Firebase console: ensure your
                    Firestore Security Rules allow authenticated users (or the appropriate roles)
                    to <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">read</code> from the <code className="bg-muted/50 px-1.5 py-0.5 rounded-sm text-sm text-destructive-foreground">registrations</code> collection.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Detailed error: {fetchError}</p>
                </div>
              ) : (
                <p className="text-destructive">{fetchError}</p>
              )}
              {currentUser && <Button onClick={retryLoadRegistrations} className="mt-4">Retry</Button>}
              {!currentUser && <Button asChild className="mt-4"><Link href="/login">Log In</Link></Button>}
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
                      {isLoading ? "Loading..." : (searchTerm ? "No registrations match your search." : "No registrations found.")}
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

    