import { useState, useEffect, useRef, useCallback } from 'react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle2, Timer, FileText, Bold, Italic, Underline, List, Image, Superscript, Subscript, Send, ShieldAlert, PenLine, Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useExamSecurity } from '@/hooks/useExamSecurity';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MathText } from '@/components/MathText';

export default function StudentCompositions() {
  const { session } = useStudentAuth();
  const [compositions, setCompositions] = useState<any[]>([]);
  const [reponses, setReponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComp, setActiveComp] = useState<any>(null);
  const [activeType, setActiveType] = useState<string>('qcm');
  const [activeQuestions, setActiveQuestions] = useState<any[]>([]);
  const [activeSujet, setActiveSujet] = useState<{ url: string; nom: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [violations, setViolations] = useState(0);
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningReason, setWarningReason] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const blockedRef = useRef(false);
  const [photos, setPhotos] = useState<{ id: string; dataUrl: string }[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  const capturePhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Image trop volumineuse (max 10 Mo)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const id = `photo_${Date.now()}`;
        setPhotos(prev => [...prev, { id, dataUrl: ev.target?.result as string }]);
        toast.success('📸 Photo ajoutée !');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const removePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  const handleSecurityViolation = useCallback((reason: string) => {
    if (blockedRef.current) return;
    setViolations(prev => {
      const newCount = prev + 1;
      if (newCount >= 2) {
        blockedRef.current = true;
        setBlocked(true);
        // Auto-submit
        handleSubmit(true);
        toast.error('⛔ Accès bloqué ! Vous avez quitté l\'application pendant la composition.');
      } else {
        const reasons: Record<string, string> = {
          tab_switch: 'Vous avez quitté l\'onglet',
          window_blur: 'Vous avez quitté la fenêtre',
          screenshot_attempt: 'Tentative de capture d\'écran détectée',
        };
        setWarningReason(reasons[reason] || 'Activité suspecte détectée');
        setWarningOpen(true);
        toast.warning(`⚠️ Avertissement ${newCount}/2 — Ne quittez pas l'application !`);
      }
      return newCount;
    });
  }, []);

  useExamSecurity({
    isActive: !!activeComp && !blocked,
    onViolation: handleSecurityViolation,
    maxViolations: 2,
    allowPasteInEditable: true,
  });

  // Auto-refresh compositions list every 10s
  useEffect(() => {
    if (!session) return;
    fetchCompositions();
    const refreshId = setInterval(() => { // Refresh every 2s
      if (!activeComp) fetchCompositions();
    }, 2000);
    return () => {
      clearInterval(refreshId);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session, activeComp]);

  // Live countdown tick every second for upcoming compositions
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const callApi = async (action: string, extra: any = {}) => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token: session!.token, action, ...extra }),
      }
    );
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erreur');
    return data;
  };

  async function fetchCompositions() {
    try {
      setLoading(true);
      const data = await callApi('compositions');
      setCompositions(data.compositions || []);
      setReponses(data.reponses || []);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function startComposition(comp: any) {
    try {
      const data = await callApi('start_composition', { composition_id: comp.id });
      setActiveComp(comp);
      setActiveType(data.type_composition || 'qcm');
      setAnswers({});
      setCurrentQIndex(0);

      if (data.type_composition === 'document') {
        setActiveSujet({ url: data.sujet_url, nom: data.sujet_nom });
        setActiveQuestions([]);
      } else {
        setActiveQuestions(data.questions || []);
        setActiveSujet(null);
      }

      // Calculate time left
      const debut = new Date(data.debut_at).getTime();
      const maxMs = comp.duree_minutes * 60 * 1000;
      const elapsed = Date.now() - debut;
      const remaining = Math.max(0, Math.floor((maxMs - elapsed) / 1000));
      setTimeLeft(remaining);

      // Start timer
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleSubmit(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      // Build photos HTML
      const photosHtml = photos.length > 0
        ? '<hr/><h3>📸 Photos jointes</h3>' + photos.map((p, i) => `<div><p>Photo ${i + 1}:</p><img src="${p.dataUrl}" style="max-width:100%;margin:8px 0;border-radius:8px;" /></div>`).join('')
        : '';

      if (activeType === 'document') {
        const htmlContent = (editorRef.current?.innerHTML || '') + photosHtml;
        if (!autoSubmit && !htmlContent.trim() && photos.length === 0) {
          if (!confirm('Votre réponse est vide. Soumettre quand même ?')) {
            setSubmitting(false);
            return;
          }
        }
        const data = await callApi('submit_composition', {
          composition_id: activeComp.id,
          reponse_texte: htmlContent,
        });
        toast.success(data.message || 'Composition soumise !');
      } else if (activeType === 'texte') {
        const textPayload = activeQuestions.map((q: any, idx: number) => ({
          question_id: q.id,
          ordre: idx + 1,
          question: q.enonce,
          answer: (answers[q.id] || '').trim(),
          points: q.points,
        }));

        const textParts = textPayload.map((item) => {
          const safeQuestion = item.question
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
          const safeAnswer = item.answer
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br/>');

          return `<div><strong>Q${item.ordre}: ${safeQuestion}</strong><br/>${safeAnswer || '<em>Aucune réponse</em>'}</div>`;
        }).join('<hr/>');
        
        if (!autoSubmit) {
          const unanswered = activeQuestions.filter((q: any) => !answers[q.id]?.trim());
          if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) sans réponse. Soumettre quand même ?`)) {
            setSubmitting(false);
            return;
          }
        }
        const data = await callApi('submit_composition', {
          composition_id: activeComp.id,
          reponse_texte: textParts + photosHtml,
          reponses: textPayload,
        });
        toast.success(data.message || 'Composition soumise !');
      } else {
        if (!autoSubmit) {
          const unanswered = activeQuestions.filter(q => !answers[q.id]);
          if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) sans réponse. Soumettre quand même ?`)) {
            setSubmitting(false);
            return;
          }
        }
        const data = await callApi('submit_composition', {
          composition_id: activeComp.id,
          reponses: answers,
        });
        toast.success(`Composition soumise ! Score : ${data.score}/${data.bareme}`);
      }
      setActiveComp(null);
      setActiveQuestions([]);
      setActiveSujet(null);
      setPhotos([]);
      fetchCompositions();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [activeComp, activeQuestions, answers, submitting, session, activeType, photos]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getStatus = (comp: any) => {
    const rep = reponses.find((r: any) => r.composition_id === comp.id);
    if (rep?.soumis_at) return 'done';
    if (rep) return 'in_progress';
    const now = Date.now();
    if (new Date(comp.date_fin).getTime() < now) return 'expired';
    if (new Date(comp.date_debut).getTime() > now) return 'upcoming';
    return 'available';
  };

  const getCountdown = (comp: any) => {
    const diff = new Date(comp.date_debut).getTime() - Date.now();
    if (diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d}j ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Rich text editor commands
  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
  };

  const insertImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image trop volumineuse (max 5 Mo)');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        execCmd('insertImage', ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const insertMathSymbol = (symbol: string) => {
    execCmd('insertHTML', `<span style="font-family: 'Times New Roman', serif; font-style: italic;">${symbol}</span>`);
  };

  // Blocked screen
  if (blocked && activeComp) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full border-destructive/50">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-destructive">Accès Bloqué</h2>
              <p className="text-muted-foreground">
                Vous avez quitté l'application pendant la composition. 
                Votre copie a été automatiquement soumise.
              </p>
              <p className="text-sm text-muted-foreground">
                Contactez votre superviseur si vous pensez qu'il s'agit d'une erreur.
              </p>
              <Button variant="outline" onClick={() => { setBlocked(false); setActiveComp(null); blockedRef.current = false; setViolations(0); fetchCompositions(); }}>
                Retour aux compositions
              </Button>
            </CardContent>
          </Card>
        </div>
      </StudentLayout>
    );
  }

  // Warning dialog for first violation
  const violationWarningDialog = (
    <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Avertissement !
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="font-medium">{warningReason}</p>
          <p className="text-sm text-muted-foreground">
            <strong>Attention :</strong> Si vous quittez l'application une deuxième fois, 
            votre composition sera automatiquement soumise et votre accès sera bloqué.
          </p>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs font-semibold text-destructive">Avertissement {violations}/2 — Prochain = Blocage</p>
          </div>
        </div>
        <Button onClick={() => setWarningOpen(false)} className="w-full">
          J'ai compris, continuer
        </Button>
      </DialogContent>
    </Dialog>
  );

  // Floating timer component - always visible
  const FloatingTimer = () => {
    const isUrgent = timeLeft < 60;
    const isWarning = timeLeft < 180 && timeLeft >= 60;
    return (
      <div className={`fixed top-2 right-2 z-50 flex items-center gap-2 px-4 py-2 rounded-2xl shadow-lg border font-mono text-lg font-bold backdrop-blur-md transition-all ${
        isUrgent ? 'bg-destructive/90 text-destructive-foreground border-destructive animate-pulse' 
        : isWarning ? 'bg-orange-500/90 text-white border-orange-400'
        : 'bg-primary/90 text-primary-foreground border-primary/50'
      }`}>
        <Timer className="h-5 w-5" />
        {formatTime(timeLeft)}
        {violations > 0 && <Badge variant="destructive" className="text-xs ml-1">⚠️ {violations}/2</Badge>}
      </div>
    );
  };

  // Active exam view - Document type
  if (activeComp && activeType === 'document') {
    const sujetUrl = activeSujet?.url || '';
    const isPdf = sujetUrl.toLowerCase().includes('.pdf');
    const viewerUrl = isPdf
      ? sujetUrl
      : `https://docs.google.com/gview?url=${encodeURIComponent(sujetUrl)}&embedded=true`;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <FloatingTimer />
        <div className="flex flex-col h-[calc(100vh-80px)] exam-secure-content">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldAlert className="h-3 w-3" /> Surveillé
              </Badge>
            </div>
          </div>

          {/* Content: Subject viewer + Editor */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Subject viewer */}
            <div className="lg:w-1/2 h-[40vh] lg:h-full border-b lg:border-b-0 lg:border-r">
              <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Sujet : {activeSujet?.nom}</span>
              </div>
              <iframe src={viewerUrl} className="w-full h-[calc(100%-40px)]" title="Sujet" />
            </div>

            {/* Rich text editor */}
            <div className="lg:w-1/2 flex flex-col flex-1">
              {/* Toolbar */}
              <div className="px-3 py-2 border-b bg-muted/20 flex items-center gap-1 flex-wrap">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('bold')} title="Gras">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('italic')} title="Italique">
                  <Italic className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('underline')} title="Souligné">
                  <Underline className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('insertUnorderedList')} title="Liste">
                  <List className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('superscript')} title="Exposant">
                  <Superscript className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('subscript')} title="Indice">
                  <Subscript className="h-4 w-4" />
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={insertImage} title="Insérer image">
                  <Image className="h-4 w-4 mr-1" /> Image
                </Button>
                <div className="w-px h-5 bg-border mx-1" />
                {/* Math symbols */}
                <div className="flex items-center gap-0.5">
                  <span className="text-xs text-muted-foreground mr-1">Maths:</span>
                  {['√', '∑', '∫', 'π', '∞', '≤', '≥', '≠', '±', 'α', 'β', 'Δ', 'θ', '∈', '∪', '∩', '→', '⇒', 'ƒ', '∂'].map(sym => (
                    <Button key={sym} variant="ghost" size="icon" className="h-7 w-7 text-xs font-mono" onClick={() => insertMathSymbol(sym)}>
                      {sym}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Editor area */}
              <div
                ref={editorRef}
                contentEditable
                className="flex-1 p-4 overflow-y-auto outline-none prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded"
                style={{ minHeight: '200px' }}
                data-placeholder="Rédigez votre réponse ici..."
              />

              {/* Photo capture */}
              <div className="px-3 py-2 border-t bg-muted/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">📸 Joindre des photos</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={capturePhoto}>
                    <Camera className="h-3 w-3 mr-1" /> Photo
                  </Button>
                </div>
                {photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map(p => (
                      <div key={p.id} className="relative shrink-0 group">
                        <img src={p.dataUrl} alt="Photo" className="h-16 w-20 object-cover rounded border" />
                        <Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removePhoto(p.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 border-t bg-background/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.15)]">
                <Button className="w-full h-12 text-base font-bold" size="lg" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                  ✅ Soumettre ma réponse
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Active exam view - Texte type (questions with free text answers) — one at a time
  if (activeComp && activeType === 'texte') {
    const total = activeQuestions.length;
    const answered = Object.keys(answers).filter(k => answers[k]?.trim()).length;
    const progress = total > 0 ? ((currentQIndex + 1) / total) * 100 : 0;
    const q = activeQuestions[currentQIndex];
    const isLast = currentQIndex >= total - 1;
    const isFirst = currentQIndex === 0;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <FloatingTimer />
        <div className="max-w-3xl mx-auto space-y-4 p-4 pb-36 exam-secure-content">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <ShieldAlert className="h-3 w-3" /> Surveillé
            </Badge>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>Question {currentQIndex + 1}/{total} — {answered}/{total} répondue(s)</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex gap-[2px]">
              {activeQuestions.map((_: any, i: number) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    answers[activeQuestions[i]?.id]?.trim()
                      ? 'bg-emerald-500'
                      : i === currentQIndex
                        ? 'bg-primary animate-pulse'
                        : 'bg-muted'
                  }`}
                />
              ))}
            </div>
            {/* Question dots */}
            <div className="flex gap-1 justify-center pt-2 flex-wrap">
              {activeQuestions.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIndex(i)}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                    i === currentQIndex
                      ? 'bg-primary text-primary-foreground scale-110 shadow-md'
                      : answers[activeQuestions[i]?.id]?.trim()
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Current question */}
          {q && (
            <Card className={`border-2 ${answers[q.id]?.trim() ? 'border-primary/30' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Badge className="shrink-0 mt-1 bg-primary text-primary-foreground">{currentQIndex + 1}</Badge>
                    <div className="flex-1">
                      <p className="font-semibold text-base"><MathText text={q.enonce} /></p>
                      <Badge variant="secondary" className="text-xs mt-2">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                    </div>
                  </div>
                  <Textarea
                    placeholder="Rédigez votre réponse ici..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    onPaste={() => toast.success('Formule collée')}
                    rows={6}
                    className="resize-y text-base"
                    data-allow-exam-paste="true"
                    autoFocus
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Photos section - only on last question */}
          {isLast && (
            <Card className="border-dashed">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">📸 Photos de votre travail</span>
                  <Button variant="outline" size="sm" onClick={capturePhoto}>
                    <Camera className="h-4 w-4 mr-1" /> Photo
                  </Button>
                </div>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map(p => (
                      <div key={p.id} className="relative group">
                        <img src={p.dataUrl} alt="Photo" className="w-full h-24 object-cover rounded-lg border" />
                        <Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => removePhoto(p.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fixed bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md py-3 px-4 border-t shadow-[0_-4px_16px_rgba(0,0,0,0.15)]">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <Button variant="outline" className="h-12 px-4" onClick={() => setCurrentQIndex(i => i - 1)} disabled={isFirst}>
                <ChevronLeft className="h-5 w-5 mr-1" /> Précédent
              </Button>
              <div className="flex-1" />
              {isLast ? (
                <Button className="h-12 px-6 text-base font-bold" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                  Soumettre ({answered}/{total})
                </Button>
              ) : (
                <Button className="h-12 px-6 text-base font-bold" onClick={() => setCurrentQIndex(i => i + 1)}>
                  Suivant <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Active exam view - QCM type — one at a time
  if (activeComp) {
    const total = activeQuestions.length;
    const answered = Object.keys(answers).length;
    const progress = total > 0 ? ((currentQIndex + 1) / total) * 100 : 0;
    const q = activeQuestions[currentQIndex];
    const isLast = currentQIndex >= total - 1;
    const isFirst = currentQIndex === 0;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <FloatingTimer />
        <div className="max-w-3xl mx-auto space-y-4 p-4 pb-36 exam-secure-content">
          <div className="flex items-center justify-between py-3 border-b">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <ShieldAlert className="h-3 w-3" /> Surveillé
            </Badge>
          </div>

          {/* Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Question {currentQIndex + 1}/{total}</span>
              <span>{answered}/{total} répondue(s)</span>
            </div>
            <Progress value={progress} className="h-2" />
            {/* Question dots */}
            <div className="flex gap-1 justify-center pt-2 flex-wrap">
              {activeQuestions.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIndex(i)}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
                    i === currentQIndex
                      ? 'bg-primary text-primary-foreground scale-110 shadow-md'
                      : answers[activeQuestions[i]?.id]
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Current question */}
          {q && (
            <Card className={`border-2 ${answers[q.id] ? 'border-primary/30' : 'border-border'}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Badge className="shrink-0 mt-1 bg-primary text-primary-foreground">{currentQIndex + 1}</Badge>
                  <div className="flex-1 space-y-4">
                    <p className="font-semibold text-base"><MathText text={q.enonce} /></p>
                    <Badge variant="secondary" className="text-xs">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                    <RadioGroup value={answers[q.id] || ''} onValueChange={v => {
                      setAnswers(prev => ({ ...prev, [q.id]: v }));
                      // Auto-advance after selecting an answer (with small delay)
                      if (!isLast) {
                        setTimeout(() => setCurrentQIndex(i => i + 1), 400);
                      }
                    }}>
                      {(q.options || []).map((opt: any, oi: number) => (
                        <div key={oi} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          answers[q.id] === opt.label
                            ? 'border-primary bg-primary/5 shadow-sm'
                            : 'border-border hover:border-primary/30 hover:bg-accent/30'
                        }`}>
                          <RadioGroupItem value={opt.label} id={`q${q.id}_${oi}`} />
                          <Label htmlFor={`q${q.id}_${oi}`} className="cursor-pointer flex-1 text-sm font-medium"><MathText text={opt.label} /></Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Fixed bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md py-3 px-4 border-t shadow-[0_-4px_16px_rgba(0,0,0,0.15)]">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <Button variant="outline" className="h-12 px-4" onClick={() => setCurrentQIndex(i => i - 1)} disabled={isFirst}>
                <ChevronLeft className="h-5 w-5 mr-1" /> Précédent
              </Button>
              <div className="flex-1" />
              {isLast ? (
                <Button className="h-12 px-6 text-base font-bold" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  Soumettre ({answered}/{total})
                </Button>
              ) : (
                <Button className="h-12 px-6 text-base font-bold" onClick={() => setCurrentQIndex(i => i + 1)}>
                  Suivant <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  return (
    <StudentLayout>
      <div className="p-4 space-y-4 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold">📝 Compositions</h1>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : compositions.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune composition disponible</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {compositions.map((comp: any) => {
              const status = getStatus(comp);
              const rep = reponses.find((r: any) => r.composition_id === comp.id);
              const isDocument = comp.type_composition === 'document';
              const isTexte = comp.type_composition === 'texte';

              return (
                <Card key={comp.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{comp.titre}</h3>
                          <Badge variant="outline" className="text-xs">
                            {isDocument ? '📄 Document' : comp.type_composition === 'texte' ? '✍️ Texte' : '📝 QCM'}
                          </Badge>
                          {status === 'done' && <Badge className="bg-emerald-100 text-emerald-700">Terminée</Badge>}
                          {status === 'in_progress' && <Badge className="bg-amber-100 text-amber-700">En cours</Badge>}
                          {status === 'expired' && <Badge variant="destructive">Expirée</Badge>}
                          {status === 'upcoming' && <Badge variant="secondary">À venir</Badge>}
                          {status === 'available' && <Badge className="bg-blue-100 text-blue-700">Disponible</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{comp.matieres?.nom} • {comp.duree_minutes} min • /{comp.bareme}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(comp.date_debut).toLocaleDateString('fr')} {new Date(comp.date_debut).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })} → {new Date(comp.date_fin).toLocaleDateString('fr')} {new Date(comp.date_fin).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {status === 'upcoming' && (() => {
                          const countdown = getCountdown(comp);
                          return countdown ? (
                            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20 animate-pulse">
                              <Timer className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold font-mono text-primary">Début dans {countdown}</span>
                            </div>
                          ) : null;
                        })()}
                        {status === 'done' && rep && !isDocument && !isTexte && (
                          <p className="text-sm font-bold mt-2 text-primary">Score : {rep.score}/{comp.bareme}</p>
                        )}
                        {status === 'done' && rep && (isDocument || isTexte) && (
                          <p className="text-sm font-bold mt-2 text-primary">
                            {rep.score != null ? `Note : ${rep.score}/${comp.bareme}` : 'En attente de correction'}
                          </p>
                        )}
                      </div>
                      <div>
                        {(status === 'available' || status === 'in_progress') && (
                          <Button size="sm" onClick={() => startComposition(comp)}>
                            {status === 'in_progress' ? 'Reprendre' : 'Commencer'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </StudentLayout>
  );
}
