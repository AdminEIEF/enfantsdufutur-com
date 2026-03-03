import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, ArrowLeft, Backpack, Star, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useStudentAuth } from '@/hooks/useStudentAuth';

export default function StudentPrimaryLogin() {
  const { session } = useStudentAuth();
  const navigate = useNavigate();
  const [matricule, setMatricule] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (session) {
    navigate('/eleve/dashboard', { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!matricule.trim()) return;
    setSubmitting(true);
    setErrorMsg('');

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-primary-auth`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ matricule: matricule.trim().toUpperCase() }),
        }
      );

      const data = await resp.json();

      if (!resp.ok) {
        setErrorMsg(data.error || 'Matricule introuvable');
        return;
      }

      // Store session in localStorage for StudentAuthProvider compatibility
      const newSession = {
        eleve: data.eleve,
        matricule: matricule.trim().toUpperCase(),
        token: data.token,
      };
      localStorage.setItem('student_session', JSON.stringify(newSession));
      toast.success(`Bienvenue ${data.eleve.prenom} ! 🎉`);
      window.location.href = '/eleve/dashboard';
    } catch {
      setErrorMsg('Erreur de connexion. Réessaie !');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #bbf7d0 40%, #bfdbfe 70%, #fecaca 100%)' }}
    >
      {/* Floating decorations */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-4xl sm:text-5xl"
            style={{
              top: `${15 + (i * 14)}%`,
              left: i % 2 === 0 ? `${5 + i * 3}%` : `${75 + i * 3}%`,
            }}
            animate={{
              y: [0, -15, 0],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 3 + i * 0.5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: i * 0.3,
            }}
          >
            {['📚', '✏️', '🎨', '⭐', '🏫', '🎒'][i]}
          </motion.div>
        ))}
      </div>

      <motion.div
        className="w-full max-w-md relative z-10"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Card */}
        <div className="bg-white/90 backdrop-blur-md rounded-[2rem] shadow-2xl border-4 border-yellow-300 p-8 sm:p-10 space-y-6">
          {/* Header */}
          <motion.div
            className="text-center space-y-2"
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex justify-center gap-1 mb-2">
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              <Sparkles className="h-6 w-6 text-blue-400" />
              <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-green-600 via-blue-600 to-purple-600 bg-clip-text text-transparent"
              style={{ fontFamily: 'Nunito, Comic Sans MS, sans-serif' }}
            >
              Salut l'élève ! 👋
            </h1>
            <p className="text-muted-foreground text-base font-medium">
              Entre ton matricule pour accéder à ton espace
            </p>
          </motion.div>

          {/* Error message */}
          {errorMsg && (
            <motion.div
              className="p-4 rounded-2xl bg-orange-50 border-2 border-orange-200 text-center"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <p className="text-orange-700 font-semibold text-sm leading-relaxed">
                {errorMsg}
              </p>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-base font-bold text-foreground flex items-center gap-2"
                style={{ fontFamily: 'Nunito, sans-serif' }}
              >
                🏷️ Ton Matricule
              </label>
              <Input
                value={matricule}
                onChange={(e) => setMatricule(e.target.value.toUpperCase())}
                placeholder="Ex: EI-2026-001"
                maxLength={20}
                autoFocus
                autoComplete="off"
                className="h-16 text-xl text-center font-bold tracking-[0.2em] rounded-2xl border-3 border-blue-300 bg-blue-50/50 placeholder:text-blue-300/60 placeholder:tracking-[0.15em] placeholder:text-base focus-visible:ring-4 focus-visible:ring-green-400/40 focus-visible:border-green-400 transition-all"
                style={{ fontFamily: 'monospace' }}
              />
            </div>

            <Button
              type="submit"
              disabled={submitting || !matricule.trim()}
              className="w-full h-16 rounded-2xl text-xl font-extrabold tracking-wide shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                color: 'white',
                fontFamily: 'Nunito, sans-serif',
                boxShadow: '0 8px 25px -5px rgba(34, 197, 94, 0.4)',
              }}
            >
              {submitting ? (
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
              ) : (
                <Backpack className="h-6 w-6 mr-2" />
              )}
              C'est parti !
            </Button>
          </form>

          {/* Back link */}
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-muted-foreground hover:text-foreground rounded-xl"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
