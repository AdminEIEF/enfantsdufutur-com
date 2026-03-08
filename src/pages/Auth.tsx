import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Download, Eye, EyeOff, LogIn, User, Lock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import schoolLogo from '@/assets/school-logo.png';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { isInstallable, install } = usePWAInstall();
  const { data: schoolConfig } = useSchoolConfig();
  const navigate = useNavigate();

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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left side — Logo & Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #1e40af 0%, #2563eb 40%, #3b82f6 70%, #60a5fa 100%)' }}
      >
        {/* Animated background blobs */}
        <motion.div
          className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #93c5fd 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], x: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #bfdbfe 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Decorative tricolor ring accents */}
        <div className="absolute top-10 left-10 w-16 h-16 rounded-full border-2 border-white/15" />
        <div className="absolute bottom-16 right-16 w-24 h-24 rounded-full border-2 border-white/10" />
        <div className="absolute top-1/3 right-12 w-10 h-10 rounded-full border-2 border-blue-200/20" />

        <motion.div
          className="relative z-10 flex flex-col items-center px-8"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          {/* Logo in circle with tricolor border */}
          <motion.div
            className="relative p-[4px] rounded-full"
            style={{
              background: 'conic-gradient(from var(--border-angle, 0deg), #dc2626, #eab308, #16a34a, #dc2626)',
              animation: 'spin-border 4s linear infinite',
            }}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 150, damping: 15, delay: 0.3 }}
          >
            <div className="w-44 h-44 rounded-full bg-white flex items-center justify-center shadow-2xl">
              <img src={schoolLogo} alt="Logo EIEF" className="w-36 h-36 object-contain" />
            </div>
          </motion.div>

          <div className="mt-8 text-center">
            <h2 className="text-2xl font-bold text-white drop-shadow-md" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              École Internationale
            </h2>
            <h3 className="text-xl font-bold text-white/90 mt-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Les Enfants du Futur
            </h3>
            <p className="text-blue-100/70 mt-3 text-sm max-w-xs mx-auto italic">
              Faisons Plus !
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right side — Form */}
      <div
        className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f1b2d 60%, #162d50 100%)' }}
      >
        {/* Mobile only: subtle background blobs */}
        <div className="lg:hidden absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, #2563eb 0%, transparent 70%)' }} />
        </div>

        <motion.div
          className="relative z-10 w-full max-w-sm"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Mobile logo */}
          <div className="lg:hidden flex justify-center mb-6">
            <motion.div
              className="p-[3px] rounded-full"
              style={{
                background: 'conic-gradient(from var(--border-angle, 0deg), #dc2626, #eab308, #16a34a, #dc2626)',
                animation: 'spin-border 4s linear infinite',
              }}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 150, damping: 15 }}
            >
              <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center">
                <img src={schoolLogo} alt="Logo EIEF" className="w-16 h-16 object-contain" />
              </div>
            </motion.div>
          </div>

          {/* Badge */}
          <div className="text-center mb-6">
            <span
              className="inline-block px-4 py-1.5 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-3"
              style={{ background: 'linear-gradient(90deg, #dc2626, #eab308, #16a34a)', color: '#fff' }}
            >
              Espace Administration
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Connexion
            </h1>
            <p className="text-blue-300/50 text-sm mt-1">
              {schoolConfig?.nom || 'École Internationale Les Enfants du Futur'}
            </p>
          </div>

          {/* Form card */}
          <div className="relative p-[2px] rounded-2xl">
            <div className="absolute inset-0 rounded-2xl overflow-hidden">
              <div
                className="absolute inset-0"
                style={{
                  background: 'conic-gradient(from var(--border-angle, 0deg), #dc2626, #eab308, #16a34a, #dc2626)',
                  animation: 'spin-border 3s linear infinite',
                }}
              />
            </div>
            <div
              className="relative rounded-[14px] p-6 sm:p-8"
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
              }}
            >
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Email</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="admin@ecole.com"
                      className="h-11 pl-10 pr-4 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-400/60 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:border-blue-400/30"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Mot de passe</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Votre mot de passe"
                      className="h-11 pl-10 pr-11 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-slate-400/60 focus-visible:ring-2 focus-visible:ring-blue-400/40 focus-visible:border-blue-400/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 rounded-xl text-sm font-semibold tracking-wide uppercase text-white shadow-lg border-0"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #2563eb, #3b82f6)' }}
                >
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
                  Se connecter
                </Button>
              </form>

              <p className="text-center text-xs text-slate-400/60 mt-4">
                Seul l'administrateur peut créer des comptes.
              </p>
            </div>
          </div>

          {/* Extra links */}
          <div className="mt-6 space-y-3">
            {isInstallable && (
              <Button
                variant="ghost"
                className="w-full h-10 text-blue-300/50 hover:text-white hover:bg-white/5 rounded-full text-sm"
                onClick={install}
              >
                <Download className="mr-2 h-4 w-4" /> Installer l'Application
              </Button>
            )}
            <Link to="/download" className="block text-center text-xs text-blue-300/40 hover:text-blue-200/70 transition-colors">
              📱 Comment installer l'appli sur mon téléphone ?
            </Link>
          </div>

          {/* Separator + back */}
          <div className="my-5 border-t border-white/10" />
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-blue-300/40 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour à l'accueil
            </Button>
          </div>

          <p className="text-center text-xs text-blue-300/20 mt-4">
            © {new Date().getFullYear()} IdrissdevTech — Propulsé par RJP SARLU
          </p>
        </motion.div>
      </div>

      <style>{`
        @property --border-angle { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
        @keyframes spin-border { to { --border-angle: 360deg; } }
      `}</style>
    </div>
  );
}
