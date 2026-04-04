import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { ClipboardList, Upload, CheckCircle, Clock, AlertTriangle, Loader2, FileText, ListChecks, Send, XCircle, ChevronRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';

export default function StudentDevoirs() {
  const { session } = useStudentAuth();
  const [devoirs, setDevoirs] = useState<any[]>([]);
  const [soumissions, setSoumissions] = useState<any[]>([]);
  const [quizReponses, setQuizReponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevoirId, setSelectedDevoirId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'afaire' | 'soumis' | 'expires'>('afaire');
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, number>>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState<string | null>(null);

  useEffect(() => { if (session) fetchDevoirs(); }, [session]);

  const fetchDevoirs = async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session!.token, action: 'devoirs' }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setDevoirs(data.devoirs || []);
      setSoumissions(data.soumissions || []);
      setQuizReponses(data.quiz_reponses || []);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (devoirId: string, file: File) => {
    if (!file || !session) return;
    const ext = file.name.split('.').pop();
    const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx'];
    if (!allowed.includes(ext?.toLowerCase() || '')) { toast.error('Format : PDF, JPG, PNG, Word'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Max 10 Mo'); return; }

    setUploading(devoirId);
    try {
      const fileName = `${session.eleve.id}/${devoirId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('devoirs').upload(fileName, file);
      if (uploadError) throw uploadError;
      const { data: signedData } = await supabase.storage.from('devoirs').createSignedUrl(fileName, 31536000);
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session.token, action: 'submit_file', devoir_id: devoirId, fichier_url: signedData?.signedUrl || '', fichier_nom: file.name }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success('Devoir soumis ✅');
      fetchDevoirs();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmitQuiz = async (devoirId: string, questions: any[]) => {
    if (!session) return;
    const answers = quizAnswers[devoirId];
    if (!answers || Object.keys(answers).length === 0) { toast.error('Répondez à au moins une question'); return; }
    setSubmittingQuiz(devoirId);
    try {
      const reponses = questions.map(q => ({ question_id: q.id, answer_index: answers[q.id] ?? -1 }));
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ token: session.token, action: 'submit_quiz', devoir_id: devoirId, reponses }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      toast.success(`Score : ${result.score}/${result.score_max}`);
      fetchDevoirs();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSubmittingQuiz(null);
    }
  };

  const setAnswer = (devoirId: string, questionId: string, answerIndex: number) => {
    setQuizAnswers(prev => ({ ...prev, [devoirId]: { ...(prev[devoirId] || {}), [questionId]: answerIndex } }));
  };

  const aFaire = devoirs.filter(d => {
    const expired = isPast(new Date(d.date_limite));
    const hasSubmission = d.type_devoir === 'quiz' ? quizReponses.find((r: any) => r.devoir_id === d.id) : soumissions.find((s: any) => s.devoir_id === d.id);
    return !expired && !hasSubmission;
  });
  const soumis = devoirs.filter(d => d.type_devoir === 'quiz' ? quizReponses.find((r: any) => r.devoir_id === d.id) : soumissions.find((s: any) => s.devoir_id === d.id));
  const expires = devoirs.filter(d => {
    const hasSubmission = d.type_devoir === 'quiz' ? quizReponses.find((r: any) => r.devoir_id === d.id) : soumissions.find((s: any) => s.devoir_id === d.id);
    return isPast(new Date(d.date_limite)) && !hasSubmission;
  });

  const tabs = [
    { key: 'afaire' as const, label: 'À faire', count: aFaire.length, gradient: 'from-amber-500 to-orange-500', icon: '📝' },
    { key: 'soumis' as const, label: 'Soumis', count: soumis.length, gradient: 'from-emerald-500 to-green-500', icon: '✅' },
    { key: 'expires' as const, label: 'Expirés', count: expires.length, gradient: 'from-red-500 to-rose-500', icon: '⏰' },
  ];

  const currentList = activeTab === 'afaire' ? aFaire : activeTab === 'soumis' ? soumis : expires;
  const canSubmit = activeTab === 'afaire';

  const renderDevoir = (d: any) => {
    const soumission = soumissions.find((s: any) => s.devoir_id === d.id);
    const quizReponse = quizReponses.find((r: any) => r.devoir_id === d.id);
    const isExpired = isPast(new Date(d.date_limite));
    const isQuiz = d.type_devoir === 'quiz';
    const hasAnswer = isQuiz ? !!quizReponse : !!soumission;

    return (
      <motion.div key={d.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 20 }}>
        <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
          <CardContent className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                hasAnswer ? 'bg-emerald-100 dark:bg-emerald-950/30' : isExpired ? 'bg-red-100 dark:bg-red-950/30' : 'bg-amber-100 dark:bg-amber-950/30'
              }`}>
                {isQuiz ? <ListChecks className={`h-5 w-5 ${hasAnswer ? 'text-emerald-600' : isExpired ? 'text-red-500' : 'text-amber-600'}`} /> :
                  <FileText className={`h-5 w-5 ${hasAnswer ? 'text-emerald-600' : isExpired ? 'text-red-500' : 'text-amber-600'}`} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm">{d.titre}</p>
                  {isQuiz && <Badge className="text-[9px] px-1.5 py-0 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400 border-0">Quiz</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground">{d.matieres?.nom}</p>
              </div>
              {hasAnswer ? (
                <Badge className="bg-emerald-500 text-white border-0 rounded-xl text-[10px] px-2"><CheckCircle className="h-3 w-3 mr-1" /> Soumis</Badge>
              ) : isExpired ? (
                <Badge className="bg-red-500 text-white border-0 rounded-xl text-[10px] px-2"><AlertTriangle className="h-3 w-3 mr-1" /> Expiré</Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-0 rounded-xl text-[10px] px-2">
                  <Clock className="h-3 w-3 mr-1" />
                  {formatDistanceToNow(new Date(d.date_limite), { addSuffix: true, locale: fr })}
                </Badge>
              )}
            </div>

            {d.description && <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-2.5 leading-relaxed">{d.description}</p>}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
              <span>📅 Limite : {new Date(d.date_limite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <span>📊 Note max : {d.note_max}</span>
            </div>

            {/* File result */}
            {!isQuiz && soumission && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-emerald-600" />
                  <a href={soumission.fichier_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline font-medium">{soumission.fichier_nom}</a>
                </div>
                {soumission.note !== null && <p className="text-sm font-bold">Note : {soumission.note}/{d.note_max}</p>}
                {soumission.commentaire && <p className="text-xs text-muted-foreground">💬 {soumission.commentaire}</p>}
              </div>
            )}

            {/* Quiz result */}
            {isQuiz && quizReponse && (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold">Score : {quizReponse.score}/{quizReponse.score_max}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(quizReponse.soumis_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</p>
                </div>
                {d.questions?.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-emerald-200/50">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Correction</p>
                    {d.questions.sort((a: any, b: any) => a.ordre - b.ordre).map((q: any, qi: number) => {
                      const studentReponses = quizReponse.reponses as any[];
                      const studentAnswer = studentReponses?.find((r: any) => r.question_id === q.id);
                      const answerIndex = studentAnswer?.answer_index ?? -1;
                      const options = q.options as any[];
                      return (
                        <div key={q.id} className="text-xs space-y-1">
                          <p className="font-medium"><span className="text-muted-foreground">{qi + 1}.</span> {q.question}</p>
                          <div className="ml-3 space-y-0.5">
                            {options.map((opt: any, oi: number) => {
                              const isSelected = oi === answerIndex;
                              const isCorrect = opt.correct;
                              return (
                                <div key={oi} className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[11px] ${
                                  isSelected && isCorrect ? 'bg-emerald-100 text-emerald-700 font-medium dark:bg-emerald-950/40 dark:text-emerald-400' :
                                  isSelected ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' :
                                  isCorrect ? 'text-emerald-600' : 'text-muted-foreground'
                                }`}>
                                  {isSelected && isCorrect && <CheckCircle className="h-3 w-3" />}
                                  {isSelected && !isCorrect && <XCircle className="h-3 w-3" />}
                                  {!isSelected && isCorrect && <CheckCircle className="h-3 w-3 opacity-50" />}
                                  {opt.label}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* File upload */}
            {!isQuiz && canSubmit && !soumission && (
              <div>
                <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  onChange={e => { const file = e.target.files?.[0]; if (file && selectedDevoirId) handleUpload(selectedDevoirId, file); e.target.value = ''; }} />
                <Button size="sm" className="rounded-xl w-full h-10 gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white border-0 shadow-md"
                  disabled={!!uploading} onClick={() => { setSelectedDevoirId(d.id); fileInputRef.current?.click(); }}>
                  {uploading === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Soumettre mon travail
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-1">PDF, JPG, PNG, Word</p>
              </div>
            )}

            {/* Quiz form */}
            {isQuiz && canSubmit && !quizReponse && d.questions?.length > 0 && (() => {
              const questions = d.questions.sort((a: any, b: any) => a.ordre - b.ordre);
              const answeredCount = Object.keys(quizAnswers[d.id] || {}).length;
              const progressPct = (answeredCount / questions.length) * 100;
              return (
                <div className="space-y-4 rounded-2xl p-4 bg-muted/30 border border-border/50">
                  {/* Progress */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
                      <span>📝 {answeredCount}/{questions.length} répondu(s)</span>
                      <span>{Math.round(progressPct)}%</span>
                    </div>
                    <div className="relative h-2.5 w-full rounded-full bg-secondary overflow-hidden">
                      <motion.div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-600" animate={{ width: `${progressPct}%` }} transition={{ type: 'spring', damping: 20 }} />
                    </div>
                  </div>

                  {questions.map((q: any, qi: number) => (
                    <div key={q.id} className="space-y-2">
                      <p className="text-sm font-semibold">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] mr-1.5">{qi + 1}</span>
                        {q.question}
                        <span className="text-[10px] text-muted-foreground ml-1">({q.points}pt{q.points > 1 ? 's' : ''})</span>
                      </p>
                      <RadioGroup value={String(quizAnswers[d.id]?.[q.id] ?? '')} onValueChange={v => setAnswer(d.id, q.id, Number(v))} className="ml-2 space-y-1.5">
                        {(q.options as any[]).map((opt: any, oi: number) => {
                          const isSelected = quizAnswers[d.id]?.[q.id] === oi;
                          return (
                            <div key={oi} className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                              isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-background hover:bg-muted/50'
                            }`}>
                              <RadioGroupItem value={String(oi)} id={`q-${q.id}-${oi}`} />
                              <Label htmlFor={`q-${q.id}-${oi}`} className="cursor-pointer text-sm flex-1">{opt.label}</Label>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  ))}

                  <Button className="w-full rounded-xl h-11 gap-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white border-0 shadow-md"
                    disabled={submittingQuiz === d.id} onClick={() => handleSubmitQuiz(d.id, d.questions)}>
                    {submittingQuiz === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Soumettre le quiz
                  </Button>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </motion.div>
    );
  };

  return (
    <StudentLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold">Mes devoirs</h2>
            <p className="text-xs text-muted-foreground">Travaux et quiz à rendre</p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Tab pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all ${
                    activeTab === tab.key
                      ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                    activeTab === tab.key ? 'bg-white/25' : 'bg-background'
                  }`}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3">
                {currentList.length === 0 ? (
                  <Card className="border-0 shadow-md rounded-2xl">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <span className="text-3xl mb-3 block">
                        {activeTab === 'afaire' ? '🎉' : activeTab === 'soumis' ? '📭' : '✨'}
                      </span>
                      <p className="text-sm">
                        {activeTab === 'afaire' ? 'Aucun devoir en cours' : activeTab === 'soumis' ? 'Aucune soumission' : 'Aucun devoir expiré'}
                      </p>
                    </CardContent>
                  </Card>
                ) : currentList.map(d => renderDevoir(d))}
              </motion.div>
            </AnimatePresence>
          </>
        )}
      </div>
      <StudentAIChat />
    </StudentLayout>
  );
}
