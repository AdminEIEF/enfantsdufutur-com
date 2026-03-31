import { useState, useEffect, useSyncExternalStore } from 'react';
import {
  GraduationCap, UsersRound, UserRoundPlus, BookOpenText, Calculator, TriangleAlert,
  Cog, BellRing, QrCode, LibraryBig, ChartColumnStacked,
  LayoutDashboard, Landmark, ClipboardCheck, Medal, RotateCcw, BusFront, Store, Download, TvMinimalPlay, BriefcaseBusiness, CalendarRange, Timer, FileCheck2, ShieldCheck, Sparkles, Trophy, Trash2, WalletCards, HandCoins, CircleDollarSign, ChevronDown, GraduationCap as GradCap, Wrench, ScanLine
} from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ─── Sidebar theme CSS vars ─────────────────────────────
const SIDEBAR_THEME_VARS: Record<string, Record<string, string>> = {
  default: {},
  ocean: {
    '--sidebar-background': '210 50% 15%',
    '--sidebar-foreground': '200 20% 92%',
    '--sidebar-primary': '190 80% 50%',
    '--sidebar-accent': '200 40% 22%',
    '--sidebar-accent-foreground': '195 30% 95%',
    '--sidebar-border': '210 35% 22%',
  },
  forest: {
    '--sidebar-background': '160 30% 12%',
    '--sidebar-foreground': '150 20% 92%',
    '--sidebar-primary': '162 63% 50%',
    '--sidebar-accent': '155 25% 18%',
    '--sidebar-accent-foreground': '150 30% 95%',
    '--sidebar-border': '160 20% 20%',
  },
  purple: {
    '--sidebar-background': '270 30% 15%',
    '--sidebar-foreground': '265 20% 92%',
    '--sidebar-primary': '270 60% 65%',
    '--sidebar-accent': '265 25% 22%',
    '--sidebar-accent-foreground': '260 30% 95%',
    '--sidebar-border': '270 20% 22%',
  },
  slate: {
    '--sidebar-background': '220 10% 18%',
    '--sidebar-foreground': '215 15% 92%',
    '--sidebar-primary': '200 80% 55%',
    '--sidebar-accent': '218 10% 24%',
    '--sidebar-accent-foreground': '215 15% 95%',
    '--sidebar-border': '220 8% 25%',
  },
  crimson: {
    '--sidebar-background': '350 30% 14%',
    '--sidebar-foreground': '345 15% 92%',
    '--sidebar-primary': '350 70% 60%',
    '--sidebar-accent': '345 25% 20%',
    '--sidebar-accent-foreground': '340 20% 95%',
    '--sidebar-border': '350 20% 22%',
  },
};

function useLocalStorageEvent(key: string, fallback: string) {
  const subscribe = (cb: () => void) => {
    const handler = () => cb();
    window.addEventListener('sidebar-theme-change', handler);
    window.addEventListener('menu-style-change', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('sidebar-theme-change', handler);
      window.removeEventListener('menu-style-change', handler);
      window.removeEventListener('storage', handler);
    };
  };
  return useSyncExternalStore(subscribe, () => localStorage.getItem(key) || fallback);
}

const navSections = [
  {
    label: 'Superviseur',
    roles: ['superviseur'] as const,
    items: [
      { title: 'Tableau de bord', url: '/superviseur-dashboard', icon: LayoutDashboard },
      { title: 'Personnel', url: '/personnel', icon: BriefcaseBusiness },
      { title: 'Pré-inscriptions', url: '/pre-inscriptions', icon: FileCheck2 },
      { title: 'Années Scolaires', url: '/sessions', icon: CalendarRange },
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
    label: 'Coordination Secondaire',
    roles: ['coordinateur_secondaire'] as any,
    items: [
      { title: 'Tableau de bord', url: '/coordinateur-secondaire-dashboard', icon: LayoutDashboard },
      { title: 'Personnel Secondaire', url: '/coordinateur-secondaire-personnel', icon: BriefcaseBusiness },
      { title: 'Élèves Secondaire', url: '/coordinateur-secondaire-eleves', icon: UsersRound },
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
    label: 'Académique',
    roles: ['coordinateur_secondaire'] as any,
    items: [
      { title: 'Mes Classes', url: '/mes-classes', icon: UsersRound },
      { title: 'Saisie des notes', url: '/notes', icon: BookOpenText },
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
      { title: 'Scan Bus', url: '/transport?tab=validation', icon: ScanLine, roles: ['chauffeur'] as const },
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
      { title: 'Avances Soutien', url: '/tresorier-avances-soutien', icon: HandCoins },
      { title: 'Historique', url: '/tresorier-historique', icon: ClipboardCheck },
    ],
  },
  {
    label: 'Administration',
    roles: ['admin'] as const,
    items: [
      { title: 'Personnel', url: '/personnel', icon: BriefcaseBusiness },
      { title: 'Années Scolaires', url: '/sessions', icon: CalendarRange },
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
  const sidebarTheme = useLocalStorageEvent('eief-sidebar-theme', 'default');
  const menuStyle = useLocalStorageEvent('eief-menu-style', 'collapsible');

  const { data: activeSession } = useQuery({
    queryKey: ['active-session-sidebar'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions_scolaires')
        .select('nom')
        .eq('active', true)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  // Build inline style from sidebar theme
  const themeVars = SIDEBAR_THEME_VARS[sidebarTheme] || {};
  const sidebarStyle: React.CSSProperties = {};
  for (const [k, v] of Object.entries(themeVars)) {
    (sidebarStyle as any)[k] = v;
  }

  const isCompact = menuStyle === 'compact';

  const renderItems = (items: any[]) =>
    items.filter((item: any) => !item.roles || hasAnyRole(item.roles)).map((item: any) => {
      const hasQuery = item.url.includes('?');
      if (hasQuery) {
        const isActive = location.pathname + location.search === item.url;
        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton asChild className={isCompact ? 'py-1' : ''}>
              <Link to={item.url} className={`hover:bg-sidebar-accent/50 flex items-center gap-2 px-2 ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} rounded-md ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : ''}`}>
                <item.icon className={`mr-2 ${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      }
      return (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild className={isCompact ? 'py-1' : ''}>
            <NavLink to={item.url} end className={`hover:bg-sidebar-accent/50 ${isCompact ? 'text-xs' : ''}`} activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
              <item.icon className={`mr-2 ${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4'}`} />
              <span>{item.title}</span>
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  return (
    <Sidebar style={sidebarStyle}>
      <SidebarHeader className={isCompact ? 'p-3' : 'p-4'}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm">EduGestion Pro</span>
            <span className="text-xs text-sidebar-foreground/60">{activeSession?.nom || 'Aucune session active'}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        {navSections.map((section) => {
          if (!hasAnyRole(section.roles as unknown as ('superviseur' | 'admin' | 'secretaire' | 'service_info' | 'comptable' | 'boutique' | 'cantine' | 'librairie' | 'coordinateur' | 'chauffeur' | 'pointeur' | 'surveillant' | 'tresorier')[])) return null;

          if (menuStyle === 'flat') {
            return (
              <SidebarGroup key={section.label}>
                <SidebarGroupLabel className="text-sidebar-foreground/50 text-[10px] uppercase tracking-wider">
                  {section.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>{renderItems(section.items)}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <Collapsible key={section.label} defaultOpen className="group/collapsible">
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className={`cursor-pointer hover:bg-sidebar-accent/30 rounded-md flex items-center justify-between w-full ${isCompact ? 'text-[10px] py-1' : ''}`}>
                    {section.label}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-data-[state=closed]/collapsible:rotate-[-90deg]" />
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>{renderItems(section.items)}</SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-3">
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
