import { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button } from '@/components/ui/button';
import { BookOpen, Home, FileText, ClipboardList, Award, Bot, LogOut, CalendarDays, Star, PenTool, Calculator, GraduationCap } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
const NAV_ITEMS = [
  { path: '/eleve/dashboard', icon: Home, label: 'Accueil' },
  { path: '/eleve/cours', icon: BookOpen, label: 'Cours' },
  { path: '/eleve/devoirs', icon: ClipboardList, label: 'Devoirs' },
  { path: '/eleve/ecriture', icon: PenTool, label: 'Écriture' },
  { path: '/eleve/calcul', icon: Calculator, label: 'Calcul' },
  { path: '/eleve/culture', icon: GraduationCap, label: 'Culture' },
  { path: '/eleve/resultats', icon: Award, label: 'Résultats' },
];

export function StudentLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useStudentAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!session) {
    navigate('/eleve', { replace: true });
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/eleve', { replace: true });
  };

  const eleve = session.eleve;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500/5 via-background to-indigo-500/5">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="font-bold text-sm leading-tight">Espace Élève</h1>
              <p className="text-xs text-muted-foreground">
                {eleve.prenom} {eleve.nom} — {eleve.classes?.nom || ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell
              mode="student"
              targetId={eleve.id}
              token={session.token}
              onViewAll={() => navigate('/eleve/notifications')}
            />
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-1" /> Déconnexion
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6 pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur border-t">
        <div className="max-w-4xl mx-auto flex">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                  isActive ? 'text-blue-600 font-semibold' : 'text-muted-foreground hover:text-foreground'
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
