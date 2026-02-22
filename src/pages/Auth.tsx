import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, Loader2, Download, ArrowLeft, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import heroImage from '@/assets/hero-school.jpg';

const ease = [0.25, 0.4, 0.25, 1] as [number, number, number, number];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease } }),
};

const slideIn = {
  hidden: { opacity: 0, x: -30 },
  visible: (i: number) => ({ opacity: 1, x: 0, transition: { delay: i * 0.15, duration: 0.6, ease } }),
};

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState('login');
  const { toast } = useToast();
  const { isInstallable, install } = usePWAInstall();
  const { data: schoolConfig } = useSchoolConfig();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: 'Erreur de connexion', description: error.message, variant: 'destructive' });
    }
    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { nom, prenom },
      },
    });
    if (error) {
      toast({ title: "Erreur d'inscription", description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Inscription réussie', description: 'Vérifiez votre email pour confirmer votre compte.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Hero Image */}
      <motion.div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <motion.img
          src={heroImage}
          alt="Campus"
          className="absolute inset-0 w-full h-full object-cover"
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.4, ease: [0.25, 0.4, 0.25, 1] }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-primary/50" />
        <div className="relative z-10 flex flex-col justify-between p-10 text-primary-foreground w-full">
          <motion.div initial="hidden" animate="visible" custom={0} variants={slideIn}>
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity w-fit">
              {schoolConfig?.logo_url ? (
                <img src={schoolConfig.logo_url} alt="Logo" className="w-12 h-12 rounded-xl object-contain bg-white/20 backdrop-blur-sm p-1" />
              ) : (
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm">
                  <GraduationCap className="h-6 w-6" />
                </div>
              )}
              <span className="font-bold text-xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                {schoolConfig?.nom || 'Ecole Internationale Les Enfants du Futur'}
              </span>
            </Link>
          </motion.div>

          <div className="space-y-6">
            <motion.h1
              className="text-4xl xl:text-5xl font-bold leading-tight"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              initial="hidden" animate="visible" custom={1} variants={slideIn}
            >
              Bâtir l'avenir,<br />
              <span className="text-secondary">un enfant</span> à la fois
            </motion.h1>
            <motion.p
              className="text-primary-foreground/80 text-lg max-w-md leading-relaxed"
              initial="hidden" animate="visible" custom={2} variants={slideIn}
            >
              Accédez à votre espace de gestion scolaire pour suivre les notes, paiements, 
              inscriptions et bien plus encore.
            </motion.p>
            <motion.div
              className="flex items-center gap-6 text-sm text-primary-foreground/60"
              initial="hidden" animate="visible" custom={3} variants={slideIn}
            >
              {['Notes & Bulletins', 'Paiements', 'Inscriptions'].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                  {item}
                </div>
              ))}
            </motion.div>
          </div>

          <motion.p
            className="text-xs text-primary-foreground/40"
            initial="hidden" animate="visible" custom={4} variants={slideIn}
          >
            © {new Date().getFullYear()} IdrissdevTech — Propulsé par RJP SARLU
          </motion.p>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col bg-background">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border">
          <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Retour à l'accueil</span>
          </Link>
          {schoolConfig?.logo_url ? (
            <img src={schoolConfig.logo_url} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Desktop back link */}
        <motion.div
          className="hidden lg:block p-6"
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Retour à l'accueil
          </Link>
        </motion.div>

        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="relative w-full max-w-sm">
            {/* Animated border */}
            <div className="absolute -inset-[6px] rounded-2xl overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(from var(--border-angle), #dc2626, #eab308, #16a34a, #dc2626)',
                  animation: 'spin-border 3s linear infinite',
                }}
              />
            </div>
            <div className="absolute inset-0 rounded-2xl border-[4px] border-primary/30" />
          <motion.div
            className="relative w-full space-y-8 bg-background rounded-2xl p-6 overflow-hidden"
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {/* Globe watermark behind content */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-36 h-36 opacity-[0.12] pointer-events-none z-0">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <circle cx="50" cy="50" r="26" fill="hsl(var(--muted))" />
                <circle cx="50" cy="50" r="26" fill="none" stroke="hsl(var(--foreground))" strokeWidth="2.5" />
                <ellipse cx="50" cy="50" rx="26" ry="9" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <ellipse cx="50" cy="50" rx="9" ry="26" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.5" />
                <path d="M38 35 Q45 30 55 33 Q58 38 52 42 Q45 40 38 35Z" fill="hsl(var(--foreground))" opacity="0.4" />
                <path d="M42 52 Q48 48 56 50 Q58 56 50 60 Q44 58 42 52Z" fill="hsl(var(--foreground))" opacity="0.4" />
                <ellipse cx="50" cy="50" rx="42" ry="14" fill="none" stroke="hsl(var(--foreground))" strokeWidth="1.8" transform="rotate(-25 50 50)" />
                <ellipse cx="50" cy="50" rx="40" ry="16" fill="none" stroke="#eab308" strokeWidth="2" opacity="0.7" transform="rotate(35 50 50)" />
                <ellipse cx="50" cy="50" rx="44" ry="12" fill="none" stroke="#16a34a" strokeWidth="1.5" opacity="0.6" transform="rotate(-60 50 50)" />
              </svg>
              {/* Animated orbiting dots */}
              <motion.div
                className="absolute w-3 h-3 rounded-full bg-[#dc2626]"
                animate={{ x: [0, 36, 44, 12, -24, -42, -30, 0], y: [-16, -6, 12, 20, 12, -4, -14, -16] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                style={{ top: '18%', left: '42%' }}
              />
              <motion.div
                className="absolute w-3 h-3 rounded-full bg-[#eab308]"
                animate={{ x: [44, 12, -24, -42, -30, 0, 36, 44], y: [12, 20, 12, -4, -14, -16, -6, 12] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                style={{ top: '18%', left: '42%' }}
              />
              <motion.div
                className="absolute w-2.5 h-2.5 rounded-full bg-[#16a34a]"
                animate={{ x: [-24, -42, -30, 0, 36, 44, 12, -24], y: [12, -4, -14, -16, -6, 12, 20, 12] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                style={{ top: '18%', left: '42%' }}
              />
            </div>

            {/* Header */}
            <motion.div className="relative z-10 space-y-2" variants={fadeUp} custom={0}>
              <h2 className="text-2xl font-bold tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Espace Personnel
              </h2>
              <p className="text-muted-foreground text-sm">
                Connectez-vous pour accéder à votre tableau de bord
              </p>
            </motion.div>

            <motion.div className="relative z-10" variants={fadeUp} custom={1}>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-11">
                  <TabsTrigger value="login" className="gap-2 text-sm">
                    <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} className="inline-flex"><LogIn className="h-4 w-4" /></motion.span>
                    Connexion
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="gap-2 text-sm">
                    <UserPlus className="h-4 w-4" />
                    Inscription
                  </TabsTrigger>
                </TabsList>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25, ease: [0.25, 0.4, 0.25, 1] }}
                  >
                    <TabsContent value="login" className="mt-6" forceMount={activeTab === 'login' ? true : undefined}>
                      <form onSubmit={handleLogin} className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="login-email" className="text-sm font-medium">Adresse email</Label>
                          <Input id="login-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="admin@edugestion.com" className="h-11" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="login-password" className="text-sm font-medium">Mot de passe</Label>
                          <div className="relative">
                            <Input id="login-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" className="h-11 pr-10" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <motion.div whileTap={{ scale: 0.98 }}>
                          <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <motion.span animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} className="inline-flex mr-2"><LogIn className="h-4 w-4" /></motion.span>}
                            Se connecter
                          </Button>
                        </motion.div>
                      </form>
                    </TabsContent>

                    <TabsContent value="signup" className="mt-6" forceMount={activeTab === 'signup' ? true : undefined}>
                      <form onSubmit={handleSignup} className="space-y-5">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="signup-nom" className="text-sm font-medium">Nom</Label>
                            <Input id="signup-nom" value={nom} onChange={e => setNom(e.target.value)} required className="h-11" placeholder="Diallo" />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-prenom" className="text-sm font-medium">Prénom</Label>
                            <Input id="signup-prenom" value={prenom} onChange={e => setPrenom(e.target.value)} required className="h-11" placeholder="Mamadou" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-email" className="text-sm font-medium">Adresse email</Label>
                          <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="h-11" placeholder="votre@email.com" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="signup-password" className="text-sm font-medium">Mot de passe</Label>
                          <div className="relative">
                            <Input id="signup-password" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="h-11 pr-10" placeholder="6 caractères minimum" />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <motion.div whileTap={{ scale: 0.98 }}>
                          <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                            Créer mon compte
                          </Button>
                        </motion.div>
                      </form>
                    </TabsContent>
                  </motion.div>
                </AnimatePresence>
              </Tabs>
            </motion.div>

            {/* Footer actions */}
            <motion.div className="relative z-10 space-y-3 pt-3 border-t border-border" variants={fadeUp} custom={2}>
              {isInstallable && (
                <Button variant="outline" className="w-full h-10" onClick={install}>
                  <Download className="mr-2 h-4 w-4" />
                  Installer l'Application
                </Button>
              )}
              <Link to="/download" className="block text-center text-sm text-muted-foreground hover:text-primary transition-colors">
                📱 Comment installer l'appli sur mon téléphone ?
              </Link>
            </motion.div>
          </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
