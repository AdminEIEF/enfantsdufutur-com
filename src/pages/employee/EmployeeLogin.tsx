import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEmployeeAuth } from '@/hooks/useEmployeeAuth';
import { Briefcase, Lock, Loader2, User, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import employeeIllustration from '@/assets/employee-login-illustration.jpg';

export default function EmployeeLogin() {
  const { session, login, loading } = useEmployeeAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex bg-emerald-50">
      {/* Left side — Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #d1fae5 0%, #6ee7b7 40%, #059669 100%)' }}
      >
        {/* Decorative shapes */}
        <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute bottom-12 right-12 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute top-1/4 right-8 w-12 h-12 rounded-full bg-emerald-400/30" />

        <motion.div
          className="relative z-10 p-8"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <img
            src={employeeIllustration}
            alt="Illustration employé"
            className="w-full max-w-md rounded-3xl shadow-2xl"
          />
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold text-white drop-shadow-md" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Bienvenue sur votre espace
            </h2>
            <p className="text-white/80 mt-2 text-sm max-w-xs mx-auto">
              Gérez vos congés, plannings, bulletins de paie et plus encore.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Right side — Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          {/* Logo / Badge */}
          <div className="flex items-center gap-2 mb-10">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-md">
              <Briefcase className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-emerald-900 tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Espace Personnel
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Connexion
          </h1>
          <p className="text-muted-foreground mb-8">
            Entrez votre matricule et mot de passe pour accéder à votre espace.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Matricule</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={matricule}
                  onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                  placeholder="Ex: EMP-001"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                  className="h-12 pl-11 pr-4 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground/50 font-mono tracking-wider focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Votre mot de passe"
                  maxLength={30}
                  autoComplete="off"
                  className="h-12 pl-11 pr-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
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

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
          </div>

          {/* Back link */}
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
