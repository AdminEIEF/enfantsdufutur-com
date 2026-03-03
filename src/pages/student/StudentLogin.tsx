import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { BookOpen, Lock, Loader2, User, Eye, EyeOff, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import studentIllustration from '@/assets/student-login-illustration.jpg';

export default function StudentLogin() {
  const { session, login, loading } = useStudentAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [suspended, setSuspended] = useState(false);

  if (!loading && session) {
    navigate('/eleve/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule.trim() || !password.trim()) return;
    setSubmitting(true);
    setSuspended(false);
    try {
      await login(matricule, password);
      navigate('/eleve/dashboard', { replace: true });
    } catch (err: any) {
      if (err.message?.includes('régulariser')) {
        setSuspended(true);
      }
      toast.error(err.message || "Identifiants invalides");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #c7d2fe 50%, #bfdbfe 100%)' }}
    >
      <motion.div
        className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        {/* Left — Illustration */}
        <div className="md:w-5/12 relative flex items-center justify-center p-6 md:p-8"
          style={{ background: 'linear-gradient(160deg, #dbeafe 0%, #bfdbfe 100%)' }}
        >
          <motion.img
            src={studentIllustration}
            alt="Illustration élève"
            className="w-full max-w-[280px] rounded-2xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          />
        </div>

        {/* Right — Form */}
        <div className="flex-1 p-8 sm:p-10 md:p-12 flex flex-col justify-center">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-semibold text-blue-600 tracking-wide">Espace Élève</span>
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-1" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Connexion
            </h1>
            <p className="text-muted-foreground text-sm mb-8">
              Accède à tes cours, devoirs et résultats.
            </p>

            {/* Suspended alert */}
            {suspended && (
              <div className="mb-6 flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">
                  Veuillez régulariser votre situation à la comptabilité.
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <span className="text-destructive">*</span> Matricule
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    value={matricule}
                    onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                    placeholder="Ex: EI-2026-001"
                    maxLength={20}
                    autoFocus
                    autoComplete="off"
                    className="h-12 pl-11 pr-4 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground/40 font-mono tracking-wider focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-1">
                  <span className="text-destructive">*</span> Mot de passe
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ton mot de passe"
                    maxLength={30}
                    autoComplete="off"
                    className="h-12 pl-11 pr-12 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || !matricule.trim() || !password.trim()}
                className="w-full h-12 rounded-xl text-sm font-semibold tracking-wide bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Se connecter
              </Button>
            </form>

            {/* Back link */}
            <div className="mt-8 text-center">
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
      </motion.div>
    </div>
  );
}
