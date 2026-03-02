import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, FileText, CheckCircle, XCircle, Eye, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface Props {
  devoir: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DevoirSoumissionsDialog({ devoir, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const isQuiz = devoir?.type_devoir === 'quiz';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editComment, setEditComment] = useState('');
  const [viewingQuiz, setViewingQuiz] = useState<any>(null);

  // Fetch file submissions
  const { data: soumissions = [], isLoading: loadingSoumissions } = useQuery({
    queryKey: ['devoir-soumissions', devoir?.id],
    queryFn: async () => {
      if (!devoir?.id || isQuiz) return [];
      const { data, error } = await supabase
        .from('soumissions_devoirs')
        .select('*, eleves:eleve_id(nom, prenom, matricule)')
        .eq('devoir_id', devoir.id)
        .order('soumis_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!devoir?.id && !isQuiz,
  });

  // Fetch quiz responses
  const { data: quizReponses = [], isLoading: loadingQuiz } = useQuery({
    queryKey: ['devoir-quiz-reponses', devoir?.id],
    queryFn: async () => {
      if (!devoir?.id || !isQuiz) return [];
      const { data, error } = await supabase
        .from('quiz_reponses')
        .select('*, eleves:eleve_id(nom, prenom, matricule)')
        .eq('devoir_id', devoir.id)
        .order('soumis_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!devoir?.id && isQuiz,
  });

  // Fetch quiz questions for detail view
  const { data: questions = [] } = useQuery({
    queryKey: ['devoir-questions', devoir?.id],
    queryFn: async () => {
      if (!devoir?.id || !isQuiz) return [];
      const { data, error } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('devoir_id', devoir.id)
        .order('ordre');
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!devoir?.id && isQuiz,
  });

  // Grade file submission
  const gradeSubmission = useMutation({
    mutationFn: async ({ id, note, commentaire }: { id: string; note: number; commentaire: string }) => {
      const { error } = await supabase
        .from('soumissions_devoirs')
        .update({
          note,
          commentaire: commentaire || null,
          corrige_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['devoir-soumissions', devoir?.id] });
      toast({ title: 'Note enregistrée' });
      setEditingId(null);
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const loading = isQuiz ? loadingQuiz : loadingSoumissions;
  const items = isQuiz ? quizReponses : soumissions;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Soumissions — {devoir?.titre}
            <Badge variant="secondary">{items.length} réponse{items.length > 1 ? 's' : ''}</Badge>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Aucune soumission pour ce devoir</p>
        ) : viewingQuiz ? (
          // Detail view of a student's quiz answers
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">
                  {(viewingQuiz.eleves as any)?.prenom} {(viewingQuiz.eleves as any)?.nom}
                  <span className="text-muted-foreground ml-2 text-sm">({(viewingQuiz.eleves as any)?.matricule})</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Score : <span className="font-bold text-foreground">{viewingQuiz.score}/{viewingQuiz.score_max}</span>
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setViewingQuiz(null)}>← Retour</Button>
            </div>

            {questions.map((q: any, qi: number) => {
              const studentReponses = viewingQuiz.reponses as any[];
              const studentAnswer = studentReponses?.find((r: any) => r.question_id === q.id);
              const answerIndex = studentAnswer?.answer_index ?? -1;
              const options = q.options as { label: string; correct: boolean }[];

              return (
                <div key={q.id} className="border rounded-lg p-3 space-y-2">
                  <p className="font-medium text-sm">
                    <span className="text-muted-foreground mr-1">{qi + 1}.</span>
                    {q.question}
                    <span className="text-xs text-muted-foreground ml-1">({q.points} pt{q.points > 1 ? 's' : ''})</span>
                  </p>
                  <div className="space-y-1 ml-4">
                    {options.map((opt, oi) => {
                      const isSelected = oi === answerIndex;
                      const isCorrect = opt.correct;
                      let className = 'flex items-center gap-2 text-sm px-2 py-1 rounded ';
                      if (isSelected && isCorrect) className += 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400';
                      else if (isSelected && !isCorrect) className += 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400';
                      else if (isCorrect) className += 'bg-green-50 dark:bg-green-950/10 text-green-600 dark:text-green-500';
                      else className += 'text-muted-foreground';

                      return (
                        <div key={oi} className={className}>
                          {isSelected && isCorrect && <CheckCircle className="h-4 w-4 shrink-0" />}
                          {isSelected && !isCorrect && <XCircle className="h-4 w-4 shrink-0" />}
                          {!isSelected && isCorrect && <CheckCircle className="h-4 w-4 shrink-0 opacity-50" />}
                          {!isSelected && !isCorrect && <span className="w-4 h-4 shrink-0" />}
                          {opt.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : isQuiz ? (
          // Quiz responses table
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quizReponses.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{(r.eleves as any)?.prenom} {(r.eleves as any)?.nom}</TableCell>
                  <TableCell>{(r.eleves as any)?.matricule}</TableCell>
                  <TableCell>
                    <Badge variant={r.score >= r.score_max * 0.5 ? 'default' : 'destructive'}>
                      {r.score}/{r.score_max}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(r.soumis_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => setViewingQuiz(r)}>
                      <Eye className="h-4 w-4 mr-1" /> Voir réponses
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          // File submissions table
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Fichier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {soumissions.map((s: any) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{(s.eleves as any)?.prenom} {(s.eleves as any)?.nom}</TableCell>
                  <TableCell>{(s.eleves as any)?.matricule}</TableCell>
                  <TableCell>
                    <a href={s.fichier_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline flex items-center gap-1 text-sm">
                      <FileText className="h-3 w-3" /> {s.fichier_nom}
                    </a>
                  </TableCell>
                  <TableCell className="text-sm">{new Date(s.soumis_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</TableCell>
                  <TableCell>
                    {editingId === s.id ? (
                      <div className="flex flex-col gap-1">
                        <Input type="number" min={0} max={devoir?.note_max || 20} value={editNote} onChange={e => setEditNote(e.target.value)} className="w-20" placeholder="Note" />
                        <Textarea value={editComment} onChange={e => setEditComment(e.target.value)} placeholder="Commentaire..." className="text-xs min-h-[50px]" />
                      </div>
                    ) : s.note !== null ? (
                      <Badge variant="default">{s.note}/{devoir?.note_max}</Badge>
                    ) : (
                      <Badge variant="outline">Non noté</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === s.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" onClick={() => gradeSubmission.mutate({ id: s.id, note: Number(editNote), commentaire: editComment })} disabled={gradeSubmission.isPending}>
                          <Save className="h-4 w-4 mr-1" /> OK
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Annuler</Button>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => { setEditingId(s.id); setEditNote(s.note?.toString() || ''); setEditComment(s.commentaire || ''); }}>
                        {s.note !== null ? 'Modifier' : 'Noter'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
