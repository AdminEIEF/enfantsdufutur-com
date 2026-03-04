import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Bot, UserPlus, UserMinus, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function Robotique() {
  const [search, setSearch] = useState('');
  const [allEleves, setAllEleves] = useState<any[]>([]);
  const [inscrits, setInscrits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, classe_id, option_robotique, classes(nom)')
      .eq('statut', 'inscrit')
      .is('deleted_at', null)
      .order('nom');
    if (data) {
      setAllEleves(data);
      setInscrits(data.filter((e: any) => e.option_robotique));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('robotique-eleves')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eleves' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const toggleRobotique = async (eleveId: string, currentVal: boolean) => {
    setActionId(eleveId);
    const { error } = await supabase
      .from('eleves')
      .update({ option_robotique: !currentVal } as any)
      .eq('id', eleveId);
    if (error) {
      toast.error('Erreur: ' + error.message);
    } else {
      toast.success(!currentVal ? 'Élève inscrit en Robotique !' : 'Élève désinscrit de la Robotique');
      fetchData();
    }
    setActionId(null);
  };

  const filtered = search.trim()
    ? allEleves.filter(e =>
        `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-7 w-7 text-indigo-600" />
        <h1 className="text-2xl font-bold">Gestion Robotique</h1>
        <Badge className="bg-indigo-600 text-white border-0">{inscrits.length} inscrits</Badge>
      </div>

      {/* Search & Enroll */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" /> Rechercher un élève
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Nom, prénom ou matricule..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md"
          />
          {search.trim() && (
            <div className="border rounded-lg max-h-60 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Aucun résultat</TableCell></TableRow>
                  ) : filtered.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                      <TableCell><code className="text-xs">{e.matricule}</code></TableCell>
                      <TableCell>{(e.classes as any)?.nom || '—'}</TableCell>
                      <TableCell>
                        {e.option_robotique
                          ? <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200">Inscrit</Badge>
                          : <Badge variant="outline">Non inscrit</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={e.option_robotique ? 'destructive' : 'default'}
                          disabled={actionId === e.id}
                          onClick={() => toggleRobotique(e.id, e.option_robotique)}
                          className={!e.option_robotique ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                        >
                          {actionId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
                            e.option_robotique ? <><UserMinus className="h-4 w-4 mr-1" /> Désinscrire</> :
                              <><UserPlus className="h-4 w-4 mr-1" /> Inscrire</>
                          }
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enrolled students list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Élèves inscrits en Robotique
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : inscrits.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Aucun élève inscrit en Robotique</p>
          ) : (
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inscrits.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                      <TableCell><code className="text-xs">{e.matricule}</code></TableCell>
                      <TableCell>{(e.classes as any)?.nom || '—'}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="destructive" disabled={actionId === e.id} onClick={() => toggleRobotique(e.id, true)}>
                          {actionId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserMinus className="h-4 w-4 mr-1" /> Retirer</>}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
