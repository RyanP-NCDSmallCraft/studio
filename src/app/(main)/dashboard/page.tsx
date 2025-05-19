
"use client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Users, Ship, ClipboardList, ArrowRight, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function DashboardPage() {
  const { currentUser, isAdmin, isRegistrar, isInspector, isSupervisor } = useAuth();

  if (!currentUser) {
    return <p>Loading user data...</p>;
  }

  const getRoleSpecificGreeting = () => {
    switch (currentUser.role) {
      case "Admin": return "Oversee and manage all system activities.";
      case "Supervisor": return "Manage inspections and review submissions.";
      case "Registrar": return "Manage craft registrations and process applications.";
      case "Inspector": return "Conduct craft inspections and submit reports.";
      case "ReadOnly": return "View system data.";
      default: return "Welcome to RegoCraft!";
    }
  };

  // Placeholder data for stats
  const stats = {
    pendingRegistrations: isAdmin || isRegistrar || isSupervisor ? 5 : 0,
    pendingInspections: isAdmin || isInspector || isSupervisor ? 3 : 0,
    upcomingInspections: isInspector ? 2 : 0,
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-3xl">Welcome, {currentUser.displayName || currentUser.email}!</CardTitle>
          <CardDescription className="text-lg">{getRoleSpecificGreeting()}</CardDescription>
        </CardHeader>
      </Card>

      {(isAdmin || isSupervisor) && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Admin/Supervisor View</AlertTitle>
          <AlertDescription>
            You have access to high-level system management and overview.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(isAdmin || isRegistrar || isSupervisor) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
              <Ship className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingRegistrations}</div>
              <p className="text-xs text-muted-foreground">Crafts awaiting review or approval</p>
              {isRegistrar && (
                 <Button asChild size="sm" className="mt-4">
                  <Link href="/registrations/new">New Registration <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {(isAdmin || isInspector || isSupervisor) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Inspections</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingInspections}</div>
              <p className="text-xs text-muted-foreground">Inspections needing action or review</p>
            </CardContent>
          </Card>
        )}
        
        {isInspector && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Upcoming Inspections</CardTitle>
              <ClipboardList className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.upcomingInspections}</div>
              <p className="text-xs text-muted-foreground">Inspections assigned to you</p>
            </CardContent>
          </Card>
        )}
        
        {(isAdmin || isSupervisor) && (
           <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">User Management</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Manage system users and roles.</p>
               <Button asChild variant="outline" size="sm" className="mt-4">
                  <Link href="/admin/users">Go to Users <ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button asChild variant="secondary">
            <Link href="/registrations">View All Registrations</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/inspections">View All Inspections</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
