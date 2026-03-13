import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button } from '@/components/ui/button';
import { BookOpen, Home, FileText, ClipboardList, Award, Bot, LogOut, CalendarDays, Star, PenTool, Calculator, GraduationCap, Palette, Bug, Languages, Gamepad2, X } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { motion, AnimatePresence } from 'framer-motion';

const GAME_ITEMS = [
  { path: '/eleve/ecriture', icon: PenTool, label: 'Écriture', color: 'bg-pink-500', emoji: '✏️' },
  { path: '/eleve/calcul', icon: Calculator, label: 'Calcul', color: 'bg-orange-500', emoji: '🔢' },
  { path: '/eleve/culture', icon: GraduationCap, label: 'Culture', color: 'bg-purple-500', emoji: '🧠' },
  { path: '/eleve/coloriage', icon: Palette, label: 'Coloriage', color: 'bg-green-500', emoji: '🎨' },
  { path: '/eleve/serpent', icon: Bug, label: 'Serpent ABC', color: 'bg-teal-500', emoji: '🐍' },
  { path: '/eleve/anglais', icon: Languages, label: 'Anglais', color: 'bg-blue-500', emoji: '🇬🇧' },
];

const NAV_ITEMS = [
  { path: '/eleve/dashboard', icon: Home, label: 'Accueil' },
  { path: '/eleve/cours', icon: BookOpen, label: 'Cours' },
  { path: '/eleve/devoirs', icon: ClipboardList, label: 'Devoirs' },
  { path: '__games__', icon: Gamepad2, label: 'Jeux' },
  { path: '/eleve/resultats', icon: Award, label: 'Résultats' },
];

export function StudentLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useStudentAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [gamesOpen, setGamesOpen] = useState(false);

  useEffect(() => {
    if (!session) {
      navigate('/eleve', { replace: true });
    }
  }, [session, navigate]);

  // Close games menu on route change
  useEffect(() => {
    setGamesOpen(false);
  }, [location.pathname]);

  if (!session) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/eleve', { replace: true });
  };

  const eleve = session.eleve;
  const isGameRoute = GAME_ITEMS.some(g => location.pathname === g.path);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500/5 via-background to-indigo-500/5">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-card/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {eleve.photo_url ? (
              <img src={eleve.photo_url} alt="" className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border-2 border-blue-200 shrink-0" />
            ) : (
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-[10px] sm:text-xs shrink-0">
                {eleve.prenom[0]}{eleve.nom[0]}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="font-bold text-xs sm:text-sm leading-tight truncate">
                {eleve.prenom} {eleve.nom}
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                {eleve.classes?.nom || 'Espace Élève'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <NotificationBell
              mode="student"
              targetId={eleve.id}
              token={session.token}
              onViewAll={() => navigate('/eleve/notifications')}
            />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-xs px-2 sm:px-3">
              <LogOut className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24">
        {children}
      </main>

      {/* Games Overlay */}
      <AnimatePresence>
        {gamesOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
              onClick={() => setGamesOpen(false)}
            />
            {/* Games Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-2xl border-t max-h-[70vh] overflow-y-auto"
            >
              <div className="max-w-lg mx-auto px-4 pt-3 pb-6">
                {/* Handle bar */}
                <div className="flex justify-center mb-3">
                  <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <Gamepad2 className="h-5 w-5 text-primary" />
                    Jeux éducatifs
                  </h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setGamesOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {GAME_ITEMS.map((game) => {
                    const isActive = location.pathname === game.path;
                    return (
                      <motion.button
                        key={game.path}
                        whileTap={{ scale: 0.92 }}
                        onClick={() => {
                          navigate(game.path);
                          setGamesOpen(false);
                        }}
                        className={`flex flex-col items-center gap-1.5 p-3 sm:p-4 rounded-2xl border-2 transition-all ${
                          isActive
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-transparent bg-muted/50 hover:bg-muted hover:border-muted-foreground/20'
                        }`}
                      >
                        <span className="text-2xl sm:text-3xl">{game.emoji}</span>
                        <span className={`text-[11px] sm:text-xs font-semibold leading-tight text-center ${
                          isActive ? 'text-primary' : 'text-foreground'
                        }`}>
                          {game.label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card/95 backdrop-blur border-t safe-area-bottom">
        <div className="max-w-4xl mx-auto flex">
          {NAV_ITEMS.map((item) => {
            const isGames = item.path === '__games__';
            const isActive = isGames ? isGameRoute || gamesOpen : location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  if (isGames) {
                    setGamesOpen(!gamesOpen);
                  } else {
                    setGamesOpen(false);
                    navigate(item.path);
                  }
                }}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 sm:py-2.5 text-[10px] sm:text-xs transition-colors relative ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isGames && isGameRoute && (
                  <span className="absolute top-1 right-1/4 w-1.5 h-1.5 rounded-full bg-primary" />
                )}
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