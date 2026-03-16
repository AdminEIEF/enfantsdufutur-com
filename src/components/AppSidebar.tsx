import {
  GraduationCap, UsersRound, UserRoundPlus, BookOpenText, Calculator, TriangleAlert,
  Cog, BellRing, QrCode, LibraryBig, ChartColumnStacked,
  LayoutDashboard, Landmark, ClipboardCheck, Medal, RotateCcw, BusFront, Store, Download, TvMinimalPlay, BriefcaseBusiness, CalendarRange, Timer, FileCheck2, ShieldCheck, Sparkles, Trophy, Trash2, WalletCards, HandCoins, CircleDollarSign, ChevronDown, GraduationCap as GradCap, Wrench
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
      { title: 'Tableau de bord', url: '/superviseur-dashboard', icon: Home },
      { title: 'Personnel', url: '/personnel', icon: Briefcase },
      { title: 'Pré-inscriptions', url: '/pre-inscriptions', icon: FileText },
      { title: 'Supervision', url: '/supervision', icon: Shield },
      { title: 'Configuration', url: '/configuration', icon: Settings },
    ],
  },
  {
    label: 'Service Informatique',
    roles: ['service_info'] as const,
    items: [
      { title: 'Tableau de bord', url: '/service-info-dashboard', icon: Home },
      { title: 'Notifications', url: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Principal',
    roles: ['admin', 'secretaire', 'comptable'] as const,
    items: [
      { title: 'Tableau de bord', url: '/dashboard', icon: Home },
      { title: 'Notifications', url: '/notifications', icon: Bell },
    ],
  },
  {
    label: 'Scolarité',
    roles: ['admin', 'secretaire'] as const,
    items: [
      { title: 'Pré-inscriptions', url: '/pre-inscriptions', icon: FileText },
      { title: 'Inscriptions', url: '/inscriptions', icon: UserPlus },
      { title: 'Familles', url: '/familles', icon: Users },
      { title: 'Élèves', url: '/eleves', icon: ClipboardList },
      { title: 'Corbeille', url: '/corbeille', icon: Archive },
      { title: 'Réinscription', url: '/reinscription', icon: RefreshCw },
    ],
  },
  {
    label: 'Académique',
    roles: ['admin', 'service_info'] as const,
    items: [
      { title: 'Mes Classes', url: '/mes-classes', icon: Users },
      { title: 'Saisie des notes', url: '/notes', icon: BookOpen },
      { title: 'Bulletins', url: '/bulletins', icon: Award },
      { title: 'Cours & Devoirs', url: '/cours-admin', icon: Video },
      { title: 'Emploi du temps', url: '/emploi-du-temps', icon: Clock },
      { title: 'Calendrier', url: '/calendrier', icon: CalendarDays },
      { title: 'Orientation', url: '/orientation', icon: BarChart3 },
      { title: 'Performance', url: '/performance', icon: Trophy },
    ],
  },
  {
    label: 'Coordination',
    roles: ['coordinateur'] as any,
    items: [
      { title: 'Tableau de bord', url: '/coordinateur-dashboard', icon: Home },
      { title: 'Personnel', url: '/coordinateur-personnel', icon: Briefcase },
      { title: 'Élèves inscrits', url: '/coordinateur-eleves', icon: ClipboardList },
      { title: 'Documents coordinateur', url: '/coordinateur-documents', icon: FileText },
    ],
  },
  {
    label: 'Académique',
    roles: ['coordinateur'] as any,
    items: [
      { title: 'Mes Classes', url: '/mes-classes', icon: Users },
      { title: 'Saisie des notes', url: '/notes', icon: BookOpen },
      { title: 'Bulletins', url: '/bulletins', icon: Award },
      { title: 'Cours & Devoirs', url: '/cours-admin', icon: Video },
      { title: 'Emploi du temps', url: '/emploi-du-temps', icon: Clock },
      { title: 'Calendrier', url: '/calendrier', icon: CalendarDays },
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
    roles: ['admin', 'secretaire', 'chauffeur'] as const,
    items: [
      { title: 'Transport', url: '/transport', icon: Bus },
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
    label: 'Surveillance',
    roles: ['admin', 'secretaire', 'surveillant'] as const,
    items: [
      { title: 'Pointage Élèves', url: '/pointage-eleves', icon: ScanLine },
    ],
  },
  {
    label: 'Pointage',
    roles: ['pointeur'] as any,
    items: [
      { title: 'Pointage Élèves', url: '/pointeur-pointage', icon: ScanLine },
    ],
  },
  {
    label: 'Scolarité - Coordination',
    roles: ['admin', 'secretaire'] as any,
    items: [
      { title: 'Élèves inscrits', url: '/coordinateur-eleves', icon: ClipboardList },
      { title: 'Documents coordinateur', url: '/coordinateur-documents', icon: FileText },
    ],
  },
  {
    label: 'Robotique',
    roles: ['admin', 'secretaire'] as any,
    items: [
      { title: 'Gestion Robotique', url: '/robotique', icon: Bot },
    ],
  },
  {
    label: 'Robotique',
    roles: ['robotique'] as any,
    items: [
      { title: 'Dashboard Robotique', url: '/robotique-dashboard', icon: Bot },
    ],
  },
  {
    label: 'Trésorerie',
    roles: ['tresorier'] as any,
    items: [
      { title: 'Tableau de bord', url: '/tresorier-dashboard', icon: Wallet },
      { title: 'Gestion Salaires', url: '/tresorier-salaires', icon: Banknote },
      { title: 'Salaire Secondaire', url: '/tresorier-salaires?mode=secondaire', icon: BookOpen },
      { title: 'Salaire Primaire', url: '/tresorier-salaires?mode=primaire', icon: GradCap },
      { title: 'Salaire Soutien', url: '/tresorier-salaires?mode=soutien', icon: Wrench },
      { title: 'Gestion Avances', url: '/tresorier-avances', icon: DollarSign },
    ],
  },
  {
    label: 'Administration',
    roles: ['admin'] as const,
    items: [
      { title: 'Personnel', url: '/personnel', icon: Briefcase },
      { title: 'Traçabilité', url: '/tracabilite', icon: ClipboardList },
      { title: 'Supervision', url: '/supervision', icon: Shield },
      { title: 'Configuration', url: '/configuration', icon: Settings },
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
                      {section.items.map((item) => {
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
          <Bot className="mr-2 h-4 w-4" />
          Assistance IA
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
