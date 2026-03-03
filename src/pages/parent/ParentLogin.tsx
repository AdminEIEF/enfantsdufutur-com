import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useParentAuth } from '@/hooks/useParentAuth';
import { KeyRound, Loader2, ArrowLeft, Eye, EyeOff, Users } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import parentIllustration from '@/assets/parent-login-illustration.jpg';

export default function ParentLogin() {
  const { session, login, loading } = useParentAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
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
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — Illustration */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7 }}
        className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 40%, #b45309 100%)' }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-40 h-40 rounded-full bg-white/30 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-60 h-60 rounded-full bg-orange-300/30 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col items-center gap-8 px-12">
          <motion.img
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            src={parentIllustration}
            alt="Illustration espace parent"
            className="w-80 h-80 object-cover rounded-3xl shadow-2xl border-4 border-white/20"
          />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-center text-white space-y-3"
          >
            <h2 className="text-3xl font-bold">Espace Parent</h2>
            <p className="text-amber-100 text-lg max-w-sm">
              Suivez la scolarité de vos enfants en temps réel
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Right — Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Connexion Parent</h1>
                <p className="text-muted-foreground text-sm">École Internationale Enfant du Futur</p>
              </div>
            </div>
          </div>

          {/* Mobile illustration */}
          <div className="lg:hidden flex justify-center">
            <img
              src={parentIllustration}
              alt="Illustration parent"
              className="w-48 h-48 object-cover rounded-2xl shadow-lg"
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-medium">
                Code d'accès famille
              </Label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="code"
                  type={showCode ? 'text' : 'password'}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ex: FAM-XXXX"
                  className="h-12 pl-11 pr-11 font-mono tracking-wider text-center text-lg rounded-xl focus-visible:ring-amber-500/40"
                  maxLength={20}
                  autoFocus
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowCode(!showCode)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showCode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Code fourni par le secrétariat de l'école
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-semibold bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25"
              disabled={submitting || !code.trim()}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              Accéder à mon espace
            </Button>
          </form>

          {/* Footer */}
          <div className="text-center pt-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-muted-foreground">
              <ArrowLeft className="h-4 w-4 mr-1" /> Retour à l'accueil
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
