
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ship,
  ClipboardList,
  Users,
  Settings,
  FileSpreadsheet, // Changed from FileText for reports
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
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
  { href: "/inspections", label: "Inspections", icon: ClipboardList, roles: ["Admin", "Registrar", "Inspector", "Supervisor", "ReadOnly"] },
  { href: "/inspections/reports", label: "Reports", icon: FileSpreadsheet, roles: ["Admin", "Registrar"] },
  { href: "/admin/users", label: "User Management", icon: Users, roles: ["Admin", "Supervisor"] },
  // { href: "/reports", label: "Reports", icon: FileText, roles: ["Admin", "Supervisor"] }, // Example if it were top-level
  // { href: "/settings", label: "Settings", icon: Settings, roles: ["Admin"] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { currentUser } = useAuth(); 

  console.log("SidebarNav: Rendering. currentUser from useAuth():", currentUser ? `UID: ${currentUser.userId}, Role: ${currentUser.role}` : currentUser);
  // if (currentUser) {
  //   console.log("SidebarNav: currentUser.role:", currentUser.role);
  // } else {
  //   console.log("SidebarNav: currentUser is null or undefined.");
  // }

  const userHasRole = (itemRoles?: Array<string>) => {
    if (!itemRoles || itemRoles.length === 0) return true; // No specific roles means accessible to all authenticated
    if (!currentUser || !currentUser.role) return false; // No current user or role means no access to role-restricted items
    
    // Check if the user's role is included in the item's allowed roles
    // Note: useAuth provides boolean flags like isAdmin, isRegistrar, etc.
    // We can use those, or directly check currentUser.role against item.roles.
    // For simplicity and directness here, using currentUser.role.
    return itemRoles.includes(currentUser.role);
  };  
  
  const filteredNavItems = navItems.filter(item => userHasRole(item.roles));

  // console.log("SidebarNav: Original navItems count:", navItems.length);
  // console.log("SidebarNav: Filtered navItems count:", filteredNavItems.length);
  // if (filteredNavItems.length === 0 && navItems.length > 0 && currentUser) {
  //   console.warn("SidebarNav: No nav items are being rendered for the current user. Check role and item.roles definitions. User role:", currentUser.role);
  // }


  return (
    <nav className="flex flex-col gap-2">
      <SidebarMenu>
        {filteredNavItems.map((item) => (
          <SidebarMenuItem key={item.href}>
            <Link href={item.href} passHref legacyBehavior>
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
