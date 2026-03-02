import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { Loader2, Star, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const CRITERIA = [
  { key: 'pedagogie', label: 'Pédagogie', emoji: '📚' },
  { key: 'ponctualite', label: 'Ponctualité', emoji: '⏰' },
  { key: 'competences', label: 'Compétences', emoji: '🎯' },
  { key: 'relations', label: 'Relations', emoji: '🤝' },
];

// Basic profanity filter
const BANNED_WORDS = [
  'idiot', 'imbecile', 'stupide', 'con', 'connard', 'merde', 'putain', 'salaud',
  'enculé', 'bâtard', 'nul', 'débile', 'crétin', 'abruti', 'foutre', 'chier',
  'pute', 'bordel', 'connasse', 'enfoiré', 'salopard', 'salope', 'ta gueule',
  'ferme la', 'casse toi', 'dégage',
];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return BANNED_WORDS.some(word => {
    const normalizedWord = word.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes(normalizedWord);
  });
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${
            n <= value
              ? 'bg-yellow-400 text-yellow-900 shadow-sm'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function StudentEvaluations() {
  const { session } = useStudentAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enseignants, setEnseignants] = useState<any[]>([]);
  const [existingEvals, setExistingEvals] = useState<any[]>([]);
  const [periode, setPeriode] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<any>(null);
  const [scores, setScores] = useState({ pedagogie: 5, ponctualite: 5, competences: 5, relations: 5 });
  const [commentaire, setCommentaire] = useState('');

  useEffect(() => {
    if (session) fetchData();
  }, [session]);

  const fetchData = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token: session!.token, action: 'evaluations_enseignants' }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      setEnseignants(data.enseignants || []);
      setExistingEvals(data.evaluations || []);
      setPeriode(data.periode || '');
    } catch (err: any) {
      toast.error(err.message || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTeacher) return;

    // Profanity check
    if (commentaire && containsProfanity(commentaire)) {
      toast.error('Votre commentaire contient des mots inappropriés. Veuillez reformuler.');
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            token: session!.token,
            action: 'eval_enseignant',
            enseignant_id: selectedTeacher.employe_id,
            periode,
            ...scores,
            commentaire: commentaire.trim() || null,
          }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast.success('Évaluation soumise avec succès !');
      setSelectedTeacher(null);
      setScores({ pedagogie: 5, ponctualite: 5, competences: 5, relations: 5 });
      setCommentaire('');
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const hasEvaluated = (enseignantId: string) =>
    existingEvals.some((e: any) => e.enseignant_id === enseignantId);

  return (
    <StudentLayout>
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> Évaluer mes professeurs
          </h2>
          <p className="text-sm text-muted-foreground">
            Évaluez vos enseignants de manière constructive et respectueuse — Période : <strong>{periode}</strong>
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : enseignants.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Aucun enseignant affecté à votre classe pour le moment.
            </CardContent>
          </Card>
        ) : selectedTeacher ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Évaluation de {selectedTeacher.prenom} {selectedTeacher.nom}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {selectedTeacher.matiere_nom && `Matière : ${selectedTeacher.matiere_nom}`}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {CRITERIA.map(c => (
                <div key={c.key} className="space-y-1">
                  <Label className="text-sm">{c.emoji} {c.label}</Label>
                  <StarRating
                    value={(scores as any)[c.key]}
                    onChange={v => setScores(s => ({ ...s, [c.key]: v }))}
                  />
                </div>
              ))}
              <div className="space-y-1">
                <Label className="text-sm">💬 Commentaire (optionnel)</Label>
                <Textarea
                  value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  placeholder="Partagez un retour constructif et respectueux..."
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Les insultes et mots vulgaires ne sont pas acceptés.
                </p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={submitting} className="flex-1">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Soumettre l'évaluation
                </Button>
                <Button variant="outline" onClick={() => setSelectedTeacher(null)}>Annuler</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {enseignants.map((ens: any) => {
              const done = hasEvaluated(ens.employe_id);
              return (
                <Card key={ens.id} className={done ? 'opacity-60' : ''}>
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{ens.prenom} {ens.nom}</p>
                      <p className="text-sm text-muted-foreground">{ens.matiere_nom || 'Enseignant'}</p>
                    </div>
                    {done ? (
                      <Badge variant="outline" className="text-green-600 border-green-300">
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Évalué
                      </Badge>
                    ) : (
                      <Button size="sm" onClick={() => setSelectedTeacher(ens)}>
                        <Star className="h-4 w-4 mr-1" /> Évaluer
                      </Button>
                    )}
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
