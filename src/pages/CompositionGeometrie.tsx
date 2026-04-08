import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, Check, Loader2, Shapes, Grid3X3 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { RelierFormesExercice } from '@/components/geometrie/RelierFormesExercice';
import { QuadrillageExercice } from '@/components/geometrie/QuadrillageExercice';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PASTEL_BG = 'bg-gradient-to-br from-emerald-50 via-cyan-50 to-violet-50 dark:from-emerald-950/30 dark:via-cyan-950/30 dark:to-violet-950/30';

const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    u.rate = 0.85;
    u.pitch = 1.1;
    window.speechSynthesis.speak(u);
  }
};

export default function CompositionGeometrie() {
  const [tab, setTab] = useState('relier');
  const [relierScore, setRelierScore] = useState<number | null>(null);
  const [quadrillageDataUrl, setQuadrillageDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#34d399', '#60a5fa', '#a78bfa', '#fbbf24', '#f472b6'] });
      setSubmitted(true);
      toast.success('Bravo ! Tes tracés ont été envoyés au maître ! 🌟');
    } catch (err) {
      toast.error('Erreur lors de l\'envoi');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className={`min-h-screen ${PASTEL_BG} flex items-center justify-center p-4`}>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12 }}>
          <Card className="max-w-md w-full rounded-3xl border-0 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-400 p-1" />
            <CardContent className="p-8 text-center space-y-6">
              <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ duration: 1.5, repeat: 2 }}>
                <span className="text-7xl">🎉</span>
              </motion.div>
              <h1 className="text-3xl font-black" style={{ fontFamily: 'Nunito, sans-serif', color: '#059669' }}>
                Félicitations !
              </h1>
              <p className="text-lg text-muted-foreground" style={{ fontFamily: 'Nunito, sans-serif' }}>
                Tes tracés ont été envoyés au maître. 🌟
              </p>
              {relierScore !== null && (
                <div className="bg-gradient-to-r from-emerald-100 to-cyan-100 dark:from-emerald-900/30 dark:to-cyan-900/20 rounded-2xl p-4">
                  <p className="text-sm text-muted-foreground">Formes reliées correctement</p>
                  <p className="text-4xl font-black text-emerald-600">{relierScore}/4 ⭐</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${PASTEL_BG} pb-32`} style={{ fontFamily: 'Nunito, "Comic Neue", sans-serif' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-black text-emerald-700 flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            📐 Géométrie & Tracés
          </h1>
          <Badge className="bg-emerald-100 text-emerald-700 font-bold">Primaire / Maternelle</Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4">
        <Tabs value={tab} onValueChange={setTab} className="space-y-4">
          <TabsList className="w-full h-14 rounded-2xl bg-white/70 dark:bg-card/70 shadow-md p-1">
            <TabsTrigger value="relier" className="flex-1 h-12 rounded-xl text-base font-bold data-[state=active]:bg-emerald-500 data-[state=active]:text-white gap-2">
              <Shapes className="h-5 w-5" /> Relier les Formes
            </TabsTrigger>
            <TabsTrigger value="quadrillage" className="flex-1 h-12 rounded-xl text-base font-bold data-[state=active]:bg-cyan-500 data-[state=active]:text-white gap-2">
              <Grid3X3 className="h-5 w-5" /> Quadrillage Magique
            </TabsTrigger>
          </TabsList>

          <TabsContent value="relier">
            <RelierFormesExercice onScoreChange={setRelierScore} speak={speak} />
          </TabsContent>

          <TabsContent value="quadrillage">
            <QuadrillageExercice onCapture={setQuadrillageDataUrl} speak={speak} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom submit */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md py-4 px-4 border-t-2 border-emerald-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-3xl mx-auto flex justify-end">
          <Button
            className="h-16 px-10 rounded-2xl text-xl font-black bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 shadow-xl animate-pulse"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
            VALIDER MES TRACÉS ✅
          </Button>
        </div>
      </div>
    </div>
  );
}
