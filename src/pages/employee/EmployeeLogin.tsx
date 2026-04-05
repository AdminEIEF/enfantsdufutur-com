import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Briefcase, Lock, Loader2, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import employeeIllustration from '@/assets/employee-illustration.png';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import SplashScreen from '@/components/SplashScreen';

export default function EmployeeLogin() {
  const { session, login, loading } = useEmployeeAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('splash-employee-login-seen'));
  const handleSplashComplete = useCallback(() => { sessionStorage.setItem('splash-employee-login-seen', '1'); setShowSplash(false); }, []);

  // Photo lookup state
  const [lookupData, setLookupData] = useState<any>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const debounceRef = useRef<any>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = matricule.trim().toUpperCase();
    if (trimmed.length < 3) { setLookupData(null); return; }
    debounceRef.current = setTimeout(async () => {
      setLookingUp(true);
      try {
        const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ matricule: trimmed, action: 'lookup' }),
        });
        const data = await resp.json();
        setLookupData(data.employe || null);
      } catch { setLookupData(null); }
      setLookingUp(false);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [matricule]);

  if (!loading && session) {
    navigate('/employe/dashboard', { replace: true });
    return null;
  }

  if (showSplash) return <SplashScreen onComplete={handleSplashComplete} subtitle="Espace Employé" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      await login(matricule, password);
      navigate('/employe/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Identifiants invalides");
    } finally {
      setSubmitting(false);
    }
  };

  const photoUrl = lookupData?.photo_url;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left side — gradient panel */}
      <div className="hidden lg:flex lg:w-[45%] relative items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-400">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-[10%] left-[15%] w-40 h-40 rounded-full border-2 border-white" />
          <div className="absolute bottom-[15%] right-[10%] w-64 h-64 rounded-full border border-white" />
          <div className="absolute top-[50%] left-[60%] w-24 h-24 rounded-full bg-white/20" />
          <div className="absolute top-[20%] right-[25%] w-16 h-16 rounded-full bg-white/15" />
        </div>

        <motion.div
          className="relative z-10 flex flex-col items-center px-12 text-center"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-6 shadow-lg">
            <Briefcase className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Espace Personnel
          </h2>
          <p className="text-white/80 text-sm max-w-xs leading-relaxed">
            Accédez à vos congés, plannings, bulletins de paie, courriers et plus encore depuis votre espace sécurisé.
          </p>
          <div className="mt-6 flex gap-4">
            {['Congés', 'Paie', 'Planning', 'Courriers'].map((item, i) => (
              <motion.div
                key={item}
                className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-white/90 text-xs font-medium"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                {item}
              </motion.div>
            ))}
          </div>
          <motion.div
            className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-lg"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <img
              src={employeeIllustration}
              alt="Employé"
              width={240}
              height={240}
              className="drop-shadow-xl mx-auto"
            />
          </motion.div>
        </motion.div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
        <motion.div
          className="w-full max-w-[380px]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Mobile header */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md shrink-0">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Espace Personnel
            </span>
          </div>

          {/* Photo preview */}
          <AnimatePresence mode="wait">
            {lookupData && (
              <motion.div
                className="flex flex-col items-center mb-6"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative w-20 h-20 rounded-full overflow-hidden ring-4 ring-emerald-500/20 shadow-lg mb-2">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-emerald-500/15 flex items-center justify-center text-2xl font-bold text-emerald-700">
                      {lookupData.prenom?.[0]}{lookupData.nom?.[0]}
                    </div>
                  )}
                </div>
                <p className="font-semibold text-foreground text-sm">{lookupData.prenom} {lookupData.nom}</p>
                <p className="text-xs text-muted-foreground">{lookupData.poste}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!lookupData && (
            <>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Connexion
              </h1>
              <p className="text-muted-foreground text-sm mb-7">
                Entrez votre matricule et mot de passe.
              </p>
            </>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Matricule</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="Ex: ENP001"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                  className="h-12 pl-10 pr-4 rounded-xl border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 font-mono tracking-wider text-base focus-visible:ring-2 focus-visible:ring-emerald-500/40 transition-all"
                />
                {lookingUp && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-emerald-500" />
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  maxLength={30}
                  autoComplete="off"
                  className="h-12 pl-10 pr-11 rounded-xl border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/40 text-base focus-visible:ring-2 focus-visible:ring-emerald-500/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || !matricule.trim() || !password.trim()}
              className="w-full h-12 rounded-xl text-sm font-semibold tracking-wide bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Se connecter
            </Button>
          </form>

          <div className="my-6 border-t border-border" />

          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour à l'accueil
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
