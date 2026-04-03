import { ReactNode, useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BookOpen, Home, ClipboardList, Award, LogOut, PenTool, Calculator, GraduationCap, Palette, Bug, Languages, Gamepad2, X, Pyramid, FileQuestion, User, Calendar, Hash, Sparkles } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { SchoolWatermark } from '@/components/SchoolWatermark';
import { motion, AnimatePresence } from 'framer-motion';

interface GameItem {
  path: string;
  label: string;
  emoji: string;
  color: string;
  levels: string[]; // which cycle levels can see this
}

// levels: 'creche', 'maternelle', 'primaire', 'college', 'lycee'
const ALL_GAMES: GameItem[] = [
  { path: '/eleve/ecriture', label: 'Écriture', emoji: '✏️', color: 'from-blue-400 to-blue-600', levels: ['creche', 'maternelle', 'primaire'] },
  { path: '/eleve/calcul', label: 'Calcul Mental', emoji: '🔢', color: 'from-emerald-400 to-emerald-600', levels: ['primaire', 'college', 'lycee'] },
  { path: '/eleve/pyramide', label: 'Pyramide', emoji: '🔺', color: 'from-amber-400 to-amber-600', levels: ['primaire', 'college'] },
  { path: '/eleve/culture', label: 'Culture Gén.', emoji: '🧠', color: 'from-violet-400 to-violet-600', levels: ['primaire', 'college', 'lycee'] },
  { path: '/eleve/coloriage', label: 'Coloriage', emoji: '🎨', color: 'from-pink-400 to-pink-600', levels: ['creche', 'maternelle', 'primaire'] },
  { path: '/eleve/serpent', label: 'Serpent ABC', emoji: '🐍', color: 'from-green-400 to-green-600', levels: ['creche', 'maternelle', 'primaire'] },
  { path: '/eleve/anglais', label: 'Anglais', emoji: '🇬🇧', color: 'from-indigo-400 to-indigo-600', levels: ['primaire', 'college', 'lycee'] },
  { path: '/eleve/quiz-matieres', label: 'Quiz Matières', emoji: '📝', color: 'from-rose-400 to-rose-600', levels: ['primaire', 'college', 'lycee'] },
];

const NAV_ITEMS = [
  { path: '/eleve/dashboard', icon: Home, label: 'Accueil' },
  { path: '/eleve/cours', icon: BookOpen, label: 'Cours' },
  { path: '/eleve/devoirs', icon: ClipboardList, label: 'Devoirs' },
  { path: '/eleve/compositions', icon: FileQuestion, label: 'Compos' },
  { path: '__games__', icon: Gamepad2, label: 'Jeux' },
  { path: '/eleve/resultats', icon: Award, label: 'Résultats' },
];

function detectLevel(session: any): string {
  const cycleName = (session?.eleve?.classes?.niveaux?.cycles?.nom || session?.eleve?.classes?.cycle_nom || '').toLowerCase();
  if (cycleName.includes('crèche') || cycleName.includes('creche')) return 'creche';
  if (cycleName.includes('maternelle')) return 'maternelle';
  if (cycleName.includes('lycée') || cycleName.includes('lycee')) return 'lycee';
  if (cycleName.includes('collège') || cycleName.includes('college') || cycleName.includes('secondaire')) return 'college';
  return 'primaire';
}

export function StudentLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useStudentAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [gamesOpen, setGamesOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const level = useMemo(() => detectLevel(session), [session]);
  const filteredGames = useMemo(() => ALL_GAMES.filter(g => g.levels.includes(level)), [level]);

  useEffect(() => {
    if (!session) navigate('/eleve', { replace: true });
  }, [session, navigate]);

  useEffect(() => {
    setGamesOpen(false);
  }, [location.pathname]);

  if (!session) return null;

  const handleLogout = () => {
    logout();
    navigate('/eleve', { replace: true });
  };

  const eleve = session.eleve;
  const isGameRoute = filteredGames.some(g => location.pathname === g.path);

  return (
    <div className="min-h-screen bg-background relative">
      <SchoolWatermark />

      {/* ─── Top App Bar ─── */}
      <header className="sticky top-0 z-30 bg-primary shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setProfileOpen(true)} className="flex items-center gap-3 min-w-0 cursor-pointer active:scale-[0.97] transition-transform">
            {eleve.photo_url ? (
              <img src={eleve.photo_url} alt="" loading="lazy" decoding="async" className="w-9 h-9 rounded-full object-cover ring-2 ring-primary-foreground/30 shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground font-bold text-xs shrink-0">
                {eleve.prenom[0]}{eleve.nom[0]}
              </div>
            )}
            <div className="min-w-0 text-left">
              <h1 className="font-semibold text-sm text-primary-foreground leading-tight truncate">
                {eleve.prenom} {eleve.nom}
              </h1>
              <p className="text-[11px] text-primary-foreground/70 truncate">
                {eleve.classes?.nom || 'Espace Élève'}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell mode="student" targetId={eleve.id} token={session.token} onViewAll={() => navigate('/eleve/notifications')} />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9 rounded-full">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-24">
        {children}
      </main>

      {/* ─── Profile Dialog ─── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
          <div className="flex justify-center pt-6 pb-2 bg-card">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="w-28 h-28 rounded-full bg-gradient-to-br from-primary via-primary/80 to-accent p-[3px] shadow-xl"
            >
              {eleve.photo_url ? (
                <img src={eleve.photo_url} alt={`${eleve.prenom} ${eleve.nom}`} className="w-full h-full rounded-full object-cover bg-background" />
              ) : (
                <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-primary font-bold text-3xl">
                  {eleve.prenom[0]}{eleve.nom[0]}
                </div>
              )}
            </motion.div>
          </div>

          <div className="relative bg-gradient-to-br from-primary via-primary/80 to-accent py-4 px-6">
            <DialogHeader>
              <DialogTitle className="text-center text-primary-foreground text-base font-semibold">Mon Profil</DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex flex-col items-center px-5 pb-6">
            <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="text-center mt-4">
              <h2 className="text-xl font-bold text-foreground">{eleve.prenom} {eleve.nom}</h2>
              {eleve.classes?.nom && (
                <span className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {eleve.classes.nom}
                </span>
              )}
            </motion.div>

            <motion.div initial={{ y: 15, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="w-full mt-5 space-y-2">
              {eleve.matricule && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Hash className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Matricule</p>
                    <p className="text-sm font-bold text-foreground">{eleve.matricule}</p>
                  </div>
                </div>
              )}
              {eleve.date_naissance && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Date de naissance</p>
                    <p className="text-sm font-bold text-foreground">{new Date(eleve.date_naissance).toLocaleDateString('fr-FR')}</p>
                  </div>
                </div>
              )}
              {eleve.sexe && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                  <div className="w-9 h-9 rounded-full bg-secondary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-secondary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sexe</p>
                    <p className="text-sm font-bold text-foreground">{eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Games Bottom Sheet ─── */}
      <AnimatePresence>
        {gamesOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setGamesOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-[28px] shadow-2xl border-t max-h-[75vh] overflow-y-auto"
            >
              <div className="max-w-lg mx-auto px-4 pt-2 pb-6">
                <div className="flex justify-center py-2">
                  <div className="w-9 h-1 rounded-full bg-muted-foreground/25" />
                </div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold flex items-center gap-2 text-foreground">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Jeux éducatifs
                  </h2>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setGamesOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {filteredGames.map((game, i) => {
                    const isActive = location.pathname === game.path;
                    return (
                      <motion.button
                        key={game.path}
                        initial={{ opacity: 0, y: 20, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: i * 0.05, type: 'spring', damping: 18 }}
                        whileTap={{ scale: 0.93 }}
                        whileHover={{ y: -3 }}
                        onClick={() => {
                          navigate(game.path);
                          setGamesOpen(false);
                        }}
                        className={`relative overflow-hidden rounded-2xl p-4 text-left transition-shadow ${
                          isActive ? 'ring-2 ring-primary shadow-xl' : 'shadow-md hover:shadow-lg'
                        }`}
                      >
                        {/* Gradient background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-90`} />
                        {/* Decorative shape */}
                        <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
                        <div className="absolute -bottom-2 -left-2 w-10 h-10 rounded-full bg-white/5" />

                        <div className="relative z-10 flex flex-col gap-2">
                          <motion.span
                            className="text-3xl drop-shadow-md"
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 3, delay: i * 0.3, ease: 'easeInOut' }}
                          >
                            {game.emoji}
                          </motion.span>
                          <span className="text-sm font-bold text-white leading-tight drop-shadow-sm">
                            {game.label}
                          </span>
                        </div>

                        {isActive && (
                          <motion.div
                            layoutId="activeGameDot"
                            className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-white shadow-lg"
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── Bottom Nav ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card shadow-[0_-2px_12px_rgba(0,0,0,0.08)] safe-area-bottom">
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
                className="flex-1 flex flex-col items-center gap-0.5 py-2 relative group"
              >
                <div className={`absolute top-1 w-12 h-[3px] rounded-full transition-all duration-200 ${
                  isActive ? 'bg-primary scale-100' : 'scale-0'
                }`} />
                <div className={`flex items-center justify-center w-10 h-7 rounded-full transition-all duration-200 ${
                  isActive ? 'bg-primary/12' : ''
                }`}>
                  <item.icon className={`h-[18px] w-[18px] transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  {isGames && isGameRoute && (
                    <span className="absolute top-1.5 right-1/4 w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
                <span className={`text-[10px] leading-tight transition-colors duration-200 ${
                  isActive ? 'text-primary font-semibold' : 'text-muted-foreground font-medium'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
