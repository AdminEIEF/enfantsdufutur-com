import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, Eye, EyeOff, LogIn, UserPlus, User, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d9488 0%, #14b8a6 30%, #2dd4bf 50%, #06b6d4 70%, #0891b2 100%)' }}
    >
      {/* Organic blob shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #0d9488 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 -right-20 w-[300px] h-[300px] rounded-full opacity-25"
          style={{ background: 'radial-gradient(circle, #2dd4bf 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-md"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      >
        {/* Hexagonal avatar */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <polygon
                points="40,4 72,20 72,56 40,72 8,56 8,20"
                fill="rgba(255,255,255,0.15)"
                stroke="rgba(255,255,255,0.3)"
                strokeWidth="2"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {schoolConfig?.logo_url ? (
                <img src={schoolConfig.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <User className="h-8 w-8 text-white/80" />
              )}
            </div>
          </div>
        </div>

        {/* Glassmorphism hexagonal card */}
        <div
          className="relative p-8 rounded-3xl"
          style={{
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* School name */}
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              {activeTab === 'login' ? 'Connexion' : 'Inscription'}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {schoolConfig?.nom || 'École Internationale Les Enfants du Futur'}
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-10 bg-white/10 border border-white/15 rounded-xl mb-6">
              <TabsTrigger value="login" className="text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white rounded-lg text-sm gap-1.5">
                <LogIn className="h-3.5 w-3.5" /> Connexion
              </TabsTrigger>
              <TabsTrigger value="signup" className="text-white/70 data-[state=active]:bg-white/20 data-[state=active]:text-white rounded-lg text-sm gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> Inscription
              </TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-0">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700/50" />
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="Adresse email"
                    className="h-12 pl-10 pr-4 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700/50" />
                  <Input
                    type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    placeholder="Mot de passe"
                    className="h-12 pl-10 pr-10 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-700/50 hover:text-teal-900 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="submit" disabled={loading}
                  className="w-full h-12 rounded-full text-sm font-semibold tracking-wide uppercase bg-teal-900 hover:bg-teal-950 text-white shadow-lg"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Se connecter
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-0">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={nom} onChange={e => setNom(e.target.value)} required placeholder="Nom"
                    className="h-12 px-4 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
                  />
                  <Input
                    value={prenom} onChange={e => setPrenom(e.target.value)} required placeholder="Prénom"
                    className="h-12 px-4 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700/50" />
                  <Input
                    type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Adresse email"
                    className="h-12 pl-10 pr-4 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700/50" />
                  <Input
                    type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                    placeholder="Mot de passe (6 car. min)"
                    className="h-12 pl-10 pr-10 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-700/50 hover:text-teal-900 transition-colors">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="submit" disabled={loading}
                  className="w-full h-12 rounded-full text-sm font-semibold tracking-wide uppercase bg-teal-900 hover:bg-teal-950 text-white shadow-lg"
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  Créer mon compte
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <div className="mt-6 space-y-3">
            {isInstallable && (
              <Button variant="ghost" className="w-full h-10 text-white/70 hover:text-white hover:bg-white/10 rounded-full text-sm" onClick={install}>
                <Download className="mr-2 h-4 w-4" /> Installer l'Application
              </Button>
            )}
            <Link to="/download" className="block text-center text-xs text-white/50 hover:text-white/80 transition-colors">
              📱 Comment installer l'appli sur mon téléphone ?
            </Link>
          </div>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-white/50 hover:text-white/80 transition-colors">
            ← Retour à l'accueil
          </Link>
        </div>

        <p className="text-center text-xs text-white/30 mt-4">
          © {new Date().getFullYear()} IdrissdevTech — Propulsé par RJP SARLU
        </p>
      </motion.div>
    </div>
  );
}
