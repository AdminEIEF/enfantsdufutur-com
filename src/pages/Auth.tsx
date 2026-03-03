import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Eye, EyeOff, LogIn, User, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #1a2744 30%, #0f1b2d 60%, #162d50 100%)' }}
    >
      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-32 -right-32 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #1d4ed8 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
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
              <polygon points="40,4 72,20 72,56 40,72 8,56 8,20" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="2" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {schoolConfig?.logo_url ? (
                <img src={schoolConfig.logo_url} alt="Logo" className="w-10 h-10 rounded-lg object-contain" />
              ) : (
                <User className="h-8 w-8 text-blue-300/80" />
              )}
            </div>
          </div>
        </div>

        {/* Card with animated tricolor border */}
        <div className="relative p-[3px] rounded-3xl">
          <div className="absolute inset-0 rounded-3xl overflow-hidden">
            <div className="absolute inset-0" style={{ background: 'conic-gradient(from var(--border-angle, 0deg), #dc2626, #eab308, #16a34a, #dc2626)', animation: 'spin-border 3s linear infinite' }} />
          </div>
          <div className="relative rounded-[22px] p-8" style={{ background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)' }}>
            <div className="text-center mb-6">
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-3" style={{ background: 'linear-gradient(90deg, #dc2626, #eab308, #16a34a)', color: '#fff' }}>
                Espace Admin
              </span>
              <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>Connexion</h2>
              <p className="text-blue-300/50 text-sm mt-1">{schoolConfig?.nom || 'École Internationale Les Enfants du Futur'}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Adresse email"
                  className="h-12 pl-10 pr-4 bg-white/10 border border-white/10 rounded-full text-white placeholder:text-slate-400/60 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:border-blue-400/30" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mot de passe"
                  className="h-12 pl-10 pr-10 bg-white/10 border border-white/10 rounded-full text-white placeholder:text-slate-400/60 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:border-blue-400/30" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-12 rounded-full text-sm font-semibold tracking-wide uppercase text-white shadow-lg border-0"
                style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #3b82f6)' }}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                Se connecter
              </Button>
            </form>

            <p className="text-center text-xs text-slate-400/60 mt-4">
              Seul l'administrateur peut créer des comptes.
            </p>

            <div className="mt-6 space-y-3">
              {isInstallable && (
                <Button variant="ghost" className="w-full h-10 text-blue-300/50 hover:text-white hover:bg-white/5 rounded-full text-sm" onClick={install}>
                  <Download className="mr-2 h-4 w-4" /> Installer l'Application
                </Button>
              )}
              <Link to="/download" className="block text-center text-xs text-blue-300/40 hover:text-blue-200/70 transition-colors">
                📱 Comment installer l'appli sur mon téléphone ?
              </Link>
            </div>
          </div>
        </div>

        <div className="text-center mt-6">
          <Link to="/" className="text-sm text-blue-300/40 hover:text-blue-200/70 transition-colors">← Retour à l'accueil</Link>
        </div>
        <p className="text-center text-xs text-blue-300/20 mt-4">© {new Date().getFullYear()} IdrissdevTech — Propulsé par RJP SARLU</p>
      </motion.div>

      <style>{`
        @property --border-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes spin-border { to { --border-angle: 360deg; } }
      `}</style>
    </div>
  );
}
