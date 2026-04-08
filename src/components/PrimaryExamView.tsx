import { useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Volume2, Check, Paintbrush, Eraser, Trash2, ChevronRight, Timer } from 'lucide-react';
import confetti from 'canvas-confetti';
import mortierPilonImg from '@/assets/mortier-pilon.png';
import panier10 from '@/assets/panier-10.png';
import panier12 from '@/assets/panier-12.png';
import panier13 from '@/assets/panier-13.png';

interface PrimaryExamViewProps {
  composition: any;
  questions: any[];
  timeLeft: number;
  onSubmit: (results: { score: number; total: number; dessinDataUrl: string; detail: any }) => void;
  submitting: boolean;
}

const PASTEL_BG = 'bg-gradient-to-br from-amber-50 via-pink-50 to-blue-50 dark:from-amber-950/30 dark:via-pink-950/30 dark:to-blue-950/30';

export function PrimaryExamView({ composition, questions, timeLeft, onSubmit, submitting }: PrimaryExamViewProps) {
  const [step, setStep] = useState(0); // 0=dessin, 1=math, 2+=qcm, last=submit
  const [drawTool, setDrawTool] = useState<'pen' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState('#1e40af');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Math answer
  const [mathAnswer, setMathAnswer] = useState<number | null>(null);
  const MATH_CORRECT = 12;

  // QCM answers
  const [qcmAnswers, setQcmAnswers] = useState<Record<number, string>>({});

  // Submitted state
  const [submitted, setSubmitted] = useState(false);

  const totalSteps = 2 + questions.length; // dessin + math + N qcm

  // ---------- Canvas setup ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      const size = Math.min(parent.clientWidth - 16, 380);
      canvas.width = size;
      canvas.height = size;
    }
    clearCanvas();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Draw light guide
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const getPos = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsDrawing(true);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = drawTool === 'eraser' ? '#ffffff' : penColor;
    ctx.lineWidth = drawTool === 'eraser' ? 20 : 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  // ---------- TTS (read aloud) ----------
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

  // ---------- Final submit ----------
  const handleFinalSubmit = () => {
    // Compute QCM score
    let score = 0;
    let total = questions.length + 1; // +1 for math
    // Math
    if (mathAnswer === MATH_CORRECT) score++;
    // QCM
    questions.forEach((q, i) => {
      if (qcmAnswers[i] === q.reponse_correcte) score++;
    });

    // Get drawing as data URL
    const dessinDataUrl = canvasRef.current?.toDataURL('image/png') || '';

    // Confetti!
    confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa'] });
    setSubmitted(true);

    onSubmit({
      score,
      total,
      dessinDataUrl,
      detail: {
        math: mathAnswer === MATH_CORRECT,
        qcm: qcmAnswers,
      },
    });
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const isUrgent = timeLeft < 60;
  const isWarning = timeLeft < 180 && timeLeft >= 60;

  const colors = ['#1e40af', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2'];

  // ---------- SUBMITTED / CONGRATS ----------
  if (submitted) {
    return (
      <div className={`min-h-screen ${PASTEL_BG} flex items-center justify-center p-4`}>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12 }}>
          <Card className="max-w-md w-full rounded-3xl border-0 shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-yellow-400 via-pink-400 to-blue-400 p-1" />
            <CardContent className="p-8 text-center space-y-6">
              <motion.div animate={{ rotate: [0, -10, 10, -10, 10, 0] }} transition={{ duration: 1.5, repeat: 2 }}>
                <span className="text-7xl">🎉</span>
              </motion.div>
              <h1 className="text-3xl font-black" style={{ fontFamily: 'Nunito, sans-serif', color: '#7c3aed' }}>
                Félicitations !
              </h1>
              <p className="text-lg text-muted-foreground" style={{ fontFamily: 'Nunito, sans-serif' }}>
                Ta copie a été envoyée au maître. 🌟
              </p>
              <div className="bg-gradient-to-r from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 rounded-2xl p-4">
                <p className="text-sm text-muted-foreground">Ton score QCM</p>
                <p className="text-4xl font-black text-emerald-600">Bravo ! ⭐</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${PASTEL_BG}`} style={{ fontFamily: 'Nunito, "Comic Neue", sans-serif' }}>
      {/* Floating timer */}
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-2 right-2 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg border font-mono text-lg font-bold backdrop-blur-md transition-all ${
          isUrgent ? 'bg-destructive/90 text-destructive-foreground border-destructive animate-pulse'
          : isWarning ? 'bg-orange-500/90 text-white border-orange-400'
          : 'bg-primary/90 text-primary-foreground border-primary/50'
        }`}
      >
        <Timer className="h-5 w-5" />
        {formatTime(timeLeft)}
      </motion.div>

      {/* Progress bar */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-background/80 backdrop-blur-md border-b px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-black text-purple-700" style={{ fontFamily: 'Nunito, sans-serif' }}>
              📝 {composition?.titre || 'Mon Examen'}
            </h2>
            <Badge className="bg-purple-100 text-purple-700 text-xs">{step + 1}/{totalSteps}</Badge>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-3 flex-1 rounded-full transition-all duration-500 ${
                i < step ? 'bg-emerald-400' : i === step ? 'bg-purple-500 animate-pulse' : 'bg-muted'
              }`} />
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 pb-32">
        <AnimatePresence mode="wait">
          {/* ─── STEP 0: DESSIN ─── */}
          {step === 0 && (
            <motion.div key="dessin" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    🎨 Dessine le Mortier et Pilon
                  </h3>
                  <p className="text-white/90 text-sm mt-1">Regarde bien le modèle et dessine-le !</p>
                </div>
                <CardContent className="p-6 space-y-4">
                  {/* Model image */}
                  <div className="flex justify-center">
                    <div className="bg-white rounded-2xl shadow-inner p-4 border-2 border-dashed border-amber-200">
                      <p className="text-xs text-center text-muted-foreground mb-2 font-bold">📌 MODÈLE</p>
                      <img src={mortierPilonImg} alt="Mortier et Pilon" className="w-40 h-40 object-contain mx-auto" />
                    </div>
                  </div>

                  {/* Canvas */}
                  <div className="flex justify-center">
                    <canvas
                      ref={canvasRef}
                      className="border-4 border-dashed border-purple-300 rounded-3xl bg-white cursor-crosshair touch-none shadow-inner"
                      onMouseDown={startDraw}
                      onMouseMove={draw}
                      onMouseUp={stopDraw}
                      onMouseLeave={stopDraw}
                      onTouchStart={startDraw}
                      onTouchMove={draw}
                      onTouchEnd={stopDraw}
                    />
                  </div>

                  {/* Tools */}
                  <div className="flex items-center gap-2 justify-center flex-wrap">
                    <Button
                      size="lg"
                      variant={drawTool === 'pen' ? 'default' : 'outline'}
                      className="rounded-2xl text-lg h-14 px-6 font-bold"
                      onClick={() => setDrawTool('pen')}
                    >
                      <Paintbrush className="h-6 w-6 mr-2" /> 🖌️ Dessiner
                    </Button>
                    <Button
                      size="lg"
                      variant={drawTool === 'eraser' ? 'default' : 'outline'}
                      className="rounded-2xl text-lg h-14 px-6 font-bold"
                      onClick={() => setDrawTool('eraser')}
                    >
                      <Eraser className="h-6 w-6 mr-2" /> 🧽 Gomme
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="rounded-2xl text-lg h-14 px-6 font-bold border-destructive text-destructive hover:bg-destructive/10"
                      onClick={clearCanvas}
                    >
                      <Trash2 className="h-6 w-6 mr-2" /> 🗑️ Effacer
                    </Button>
                  </div>

                  {/* Color picker */}
                  <div className="flex gap-2 justify-center">
                    {colors.map(c => (
                      <button
                        key={c}
                        className={`w-10 h-10 rounded-full border-4 transition-transform ${penColor === c && drawTool === 'pen' ? 'scale-125 border-foreground shadow-lg' : 'border-transparent'}`}
                        style={{ background: c }}
                        onClick={() => { setPenColor(c); setDrawTool('pen'); }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── STEP 1: MATH VISUEL ─── */}
          {step === 1 && (
            <motion.div key="math" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
              <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-blue-400 to-cyan-400 px-6 py-4">
                  <h3 className="text-xl font-black text-white flex items-center gap-2">
                    🧮 Le Problème d'Amara
                  </h3>
                </div>
                <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 flex-1">
                      <p className="text-lg font-bold text-center" style={{ fontFamily: 'Nunito, sans-serif', lineHeight: 1.6 }}>
                        🥭 Amara a <span className="text-3xl text-blue-600 font-black">5</span> mangues, 
                        il en ajoute <span className="text-3xl text-blue-600 font-black">7</span>. 
                        <br />Clique sur le bon panier !
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="rounded-full h-12 w-12 shrink-0 bg-blue-100 hover:bg-blue-200" onClick={() => speak("Amara a 5 mangues, il en ajoute 7. Clique sur le bon panier !")}>
                      <Volume2 className="h-6 w-6 text-blue-600" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { value: 10, img: panier10, label: 'Panier A' },
                      { value: 12, img: panier12, label: 'Panier B' },
                      { value: 13, img: panier13, label: 'Panier C' },
                    ].map(p => (
                      <motion.div key={p.value} whileTap={{ scale: 0.95 }}>
                        <button
                          onClick={() => setMathAnswer(p.value)}
                          className={`w-full rounded-3xl border-4 p-3 transition-all flex flex-col items-center gap-2 ${
                            mathAnswer === p.value
                              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg scale-105 ring-4 ring-emerald-200'
                              : 'border-muted bg-white dark:bg-card hover:border-blue-300 hover:shadow-md'
                          }`}
                        >
                          <img src={p.img} alt={p.label} className="w-20 h-20 object-contain" />
                          <span className="text-3xl font-black" style={{ color: mathAnswer === p.value ? '#10b981' : '#6366f1' }}>
                            {p.value}
                          </span>
                          <Badge className={`text-xs font-bold ${mathAnswer === p.value ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>
                            {p.label}
                          </Badge>
                          {mathAnswer === p.value && <Check className="h-6 w-6 text-emerald-500" />}
                        </button>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ─── STEPS 2+: QCM ─── */}
          {step >= 2 && step < totalSteps && (() => {
            const qIdx = step - 2;
            const q = questions[qIdx];
            if (!q) return null;
            const opts = q.options || [];
            return (
              <motion.div key={`qcm-${qIdx}`} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="space-y-4">
                <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                  <div className="bg-gradient-to-r from-purple-400 to-pink-400 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-xl font-black text-white">
                      📖 Question {qIdx + 1}
                    </h3>
                    <Badge className="bg-white/20 text-white text-sm font-bold">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                  </div>
                  <CardContent className="p-6 space-y-5">
                    <div className="flex items-start gap-2">
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 flex-1">
                        <p className="text-xl font-bold leading-relaxed" style={{ fontFamily: 'Nunito, sans-serif' }}>
                          {q.enonce}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="rounded-full h-14 w-14 shrink-0 bg-purple-100 hover:bg-purple-200" onClick={() => speak(q.enonce)}>
                        <Volume2 className="h-7 w-7 text-purple-600" />
                      </Button>
                    </div>

                    <RadioGroup
                      value={qcmAnswers[qIdx] || ''}
                      onValueChange={v => setQcmAnswers(prev => ({ ...prev, [qIdx]: v }))}
                      className="space-y-3"
                    >
                      {opts.map((opt: any, oi: number) => (
                        <motion.div key={oi} whileTap={{ scale: 0.97 }}>
                          <label
                            htmlFor={`pq_${qIdx}_${oi}`}
                            className={`flex items-center gap-4 p-5 rounded-2xl border-4 transition-all cursor-pointer ${
                              qcmAnswers[qIdx] === opt.label
                                ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 shadow-lg'
                                : 'border-muted bg-white dark:bg-card hover:border-purple-200 hover:shadow-md'
                            }`}
                          >
                            <RadioGroupItem value={opt.label} id={`pq_${qIdx}_${oi}`} className="h-6 w-6" />
                            <span className="flex-1 text-lg font-bold" style={{ fontFamily: 'Nunito, sans-serif' }}>
                              {opt.label}
                            </span>
                            {qcmAnswers[qIdx] === opt.label && <Check className="h-6 w-6 text-emerald-500" />}
                          </label>
                        </motion.div>
                      ))}
                    </RadioGroup>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>

      {/* Bottom navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-card/95 backdrop-blur-md py-4 px-4 border-t-2 border-purple-200 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              className="h-14 px-6 rounded-2xl text-lg font-bold border-2"
              onClick={() => setStep(s => s - 1)}
            >
              ← Retour
            </Button>
          )}
          <div className="flex-1" />
          {step < totalSteps - 1 ? (
            <Button
              className="h-14 px-8 rounded-2xl text-lg font-black bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg"
              onClick={() => setStep(s => s + 1)}
            >
              Suivant <ChevronRight className="h-6 w-6 ml-1" />
            </Button>
          ) : (
            <Button
              className="h-16 px-10 rounded-2xl text-xl font-black bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-xl animate-pulse"
              onClick={handleFinalSubmit}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : null}
              J'AI TERMINÉ MON EXAMEN ✅
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
