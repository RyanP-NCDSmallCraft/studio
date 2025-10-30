
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Briefcase, Eye, Filter, Search, Loader2 } from "lucide-react";
import type { CommercialLicense } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge";
import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";

// Dummy data for now
const sampleCommercialLicenses: CommercialLicense[] = [];

export default function CommercialLicensesPage() {
  const { currentUser, isAdmin, isRegistrar } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [licenses, setLicenses] = useState<CommercialLicense[]>(sampleCommercialLicenses);
  const [isLoading, setIsLoading] = useState(false); // Will be used with actual data fetching

  const getStatusBadgeVariant = (status?: CommercialLicense["status"]): BadgeProps["variant"] => {
    switch (status) {
      case "Active": return "default";
      case "Submitted": return "secondary";
      case "Expired": case "Revoked": case "Suspended": return "destructive";
      case "Draft": return "outline";
      default: return "outline";
    }
  };

  const canCreate = isAdmin || isRegistrar;

  const filteredLicenses = useMemo(() => {
    if (!searchTerm) return licenses;
    const lowercasedFilter = searchTerm.toLowerCase();
    return licenses.filter((lic) =>
      (lic.licenseNumber.toLowerCase().includes(lowercasedFilter)) ||
      (lic.registrationData?.scaRegoNo?.toLowerCase().includes(lowercasedFilter)) ||
      (lic.status?.toLowerCase().includes(lowercasedFilter)) ||
      (lic.licenseType.toLowerCase().includes(lowercasedFilter))
    );
  }, [searchTerm, licenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Briefcase className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Commercial Licenses</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search licenses..."
              className="pl-10 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" disabled>
            <Filter className="mr-2 h-4 w-4" /> Filter
          </Button>
          {canCreate && (
            <Button asChild>
              <Link href="/commercial-licenses/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New License
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>License Overview</CardTitle>
          <CardDescription>Manage and track all commercial craft licenses.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 justify-center items-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading licenses...</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>License No.</TableHead>
                  <TableHead>Craft Rego</TableHead>
                  <TableHead>License Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLicenses.length > 0 ? filteredLicenses.map((lic) => (
                  <TableRow key={lic.commercialLicenseId}>
                    <TableCell className="font-medium">{lic.licenseNumber}</TableCell>
                    <TableCell>{lic.registrationData?.scaRegoNo || "N/A"}</TableCell>
                    <TableCell>{lic.licenseType}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lic.status)}>{lic.status}</Badge>
                    </TableCell>
                    <TableCell>{formatFirebaseTimestamp(lic.issuedAt, "PP")}</TableCell>
                    <TableCell>{formatFirebaseTimestamp(lic.expiryDate, "PP")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" asChild title="View Details">
                        <Link href={`/commercial-licenses/${lic.commercialLicenseId}`}><Eye className="h-4 w-4" /></Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                )) : (
                   <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No commercial licenses found.
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
