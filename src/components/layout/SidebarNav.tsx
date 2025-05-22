
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ship,
  ClipboardList,
  Users,
  Settings,
  FileText,
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
  { href: "/admin/users", label: "User Management", icon: Users, roles: ["Admin", "Supervisor"] },
  // { href: "/reports", label: "Reports", icon: FileText, roles: ["Admin", "Supervisor"] },
  // { href: "/settings", label: "Settings", icon: Settings, roles: ["Admin"] },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { currentUser } = useAuth(); // Removed unused isAdmin, etc. for this specific log

  console.log("SidebarNav: Rendering. currentUser from useAuth():", JSON.stringify(currentUser, null, 2));
  if (currentUser) {
    console.log("SidebarNav: currentUser.role:", currentUser.role);
  } else {
    console.log("SidebarNav: currentUser is null or undefined.");
  }

  const userHasRole = (itemRoles?: Array<string>) => {
    if (!itemRoles || itemRoles.length === 0) return true;
    if (!currentUser || !currentUser.role) return false;
    const userRole = currentUser.role.toLowerCase();
    return itemRoles.some(role => role.toLowerCase() === userRole);
  };  
  
  const filteredNavItems = navItems.filter(item => userHasRole(item.roles));

  console.log("SidebarNav: Original navItems count:", navItems.length);
  console.log("SidebarNav: Filtered navItems count:", filteredNavItems.length);
  if (filteredNavItems.length === 0 && navItems.length > 0 && currentUser) {
    console.warn("SidebarNav: No nav items are being rendered for the current user. Check role and item.roles definitions. User role:", currentUser.role);
  }


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
