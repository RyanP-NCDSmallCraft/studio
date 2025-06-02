
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { PlusCircle, Eye, Filter, Search, Contact, ArrowLeft } from "lucide-react";
import type { OperatorLicense, Operator } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { formatFirebaseTimestamp } from '@/lib/utils';
import type { BadgeProps } from "@/components/ui/badge";
import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Timestamp } from "firebase/firestore";
import { useRouter } from "next/navigation";


// Placeholder data
const placeholderOperators: Operator[] = [
  { operatorId: "OP001", surname: "Pini", firstName: "Ryan", dob: Timestamp.fromDate(new Date(1985, 5, 10)), sex: "Male", placeOfOriginTown: "Port Moresby", placeOfOriginDistrict: "NCD", placeOfOriginLLG: "NCD", placeOfOriginVillage: "Hanuabada", phoneMobile: "70000001", email: "ryan.pini@example.com", postalAddress: "PO Box 123", createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
  { operatorId: "OP002", surname: "Toua", firstName: "Dika", dob: Timestamp.fromDate(new Date(1990, 2, 22)), sex: "Female", placeOfOriginTown: "Lae", placeOfOriginDistrict: "Morobe", placeOfOriginLLG: "Lae Urban", placeOfOriginVillage: "Voco Point", phoneMobile: "70000002", email: "dika.toua@example.com", postalAddress: "PO Box 456", createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
];

const placeholderLicenses: OperatorLicense[] = [
  {
    licenseApplicationId: "LICAPP001",
    operatorRef: { id: "OP001" } as any,
    operatorData: placeholderOperators[0],
    applicationType: "New",
    status: "Approved",
    assignedLicenseNumber: "OL001",
    submittedAt: Timestamp.fromDate(new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)),
    approvedAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
    issuedAt: Timestamp.fromDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
    expiryDate: Timestamp.fromDate(new Date(new Date().setFullYear(new Date().getFullYear() + 2))),
    attachedDocuments: [],
    createdByUserRef: {} as any,
    createdAt: Timestamp.now(),
    lastUpdatedAt: Timestamp.now(),
  },
  {
    licenseApplicationId: "LICAPP002",
    operatorRef: { id: "OP002" } as any,
    operatorData: placeholderOperators[1],
    applicationType: "Renewal",
    previousLicenseNumber: "OLPREV789",
    status: "PendingReview",
    submittedAt: Timestamp.fromDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
    attachedDocuments: [],
    createdByUserRef: {} as any,
    createdAt: Timestamp.now(),
    lastUpdatedAt: Timestamp.now(),
  },
  {
    licenseApplicationId: "LICAPP003",
    operatorRef: { id: "OP001" } as any,
    operatorData: placeholderOperators[0],
    applicationType: "New",
    status: "Draft",
    attachedDocuments: [],
    createdByUserRef: {} as any,
    createdAt: Timestamp.now(),
    lastUpdatedAt: Timestamp.now(),
  },
];

export default function OperatorLicenseListPage() {
  const { currentUser, isAdmin, isRegistrar, isSupervisor } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const licenses = placeholderLicenses; // In real app, fetch from Firestore
  const router = useRouter();

  const getStatusBadgeVariant = (status: OperatorLicense["status"]): BadgeProps["variant"] => {
    switch (status) {
      case "Approved": return "default";
      case "Submitted": case "PendingReview": case "AwaitingTest": case "TestScheduled": case "TestPassed": return "secondary";
      case "Rejected": case "Expired": case "Revoked": case "TestFailed": return "destructive";
      case "Draft": case "RequiresInfo": return "outline";
      default: return "outline";
    }
  };

  const getApplicantName = (license: OperatorLicense): string => {
    return license.operatorData ? `${license.operatorData.firstName} ${license.operatorData.surname}` : "N/A";
  };
  
  const canAddNew = isAdmin || isRegistrar || isSupervisor;

  const filteredLicenses = useMemo(() => {
    if (!searchTerm) return licenses;
    const lowercasedFilter = searchTerm.toLowerCase();
    return licenses.filter((lic) => {
      const applicantName = getApplicantName(lic);
      return (
        (lic.assignedLicenseNumber || "").toLowerCase().includes(lowercasedFilter) ||
        applicantName.toLowerCase().includes(lowercasedFilter) ||
        lic.status.toLowerCase().includes(lowercasedFilter) ||
        lic.applicationType.toLowerCase().includes(lowercasedFilter)
      );
    });
  }, [searchTerm, licenses]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => router.back()} className="mr-1 h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back</span>
          </Button>
          <Contact className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Operator Licenses</h1>
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
          {canAddNew && (
            <Button asChild>
              <Link href="/operator-licenses/new">
                <PlusCircle className="mr-2 h-4 w-4" /> New Application
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>License Overview</CardTitle>
          <CardDescription>Manage and track all operator license applications and issued licenses.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>License No.</TableHead>
                <TableHead>Applicant Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLicenses.map((lic) => (
                <TableRow key={lic.licenseApplicationId}>
                  <TableCell className="font-medium">{lic.assignedLicenseNumber || lic.licenseApplicationId}</TableCell>
                  <TableCell>{getApplicantName(lic)}</TableCell>
                  <TableCell>{lic.applicationType}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusBadgeVariant(lic.status)}>{lic.status}</Badge>
                  </TableCell>
                  <TableCell>{formatFirebaseTimestamp(lic.submittedAt, "PP")}</TableCell>
                  <TableCell>{formatFirebaseTimestamp(lic.expiryDate, "PP")}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild title="View Details">
                      <Link href={`/operator-licenses/${lic.licenseApplicationId}`}><Eye className="h-4 w-4" /></Link>
                    </Button>
                    {/* Add Edit button here if applicable based on status/role */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredLicenses.length === 0 && (
             <p className="pt-4 text-center text-muted-foreground">
                {searchTerm ? "No licenses match your search." : "No licenses found."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
