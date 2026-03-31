import { useState, useEffect, useRef, useCallback } from 'react';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { Loader2, Clock, FileQuestion, CheckCircle2, AlertTriangle, Timer } from 'lucide-react';

export default function StudentCompositions() {
  const { session } = useStudentAuth();
  const [compositions, setCompositions] = useState<any[]>([]);
  const [reponses, setReponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeComp, setActiveComp] = useState<any>(null);
  const [activeQuestions, setActiveQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      setActiveQuestions(data.questions || []);
      setAnswers({});

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

    if (!autoSubmit) {
      const unanswered = activeQuestions.filter(q => !answers[q.id]);
      if (unanswered.length > 0 && !confirm(`${unanswered.length} question(s) sans réponse. Soumettre quand même ?`)) {
        setSubmitting(false);
        return;
      }
    }

    try {
      const data = await callApi('submit_composition', {
        composition_id: activeComp.id,
        reponses: answers,
      });
      toast.success(`Composition soumise ! Score : ${data.score}/${data.bareme}`);
      setActiveComp(null);
      setActiveQuestions([]);
      fetchCompositions();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSubmitting(false);
    }
  }, [activeComp, activeQuestions, answers, submitting, session]);

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

  // Active exam view
  if (activeComp) {
    const progress = activeQuestions.length > 0
      ? (Object.keys(answers).length / activeQuestions.length) * 100 : 0;
    const isUrgent = timeLeft < 60;

    return (
      <StudentLayout>
        <div className="max-w-3xl mx-auto space-y-4 p-4">
          <div className="flex items-center justify-between sticky top-0 z-10 bg-background py-3 border-b">
            <div>
              <h2 className="font-bold text-lg">{activeComp.titre}</h2>
              <p className="text-sm text-muted-foreground">{activeComp.matieres?.nom}</p>
            </div>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-lg font-bold ${isUrgent ? 'bg-destructive/10 text-destructive animate-pulse' : 'bg-primary/10 text-primary'}`}>
              <Timer className="h-5 w-5" />
              {formatTime(timeLeft)}
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

              return (
                <Card key={comp.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{comp.titre}</h3>
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
                        {status === 'done' && rep && (
                          <p className="text-sm font-bold mt-2 text-primary">Score : {rep.score}/{comp.bareme}</p>
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
