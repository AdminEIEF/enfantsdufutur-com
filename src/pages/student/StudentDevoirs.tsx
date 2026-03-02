import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { ClipboardList, Upload, CheckCircle, Clock, AlertTriangle, Loader2, FileText, ListChecks, Send } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, isPast } from 'date-fns';
import { fr } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export default function StudentDevoirs() {
  const { session } = useStudentAuth();
  const [devoirs, setDevoirs] = useState<any[]>([]);
  const [soumissions, setSoumissions] = useState<any[]>([]);
  const [quizReponses, setQuizReponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDevoirId, setSelectedDevoirId] = useState<string | null>(null);

  // Quiz state: { [devoirId]: { [questionId]: answerIndex } }
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<string, number>>>({});
  const [submittingQuiz, setSubmittingQuiz] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    fetchDevoirs();
  }, [session]);

  const fetchDevoirs = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token: session!.token, action: 'devoirs' }),
        }
      );
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
    if (!allowed.includes(ext?.toLowerCase() || '')) {
      toast.error('Format autorisé : PDF, JPG, PNG, Word (.doc, .docx)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Fichier trop volumineux (max 10 Mo)');
      return;
    }

    setUploading(devoirId);
    try {
      const fileName = `${session.eleve.id}/${devoirId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('devoirs').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage.from('devoirs').createSignedUrl(fileName, 31536000);

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            token: session.token,
            action: 'submit_file',
            devoir_id: devoirId,
            fichier_url: signedData?.signedUrl || '',
            fichier_nom: file.name,
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      toast.success('Devoir soumis avec succès !');
      fetchDevoirs();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setUploading(null);
    }
  };

  const handleSubmitQuiz = async (devoirId: string, questions: any[]) => {
    if (!session) return;
    const answers = quizAnswers[devoirId];
    if (!answers || Object.keys(answers).length === 0) {
      toast.error('Veuillez répondre à au moins une question');
      return;
    }

    setSubmittingQuiz(devoirId);
    try {
      const reponses = questions.map(q => ({
        question_id: q.id,
        answer_index: answers[q.id] ?? -1,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            token: session.token,
            action: 'submit_quiz',
            devoir_id: devoirId,
            reponses,
          }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);

      toast.success(`Quiz soumis ! Score : ${result.score}/${result.score_max}`);
      fetchDevoirs();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSubmittingQuiz(null);
    }
  };

  const setAnswer = (devoirId: string, questionId: string, answerIndex: number) => {
    setQuizAnswers(prev => ({
      ...prev,
      [devoirId]: { ...(prev[devoirId] || {}), [questionId]: answerIndex },
    }));
  };

  const aFaire = devoirs.filter(d => {
    const expired = isPast(new Date(d.date_limite));
    const hasSubmission = d.type_devoir === 'quiz' 
      ? quizReponses.find((r: any) => r.devoir_id === d.id)
      : soumissions.find((s: any) => s.devoir_id === d.id);
    return !expired && !hasSubmission;
  });
  const soumis = devoirs.filter(d => {
    return d.type_devoir === 'quiz'
      ? quizReponses.find((r: any) => r.devoir_id === d.id)
      : soumissions.find((s: any) => s.devoir_id === d.id);
  });
  const expires = devoirs.filter(d => {
    const hasSubmission = d.type_devoir === 'quiz'
      ? quizReponses.find((r: any) => r.devoir_id === d.id)
      : soumissions.find((s: any) => s.devoir_id === d.id);
    return isPast(new Date(d.date_limite)) && !hasSubmission;
  });

  const renderDevoir = (d: any, canSubmit: boolean) => {
    const soumission = soumissions.find((s: any) => s.devoir_id === d.id);
    const quizReponse = quizReponses.find((r: any) => r.devoir_id === d.id);
    const isExpired = isPast(new Date(d.date_limite));
    const isQuiz = d.type_devoir === 'quiz';
    const hasAnswer = isQuiz ? !!quizReponse : !!soumission;

    return (
      <Card key={d.id}>
        <CardContent className="py-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{d.titre}</p>
                {isQuiz && <Badge variant="default" className="gap-1 text-xs"><ListChecks className="h-3 w-3" /> Quiz</Badge>}
              </div>
              <p className="text-xs text-muted-foreground">{d.matieres?.nom}</p>
              {d.description && <p className="text-sm text-muted-foreground mt-1">{d.description}</p>}
            </div>
            {hasAnswer ? (
              <Badge className="bg-green-600"><CheckCircle className="h-3 w-3 mr-1" /> Soumis</Badge>
            ) : isExpired ? (
              <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Expiré</Badge>
            ) : (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                <Clock className="h-3 w-3 mr-1" />
                {formatDistanceToNow(new Date(d.date_limite), { addSuffix: true, locale: fr })}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Date limite : {new Date(d.date_limite).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            <span>Note max : {d.note_max}</span>
          </div>

          {/* File submission result */}
          {!isQuiz && soumission && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 space-y-1">
              <p className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <a href={soumission.fichier_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{soumission.fichier_nom}</a>
              </p>
              {soumission.note !== null && (
                <p className="text-sm font-semibold">Note : {soumission.note}/{d.note_max}</p>
              )}
              {soumission.commentaire && (
                <p className="text-xs text-muted-foreground">💬 {soumission.commentaire}</p>
              )}
            </div>
          )}

          {/* Quiz result */}
          {isQuiz && quizReponse && (
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3">
              <p className="text-sm font-semibold">
                Score : {quizReponse.score}/{quizReponse.score_max}
              </p>
              <p className="text-xs text-muted-foreground">
                Soumis le {new Date(quizReponse.soumis_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}

          {/* File upload form */}
          {!isQuiz && canSubmit && !soumission && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file && selectedDevoirId) handleUpload(selectedDevoirId, file);
                  e.target.value = '';
                }}
              />
              <Button
                size="sm"
                disabled={!!uploading}
                onClick={() => {
                  setSelectedDevoirId(d.id);
                  fileInputRef.current?.click();
                }}
              >
                {uploading === d.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Soumettre mon travail
              </Button>
              <p className="text-xs text-muted-foreground mt-1">PDF, JPG, PNG, Word (.doc, .docx)</p>
            </div>
          )}

          {/* Quiz form */}
          {isQuiz && canSubmit && !quizReponse && d.questions && d.questions.length > 0 && (
            <div className="space-y-4 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold text-sm">📝 Répondez aux questions</h4>
              {d.questions.sort((a: any, b: any) => a.ordre - b.ordre).map((q: any, qi: number) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-sm font-medium">
                    <span className="text-muted-foreground mr-1">{qi + 1}.</span>
                    {q.question}
                    <span className="text-xs text-muted-foreground ml-1">({q.points} pt{q.points > 1 ? 's' : ''})</span>
                  </p>
                  <RadioGroup
                    value={String(quizAnswers[d.id]?.[q.id] ?? '')}
                    onValueChange={v => setAnswer(d.id, q.id, Number(v))}
                    className="ml-4 space-y-1"
                  >
                    {(q.options as any[]).map((opt: any, oi: number) => (
                      <div key={oi} className="flex items-center gap-2">
                        <RadioGroupItem value={String(oi)} id={`q-${q.id}-${oi}`} />
                        <Label htmlFor={`q-${q.id}-${oi}`} className="cursor-pointer text-sm">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              ))}
              <Button
                size="sm"
                disabled={submittingQuiz === d.id}
                onClick={() => handleSubmitQuiz(d.id, d.questions)}
              >
                {submittingQuiz === d.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Soumettre le quiz
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <StudentLayout>
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="h-6 w-6 text-orange-600" /> Mes devoirs
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <Tabs defaultValue="afaire">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="afaire">À faire ({aFaire.length})</TabsTrigger>
            <TabsTrigger value="soumis">Soumis ({soumis.length})</TabsTrigger>
            <TabsTrigger value="expires">Expirés ({expires.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="afaire" className="space-y-3 mt-4">
            {aFaire.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucun devoir en cours 🎉</p> : aFaire.map(d => renderDevoir(d, true))}
          </TabsContent>
          <TabsContent value="soumis" className="space-y-3 mt-4">
            {soumis.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucune soumission</p> : soumis.map(d => renderDevoir(d, false))}
          </TabsContent>
          <TabsContent value="expires" className="space-y-3 mt-4">
            {expires.length === 0 ? <p className="text-center text-muted-foreground py-8">Aucun devoir expiré</p> : expires.map(d => renderDevoir(d, false))}
          </TabsContent>
        </Tabs>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
