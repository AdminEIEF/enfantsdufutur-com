import { ReactNode, useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { BookOpen, Home, ClipboardList, Award, LogOut, Gamepad2, X, FileQuestion, ZoomIn, Sparkles, GraduationCap, MapPin, Phone, Mail } from 'lucide-react';
import { NotificationBell } from '@/components/NotificationBell';
import { SchoolWatermark } from '@/components/SchoolWatermark';
import { motion, AnimatePresence } from 'framer-motion';

interface GameItem {
  path: string;
  label: string;
  emoji: string;
  color: string;
  levels: string[];
}

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
  { path: '/eleve/librairie', icon: BookOpen, label: 'Librairie' },
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
  const [photoZoom, setPhotoZoom] = useState(false);

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

      {/* ─── Top App Bar — Material 3 style ─── */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-primary via-primary/95 to-primary shadow-lg">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <button onClick={() => setProfileOpen(true)} className="flex items-center gap-3 min-w-0 cursor-pointer active:scale-[0.97] transition-transform">
            <div className="relative">
              {eleve.photo_url ? (
                <img src={eleve.photo_url} alt="" loading="eager" decoding="async" className="w-10 h-10 rounded-2xl object-cover ring-2 ring-primary-foreground/40 shadow-md shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-primary-foreground/20 backdrop-blur flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0 shadow-md">
                  {eleve.prenom[0]}{eleve.nom[0]}
                </div>
              )}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-primary" />
            </div>
            <div className="min-w-0 text-left">
              <h1 className="font-bold text-sm text-primary-foreground leading-tight truncate">
                {eleve.prenom} {eleve.nom}
              </h1>
              <p className="text-[11px] text-primary-foreground/60 truncate font-medium">
                {eleve.classes?.nom || 'Espace Élève'}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <NotificationBell mode="student" targetId={eleve.id} token={session.token} onViewAll={() => navigate('/eleve/notifications')} />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-primary-foreground hover:bg-primary-foreground/10 h-9 w-9 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-28">
        {children}
      </main>

      {/* ─── Profile Dialog — Clean & Elegant ─── */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden rounded-3xl border-0 shadow-2xl">
          {/* Header with photo */}
          <div className="relative bg-gradient-to-br from-primary via-primary/90 to-accent pt-8 pb-16 px-6">
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary-foreground/5 -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-20 h-20 rounded-full bg-primary-foreground/5 translate-y-1/3 -translate-x-1/4" />
            
            <div className="relative flex flex-col items-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="relative w-24 h-24 rounded-3xl bg-primary-foreground/10 p-[3px] shadow-2xl cursor-pointer group"
                onClick={() => eleve.photo_url && setPhotoZoom(true)}
              >
                {eleve.photo_url ? (
                  <>
                    <img src={eleve.photo_url} alt={`${eleve.prenom} ${eleve.nom}`} className="w-full h-full rounded-[21px] object-cover" />
                    <div className="absolute inset-0 rounded-[21px] bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full rounded-[21px] bg-primary-foreground/20 flex items-center justify-center text-primary-foreground font-bold text-2xl">
                    {eleve.prenom[0]}{eleve.nom[0]}
                  </div>
                )}
              </motion.div>
              <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mt-3 text-center">
                <h2 className="text-lg font-bold text-primary-foreground">{eleve.prenom} {eleve.nom}</h2>
                {eleve.classes?.nom && (
                  <span className="inline-flex items-center gap-1 mt-1 px-3 py-0.5 rounded-full bg-primary-foreground/15 text-primary-foreground/90 text-xs font-medium">
                    <GraduationCap className="h-3 w-3" />
                    {eleve.classes.nom}
                  </span>
                )}
              </motion.div>
            </div>
          </div>

          {/* Info cards */}
          <div className="px-5 pb-6 -mt-8 relative z-10">
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="bg-card rounded-2xl shadow-lg border border-border/50 p-4 space-y-3"
            >
              {eleve.matricule && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">#</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Matricule</p>
                    <p className="text-sm font-bold text-foreground truncate">{eleve.matricule}</p>
                  </div>
                </div>
              )}
              {eleve.date_naissance && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">🎂</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Date de naissance</p>
                    <p className="text-sm font-bold text-foreground">{new Date(eleve.date_naissance).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              )}
              {eleve.sexe && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm">{eleve.sexe === 'M' ? '👦' : '👧'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Sexe</p>
                    <p className="text-sm font-bold text-foreground">{eleve.sexe === 'M' ? 'Masculin' : 'Féminin'}</p>
                  </div>
                </div>
              )}
              {eleve.classes?.niveaux?.nom && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <GraduationCap className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Niveau</p>
                    <p className="text-sm font-bold text-foreground">{eleve.classes.niveaux.nom}</p>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Quick actions */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-3 flex gap-2"
            >
              <Button variant="outline" className="flex-1 rounded-xl h-11 text-xs font-semibold gap-1.5" onClick={() => { setProfileOpen(false); navigate('/eleve/resultats'); }}>
                <Award className="h-4 w-4" /> Mes résultats
              </Button>
              <Button variant="outline" className="flex-1 rounded-xl h-11 text-xs font-semibold gap-1.5 text-destructive hover:text-destructive" onClick={() => { setProfileOpen(false); handleLogout(); }}>
                <LogOut className="h-4 w-4" /> Déconnexion
              </Button>
            </motion.div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Photo Zoom ─── */}
      <AnimatePresence>
        {photoZoom && eleve.photo_url && (
          <Dialog open={photoZoom} onOpenChange={setPhotoZoom}>
            <DialogContent className="max-w-md p-2 bg-black/95 border-0 rounded-3xl">
              <motion.img
                src={eleve.photo_url}
                alt={`${eleve.prenom} ${eleve.nom}`}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20 }}
                className="w-full h-auto max-h-[70vh] object-contain rounded-2xl"
              />
              <p className="text-center text-white/80 text-sm font-medium mt-2">{eleve.prenom} {eleve.nom}</p>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>

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
                        <div className={`absolute inset-0 bg-gradient-to-br ${game.color} opacity-90`} />
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

      {/* ─── Bottom Nav — Material 3 pill style ─── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 safe-area-bottom">
        <div className="max-w-4xl mx-auto px-3 pb-2">
          <div className="relative overflow-hidden rounded-[20px] bg-card/95 backdrop-blur-xl shadow-[0_-2px_20px_rgba(0,0,0,0.1)] border border-border/40">
            <div className="relative z-10 flex items-center py-1 px-0.5">
              {NAV_ITEMS.map((item) => {
                const isGames = item.path === '__games__';
                const isActive = isGames ? isGameRoute || gamesOpen : location.pathname === item.path;

                return (
                  <motion.button
                    key={item.path}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => {
                      if (isGames) {
                        setGamesOpen(!gamesOpen);
                      } else {
                        setGamesOpen(false);
                        navigate(item.path);
                      }
                    }}
                    className="flex-1 flex flex-col items-center gap-0.5 py-2 relative"
                  >
                    <motion.div
                      className={`flex items-center justify-center w-14 h-8 rounded-2xl transition-all duration-300 ${
                        isActive ? 'bg-primary/12' : ''
                      }`}
                    >
                      <item.icon className={`h-[18px] w-[18px] transition-all duration-200 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`} />
                      {isGames && isGameRoute && (
                        <span className="absolute top-1 right-1/4 w-2 h-2 rounded-full bg-primary ring-2 ring-card" />
                      )}
                    </motion.div>
                    <span className={`text-[10px] leading-tight transition-all duration-200 ${
                      isActive ? 'text-primary font-bold' : 'text-muted-foreground font-medium'
                    }`}>
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}
