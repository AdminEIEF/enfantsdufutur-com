import {
  GraduationCap, Users, UserPlus, BookOpen, Calculator, AlertTriangle,
  Settings, Bell, ScanLine, Library, BarChart3, LogOut,
  Home, CreditCard, ClipboardList, Award, RefreshCw, Bus, ShoppingBag
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/hooks/useAuth';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const navSections = [
  {
    label: 'Principal',
    roles: ['admin', 'secretaire', 'service_info', 'comptable'] as const,
    items: [
      { title: 'Tableau de bord', url: '/dashboard', icon: Home },
    ],
  },
  {
    label: 'Scolarité',
    roles: ['admin', 'secretaire'] as const,
    items: [
      { title: 'Inscriptions', url: '/inscriptions', icon: UserPlus },
      { title: 'Familles', url: '/familles', icon: Users },
      { title: 'Élèves', url: '/eleves', icon: ClipboardList },
      { title: 'Réinscription', url: '/reinscription', icon: RefreshCw },
    ],
  },
  {
    label: 'Académique',
    roles: ['admin', 'service_info'] as const,
    items: [
      { title: 'Saisie des notes', url: '/notes', icon: BookOpen },
      { title: 'Bulletins', url: '/bulletins', icon: Award },
      { title: 'Orientation', url: '/orientation', icon: BarChart3 },
    ],
  },
  {
    label: 'Finances',
    roles: ['admin', 'comptable'] as const,
    items: [
      { title: 'Paiements', url: '/paiements', icon: CreditCard },
      { title: 'Dépenses', url: '/depenses', icon: Calculator },
      { title: 'Impayés', url: '/impayes', icon: AlertTriangle },
      { title: 'Tableau financier', url: '/finances', icon: BarChart3 },
    ],
  },
  {
    label: 'Cantine',
    roles: ['admin', 'cantine', 'secretaire', 'comptable'] as const,
    items: [
      { title: 'Cantine & QR', url: '/cantine', icon: ScanLine },
    ],
  },
  {
    label: 'Services',
    roles: ['admin', 'secretaire'] as const,
    items: [
      { title: 'Transport', url: '/transport', icon: Bus },
      { title: 'Notifications', url: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Librairie',
    roles: ['admin', 'librairie', 'secretaire'] as const,
    items: [
      { title: 'Librairie', url: '/librairie', icon: BookOpen },
    ],
  },
  {
    label: 'Bibliothèque',
    roles: ['admin', 'secretaire'] as const,
    items: [
      { title: 'Bibliothèque', url: '/bibliotheque', icon: Library },
    ],
  },
  {
    label: 'Boutique',
    roles: ['admin', 'boutique'] as const,
    items: [
      { title: 'Boutique', url: '/boutique', icon: ShoppingBag },
    ],
  },
  {
    label: 'Administration',
    roles: ['admin'] as const,
    items: [
      { title: 'Configuration', url: '/configuration', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { hasAnyRole, signOut, user } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm">EduGestion Pro</span>
            <span className="text-xs text-sidebar-foreground/60">Année 2025-2026</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {navSections.map((section) => {
          if (!hasAnyRole(section.roles as unknown as ('admin' | 'secretaire' | 'service_info' | 'comptable' | 'boutique' | 'cantine' | 'librairie')[])) return null;
          return (
            <SidebarGroup key={section.label}>
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {section.items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                          <item.icon className="mr-2 h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-3">
        <div className="text-xs text-sidebar-foreground/60 mb-2 truncate px-2">
          {user?.email}
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
