import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { StudentLayout } from '@/components/StudentLayout';
import { StudentAIChat } from '@/components/StudentAIChat';
import { Award, BookOpen, FileCheck, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentResultats() {
  const { session } = useStudentAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session) return;
    fetchResultats();
  }, [session]);

  const fetchResultats = async () => {
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ token: session!.token, action: 'resultats' }),
        }
      );
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error);
      setData(result);
    } catch (err: any) {
      toast.error(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const bareme = session?.eleve?.classes?.niveaux?.cycles?.bareme || 20;

  // Group notes by period
  const notesByPeriode = (data?.notes || []).reduce((acc: Record<string, any[]>, n: any) => {
    const periode = n.periodes?.nom || 'Inconnu';
    if (!acc[periode]) acc[periode] = [];
    acc[periode].push(n);
    return acc;
  }, {});

  const periodes = Object.keys(notesByPeriode).sort((a, b) => {
    const aOrdre = notesByPeriode[a][0]?.periodes?.ordre || 0;
    const bOrdre = notesByPeriode[b][0]?.periodes?.ordre || 0;
    return aOrdre - bOrdre;
  });

  const calcMoyenne = (notes: any[]) => {
    const valid = notes.filter(n => n.note !== null);
    if (valid.length === 0) return null;
    const totalCoef = valid.reduce((s, n) => s + (n.matieres?.coefficient || 1), 0);
    const totalWeighted = valid.reduce((s, n) => s + n.note * (n.matieres?.coefficient || 1), 0);
    return totalCoef > 0 ? (totalWeighted / totalCoef).toFixed(2) : null;
  };

  return (
    <StudentLayout>
      <div className="space-y-1">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Award className="h-6 w-6 text-green-600" /> Mes résultats
        </h2>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <Tabs defaultValue="notes">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="devoirs">Devoirs notés</TabsTrigger>
            <TabsTrigger value="bulletins">Bulletins</TabsTrigger>
          </TabsList>

          <TabsContent value="notes" className="space-y-4 mt-4">
            {periodes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucune note disponible</p>
            ) : periodes.map(periode => {
              const notes = notesByPeriode[periode];
              const moyenne = calcMoyenne(notes);
              return (
                <Card key={periode}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      {periode}
                      {moyenne && (
                        <Badge className={Number(moyenne) >= bareme / 2 ? 'bg-green-600' : 'bg-red-500'}>
                          Moy: {moyenne}/{bareme}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Matière</TableHead>
                          <TableHead className="text-right">Note</TableHead>
                          <TableHead className="text-right">Coef</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {notes.map((n: any) => (
                          <TableRow key={n.id}>
                            <TableCell className="font-medium">{n.matieres?.nom}</TableCell>
                            <TableCell className="text-right">
                              {n.note !== null ? (
                                <span className={n.note >= bareme / 2 ? 'text-green-600 font-bold' : 'text-red-500 font-bold'}>
                                  {n.note}/{bareme}
                                </span>
                              ) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">{n.matieres?.coefficient}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="devoirs" className="space-y-3 mt-4">
            {(data?.soumissionsNotees || []).length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Aucun devoir noté</p>
            ) : (data.soumissionsNotees.map((s: any) => (
              <Card key={s.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.devoirs?.titre}</p>
                    <p className="text-xs text-muted-foreground">{s.devoirs?.matieres?.nom}</p>
                    {s.commentaire && <p className="text-xs text-muted-foreground mt-1">💬 {s.commentaire}</p>}
                  </div>
                  <Badge className={s.note >= (s.devoirs?.note_max || 20) / 2 ? 'bg-green-600' : 'bg-red-500'}>
                    {s.note}/{s.devoirs?.note_max || 20}
                  </Badge>
                </CardContent>
              </Card>
            )))}
          </TabsContent>

          <TabsContent value="bulletins" className="space-y-3 mt-4">
            {(data?.bulletinPublications || []).length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Aucun bulletin publié pour le moment</p>
                <p className="text-xs mt-1">Les bulletins seront visibles une fois publiés par l'administration.</p>
              </div>
            ) : (data.bulletinPublications.map((bp: any) => (
              <Card key={bp.id}>
                <CardContent className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{bp.periodes?.nom}</p>
                    <p className="text-xs text-muted-foreground">
                      Publié le {new Date(bp.published_at || bp.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <Badge className="bg-green-600">✓ Visible</Badge>
                </CardContent>
              </Card>
            )))}
          </TabsContent>
        </Tabs>
      )}
      <StudentAIChat />
    </StudentLayout>
  );
}
