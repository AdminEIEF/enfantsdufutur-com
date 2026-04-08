import { useState, useEffect, useRef, useCallback } from 'react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Loader2, Clock, CheckCircle2, Timer, FileText, Bold, Italic, Underline, List, Image, Superscript, Subscript, Send, ShieldAlert, Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useExamSecurity } from '@/hooks/useExamSecurity';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MathText } from '@/components/MathText';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentCompositions() {
  const { session } = useStudentAuth();
  const [compositions, setCompositions] = useState<any[]>([]);
  const [reponses, setReponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComp, setActiveComp] = useState<any>(null);
  const [activeType, setActiveType] = useState<string>('qcm');
  const [activeQuestions, setActiveQuestions] = useState<any[]>([]);
  const [activeSujet, setActiveSujet] = useState<{ url: string; nom: string } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
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
  const [listTab, setListTab] = useState<'active' | 'history'>('active');

  const capturePhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast.error('Image trop volumineuse (max 10 Mo)'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setPhotos(prev => [...prev, { id: `photo_${Date.now()}`, dataUrl: ev.target?.result as string }]);
        toast.success('📸 Photo ajoutée !');
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const removePhoto = (id: string) => setPhotos(prev => prev.filter(p => p.id !== id));

  const handleSecurityViolation = useCallback((reason: string) => {
    if (blockedRef.current) return;
    setViolations(prev => {
      const newCount = prev + 1;
      if (newCount >= 2) {
        blockedRef.current = true;
        setBlocked(true);
        handleSubmit(true);
        toast.error('⛔ Accès bloqué !');
      } else {
        const reasons: Record<string, string> = { tab_switch: 'Vous avez quitté l\'onglet', window_blur: 'Vous avez quitté la fenêtre', screenshot_attempt: 'Capture d\'écran détectée' };
        setWarningReason(reasons[reason] || 'Activité suspecte');
        setWarningOpen(true);
        toast.warning(`⚠️ Avertissement ${newCount}/2`);
      }
      return newCount;
    });
  }, []);

  useExamSecurity({ isActive: !!activeComp && !blocked, onViolation: handleSecurityViolation, maxViolations: 2, allowPasteInEditable: true });

  useEffect(() => {
    if (!session) return;
    fetchCompositions();
    const refreshId = setInterval(() => { if (!activeComp) fetchCompositions(); }, 2000);
    return () => { clearInterval(refreshId); if (timerRef.current) clearInterval(timerRef.current); };
  }, [session, activeComp]);

  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 1000); return () => clearInterval(id); }, []);

  const callApi = async (action: string, extra: any = {}) => {
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ token: session!.token, action, ...extra }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erreur');
    return data;
  };

  async function fetchCompositions() {
    try { setLoading(true); const data = await callApi('compositions'); setCompositions(data.compositions || []); setReponses(data.reponses || []); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }

  async function startComposition(comp: any) {
    try {
      const data = await callApi('start_composition', { composition_id: comp.id });
      setActiveComp(comp); setActiveType(data.type_composition || 'qcm'); setAnswers({}); setCurrentQIndex(0);
      if (data.type_composition === 'document') { setActiveSujet({ url: data.sujet_url, nom: data.sujet_nom }); setActiveQuestions([]); }
      else { setActiveQuestions(data.questions || []); setActiveSujet(null); }
      const debut = new Date(data.debut_at).getTime();
      const remaining = Math.max(0, Math.floor((comp.duree_minutes * 60 * 1000 - (Date.now() - debut)) / 1000));
      setTimeLeft(remaining);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => { if (prev <= 1) { if (timerRef.current) clearInterval(timerRef.current); handleSubmit(true); return 0; } return prev - 1; });
      }, 1000);
    } catch (e: any) { toast.error(e.message); }
  }

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submitting) return;
    setSubmitting(true);
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      const photosHtml = photos.length > 0 ? '<hr/><h3>📸 Photos</h3>' + photos.map((p, i) => `<div><p>Photo ${i + 1}:</p><img src="${p.dataUrl}" style="max-width:100%;margin:8px 0;border-radius:8px;" /></div>`).join('') : '';
      if (activeType === 'document') {
        const htmlContent = (editorRef.current?.innerHTML || '') + photosHtml;
        if (!autoSubmit && !htmlContent.trim() && photos.length === 0 && !confirm('Réponse vide. Soumettre ?')) { setSubmitting(false); return; }
        await callApi('submit_composition', { composition_id: activeComp.id, reponse_texte: htmlContent });
        toast.success('Composition soumise !');
      } else if (activeType === 'texte') {
        const textPayload = activeQuestions.map((q: any, idx: number) => ({ question_id: q.id, ordre: idx + 1, question: q.enonce, answer: (String(answers[q.id] || '')).trim(), points: q.points }));
        const textParts = textPayload.map(item => {
          const sq = item.question.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const sa = item.answer.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>');
          return `<div><strong>Q${item.ordre}: ${sq}</strong><br/>${sa || '<em>Aucune réponse</em>'}</div>`;
        }).join('<hr/>');
        if (!autoSubmit) { const unanswered = activeQuestions.filter((q: any) => !String(answers[q.id] || '').trim()); if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) sans réponse. Soumettre ?`)) { setSubmitting(false); return; } }
        await callApi('submit_composition', { composition_id: activeComp.id, reponse_texte: textParts + photosHtml, reponses: textPayload });
        toast.success('Composition soumise !');
      } else {
        if (!autoSubmit) { const unanswered = activeQuestions.filter(q => !answers[q.id]); if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) sans réponse. Soumettre ?`)) { setSubmitting(false); return; } }
        const data = await callApi('submit_composition', { composition_id: activeComp.id, reponses: answers });
        toast.success(`Score : ${data.score}/${data.bareme}`);
      }
      setActiveComp(null); setActiveQuestions([]); setActiveSujet(null); setPhotos([]); fetchCompositions();
    } catch (e: any) { toast.error(e.message); } finally { setSubmitting(false); }
  }, [activeComp, activeQuestions, answers, submitting, session, activeType, photos]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

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
    const d = Math.floor(totalSec / 86400); const h = Math.floor((totalSec % 86400) / 3600); const m = Math.floor((totalSec % 3600) / 60); const s = totalSec % 60;
    if (d > 0) return `${d}j ${h}h ${m}m ${s}s`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const execCmd = (cmd: string, value?: string) => { document.execCommand(cmd, false, value); editorRef.current?.focus(); };
  const insertImage = () => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*';
    input.onchange = (e: any) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 Mo'); return; }
      const reader = new FileReader(); reader.onload = (ev) => { execCmd('insertImage', ev.target?.result as string); }; reader.readAsDataURL(file); }; input.click();
  };
  const insertMathSymbol = (symbol: string) => { execCmd('insertHTML', `<span style="font-family:'Times New Roman',serif;font-style:italic;">${symbol}</span>`); };

  // ─── Floating Timer ───
  const FloatingTimer = () => {
    const isUrgent = timeLeft < 60;
    const isWarning = timeLeft < 180 && timeLeft >= 60;
    return (
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
        {violations > 0 && <Badge variant="destructive" className="text-xs ml-1">⚠️ {violations}/2</Badge>}
      </motion.div>
    );
  };

  // ─── Warning dialog ───
  const violationWarningDialog = (
    <Dialog open={warningOpen} onOpenChange={setWarningOpen}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> Avertissement !</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="font-medium">{warningReason}</p>
          <p className="text-sm text-muted-foreground"><strong>Attention :</strong> Prochain quittage = blocage automatique.</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <span className="text-2xl">⚠️</span>
            <p className="text-xs font-semibold text-destructive">Avertissement {violations}/2</p>
          </div>
        </div>
        <Button onClick={() => setWarningOpen(false)} className="w-full rounded-xl">J'ai compris</Button>
      </DialogContent>
    </Dialog>
  );

  // ─── Blocked screen ───
  if (blocked && activeComp) {
    return (
      <StudentLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md w-full border-destructive/50 rounded-3xl">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <ShieldAlert className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-destructive">Accès Bloqué</h2>
              <p className="text-muted-foreground">Votre copie a été automatiquement soumise.</p>
              <Button variant="outline" className="rounded-xl" onClick={() => { setBlocked(false); setActiveComp(null); blockedRef.current = false; setViolations(0); fetchCompositions(); }}>
                Retour
              </Button>
            </CardContent>
          </Card>
        </div>
      </StudentLayout>
    );
  }

  // ─── Document exam view ───
  if (activeComp && activeType === 'document') {
    const sujetUrl = activeSujet?.url || '';
    const isPdf = sujetUrl.toLowerCase().includes('.pdf');
    const viewerUrl = isPdf ? sujetUrl : `https://docs.google.com/gview?url=${encodeURIComponent(sujetUrl)}&embedded=true`;
    return (
      <StudentLayout>
        {violationWarningDialog}
        <FloatingTimer />
        <div className="flex flex-col h-[calc(100vh-80px)] exam-secure-content">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
            <div>
              <h2 className="font-bold text-base">{activeComp.titre}</h2>
              <p className="text-xs text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Surveillé</Badge>
          </div>
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            <div className="lg:w-1/2 h-[40vh] lg:h-full border-b lg:border-b-0 lg:border-r">
              <div className="px-3 py-2 bg-muted/30 border-b flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="text-sm font-medium">Sujet : {activeSujet?.nom}</span>
              </div>
              <iframe src={viewerUrl} className="w-full h-[calc(100%-40px)]" title="Sujet" />
            </div>
            <div className="lg:w-1/2 flex flex-col flex-1">
              <div className="px-3 py-2 border-b bg-muted/20 flex items-center gap-1 flex-wrap">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('bold')}><Bold className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('italic')}><Italic className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('underline')}><Underline className="h-4 w-4" /></Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('insertUnorderedList')}><List className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('superscript')}><Superscript className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCmd('subscript')}><Subscript className="h-4 w-4" /></Button>
                <div className="w-px h-5 bg-border mx-1" />
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={insertImage}><Image className="h-4 w-4 mr-1" /> Image</Button>
                <div className="w-px h-5 bg-border mx-1" />
                <div className="flex items-center gap-0.5">
                  <span className="text-xs text-muted-foreground mr-1">Maths:</span>
                  {['√', '∑', '∫', 'π', '∞', '≤', '≥', '≠', '±', 'α', 'β', 'Δ', 'θ', '∈', '∪', '∩', '→', '⇒', 'ƒ', '∂'].map(sym => (
                    <Button key={sym} variant="ghost" size="icon" className="h-7 w-7 text-xs font-mono" onClick={() => insertMathSymbol(sym)}>{sym}</Button>
                  ))}
                </div>
              </div>
              <div ref={editorRef} contentEditable className="flex-1 p-4 overflow-y-auto outline-none prose prose-sm max-w-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded" style={{ minHeight: '200px' }} data-placeholder="Rédigez votre réponse..." />
              <div className="px-3 py-2 border-t bg-muted/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">📸 Photos</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg" onClick={capturePhoto}><Camera className="h-3 w-3 mr-1" /> Photo</Button>
                </div>
                {photos.length > 0 && <div className="flex gap-2 overflow-x-auto pb-1">{photos.map(p => (
                  <div key={p.id} className="relative shrink-0 group"><img src={p.dataUrl} alt="" className="h-16 w-20 object-cover rounded-lg border" /><Button variant="destructive" size="icon" className="absolute -top-1 -right-1 h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => removePhoto(p.id)}><X className="h-3 w-3" /></Button></div>
                ))}</div>}
              </div>
              <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 border-t bg-card/95 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.1)]">
                <Button className="w-full h-12 text-base font-bold rounded-2xl" size="lg" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                  Soumettre ma réponse
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // ─── Texte exam (one question at a time) ───
  if (activeComp && activeType === 'texte') {
    const total = activeQuestions.length;
    const answered = Object.keys(answers).filter(k => String(answers[k] || '').trim()).length;
    const progress = total > 0 ? ((currentQIndex + 1) / total) * 100 : 0;
    const q = activeQuestions[currentQIndex];
    const isLast = currentQIndex >= total - 1;
    const isFirst = currentQIndex === 0;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <FloatingTimer />
        <div className="max-w-2xl mx-auto space-y-4 p-4 pb-32 exam-secure-content">
          {/* Header */}
          <div className="flex items-center justify-between py-2">
            <div>
              <h2 className="font-bold text-base">{activeComp.titre}</h2>
              <p className="text-xs text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Surveillé</Badge>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>Question {currentQIndex + 1}/{total}</span>
              <span>{answered}/{total} répondue(s)</span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            {/* Question dots */}
            <div className="flex gap-1.5 justify-center pt-1 flex-wrap">
              {activeQuestions.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIndex(i)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    i === currentQIndex
                      ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                      : String(answers[activeQuestions[i]?.id] || '').trim()
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Question card */}
          {q && (
            <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{currentQIndex + 1}</div>
                    <Badge variant="secondary" className="text-[10px]">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                  </div>
                </div>
                <CardContent className="p-5 space-y-4">
                  <p className="font-semibold text-[15px] leading-relaxed"><MathText text={q.enonce} /></p>
                  <Textarea
                    placeholder="Rédigez votre réponse ici..."
                    value={answers[q.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                    onPaste={() => toast.success('Formule collée')}
                    rows={5}
                    className="resize-y text-base rounded-xl border-2 border-muted focus:border-primary transition-colors"
                    data-allow-exam-paste="true"
                    autoFocus
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Photos on last question */}
          {isLast && (
            <Card className="border-dashed border-2 rounded-2xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">📸 Photos de votre travail</span>
                  <Button variant="outline" size="sm" className="rounded-xl" onClick={capturePhoto}><Camera className="h-4 w-4 mr-1" /> Photo</Button>
                </div>
                {photos.length > 0 && <div className="grid grid-cols-3 gap-2">{photos.map(p => (
                  <div key={p.id} className="relative group"><img src={p.dataUrl} alt="" className="w-full h-24 object-cover rounded-xl border" /><Button variant="destructive" size="icon" className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 rounded-lg" onClick={() => removePhoto(p.id)}><X className="h-3 w-3" /></Button></div>
                ))}</div>}
              </CardContent>
            </Card>
          )}

          {/* Bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md py-3 px-4 border-t shadow-[0_-2px_16px_rgba(0,0,0,0.08)]">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <Button variant="outline" className="h-12 px-4 rounded-xl" onClick={() => setCurrentQIndex(i => i - 1)} disabled={isFirst}>
                <ChevronLeft className="h-5 w-5 mr-1" /> Préc.
              </Button>
              <div className="flex-1" />
              {isLast ? (
                <Button className="h-12 px-6 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />}
                  Soumettre ({answered}/{total})
                </Button>
              ) : (
                <Button className="h-12 px-6 text-base font-bold rounded-xl" onClick={() => setCurrentQIndex(i => i + 1)}>
                  Suivant <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // ─── QCM exam (one question at a time) ───
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
        <div className="max-w-2xl mx-auto space-y-4 p-4 pb-32 exam-secure-content">
          <div className="flex items-center justify-between py-2">
            <div>
              <h2 className="font-bold text-base">{activeComp.titre}</h2>
              <p className="text-xs text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <Badge variant="outline" className="text-[10px] gap-1"><ShieldAlert className="h-3 w-3" /> Surveillé</Badge>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
              <span>Question {currentQIndex + 1}/{total}</span>
              <span>{answered}/{total} répondue(s)</span>
            </div>
            <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <div className="flex gap-1.5 justify-center pt-1 flex-wrap">
              {activeQuestions.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setCurrentQIndex(i)}
                  className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                    i === currentQIndex
                      ? 'bg-primary text-primary-foreground scale-110 shadow-lg'
                      : answers[activeQuestions[i]?.id]
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Question card */}
          {q && (
            <motion.div key={q.id} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
              <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-5 py-3 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">{currentQIndex + 1}</div>
                  <Badge variant="secondary" className="text-[10px]">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                </div>
                <CardContent className="p-5 space-y-4">
                  <p className="font-semibold text-[15px] leading-relaxed"><MathText text={q.enonce} /></p>
                  {(() => {
                    // Detect multi-answer: reponse_correcte is a JSON array
                    let isMulti = false;
                    try {
                      const parsed = JSON.parse(q.reponse_correcte);
                      if (Array.isArray(parsed) && parsed.length >= 2) isMulti = true;
                    } catch {}

                    if (isMulti) {
                      const selected: string[] = Array.isArray(answers[q.id]) ? answers[q.id] as string[] : [];
                      return (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground italic">Plusieurs réponses possibles</p>
                          {(q.options || []).map((opt: any, oi: number) => {
                            const isChecked = selected.includes(opt.label);
                            return (
                              <motion.div key={oi} whileTap={{ scale: 0.97 }}>
                                <div
                                  onClick={() => {
                                    const newSel = isChecked ? selected.filter(s => s !== opt.label) : [...selected, opt.label];
                                    setAnswers(prev => ({ ...prev, [q.id]: newSel }));
                                  }}
                                  className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                                    isChecked
                                      ? 'border-primary bg-primary/5 shadow-md'
                                      : 'border-muted hover:border-primary/30 hover:bg-accent/20'
                                  }`}
                                >
                                  <input type="checkbox" checked={isChecked} readOnly className="rounded border-muted-foreground" />
                                  <span className="flex-1 text-sm font-medium"><MathText text={opt.label} /></span>
                                  {isChecked && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      );
                    }

                    return (
                      <RadioGroup value={String(answers[q.id] || '')} onValueChange={v => {
                        setAnswers(prev => ({ ...prev, [q.id]: v }));
                        if (!isLast) setTimeout(() => setCurrentQIndex(i => i + 1), 400);
                      }} className="space-y-2">
                        {(q.options || []).map((opt: any, oi: number) => (
                          <motion.div key={oi} whileTap={{ scale: 0.97 }}>
                            <label
                              htmlFor={`q${q.id}_${oi}`}
                              className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                                answers[q.id] === opt.label
                                  ? 'border-primary bg-primary/5 shadow-md'
                                  : 'border-muted hover:border-primary/30 hover:bg-accent/20'
                              }`}
                            >
                              <RadioGroupItem value={opt.label} id={`q${q.id}_${oi}`} />
                              <span className="flex-1 text-sm font-medium"><MathText text={opt.label} /></span>
                              {answers[q.id] === opt.label && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                            </label>
                          </motion.div>
                        ))}
                      </RadioGroup>
                    );
                  })()}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Bottom nav */}
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md py-3 px-4 border-t shadow-[0_-2px_16px_rgba(0,0,0,0.08)]">
            <div className="max-w-2xl mx-auto flex items-center gap-2">
              <Button variant="outline" className="h-12 px-4 rounded-xl" onClick={() => setCurrentQIndex(i => i - 1)} disabled={isFirst}>
                <ChevronLeft className="h-5 w-5 mr-1" /> Préc.
              </Button>
              <div className="flex-1" />
              {isLast ? (
                <Button className="h-12 px-6 text-base font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                  Soumettre ({answered}/{total})
                </Button>
              ) : (
                <Button className="h-12 px-6 text-base font-bold rounded-xl" onClick={() => setCurrentQIndex(i => i + 1)}>
                  Suivant <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // ─── Compositions list ───

  const activeComps = compositions.filter((c: any) => {
    const s = getStatus(c);
    return s === 'available' || s === 'in_progress' || s === 'upcoming';
  });
  const historyComps = compositions.filter((c: any) => {
    const s = getStatus(c);
    return s === 'done' || s === 'expired';
  });

  const renderCompCard = (comp: any, i: number) => {
    const status = getStatus(comp);
    const rep = reponses.find((r: any) => r.composition_id === comp.id);
    const isDocument = comp.type_composition === 'document';
    const isTexte = comp.type_composition === 'texte';

    const statusConfig: Record<string, { label: string; className: string }> = {
      done: { label: '✅ Terminée', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
      in_progress: { label: '⏳ En cours', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      expired: { label: '❌ Expirée', className: 'bg-destructive/10 text-destructive' },
      upcoming: { label: '🕐 À venir', className: 'bg-muted text-muted-foreground' },
      available: { label: '🟢 Disponible', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    };
    const sc = statusConfig[status] || statusConfig.available;

    return (
      <motion.div key={comp.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-shadow">
          <CardContent className="p-0">
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm">{comp.titre}</h3>
                    <Badge variant="outline" className="text-[10px]">
                      {isDocument ? '📄 Document' : isTexte ? '✍️ Texte' : '📝 QCM'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{comp.matieres?.nom} • {comp.duree_minutes} min • /{comp.bareme}</p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${sc.className}`}>{sc.label}</Badge>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                {new Date(comp.date_debut).toLocaleDateString('fr')} {new Date(comp.date_debut).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })} → {new Date(comp.date_fin).toLocaleTimeString('fr', { hour: '2-digit', minute: '2-digit' })}
              </div>

              {status === 'upcoming' && (() => {
                const countdown = getCountdown(comp);
                return countdown ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/5 border border-primary/20">
                    <Timer className="h-4 w-4 text-primary animate-pulse" />
                    <span className="text-xs font-bold font-mono text-primary">Début dans {countdown}</span>
                  </div>
                ) : null;
              })()}

              {status === 'done' && rep && (
                <p className="text-sm font-bold text-primary">
                  {!isDocument && !isTexte ? `Score : ${rep.score}/${comp.bareme}` : rep.score != null ? `Note : ${rep.score}/${comp.bareme}` : '⏳ En attente de correction'}
                </p>
              )}

              {(status === 'available' || status === 'in_progress') && (
                <Button size="sm" className="w-full rounded-xl h-10 font-bold" onClick={() => startComposition(comp)}>
                  {status === 'in_progress' ? '▶️ Reprendre' : '🚀 Commencer'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <StudentLayout>
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <h1 className="text-lg font-bold text-foreground">📝 Compositions</h1>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-muted/60 rounded-2xl">
          <button
            onClick={() => setListTab('active')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              listTab === 'active'
                ? 'bg-card shadow-md text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🟢 Actives ({activeComps.length})
          </button>
          <button
            onClick={() => setListTab('history')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
              listTab === 'history'
                ? 'bg-card shadow-md text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            📋 Historique ({historyComps.length})
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <AnimatePresence mode="wait">
            {listTab === 'active' ? (
              <motion.div key="active" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="space-y-3">
                {activeComps.length === 0 ? (
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Aucune composition active</p>
                    </CardContent>
                  </Card>
                ) : activeComps.map(renderCompCard)}
              </motion.div>
            ) : (
              <motion.div key="history" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                {historyComps.length === 0 ? (
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Aucun historique de composition</p>
                    </CardContent>
                  </Card>
                ) : historyComps.map(renderCompCard)}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </StudentLayout>
  );
}
