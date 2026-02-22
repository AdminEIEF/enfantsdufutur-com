import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Button } from '@/components/ui/button';
import { Home, Calendar, FileText, BellRing, LogOut, Briefcase } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';

const NAV_ITEMS = [
  { path: '/employe/dashboard', icon: Home, label: 'Accueil' },
  { path: '/employe/conges', icon: Calendar, label: 'Congés' },
  { path: '/employe/paie', icon: FileText, label: 'Paie' },
];

export function EmployeeLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useEmployeeAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!session) {
    navigate('/employe', { replace: true });
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/employe', { replace: true });
  };

  const emp = session.employe;
  const categorieLabel: Record<string, string> = {
    enseignant: 'Enseignant',
    administration: 'Administration',
    service: 'Service',
    direction: 'Direction',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500/5 via-background to-teal-500/5">
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-emerald-600" />
            <div>
              <h1 className="font-bold text-sm leading-tight">Espace Personnel</h1>
              <p className="text-xs text-muted-foreground">
                {emp.prenom} {emp.nom} — {categorieLabel[emp.categorie] || emp.categorie}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              mode="employee"
              targetId={emp.id}
              token={session.token}
              onViewAll={() => navigate('/employe/notifications')}
            />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur border-t">
        <div className="max-w-4xl mx-auto flex">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  isActive ? 'text-emerald-600 font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
