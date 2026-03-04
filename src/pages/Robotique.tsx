import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Bot, UserPlus, UserMinus, Users, Loader2, DollarSign, TrendingUp, CheckCircle2, XCircle, Save, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function Robotique() {
  const { roles } = useAuth();
  const [search, setSearch] = useState('');
  const [allEleves, setAllEleves] = useState<any[]>([]);
  const [inscrits, setInscrits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [prixRobotique, setPrixRobotique] = useState('500000');
  const [prixInput, setPrixInput] = useState('');
  const [savingPrix, setSavingPrix] = useState(false);

  const isAdmin = roles.includes('admin') || roles.includes('superviseur');
  const canAccess = roles.includes('admin') || roles.includes('secretaire') || roles.includes('superviseur');

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, classe_id, option_robotique, robotique_paye, classes(nom)')
      .eq('statut', 'inscrit')
      .is('deleted_at', null)
      .order('nom');
    if (data) {
      setAllEleves(data);
      setInscrits(data.filter((e: any) => e.option_robotique));
    }
    setLoading(false);
  };

  const fetchPrix = async () => {
    const { data } = await supabase.from('parametres').select('valeur').eq('cle', 'prix_robotique').maybeSingle();
    if (data?.valeur) {
      const val = typeof data.valeur === 'string' ? data.valeur : String(data.valeur);
      setPrixRobotique(val);
      setPrixInput(val);
    }
  };

  useEffect(() => {
    fetchData();
    fetchPrix();

    const channel = supabase
      .channel('robotique-eleves')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eleves' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Garde d'accès après les hooks
  if (!canAccess) {
    return <Navigate to="/robotique-dashboard" replace />;
  }

  const toggleRobotique = async (eleveId: string, currentVal: boolean) => {
    setActionId(eleveId);
    const { error } = await supabase
      .from('eleves')
      .update({ option_robotique: !currentVal } as any)
      .eq('id', eleveId);
    if (error) toast.error('Erreur: ' + error.message);
    else {
      toast.success(!currentVal ? 'Élève inscrit en Robotique !' : 'Élève désinscrit de la Robotique');
      fetchData();
    }
    setActionId(null);
  };

  const togglePaiement = async (eleveId: string, currentVal: boolean) => {
    setActionId(eleveId);
    const { error } = await supabase
      .from('eleves')
      .update({ robotique_paye: !currentVal } as any)
      .eq('id', eleveId);
    if (error) toast.error('Erreur: ' + error.message);
    else {
      toast.success(!currentVal ? 'Marqué comme Payé' : 'Marqué comme Non Payé');
      fetchData();
    }
    setActionId(null);
  };

  const savePrix = async () => {
    setSavingPrix(true);
    const { error } = await supabase
      .from('parametres')
      .update({ valeur: prixInput } as any)
      .eq('cle', 'prix_robotique');
    if (error) toast.error('Erreur: ' + error.message);
    else {
      setPrixRobotique(prixInput);
      toast.success('Prix de formation mis à jour !');
    }
    setSavingPrix(false);
  };

  const filtered = search.trim()
    ? allEleves.filter(e =>
        `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(search.toLowerCase())
      )
    : [];

  const prix = Number(prixRobotique) || 0;
  const totalInscrits = inscrits.length;
  const totalPayes = inscrits.filter((e: any) => e.robotique_paye).length;
  const totalNonPayes = totalInscrits - totalPayes;
  const revenuAttendu = totalInscrits * prix;
  const revenuReel = totalPayes * prix;

  const formatGNF = (n: number) => n.toLocaleString('fr-GN') + ' GNF';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="h-7 w-7 text-indigo-600" />
        <h1 className="text-2xl font-bold">Gestion Robotique</h1>
        <Badge className="bg-indigo-600 text-white border-0">{inscrits.length} inscrits</Badge>
      </div>

      <Tabs defaultValue="gestion">
        <TabsList>
          <TabsTrigger value="gestion">📋 Gestion</TabsTrigger>
          <TabsTrigger value="finances">💰 Statistiques Financières</TabsTrigger>
        </TabsList>

        <TabsContent value="gestion" className="space-y-6">
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
                        <TableHead>Paiement</TableHead>
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
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePaiement(e.id, e.robotique_paye)}
                              disabled={actionId === e.id}
                              className={e.robotique_paye ? 'text-emerald-700 hover:text-emerald-800' : 'text-red-600 hover:text-red-700'}
                            >
                              {actionId === e.id ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                e.robotique_paye
                                  ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Payé</>
                                  : <><XCircle className="h-4 w-4 mr-1" /> Non Payé</>
                              }
                            </Button>
                          </TableCell>
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
        </TabsContent>

        <TabsContent value="finances" className="space-y-6">
          {/* Prix paramétrage */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" /> Paramétrage du prix
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm font-medium">Prix de formation Robotique :</label>
                  <Input
                    type="number"
                    value={prixInput}
                    onChange={e => setPrixInput(e.target.value)}
                    className="w-48"
                    min={0}
                  />
                  <span className="text-sm text-muted-foreground">GNF</span>
                  <Button onClick={savePrix} disabled={savingPrix || prixInput === prixRobotique} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                    {savingPrix ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Enregistrer
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <Users className="h-8 w-8 mx-auto mb-2 text-indigo-600" />
                <p className="text-3xl font-bold text-indigo-600">{totalInscrits}</p>
                <p className="text-sm text-muted-foreground">Inscrits total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                <p className="text-2xl font-bold text-blue-600">{formatGNF(revenuAttendu)}</p>
                <p className="text-sm text-muted-foreground">Revenu Total Attendu</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardContent className="pt-6 text-center">
                <DollarSign className="h-8 w-8 mx-auto mb-2 text-emerald-600" />
                <p className="text-2xl font-bold text-emerald-600">{formatGNF(revenuReel)}</p>
                <p className="text-sm text-muted-foreground">Revenu Réel (Payés: {totalPayes})</p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50/30">
              <CardContent className="pt-6 text-center">
                <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                <p className="text-2xl font-bold text-red-500">{totalNonPayes}</p>
                <p className="text-sm text-muted-foreground">Non Payés ({formatGNF(totalNonPayes * prix)})</p>
              </CardContent>
            </Card>
          </div>

          {/* Payment detail table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" /> Détail des paiements — {formatGNF(prix)} / élève
              </CardTitle>
            </CardHeader>
            <CardContent>
              {inscrits.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">Aucun élève inscrit</p>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Statut</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inscrits.map((e, i) => (
                        <TableRow key={e.id} className={e.robotique_paye ? 'bg-emerald-50/50' : ''}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                          <TableCell>{(e.classes as any)?.nom || '—'}</TableCell>
                          <TableCell>{formatGNF(prix)}</TableCell>
                          <TableCell>
                            {e.robotique_paye
                              ? <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">✅ Payé</Badge>
                              : <Badge variant="destructive">❌ Non Payé</Badge>
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
