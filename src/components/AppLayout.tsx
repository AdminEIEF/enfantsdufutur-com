import { ReactNode } from 'react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { AIChatBubble } from '@/components/AIChatBubble';
import { AdminNotificationBell } from '@/components/AdminNotificationBell';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';

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
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="h-14 border-b flex items-center px-4 gap-3 bg-card">
            <SidebarTrigger />
            <div className="flex-1" />
            <div className="flex items-center gap-2">
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
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
        </main>
      </div>
      <AIChatBubble />
    </SidebarProvider>
  );
}
