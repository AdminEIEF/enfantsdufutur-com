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
import { Loader2, Clock, CheckCircle2, Timer, FileText, Bold, Italic, Underline, List, Image, Superscript, Subscript, Send, ShieldAlert, PenLine } from 'lucide-react';
import { useExamSecurity } from '@/hooks/useExamSecurity';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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
  });

  useEffect(() => {
    if (session) fetchCompositions();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [session]);

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
      if (activeType === 'document') {
        const htmlContent = editorRef.current?.innerHTML || '';
        if (!autoSubmit && !htmlContent.trim()) {
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
        // Build HTML from text answers
        const textParts = activeQuestions.map((q: any, idx: number) => {
          const answer = answers[q.id] || '';
          return `<div><strong>Q${idx + 1}: ${q.enonce}</strong><br/>${answer.replace(/\n/g, '<br/>')}</div>`;
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
          reponse_texte: textParts,
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
      fetchCompositions();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [activeComp, activeQuestions, answers, submitting, session, activeType]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const getStatus = (comp: any) => {
    const rep = reponses.find((r: any) => r.composition_id === comp.id);
    if (rep?.soumis_at) return 'done';
    if (rep) return 'in_progress';
    const now = new Date();
    if (new Date(comp.date_fin) < now) return 'expired';
    if (new Date(comp.date_debut) > now) return 'upcoming';
    return 'available';
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

  // Active exam view - Document type
  if (activeComp && activeType === 'document') {
    const isUrgent = timeLeft < 60;
    const sujetUrl = activeSujet?.url || '';
    const isPdf = sujetUrl.toLowerCase().includes('.pdf');
    const viewerUrl = isPdf
      ? sujetUrl
      : `https://docs.google.com/gview?url=${encodeURIComponent(sujetUrl)}&embedded=true`;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <div className="flex flex-col h-[calc(100vh-80px)] exam-secure-content">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2 border-b bg-background shrink-0">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <div className="flex items-center gap-2">
              {violations > 0 && (
                <Badge variant="destructive" className="text-xs">⚠️ {violations}/2</Badge>
              )}
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldAlert className="h-3 w-3" /> Surveillé
              </Badge>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-lg font-bold ${isUrgent ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
                <Timer className="h-5 w-5" />
                {formatTime(timeLeft)}
              </div>
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

              {/* Submit */}
              <div className="px-4 py-3 border-t bg-background">
                <Button className="w-full" size="lg" onClick={() => handleSubmit(false)} disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Soumettre ma réponse
                </Button>
              </div>
            </div>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Active exam view - Texte type (questions with free text answers)
  if (activeComp && activeType === 'texte') {
    const progress = activeQuestions.length > 0
      ? (Object.keys(answers).filter(k => answers[k]?.trim()).length / activeQuestions.length) * 100 : 0;
    const isUrgent = timeLeft < 60;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <div className="max-w-3xl mx-auto space-y-4 p-4 exam-secure-content">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom} • /{activeComp.bareme}</p>
            </div>
            <div className="flex items-center gap-2">
              {violations > 0 && (
                <Badge variant="destructive" className="text-xs">⚠️ {violations}/2</Badge>
              )}
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldAlert className="h-3 w-3" /> Surveillé
              </Badge>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-lg font-bold ${isUrgent ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
                <Timer className="h-5 w-5" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{Object.keys(answers).filter(k => answers[k]?.trim()).length}/{activeQuestions.length} répondue(s)</p>

          <div className="space-y-4">
            {activeQuestions.map((q: any, idx: number) => (
              <Card key={q.id} className={answers[q.id]?.trim() ? 'border-primary/30' : ''}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0 mt-1">{idx + 1}</Badge>
                      <div className="flex-1">
                        <p className="font-medium">{q.enonce}</p>
                        <Badge variant="secondary" className="text-xs mt-1">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                    <Textarea
                      placeholder="Rédigez votre réponse ici..."
                      value={answers[q.id] || ''}
                      onChange={e => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={4}
                      className="resize-y"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-0 bg-background py-4 border-t">
            <Button className="w-full" size="lg" onClick={() => handleSubmit(false)} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Soumettre la composition
            </Button>
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Active exam view - QCM type
  if (activeComp) {
    const progress = activeQuestions.length > 0
      ? (Object.keys(answers).length / activeQuestions.length) * 100 : 0;
    const isUrgent = timeLeft < 60;

    return (
      <StudentLayout>
        {violationWarningDialog}
        <div className="max-w-3xl mx-auto space-y-4 p-4 exam-secure-content">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom}</p>
            </div>
            <div className="flex items-center gap-2">
              {violations > 0 && (
                <Badge variant="destructive" className="text-xs">⚠️ {violations}/2</Badge>
              )}
              <Badge variant="outline" className="text-xs gap-1">
                <ShieldAlert className="h-3 w-3" /> Surveillé
              </Badge>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-lg font-bold ${isUrgent ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
                <Timer className="h-5 w-5" />
                {formatTime(timeLeft)}
              </div>
            </div>
          </div>

          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-right">{Object.keys(answers).length}/{activeQuestions.length} répondue(s)</p>

          <div className="space-y-4">
            {activeQuestions.map((q: any, idx: number) => (
              <Card key={q.id} className={answers[q.id] ? 'border-primary/30' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Badge variant="outline" className="shrink-0 mt-1">{idx + 1}</Badge>
                    <div className="flex-1 space-y-3">
                      <p className="font-medium">{q.enonce}</p>
                      <Badge variant="secondary" className="text-xs">{q.points} pt{q.points > 1 ? 's' : ''}</Badge>
                      <RadioGroup value={answers[q.id] || ''} onValueChange={v => setAnswers(prev => ({ ...prev, [q.id]: v }))}>
                        {(q.options || []).map((opt: any, oi: number) => (
                          <div key={oi} className="flex items-center gap-2 p-2 rounded hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value={opt.label} id={`q${q.id}_${oi}`} />
                            <Label htmlFor={`q${q.id}_${oi}`} className="cursor-pointer flex-1">{opt.label}</Label>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="sticky bottom-0 bg-background py-4 border-t">
            <Button className="w-full" size="lg" onClick={() => handleSubmit(false)} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Soumettre la composition
            </Button>
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
                          {new Date(comp.date_debut).toLocaleDateString('fr')} → {new Date(comp.date_fin).toLocaleDateString('fr')}
                        </p>
                        {status === 'done' && rep && !isDocument && (
                          <p className="text-sm font-bold mt-2 text-primary">Score : {rep.score}/{comp.bareme}</p>
                        )}
                        {status === 'done' && rep && isDocument && (
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
