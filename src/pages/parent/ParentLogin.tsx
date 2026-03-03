import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useParentAuth } from '@/hooks/useParentAuth';
import { GraduationCap, KeyRound, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import parentIllustration from '@/assets/parent-login-illustration.jpg';

export default function ParentLogin() {
  const { session, login, loading } = useParentAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    navigate('/parent/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    try {
      await login(code);
      navigate('/parent/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Code invalide");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-orange-50">
      {/* Left side — Illustration */}
      <div
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(160deg, #fff7ed 0%, #fdba74 40%, #ea580c 100%)' }}
      >
        {/* Decorative shapes */}
        <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-white/10" />
        <div className="absolute bottom-12 right-12 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute top-1/4 right-8 w-12 h-12 rounded-full bg-orange-400/30" />

        <motion.div
          className="relative z-10 p-8"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <img
            src={parentIllustration}
            alt="Illustration espace parent"
            className="w-full max-w-md rounded-3xl shadow-2xl"
          />
          <div className="mt-6 text-center">
            <h2 className="text-2xl font-bold text-white drop-shadow-md" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Suivez la scolarité
            </h2>
            <p className="text-white/80 mt-2 text-sm max-w-xs mx-auto">
              Résultats, paiements, notifications et bien plus dans votre espace dédié.
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
            <div className="w-10 h-10 rounded-xl bg-orange-600 flex items-center justify-center shadow-md">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-orange-900 tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Espace Parent
            </span>
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Connexion
          </h1>
          <p className="text-muted-foreground mb-8">
            Entrez le code d'accès fourni par le secrétariat de l'école.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Code d'accès</label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: FAM-XXXX"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                  className="h-12 pl-11 pr-4 rounded-xl border-border bg-background text-foreground placeholder:text-muted-foreground/50 font-mono tracking-widest text-center focus-visible:ring-2 focus-visible:ring-orange-500/40"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting || !code.trim()}
              className="w-full h-12 rounded-xl text-sm font-semibold tracking-wide bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-600/20 transition-all"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Accéder à mon espace
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
