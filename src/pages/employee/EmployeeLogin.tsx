import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Briefcase, Lock, Loader2, User } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function EmployeeLogin() {
  const { session, login, loading } = useEmployeeAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    navigate('/employe/dashboard', { replace: true });
    return null;
  }

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

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 30%, #14b8a6 50%, #06b6d4 70%, #0891b2 100%)' }}
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
          style={{ background: 'radial-gradient(circle, #059669 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], x: [0, -15, 0], y: [0, 15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-sm"
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
              <Briefcase className="h-8 w-8 text-white/80" />
            </div>
          </div>
        </div>

        {/* Glassmorphism card */}
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
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Espace Personnel
            </h2>
            <p className="text-white/60 text-sm mt-1">
              Connectez-vous avec votre matricule
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700/50" />
              <Input
                value={matricule}
                onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                placeholder="Matricule (Ex: EMP-001)"
                maxLength={20}
                autoFocus
                autoComplete="off"
                className="h-12 pl-10 pr-4 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm text-center tracking-widest font-mono"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700/50" />
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                maxLength={30}
                autoComplete="off"
                className="h-12 pl-10 pr-4 bg-white/80 border-0 rounded-full text-teal-900 placeholder:text-teal-700/40 focus-visible:ring-2 focus-visible:ring-white/40 shadow-sm"
              />
            </div>
            <Button
              type="submit"
              disabled={submitting || !matricule.trim() || !password.trim()}
              className="w-full h-12 rounded-full text-sm font-semibold tracking-wide uppercase bg-emerald-900 hover:bg-emerald-950 text-white shadow-lg"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accéder à mon espace
            </Button>
          </form>
        </div>

        {/* Back link */}
        <div className="text-center mt-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-white/50 hover:text-white/80 hover:bg-transparent">
            ← Retour à l'accueil
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
