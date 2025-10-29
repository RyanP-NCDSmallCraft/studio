
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ship,
  ClipboardList,
  Users,
  Settings,
  FileSpreadsheet, 
  Contact, 
  AlertOctagon,
  UploadCloud, // Added for import
  Briefcase, // New Icon
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";


interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles?: Array<"Admin" | "Registrar" | "Inspector" | "Supervisor" | "ReadOnly">;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] },
  { href: "/registrations", label: "Registrations", icon: Ship, roles: ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] },
  { href: "/registrations/import", label: "Import Registrations", icon: UploadCloud, roles: ["Admin", "Registrar"] },
  { href: "/operator-licenses", label: "Operator Licenses", icon: Contact, roles: ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] },
  { href: "/commercial-licenses", label: "Commercial Licenses", icon: Briefcase, roles: ["Admin", "Registrar", "Supervisor"], disabled: true },
  { href: "/inspections", label: "Inspections", icon: ClipboardList, roles: ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] },
  { href: "/infringements", label: "Infringements", icon: AlertOctagon, roles: ["Admin", "Registrar", "Inspector", "Supervisor"] },
  { href: "/inspections/reports", label: "Reports", icon: FileSpreadsheet, roles: ["Admin", "Registrar"] },
  { href: "/admin/users", label: "User Management", icon: Users, roles: ["Admin", "Supervisor"] },
  // { href: "/settings", label: "Settings", icon: Settings, roles: ["Admin"] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { currentUser } = useAuth(); 

  console.log("SidebarNav: Rendering. currentUser from useAuth():", currentUser ? `UID: ${currentUser.userId}, Role: ${currentUser.role}` : currentUser);

  const userHasRole = (itemRoles?: Array<string>) => {
    if (!itemRoles || itemRoles.length === 0) return true; 
    if (!currentUser || !currentUser.role) return false; 
    
    return itemRoles.includes(currentUser.role);
  };  
  
  const filteredNavItems = navItems.filter(item => userHasRole(item.roles));

  if (currentUser && filteredNavItems.length === 0 && navItems.length > 0) {
    console.warn("SidebarNav: No nav items are being rendered for the current user. User role:", currentUser.role, "Original items:", navItems.map(i => ({label: i.label, roles: i.roles})));
  }


  return (
    <nav className="flex flex-col gap-2">
      <SidebarMenu>
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href}>
              <SidebarMenuButton
                isActive={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
                className={cn(
                  "w-full justify-start",
                  item.disabled && "cursor-not-allowed opacity-50"
                )}
                disabled={item.disabled}
                aria-disabled={item.disabled}
                tooltip={item.label}
              >
                <item.icon className="h-5 w-5" />
                <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </nav>
  );
}
