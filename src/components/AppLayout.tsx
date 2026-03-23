import { ReactNode, useState, useCallback } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { AIChatBubble } from '@/components/AIChatBubble';
import { SupportChat } from '@/components/SupportChat';
import { AdminNotificationBell } from '@/components/AdminNotificationBell';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LogOut, CalendarCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import schoolLogo from '@/assets/school-logo.png';

function LogoRefreshButton() {
  const [spinning, setSpinning] = useState(false);

  const handleClick = useCallback(() => {
    setSpinning(true);
    // Force reload after animation
    setTimeout(() => {
      window.location.reload();
    }, 800);
  }, []);

  return (
    <button
      onClick={handleClick}
      className="w-9 h-9 rounded-full border-2 border-primary/20 overflow-hidden bg-white shadow-sm shrink-0 cursor-pointer hover:border-primary/40 transition-colors"
      title="Actualiser le système"
    >
      <motion.img
        src={schoolLogo}
        alt="Logo EIEF"
        className="w-full h-full object-contain p-0.5"
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={spinning ? { duration: 0.8, ease: 'easeInOut' } : {}}
      />
    </button>
  );
}

const roleMeta: Record<AppRole, { label: string; color: string }> = {
  superviseur: { label: 'Superviseur', color: 'bg-red-600 text-white' },
  admin: { label: 'Admin', color: 'bg-purple-600 text-white' },
  secretaire: { label: 'Secrétaire', color: 'bg-blue-600 text-white' },
  service_info: { label: 'Service Info', color: 'bg-cyan-600 text-white' },
  comptable: { label: 'Comptable', color: 'bg-emerald-600 text-white' },
  boutique: { label: 'Boutique', color: 'bg-amber-600 text-white' },
  cantine: { label: 'Cantine', color: 'bg-orange-600 text-white' },
  librairie: { label: 'Librairie', color: 'bg-teal-600 text-white' },
  coordinateur: { label: 'Coordinateur', color: 'bg-indigo-600 text-white' },
  coordinateur_secondaire: { label: 'Coord. Secondaire', color: 'bg-indigo-500 text-white' },
  robotique: { label: 'Robotique', color: 'bg-violet-600 text-white' },
  chauffeur: { label: 'Chauffeur', color: 'bg-teal-600 text-white' },
  pointeur: { label: 'Pointeur', color: 'bg-sky-600 text-white' },
  surveillant: { label: 'Surveillant', color: 'bg-slate-600 text-white' },
  tresorier: { label: 'Trésorier', color: 'bg-emerald-700 text-white' },
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, roles, signOut } = useAuth();

  const { data: activeSession } = useQuery({
    queryKey: ['active-session-header'],
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions_scolaires')
        .select('id, nom')
        .eq('active', true)
        .maybeSingle();
      return data;
    },
    staleTime: 60000,
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 gap-3 bg-card">
            <SidebarTrigger />
            <LogoRefreshButton />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
              {activeSession && (
                <Badge variant="outline" className="gap-1.5 text-xs border-primary/30 text-primary hidden md:flex">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  {activeSession.nom}
                </Badge>
              )}
              {roles.map((role) => {
                const meta = roleMeta[role];
                return meta ? (
                  <Badge key={role} className={`${meta.color} border-0 text-[11px] px-2 py-0.5`}>
                    {meta.label}
                  </Badge>
                ) : null;
              })}
              <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[180px]">
                {user?.email}
              </span>
            </div>
            <AdminNotificationBell />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 gap-1.5" onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">Déconnexion</span>
            </Button>
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
      <AIChatBubble />
      <SupportChat />
    </SidebarProvider>
  );
}
