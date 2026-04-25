
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Briefcase, Eye, Filter, Search, Loader2, CheckCircle, Clock, CalendarClock, Ban } from "lucide-react";
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

  const stats = useMemo(() => {
    let active = 0;
    let pending = 0;
    let expiringSoon = 0;
    let invalid = 0;

    const oneMonthFromNow = new Date();
    oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
    oneMonthFromNow.setHours(23, 59, 59, 999);
    const now = new Date();

    filteredLicenses.forEach(lic => {
      if (lic.status === 'Active') active++;
      if (lic.status === 'Submitted') pending++;
      if (lic.status === 'Suspended' || lic.status === 'Revoked' || lic.status === 'Expired') invalid++;
      
      if (lic.status === 'Active' && lic.expiryDate) {
        let expDate: Date;
        if (lic.expiryDate instanceof Date) {
            expDate = lic.expiryDate;
        } else if (typeof lic.expiryDate === 'object' && lic.expiryDate !== null && 'seconds' in lic.expiryDate) {
            expDate = new Date((lic.expiryDate as any).seconds * 1000);
        } else {
            expDate = new Date(lic.expiryDate as any);
        }
        
        if (!isNaN(expDate.getTime()) && expDate <= oneMonthFromNow && expDate >= now) {
          expiringSoon++;
        }
      }
    });

    return { active, pending, expiringSoon, invalid };
  }, [filteredLicenses]);

  return (
    <div className="space-y-6">
      {/* High-Impact Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-2">
        <Card className="relative overflow-hidden bg-gradient-to-br from-green-500/10 to-green-500/5 hover:shadow-md transition-all duration-300 border-green-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CheckCircle className="w-16 h-16 text-green-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-green-700 dark:text-green-400">Total Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600 dark:text-green-500">{stats.active}</div>
            <p className="text-xs font-medium text-green-600/70 mt-1">Currently permitted</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-500/10 to-blue-500/5 hover:shadow-md transition-all duration-300 border-blue-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Clock className="w-16 h-16 text-blue-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-400">Pending Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-500">{stats.pending}</div>
            <p className="text-xs font-medium text-blue-600/70 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-500/10 to-amber-500/5 hover:shadow-md transition-all duration-300 border-amber-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <CalendarClock className="w-16 h-16 text-amber-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-amber-700 dark:text-amber-400">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-600 dark:text-amber-500">{stats.expiringSoon}</div>
            <p className="text-xs font-medium text-amber-600/70 mt-1">Expiring within 1 month</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-orange-500/10 to-orange-500/5 hover:shadow-md transition-all duration-300 border-orange-500/20 group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Ban className="w-16 h-16 text-orange-500" />
          </div>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-orange-700 dark:text-orange-400">Action Required</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600 dark:text-orange-500">{stats.invalid}</div>
            <p className="text-xs font-medium text-orange-600/70 mt-1">Invalid or suspended</p>
          </CardContent>
        </Card>
      </div>
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
