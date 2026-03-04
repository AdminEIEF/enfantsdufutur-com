import { useState, useEffect, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Bot, UserPlus, UserMinus, Users, Loader2, DollarSign, TrendingUp, CheckCircle2, XCircle, Save, Settings, Filter, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { sortClasses } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export default function Robotique() {
  const { roles } = useAuth();
  const [search, setSearch] = useState('');
  const [searchNiveau, setSearchNiveau] = useState('__none__');
  const [allEleves, setAllEleves] = useState<any[]>([]);
  const [inscrits, setInscrits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [prixRobotique, setPrixRobotique] = useState('500000');
  const [prixInput, setPrixInput] = useState('');
  const [savingPrix, setSavingPrix] = useState(false);
  const [editingPrix, setEditingPrix] = useState(false);

  // Filters
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [filterNiveau, setFilterNiveau] = useState('__none__');
  const [filterClasse, setFilterClasse] = useState('__none__');

  const isAdmin = roles.includes('admin') || roles.includes('superviseur');
  const canAccess = roles.includes('admin') || roles.includes('secretaire') || roles.includes('superviseur');

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, classe_id, option_robotique, robotique_paye, classes(nom, niveau_id, niveaux(id, nom, ordre))')
      .eq('statut', 'inscrit')
      .is('deleted_at', null)
      .order('nom');
    if (data) {
      setAllEleves(data);
      setInscrits(data.filter((e: any) => e.option_robotique));
    }
    setLoading(false);
  };

  const fetchStructure = async () => {
    const [nRes, cRes] = await Promise.all([
      supabase.from('niveaux').select('id, nom, ordre, cycle_id, cycles:cycle_id(ordre)').order('ordre'),
      supabase.from('classes').select('id, nom, niveau_id, niveaux:niveau_id(ordre, cycles:cycle_id(ordre))'),
    ]);
    if (nRes.data) setNiveaux(nRes.data);
    if (cRes.data) setClasses(sortClasses(cRes.data));
  };

  const fetchPrix = async () => {
    const { data } = await supabase.from('parametres').select('valeur').eq('cle', 'prix_robotique').maybeSingle();
    if (data?.valeur) {
      const val = typeof data.valeur === 'string' ? data.valeur : String(data.valeur);
      setPrixRobotique(val);
      setPrixInput(val);
    }
  };

  // Filtered classes based on selected niveau
  const filteredClasses = filterNiveau !== '__none__'
    ? classes.filter(c => c.niveau_id === filterNiveau)
    : classes;

  // Apply filters to inscrits
  const filteredInscrits = useMemo(() => {
    let list = inscrits;
    if (filterNiveau !== '__none__') {
      list = list.filter((e: any) => (e.classes as any)?.niveau_id === filterNiveau);
    }
    if (filterClasse !== '__none__') {
      list = list.filter((e: any) => e.classe_id === filterClasse);
    }
    return list;
  }, [inscrits, filterNiveau, filterClasse]);

  // Stats by niveau
  const statsByNiveau = useMemo(() => {
    const map: Record<string, { nom: string; ordre: number; total: number; payes: number }> = {};
    inscrits.forEach((e: any) => {
      const niv = (e.classes as any)?.niveaux;
      if (!niv) return;
      if (!map[niv.id]) {
        map[niv.id] = { nom: niv.nom, ordre: niv.ordre, total: 0, payes: 0 };
      }
      map[niv.id].total++;
      if (e.robotique_paye) map[niv.id].payes++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [inscrits]);

  useEffect(() => {
    fetchData();
    fetchPrix();
    fetchStructure();

    const channel = supabase
      .channel('robotique-eleves')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'eleves' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
      setEditingPrix(false);
      toast.success('Prix de formation mis à jour !');
    }
    setSavingPrix(false);
  };

  const filtered = search.trim()
    ? allEleves.filter(e => {
        const matchText = `${e.prenom} ${e.nom} ${e.matricule}`.toLowerCase().includes(search.toLowerCase());
        const matchNiveau = searchNiveau === '__none__' || (e.classes as any)?.niveau_id === searchNiveau;
        return matchText && matchNiveau;
      })
    : searchNiveau !== '__none__'
      ? allEleves.filter(e => (e.classes as any)?.niveau_id === searchNiveau)
      : [];

  const prix = Number(prixRobotique) || 0;
  const totalInscrits = inscrits.length;
  const totalPayes = inscrits.filter((e: any) => e.robotique_paye).length;
  const totalNonPayes = totalInscrits - totalPayes;
  const revenuAttendu = totalInscrits * prix;
  const revenuReel = totalPayes * prix;

  const formatGNF = (n: number) => n.toLocaleString('fr-GN') + ' GNF';

  const resetFilters = () => {
    setFilterNiveau('__none__');
    setFilterClasse('__none__');
  };

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
              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  placeholder="Nom, prénom ou matricule..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-md"
                />
                <Select value={searchNiveau} onValueChange={setSearchNiveau}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tous les niveaux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tous les niveaux</SelectItem>
                    {niveaux.map((n: any) => (
                      <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {searchNiveau !== '__none__' && (
                  <Button variant="ghost" size="sm" onClick={() => setSearchNiveau('__none__')}>✕</Button>
                )}
              </div>
              {(search.trim() || searchNiveau !== '__none__') && (
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

          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" /> Filtrer par Niveau / Classe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={filterNiveau} onValueChange={(v) => { setFilterNiveau(v); setFilterClasse('__none__'); }}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Tous les niveaux" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tous les niveaux</SelectItem>
                    {niveaux.map(n => (
                      <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterClasse} onValueChange={setFilterClasse}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Toutes les classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Toutes les classes</SelectItem>
                    {filteredClasses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(filterNiveau !== '__none__' || filterClasse !== '__none__') && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>✕ Réinitialiser</Button>
                )}

                <Badge variant="outline" className="ml-auto">{filteredInscrits.length} élève(s) affiché(s)</Badge>
              </div>
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
              ) : filteredInscrits.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">Aucun élève inscrit en Robotique</p>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Élève</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Niveau</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInscrits.map((e, i) => (
                        <TableRow key={e.id}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                          <TableCell><code className="text-xs">{e.matricule}</code></TableCell>
                          <TableCell>{(e.classes as any)?.niveaux?.nom || '—'}</TableCell>
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

          {/* Stats by Niveau */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Intérêt par Niveau
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsByNiveau.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground">Aucune donnée</p>
              ) : (
                <div className="border rounded-lg overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Niveau</TableHead>
                        <TableHead className="text-center">Inscrits</TableHead>
                        <TableHead className="text-center">Payés</TableHead>
                        <TableHead className="text-center">Non Payés</TableHead>
                        <TableHead className="text-center">% du total</TableHead>
                        <TableHead>Popularité</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {statsByNiveau.map((s, i) => {
                        const pct = totalInscrits > 0 ? Math.round((s.total / totalInscrits) * 100) : 0;
                        return (
                          <TableRow key={s.nom} className={i === 0 ? 'bg-indigo-50/50' : ''}>
                            <TableCell className="font-bold">{i + 1}</TableCell>
                            <TableCell className="font-medium">
                              {s.nom}
                              {i === 0 && <Badge className="ml-2 bg-indigo-600 text-white border-0 text-[10px]">🏆 Top</Badge>}
                            </TableCell>
                            <TableCell className="text-center font-bold text-indigo-600">{s.total}</TableCell>
                            <TableCell className="text-center text-emerald-600">{s.payes}</TableCell>
                            <TableCell className="text-center text-red-500">{s.total - s.payes}</TableCell>
                            <TableCell className="text-center font-medium">{pct}%</TableCell>
                            <TableCell>
                              <div className="w-full bg-muted rounded-full h-2.5">
                                <div
                                  className="bg-indigo-500 h-2.5 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
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
                {editingPrix ? (
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
                    <Button onClick={savePrix} disabled={savingPrix || !prixInput} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                      {savingPrix ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                      Valider
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { setPrixInput(prixRobotique); setEditingPrix(false); }}>
                      Annuler
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-sm font-medium">Prix de formation Robotique :</label>
                    <span className="text-lg font-bold text-indigo-600">{Number(prixRobotique).toLocaleString('fr-GN')} GNF</span>
                    <Button variant="outline" size="sm" onClick={() => { setPrixInput(prixRobotique); setEditingPrix(true); }}>
                      ✏️ Modifier
                    </Button>
                  </div>
                )}
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
