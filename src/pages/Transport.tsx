import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bus, MapPin, Users, Search, Wallet, CheckCircle, Circle, Download, AlertTriangle, CreditCard, ScanLine } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { exportToExcel } from '@/lib/excelUtils';
import { useToast } from '@/hooks/use-toast';
import CarteTransportEleve from '@/components/CarteTransportEleve';
import ValidationTransportBus from '@/components/ValidationTransportBus';

const MOIS_SCOLAIRES = [
  'Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
];

const COLORS = [
  'hsl(220, 70%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(162, 63%, 41%)',
  'hsl(200, 80%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)',
];

export default function Transport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [quickPay, setQuickPay] = useState<{ eleveId: string; eleveName: string; mois: string; montant: number } | null>(null);

  // Zones
  const { data: zones = [] } = useQuery({
    queryKey: ['transport-zones'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('zones_transport')
        .select('*')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Élèves avec transport
  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['transport-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, statut, zone_transport_id, classe_id, classes(nom), zones_transport:zone_transport_id(id, nom, prix_mensuel, chauffeur_bus, telephone_chauffeur, quartiers)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Paiements transport
  const { data: paiements = [] } = useQuery({
    queryKey: ['transport-paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('id, montant, date_paiement, eleve_id, mois_concerne')
        .eq('type_paiement', 'transport')
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ─── Computed ─────────────────────────────────────────
  const filteredEleves = useMemo(() => {
    return eleves.filter((e: any) => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchZone = filterZone === 'all' || e.zone_transport_id === filterZone;
      return matchSearch && matchZone;
    });
  }, [eleves, search, filterZone]);

  // Stats par zone
  const statsParZone = useMemo(() => {
    return zones.map((z: any) => {
      const elevesZone = eleves.filter((e: any) => e.zone_transport_id === z.id);
      const paiementsZone = paiements.filter((p: any) =>
        elevesZone.some((e: any) => e.id === p.eleve_id)
      );
      const totalAttendu = elevesZone.length * Number(z.prix_mensuel) * 10;
      const totalPaye = paiementsZone.reduce((s: number, p: any) => s + Number(p.montant), 0);
      const taux = totalAttendu > 0 ? Math.round((totalPaye / totalAttendu) * 100) : 0;

      return {
        id: z.id,
        nom: z.nom,
        chauffeur: z.chauffeur_bus || '—',
        telephoneChauffeur: z.telephone_chauffeur || '',
        quartiers: z.quartiers || [],
        prixMensuel: Number(z.prix_mensuel),
        effectif: elevesZone.length,
        totalAttendu,
        totalPaye,
        taux,
      };
    });
  }, [zones, eleves, paiements]);

  // Suivi mensuel par élève pour la zone sélectionnée
  const suiviMensuelZone = useMemo(() => {
    if (!selectedZone) return [];
    const elevesZone = eleves.filter((e: any) => e.zone_transport_id === selectedZone.id);

    return elevesZone.map((e: any) => {
      const paiementsEleve = paiements.filter((p: any) => p.eleve_id === e.id);
      const moisPayes = paiementsEleve
        .map((p: any) => p.mois_concerne)
        .filter(Boolean) as string[];
      const totalPaye = paiementsEleve.reduce((s: number, p: any) => s + Number(p.montant), 0);

      return {
        id: e.id,
        nom: `${e.prenom} ${e.nom}`,
        matricule: e.matricule || '—',
        classe: e.classes?.nom || '—',
        moisPayes,
        totalPaye,
        nbMoisPayes: moisPayes.length,
      };
    });
  }, [selectedZone, eleves, paiements]);

  // Totaux globaux
  const totalElevesTransport = eleves.length;
  const totalRecettesTransport = paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
  const totalAttenduGlobal = statsParZone.reduce((s, z) => s + z.totalAttendu, 0);
  const tauxGlobal = totalAttenduGlobal > 0 ? Math.round((totalRecettesTransport / totalAttenduGlobal) * 100) : 0;
  const zonesImpayees = statsParZone.filter(z => z.taux < 50).length;

  // Chart data
  const chartEffectif = statsParZone.map(z => ({ name: z.nom, value: z.effectif }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Bus className="h-7 w-7 text-primary" /> Transport scolaire
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Élèves transportés</p>
                <p className="text-2xl font-bold">{totalElevesTransport}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <MapPin className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Zones actives</p>
                <p className="text-2xl font-bold">{zones.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Recettes transport</p>
                <p className="text-2xl font-bold">{totalRecettesTransport.toLocaleString()} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className={`h-8 w-8 ${tauxGlobal >= 70 ? 'text-accent' : 'text-warning'}`} />
              <div>
                <p className="text-sm text-muted-foreground">Taux recouvrement</p>
                <p className="text-2xl font-bold">{tauxGlobal}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones">Zones & Bus</TabsTrigger>
          <TabsTrigger value="eleves">Élèves</TabsTrigger>
          <TabsTrigger value="suivi">Suivi mensuel</TabsTrigger>
          <TabsTrigger value="cartes" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Cartes</TabsTrigger>
          <TabsTrigger value="validation" className="gap-1"><ScanLine className="h-3.5 w-3.5" /> Validation bus</TabsTrigger>
        </TabsList>

        {/* Tab: Zones */}
        <TabsContent value="zones" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Recouvrement par zone</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zone</TableHead>
                      <TableHead>Chauffeur/Bus</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-center">Effectif</TableHead>
                      <TableHead className="text-right">Prix/mois</TableHead>
                      <TableHead className="text-center">Taux</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statsParZone.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune zone configurée</TableCell></TableRow>
                    ) : statsParZone.map((z) => (
                      <TableRow key={z.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedZone(z)}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{z.nom}</p>
                            {z.quartiers.length > 0 && (
                              <p className="text-xs text-muted-foreground">{z.quartiers.slice(0, 3).join(', ')}{z.quartiers.length > 3 ? '…' : ''}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{z.chauffeur}</TableCell>
                        <TableCell className="text-sm">{z.telephoneChauffeur || '—'}</TableCell>
                        <TableCell className="text-center font-bold">{z.effectif}</TableCell>
                        <TableCell className="text-right font-mono">{z.prixMensuel.toLocaleString()} F</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={z.taux >= 75 ? 'default' : z.taux >= 50 ? 'secondary' : 'destructive'}>
                            {z.taux}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Répartition des élèves par zone</CardTitle></CardHeader>
              <CardContent>
                {chartEffectif.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={chartEffectif} cx="50%" cy="50%" innerRadius={50} outerRadius={100} paddingAngle={3} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                        {chartEffectif.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[280px] flex items-center justify-center text-muted-foreground">Aucune donnée</div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Alertes impayés */}
          {zonesImpayees > 0 && (
            <Card className="border-warning/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" /> Zones avec faible recouvrement (&lt;50%)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 flex-wrap">
                  {statsParZone.filter(z => z.taux < 50).map(z => (
                    <Badge key={z.id} variant="destructive" className="cursor-pointer" onClick={() => setSelectedZone(z)}>
                      {z.nom} — {z.taux}% ({z.effectif} élèves)
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Élèves */}
        <TabsContent value="eleves" className="space-y-4 mt-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={filterZone} onValueChange={setFilterZone}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Zone" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les zones</SelectItem>
                {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
              const rows = filteredEleves.map((e: any) => ({
                Matricule: e.matricule || '',
                Nom: e.nom,
                Prénom: e.prenom,
                Classe: e.classes?.nom || '',
                Zone: (e.zones_transport as any)?.nom || '',
                Chauffeur: (e.zones_transport as any)?.chauffeur_bus || '',
                'Prix mensuel (GNF)': Number((e.zones_transport as any)?.prix_mensuel || 0),
              }));
              exportToExcel(rows, `transport_eleves_${new Date().toISOString().slice(0, 10)}`, 'Transport');
              toast({ title: 'Export réussi', description: `${rows.length} élève(s)` });
            }}>
              <Download className="h-4 w-4 mr-1" /> Exporter
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Zone</TableHead>
                    <TableHead>Chauffeur/Bus</TableHead>
                    <TableHead className="text-right">Prix/mois</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                  ) : filteredEleves.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève inscrit au transport</TableCell></TableRow>
                  ) : filteredEleves.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                      <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                      <TableCell>{e.classes?.nom || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{(e.zones_transport as any)?.nom || '—'}</Badge></TableCell>
                      <TableCell className="text-sm">{(e.zones_transport as any)?.chauffeur_bus || '—'}</TableCell>
                      <TableCell className="text-right font-mono">{Number((e.zones_transport as any)?.prix_mensuel || 0).toLocaleString()} F</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">{filteredEleves.length} élève(s)</p>
        </TabsContent>

        {/* Tab: Suivi mensuel */}
        <TabsContent value="suivi" className="space-y-4 mt-4">
          <div className="flex gap-3 items-center">
            <Label>Zone :</Label>
            <Select value={selectedZone?.id || ''} onValueChange={id => setSelectedZone(statsParZone.find(z => z.id === id) || null)}>
              <SelectTrigger className="w-[250px]"><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
              <SelectContent>
                {statsParZone.map(z => (
                  <SelectItem key={z.id} value={z.id}>{z.nom} ({z.effectif} élèves)</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedZone && (
              <div className="ml-auto text-sm text-muted-foreground">
                Attendu: <strong>{selectedZone.totalAttendu.toLocaleString()} GNF</strong> •
                Payé: <strong className="text-accent">{selectedZone.totalPaye.toLocaleString()} GNF</strong> •
                Taux: <Badge variant={selectedZone.taux >= 75 ? 'default' : 'destructive'}>{selectedZone.taux}%</Badge>
              </div>
            )}
          </div>

          {selectedZone ? (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-background z-10">Élève</TableHead>
                        <TableHead>Classe</TableHead>
                        {MOIS_SCOLAIRES.map(m => (
                          <TableHead key={m} className="text-center text-xs min-w-[60px]">{m.slice(0, 3)}</TableHead>
                        ))}
                        <TableHead className="text-center">Payés</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {suiviMensuelZone.length === 0 ? (
                        <TableRow><TableCell colSpan={13} className="text-center py-8 text-muted-foreground">Aucun élève dans cette zone</TableCell></TableRow>
                      ) : suiviMensuelZone.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="sticky left-0 bg-background font-medium whitespace-nowrap">{e.nom}</TableCell>
                          <TableCell className="text-xs">{e.classe}</TableCell>
                          {MOIS_SCOLAIRES.map(m => {
                            const paid = e.moisPayes.includes(m);
                            return (
                              <TableCell key={m} className="text-center p-1">
                                {paid ? (
                                  <CheckCircle className="h-4 w-4 text-accent mx-auto" />
                                ) : (
                                  <button
                                    className="mx-auto flex items-center justify-center rounded-full h-6 w-6 hover:bg-primary/10 transition-colors group"
                                    title={`Payer ${m} pour ${e.nom}`}
                                    onClick={() => setQuickPay({ eleveId: e.id, eleveName: e.nom, mois: m, montant: selectedZone.prixMensuel })}
                                  >
                                    <Circle className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                                  </button>
                                )}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center">
                             <Badge variant={e.nbMoisPayes >= 8 ? 'default' : e.nbMoisPayes >= 5 ? 'secondary' : 'destructive'}>
                              {e.nbMoisPayes}/10
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{e.totalPaye.toLocaleString()} F</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Bus className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Sélectionnez une zone pour voir le suivi mensuel des paiements transport</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        {/* Tab: Cartes transport */}
        <TabsContent value="cartes" className="mt-4">
          <CarteTransportEleve zones={zones} />
        </TabsContent>

        {/* Tab: Validation bus */}
        <TabsContent value="validation" className="mt-4">
          <ValidationTransportBus />
        </TabsContent>
      </Tabs>

      {/* Quick pay dialog */}
      <Dialog open={!!quickPay} onOpenChange={() => setQuickPay(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmer le paiement transport</DialogTitle></DialogHeader>
          {quickPay && (
            <div className="space-y-4">
              <div className="text-sm space-y-1">
                <p><strong>Élève :</strong> {quickPay.eleveName}</p>
                <p><strong>Mois :</strong> {quickPay.mois}</p>
                <p><strong>Zone :</strong> {selectedZone?.nom}</p>
                <p><strong>Montant :</strong> <span className="text-lg font-bold">{quickPay.montant.toLocaleString()} GNF</span></p>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setQuickPay(null)}>Annuler</Button>
                <Button onClick={async () => {
                  try {
                    const { error } = await supabase.from('paiements').insert({
                      eleve_id: quickPay.eleveId,
                      montant: quickPay.montant,
                      type_paiement: 'transport',
                      canal: 'especes',
                      mois_concerne: quickPay.mois,
                    } as any);
                    if (error) throw error;
                    queryClient.invalidateQueries({ queryKey: ['transport-paiements'] });
                    toast({ title: 'Paiement enregistré', description: `${quickPay.eleveName} — ${quickPay.mois} — ${quickPay.montant.toLocaleString()} GNF` });
                    setQuickPay(null);
                  } catch (err: any) {
                    toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
                  }
                }}>
                  Confirmer le paiement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
