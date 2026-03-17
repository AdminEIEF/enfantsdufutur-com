import {
  GraduationCap, UsersRound, UserRoundPlus, BookOpenText, Calculator, TriangleAlert,
  Cog, BellRing, QrCode, LibraryBig, ChartColumnStacked,
  LayoutDashboard, Landmark, ClipboardCheck, Medal, RotateCcw, BusFront, Store, Download, TvMinimalPlay, BriefcaseBusiness, CalendarRange, Timer, FileCheck2, ShieldCheck, Sparkles, Trophy, Trash2, WalletCards, HandCoins, CircleDollarSign, ChevronDown, GraduationCap as GradCap, Wrench, ScanLine
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const navSections = [
  {
    label: 'Superviseur',
    roles: ['superviseur'] as const,
    items: [
      { title: 'Tableau de bord', url: '/superviseur-dashboard', icon: LayoutDashboard },
      { title: 'Personnel', url: '/personnel', icon: BriefcaseBusiness },
      { title: 'Pré-inscriptions', url: '/pre-inscriptions', icon: FileCheck2 },
      { title: 'Supervision', url: '/supervision', icon: ShieldCheck },
      { title: 'Configuration', url: '/configuration', icon: Cog },
    ],
  },
  {
    label: 'Service Informatique',
    roles: ['service_info'] as const,
    items: [
      { title: 'Tableau de bord', url: '/service-info-dashboard', icon: LayoutDashboard },
      { title: 'Notifications', url: '/notifications', icon: BellRing },
    ],
  },
  {
    label: 'Principal',
    roles: ['admin', 'secretaire', 'comptable'] as const,
    items: [
      { title: 'Tableau de bord', url: '/dashboard', icon: LayoutDashboard },
      { title: 'Notifications', url: '/notifications', icon: BellRing },
    ],
  },
  {
    label: 'Scolarité',
    roles: ['admin', 'secretaire'] as const,
    items: [
      { title: 'Pré-inscriptions', url: '/pre-inscriptions', icon: FileCheck2 },
      { title: 'Inscriptions', url: '/inscriptions', icon: UserRoundPlus },
      { title: 'Familles', url: '/familles', icon: UsersRound },
      { title: 'Élèves', url: '/eleves', icon: ClipboardCheck },
      { title: 'Corbeille', url: '/corbeille', icon: Trash2 },
      { title: 'Réinscription', url: '/reinscription', icon: RotateCcw },
    ],
  },
  {
    label: 'Académique',
    roles: ['admin', 'service_info'] as const,
    items: [
      { title: 'Mes Classes', url: '/mes-classes', icon: UsersRound },
      { title: 'Saisie des notes', url: '/notes', icon: BookOpenText },
      { title: 'Bulletins', url: '/bulletins', icon: Medal },
      { title: 'Cours & Devoirs', url: '/cours-admin', icon: TvMinimalPlay },
      { title: 'Emploi du temps', url: '/emploi-du-temps', icon: Timer },
      { title: 'Calendrier', url: '/calendrier', icon: CalendarRange },
      { title: 'Orientation', url: '/orientation', icon: ChartColumnStacked },
      { title: 'Performance', url: '/performance', icon: Trophy },
    ],
  },
  {
    label: 'Coordination',
    roles: ['coordinateur'] as any,
    items: [
      { title: 'Tableau de bord', url: '/coordinateur-dashboard', icon: LayoutDashboard },
      { title: 'Personnel', url: '/coordinateur-personnel', icon: BriefcaseBusiness },
      { title: 'Élèves inscrits', url: '/coordinateur-eleves', icon: ClipboardCheck },
      { title: 'Documents coordinateur', url: '/coordinateur-documents', icon: FileCheck2 },
    ],
  },
  {
    label: 'Académique',
    roles: ['coordinateur'] as any,
    items: [
      { title: 'Mes Classes', url: '/mes-classes', icon: UsersRound },
      { title: 'Saisie des notes', url: '/notes', icon: BookOpenText },
      { title: 'Bulletins', url: '/bulletins', icon: Medal },
      { title: 'Cours & Devoirs', url: '/cours-admin', icon: TvMinimalPlay },
      { title: 'Emploi du temps', url: '/emploi-du-temps', icon: Timer },
      { title: 'Calendrier', url: '/calendrier', icon: CalendarRange },
      { title: 'Orientation', url: '/orientation', icon: ChartColumnStacked },
    ],
  },
  {
    label: 'Finances',
    roles: ['admin', 'comptable'] as const,
    items: [
      { title: 'Paiements', url: '/paiements', icon: Landmark },
      { title: 'Dépenses', url: '/depenses', icon: Calculator },
      { title: 'Impayés', url: '/impayes', icon: TriangleAlert },
      { title: 'Tableau financier', url: '/finances', icon: ChartColumnStacked },
    ],
  },
  {
    label: 'Cantine',
    roles: ['admin', 'cantine', 'secretaire', 'comptable'] as const,
    items: [
      { title: 'Cantine & QR', url: '/cantine', icon: QrCode },
    ],
  },
  {
    label: 'Services',
    roles: ['admin', 'secretaire', 'chauffeur'] as const,
    items: [
      { title: 'Transport', url: '/transport', icon: BusFront },
      { title: 'Scan Bus', url: '/transport?tab=scan', icon: ScanLine, roles: ['chauffeur'] as const },
    ],
  },
  {
    label: 'Librairie',
    roles: ['admin', 'librairie', 'secretaire'] as const,
    items: [
      { title: 'Librairie', url: '/librairie', icon: BookOpenText },
    ],
  },
  {
    label: 'Bibliothèque',
    roles: ['admin', 'secretaire'] as const,
    items: [
      { title: 'Bibliothèque', url: '/bibliotheque', icon: LibraryBig },
    ],
  },
  {
    label: 'Boutique',
    roles: ['admin', 'boutique'] as const,
    items: [
      { title: 'Boutique', url: '/boutique', icon: Store },
    ],
  },
  {
    label: 'Surveillance',
    roles: ['admin', 'secretaire', 'surveillant'] as const,
    items: [
      { title: 'Pointage Élèves', url: '/pointage-eleves', icon: QrCode },
    ],
  },
  {
    label: 'Pointage',
    roles: ['pointeur'] as any,
    items: [
      { title: 'Pointage Élèves', url: '/pointeur-pointage', icon: QrCode },
    ],
  },
  {
    label: 'Scolarité - Coordination',
    roles: ['admin', 'secretaire'] as any,
    items: [
      { title: 'Élèves inscrits', url: '/coordinateur-eleves', icon: ClipboardCheck },
      { title: 'Documents coordinateur', url: '/coordinateur-documents', icon: FileCheck2 },
    ],
  },
  {
    label: 'Robotique',
    roles: ['admin', 'secretaire'] as any,
    items: [
      { title: 'Gestion Robotique', url: '/robotique', icon: Sparkles },
    ],
  },
  {
    label: 'Robotique',
    roles: ['robotique'] as any,
    items: [
      { title: 'Dashboard Robotique', url: '/robotique-dashboard', icon: Sparkles },
    ],
  },
  {
    label: 'Trésorerie',
    roles: ['tresorier'] as any,
    items: [
      { title: 'Tableau de bord', url: '/tresorier-dashboard', icon: WalletCards },
      { title: 'Gestion Salaires', url: '/tresorier-salaires', icon: HandCoins },
      { title: 'Salaire Secondaire', url: '/tresorier-salaires?mode=secondaire', icon: BookOpenText },
      { title: 'Salaire Primaire', url: '/tresorier-salaires?mode=primaire', icon: GradCap },
      { title: 'Salaire Soutien', url: '/tresorier-salaires?mode=soutien', icon: Wrench },
      { title: 'Gestion Avances', url: '/tresorier-avances', icon: CircleDollarSign },
    ],
  },
  {
    label: 'Administration',
    roles: ['admin'] as const,
    items: [
      { title: 'Personnel', url: '/personnel', icon: BriefcaseBusiness },
      { title: 'Traçabilité', url: '/tracabilite', icon: ClipboardCheck },
      { title: 'Supervision', url: '/supervision', icon: ShieldCheck },
      { title: 'Configuration', url: '/configuration', icon: Cog },
    ],
  },
];

export function AppSidebar() {
  const { hasAnyRole, user } = useAuth();
  const { isInstallable, install } = usePWAInstall();
  const location = useLocation();

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
          if (!hasAnyRole(section.roles as unknown as ('superviseur' | 'admin' | 'secretaire' | 'service_info' | 'comptable' | 'boutique' | 'cantine' | 'librairie' | 'coordinateur' | 'chauffeur' | 'pointeur' | 'surveillant' | 'tresorier')[])) return null;
          return (
            <Collapsible key={section.label} defaultOpen className="group/collapsible">
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer hover:bg-sidebar-accent/30 rounded-md flex items-center justify-between w-full">
                    {section.label}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.filter((item: any) => !item.roles || hasAnyRole(item.roles)).map((item) => {
                        const hasQuery = item.url.includes('?');
                        if (hasQuery) {
                          const isActive = location.pathname + location.search === item.url;
                          return (
                            <SidebarMenuItem key={item.title}>
                              <SidebarMenuButton asChild>
                                <Link to={item.url} className={`hover:bg-sidebar-accent/50 flex items-center gap-2 px-2 py-1.5 rounded-md text-sm ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                                  <item.icon className="mr-2 h-4 w-4" />
                                  <span>{item.title}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        }
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton asChild>
                              <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
                                <item.icon className="mr-2 h-4 w-4" />
                                <span>{item.title}</span>
                              </NavLink>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-3">
        <div className="text-xs text-sidebar-foreground/60 mb-2 truncate px-2">
          {user?.email}
        </div>
        {isInstallable && (
          <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground mb-1" onClick={install}>
            <Download className="mr-2 h-4 w-4" />
            Installer l'Appli
          </Button>
        )}
        <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={() => {
          const chatBubble = document.querySelector('[data-ai-chat-trigger]') as HTMLButtonElement;
          if (chatBubble) chatBubble.click();
        }}>
          <Sparkles className="mr-2 h-4 w-4" />
          Assistance IA
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
