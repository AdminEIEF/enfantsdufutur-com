import { useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Bus, MapPin, Users, Search, Download, CreditCard, ScanLine, Route, TrendingUp, Bell, LinkIcon, Settings, User, Phone, Navigation2, GraduationCap, Printer, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { QRCodeCanvas } from 'qrcode.react';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import html2canvas from 'html2canvas';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { exportToExcel } from '@/lib/excelUtils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import CarteTransportEleve from '@/components/CarteTransportEleve';
import ValidationTransportBus from '@/components/ValidationTransportBus';
import ItinerairesTransport from '@/components/transport/ItinerairesTransport';
import PonctualiteTransport from '@/components/transport/PonctualiteTransport';
import AlertesTransport from '@/components/transport/AlertesTransport';
import ChauffeurDashboard from '@/components/transport/ChauffeurDashboard';
import AssignationBusChauffeur from '@/components/transport/AssignationBusChauffeur';
import GestionTransport from '@/components/transport/GestionTransport';

const COLORS = [
  'hsl(220, 70%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(162, 63%, 41%)',
  'hsl(200, 80%, 50%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)',
];

export default function Transport() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'zones';
  const { hasRole } = useAuth();
  const isChauffeur = hasRole('chauffeur') && !hasRole('admin') && !hasRole('secretaire');
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [filterZone, setFilterZone] = useState('all');
  const [filterClasseZone, setFilterClasseZone] = useState('all');
  const [expandedClasse, setExpandedClasse] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const { data: schoolConfig } = useSchoolConfig();

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
        .select('id, nom, prenom, matricule, statut, zone_transport_id, classe_id, photo_url, classes(nom), zones_transport:zone_transport_id(id, nom, quartiers)')
        .not('zone_transport_id', 'is', null)
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Véhicules avec chauffeur assigné (source unique de vérité pour chauffeur par zone)
  const { data: vehiculesAssignes = [] } = useQuery({
    queryKey: ['vehicules-assignation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicules_transport')
        .select('id, immatriculation, marque, capacite, zone_transport_id, chauffeur_id, employes:chauffeur_id(id, nom, prenom, telephone)')
        .eq('actif', true)
        .order('immatriculation');
      if (error) throw error;
      return data;
    },
  });

  // Recharges transport
  const { data: recharges = [] } = useQuery({
    queryKey: ['transport-recharges-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recharges_transport')
        .select('*')
        .order('date_recharge', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const getActiveRecharge = (eleveId: string) => {
    return recharges.find(
      (r: any) => r.eleve_id === eleveId && r.actif && new Date(r.date_expiration) > new Date()
    );
  };

  const getDaysRemaining = (dateExpiration: string) => {
    const diff = new Date(dateExpiration).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const exportCard = async () => {
    if (!cardRef.current) return;
    const canvas = await html2canvas(cardRef.current, { scale: 4, useCORS: true, backgroundColor: null });
    const link = document.createElement('a');
    link.download = `carte_transport_${selectedStudent?.matricule || 'eleve'}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast({ title: 'Carte exportée' });
  };

  // ─── Computed ─────────────────────────────────────────
  const filteredEleves = useMemo(() => {
    return eleves.filter((e: any) => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
      const matchZone = filterZone === 'all' || e.zone_transport_id === filterZone;
      return matchSearch && matchZone;
    });
  }, [eleves, search, filterZone]);

  // Stats par zone — chauffeur vient de vehicules_transport.chauffeur_id
  const statsParZone = useMemo(() => {
    return zones.map((z: any) => {
      const elevesZone = eleves.filter((e: any) => e.zone_transport_id === z.id);
      const veh = vehiculesAssignes.find((v: any) => v.zone_transport_id === z.id);
      const chauffeur = veh?.employes;
      return {
        id: z.id,
        nom: z.nom,
        chauffeurNom: chauffeur ? `${chauffeur.prenom} ${chauffeur.nom}` : null,
        chauffeurTel: chauffeur?.telephone || '',
        busImmat: veh?.immatriculation || null,
        quartiers: z.quartiers || [],
        effectif: elevesZone.length,
      };
    });
  }, [zones, eleves, vehiculesAssignes]);

  const totalElevesTransport = eleves.length;
  const nbChauffeurs = vehiculesAssignes.filter((v: any) => v.chauffeur_id).length;
  const chartEffectif = statsParZone.map(z => ({ name: z.nom, value: z.effectif }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Bus className="h-7 w-7 text-primary" /> Transport scolaire
      </h1>

      {/* KPIs */}
      {!isChauffeur && (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
              <Bus className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Chauffeurs assignés</p>
                <p className="text-2xl font-bold">{nbChauffeurs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      )}

      {isChauffeur ? (
        <ChauffeurDashboard />
      ) : (
      <Tabs defaultValue={initialTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="zones">Zones</TabsTrigger>
          <TabsTrigger value="eleves">Élèves</TabsTrigger>
          <TabsTrigger value="itineraires" className="gap-1"><Route className="h-3.5 w-3.5" /> Itinéraires</TabsTrigger>
          <TabsTrigger value="cartes" className="gap-1"><CreditCard className="h-3.5 w-3.5" /> Cartes</TabsTrigger>
          <TabsTrigger value="ponctualite" className="gap-1"><TrendingUp className="h-3.5 w-3.5" /> Ponctualité</TabsTrigger>
          <TabsTrigger value="assignation" className="gap-1"><LinkIcon className="h-3.5 w-3.5" /> Assignation</TabsTrigger>
          <TabsTrigger value="alertes" className="gap-1"><Bell className="h-3.5 w-3.5" /> Alertes</TabsTrigger>
          <TabsTrigger value="par-classe" className="gap-1"><GraduationCap className="h-3.5 w-3.5" /> Par Classe</TabsTrigger>
          <TabsTrigger value="validation" className="gap-1"><ScanLine className="h-3.5 w-3.5" /> Scan</TabsTrigger>
          <TabsTrigger value="gestion" className="gap-1"><Settings className="h-3.5 w-3.5" /> Gestion</TabsTrigger>
        </TabsList>

        {/* Tab: Zones */}
        <TabsContent value="zones" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statsParZone.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-8 text-center text-muted-foreground">Aucune zone configurée</CardContent>
              </Card>
            ) : statsParZone.map((z, i) => {
              const color = COLORS[i % COLORS.length];
              return (
                <Card key={z.id} className="border-l-4 cursor-pointer hover:shadow-md transition-shadow" style={{ borderLeftColor: color }}
                  onClick={() => setSelectedZone(z)}>
                  <CardContent className="pt-4 pb-3 px-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{z.nom}</h3>
                        {z.chauffeurNom ? (
                          <p className="text-xs text-muted-foreground">🚐 {z.chauffeurNom}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">Pas de chauffeur</p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-xs">{z.effectif} élèves</Badge>
                    </div>
                    {z.quartiers.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/70 line-clamp-1">{z.quartiers.join(', ')}</p>
                    )}
                    <div className="flex items-center justify-between text-xs">
                      {z.busImmat && <span className="font-mono text-muted-foreground">🚌 {z.busImmat}</span>}
                      {z.chauffeurTel && <span className="text-muted-foreground">📞 {z.chauffeurTel}</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Graphique répartition */}
          <Card>
            <CardHeader><CardTitle className="text-base">Répartition des élèves par zone</CardTitle></CardHeader>
            <CardContent>
              {chartEffectif.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(200, chartEffectif.length * 50)}>
                  <BarChart data={chartEffectif} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(val: number) => [`${val} élève(s)`, 'Effectif']} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={28}>
                      {chartEffectif.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Aucune donnée</div>
              )}
            </CardContent>
          </Card>

          {/* Dialog détails zone */}
          <Dialog open={!!selectedZone} onOpenChange={(o) => !o && setSelectedZone(null)}>
            <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
              {selectedZone && (
                <>
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      {selectedZone.nom}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-4">
                    {/* Infos zone */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-[11px] text-muted-foreground mb-1">🚌 Bus assigné</p>
                        <p className="font-mono font-bold text-sm">{selectedZone.busImmat || 'Non assigné'}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-[11px] text-muted-foreground mb-1">👥 Effectif</p>
                        <p className="font-bold text-sm">{selectedZone.effectif} élève(s)</p>
                      </div>
                    </div>

                    {/* Chauffeur */}
                    {selectedZone.chauffeurNom && (
                      <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border border-primary/10">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{selectedZone.chauffeurNom}</p>
                          {selectedZone.chauffeurTel && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {selectedZone.chauffeurTel}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quartiers */}
                    {selectedZone.quartiers.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">📍 Quartiers desservis</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedZone.quartiers.map((q: string, i: number) => (
                            <Badge key={i} variant="secondary" className="text-xs">{q}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Liste des élèves */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">🎓 Élèves inscrits</p>
                      {(() => {
                        const zoneEleves = eleves.filter((e: any) => e.zone_transport_id === selectedZone.id);
                        if (zoneEleves.length === 0) return <p className="text-sm text-muted-foreground italic">Aucun élève dans cette zone</p>;
                        return (
                          <div className="space-y-1 max-h-[200px] overflow-y-auto">
                            {zoneEleves.map((e: any) => (
                              <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm">
                                <span className="font-medium">{e.prenom} {e.nom}</span>
                                <span className="text-xs text-muted-foreground">{e.classes?.nom || '—'}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </>
              )}
            </DialogContent>
          </Dialog>
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
              const rows = filteredEleves.map((e: any) => {
                const veh = vehiculesAssignes.find((v: any) => v.zone_transport_id === e.zone_transport_id);
                const chauffeur = veh?.employes;
                return {
                  Matricule: e.matricule || '',
                  Nom: e.nom,
                  Prénom: e.prenom,
                  Classe: e.classes?.nom || '',
                  Zone: (e.zones_transport as any)?.nom || '',
                  Chauffeur: chauffeur ? `${chauffeur.prenom} ${chauffeur.nom}` : '',
                };
              });
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
                    <TableHead>Chauffeur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                  ) : filteredEleves.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun élève inscrit au transport</TableCell></TableRow>
                  ) : filteredEleves.map((e: any) => {
                    const veh = vehiculesAssignes.find((v: any) => v.zone_transport_id === e.zone_transport_id);
                    const chauffeur = veh?.employes;
                    return (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                      <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                      <TableCell>{e.classes?.nom || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{(e.zones_transport as any)?.nom || '—'}</Badge></TableCell>
                      <TableCell className="text-sm">{chauffeur ? `${chauffeur.prenom} ${chauffeur.nom}` : '—'}</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">{filteredEleves.length} élève(s)</p>
        </TabsContent>

        {/* Tab: Itinéraires */}
        <TabsContent value="itineraires" className="mt-4">
          <ItinerairesTransport zones={zones} />
        </TabsContent>

        {/* Tab: Cartes transport */}
        <TabsContent value="cartes" className="mt-4">
          <CarteTransportEleve zones={zones} />
        </TabsContent>

        {/* Tab: Ponctualité */}
        <TabsContent value="ponctualite" className="mt-4">
          <PonctualiteTransport />
        </TabsContent>

        {/* Tab: Assignation */}
        <TabsContent value="assignation" className="mt-4">
          <AssignationBusChauffeur />
        </TabsContent>

        {/* Tab: Alertes */}
        <TabsContent value="alertes" className="mt-4">
          <AlertesTransport zones={zones} />
        </TabsContent>

        {/* Tab: Par Classe */}
        <TabsContent value="par-classe" className="space-y-4 mt-4">
          {(() => {
            const elevesFiltered = filterClasseZone === 'all' ? eleves : eleves.filter((e: any) => e.zone_transport_id === filterClasseZone);
            const grouped: Record<string, { classeName: string; eleves: any[] }> = {};
            elevesFiltered.forEach((e: any) => {
              const cn = e.classes?.nom || 'Sans classe';
              if (!grouped[cn]) grouped[cn] = { classeName: cn, eleves: [] };
              grouped[cn].eleves.push(e);
            });
            const sorted = Object.values(grouped).sort((a, b) => a.classeName.localeCompare(b.classeName, 'fr', { numeric: true }));
            return (
              <>
                <div className="flex gap-3 flex-wrap items-center">
                  <Select value={filterClasseZone} onValueChange={setFilterClasseZone}>
                    <SelectTrigger className="w-[220px]"><SelectValue placeholder="Filtrer par zone" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les zones</SelectItem>
                      {zones.map((z: any) => <SelectItem key={z.id} value={z.id}>{z.nom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-sm gap-1.5 px-3 py-1.5">
                    <Users className="h-3.5 w-3.5" /> {elevesFiltered.length} élève(s) — {sorted.length} classe(s)
                  </Badge>
                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
                    const rows = sorted.flatMap(g => g.eleves.map((e: any) => ({
                      Classe: g.classeName,
                      Matricule: e.matricule || '',
                      Nom: e.nom,
                      Prénom: e.prenom,
                      Zone: (e.zones_transport as any)?.nom || '',
                    })));
                    exportToExcel(rows, `transport_par_classe_${new Date().toISOString().slice(0, 10)}`, 'Par Classe');
                    toast({ title: 'Export réussi', description: `${rows.length} élève(s)` });
                  }}>
                    <Download className="h-4 w-4 mr-1" /> Exporter
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sorted.map((g) => (
                    <Card key={g.classeName} className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary/60"
                      onClick={() => setExpandedClasse(expandedClasse === g.classeName ? null : g.classeName)}>
                      <CardContent className="pt-4 pb-3 px-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <GraduationCap className="h-4 w-4 text-primary" />
                            <span className="font-semibold text-sm">{g.classeName}</span>
                          </div>
                          <Badge className="bg-primary/10 text-primary border-0 font-bold">{g.eleves.length}</Badge>
                        </div>
                        {expandedClasse === g.classeName && (
                          <div className="space-y-1 mt-3 pt-3 border-t max-h-[250px] overflow-y-auto">
                            {g.eleves.sort((a: any, b: any) => a.nom.localeCompare(b.nom)).map((e: any) => {
                              const recharge = getActiveRecharge(e.id);
                              const jours = recharge ? getDaysRemaining(recharge.date_expiration) : 0;
                              return (
                                <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-sm cursor-pointer"
                                  onClick={(ev) => { ev.stopPropagation(); setSelectedStudent({ ...e, recharge }); }}>
                                  <span className="font-medium">{e.prenom} {e.nom}</span>
                                  <div className="flex items-center gap-2">
                                    {recharge ? (
                                      <span className={`text-[10px] font-semibold ${jours <= 5 ? 'text-destructive' : jours <= 10 ? 'text-warning' : 'text-accent'}`}>
                                        {jours}j restants
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-destructive font-semibold">Expirée</span>
                                    )}
                                    <Badge variant="outline" className="text-[10px]">{(e.zones_transport as any)?.nom || '—'}</Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {sorted.length === 0 && (
                  <Card><CardContent className="py-8 text-center text-muted-foreground">Aucun élève inscrit au transport</CardContent></Card>
                )}
              </>
            );
          })()}
        </TabsContent>

        {/* Dialog détail élève + carte transport */}
        <Dialog open={!!selectedStudent} onOpenChange={(o) => !o && setSelectedStudent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Détail transport</DialogTitle></DialogHeader>
            {selectedStudent && (
              <div className="space-y-4">
                {/* Info élève */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Élève</p>
                    <p className="font-bold text-sm">{selectedStudent.prenom} {selectedStudent.nom}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Classe</p>
                    <p className="font-bold text-sm">{selectedStudent.classes?.nom || '—'}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Zone</p>
                    <p className="font-bold text-sm">{(selectedStudent.zones_transport as any)?.nom || '—'}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[11px] text-muted-foreground mb-1">Statut carte</p>
                    {selectedStudent.recharge ? (
                      <div>
                        <Badge className="bg-accent/10 text-accent border-0 text-xs">Active</Badge>
                        <p className={`text-xs mt-1 font-semibold ${getDaysRemaining(selectedStudent.recharge.date_expiration) <= 5 ? 'text-destructive' : ''}`}>
                          <Clock className="h-3 w-3 inline mr-1" />
                          {getDaysRemaining(selectedStudent.recharge.date_expiration)} jour(s) restant(s)
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Expire le {new Date(selectedStudent.recharge.date_expiration).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Expirée / Non rechargée</Badge>
                    )}
                  </div>
                </div>

                {/* Carte PVC */}
                <div
                  ref={cardRef}
                  className="relative mx-auto overflow-hidden"
                  style={{
                    width: 400, height: 252, borderRadius: 14,
                    fontFamily: "'Inter', 'Space Grotesk', sans-serif",
                    background: '#FFFFFF',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.13)',
                  }}
                >
                  <svg className="absolute bottom-0 left-0 w-full" viewBox="0 0 400 90" preserveAspectRatio="none" style={{ height: 90 }}>
                    <path d="M0,40 C80,0 160,70 240,35 C300,10 360,50 400,25 L400,90 L0,90 Z" fill="#F87171" opacity="0.5" />
                    <path d="M0,55 C60,30 140,75 220,50 C290,30 350,65 400,40 L400,90 L0,90 Z" fill="#4ADE80" opacity="0.4" />
                  </svg>
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-[0.06]">
                    <svg width="140" height="90" viewBox="0 0 140 90" fill="none">
                      <rect x="10" y="15" width="110" height="50" rx="8" fill="#F59E0B" />
                      <rect x="15" y="22" width="22" height="18" rx="3" fill="#FDE68A" />
                      <rect x="42" y="22" width="22" height="18" rx="3" fill="#FDE68A" />
                      <rect x="69" y="22" width="22" height="18" rx="3" fill="#FDE68A" />
                      <rect x="96" y="22" width="18" height="18" rx="3" fill="#FDE68A" />
                      <circle cx="35" cy="70" r="10" fill="#374151" /><circle cx="35" cy="70" r="5" fill="#9CA3AF" />
                      <circle cx="95" cy="70" r="10" fill="#374151" /><circle cx="95" cy="70" r="5" fill="#9CA3AF" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between px-4 pt-3 pb-1 relative z-10">
                    <div className="flex items-center gap-2">
                      {schoolConfig?.logo_url ? (
                        <img src={schoolConfig.logo_url} alt="Logo" className="h-8 w-8 rounded-full object-cover" crossOrigin="anonymous" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center"><Bus className="h-4 w-4 text-primary" /></div>
                      )}
                      <p style={{ fontSize: 9, color: '#DC2626', fontWeight: 900, textTransform: 'uppercase' }}>{schoolConfig?.nom || 'École'}</p>
                    </div>
                    <div className="flex items-center gap-1 px-3 py-1 rounded-full mx-auto" style={{ background: '#FCD34D', fontSize: 8, fontWeight: 700, color: '#92400E' }}>
                      <Bus style={{ width: 10, height: 10 }} /> TRANSPORT SCOLAIRE
                    </div>
                  </div>
                  <div className="flex gap-3 px-4 pt-2 relative z-10" style={{ height: 140 }}>
                    <div className="flex-shrink-0 rounded-lg overflow-hidden bg-muted border" style={{ width: 72, height: 90, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                      {selectedStudent.photo_url ? (
                        <img src={selectedStudent.photo_url} alt="Photo" className="w-full h-full object-cover object-top" crossOrigin="anonymous" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground" style={{ fontSize: 10 }}>Photo</div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-0.5">
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#1F2937', lineHeight: 1.1 }}>{selectedStudent.prenom} {selectedStudent.nom}</p>
                        <div className="flex gap-3 mt-1.5">
                          <div>
                            <p style={{ fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase' }}>Matricule</p>
                            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151', fontFamily: 'monospace' }}>{selectedStudent.matricule || '—'}</p>
                          </div>
                          <div>
                            <p style={{ fontSize: 7, color: '#9CA3AF', textTransform: 'uppercase' }}>Classe</p>
                            <p style={{ fontSize: 10, fontWeight: 600, color: '#374151' }}>{selectedStudent.classes?.nom || '—'}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 rounded-md px-2 py-1 mt-1" style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', width: 'fit-content' }}>
                        <MapPin style={{ width: 10, height: 10, color: '#3B82F6' }} />
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#1E40AF' }}>LIGNE : {(selectedStudent.zones_transport as any)?.nom || '—'}</span>
                      </div>
                      <div className="mt-1">
                        {selectedStudent.recharge ? (
                          <div className="flex items-center gap-2">
                            <div className="rounded-full px-2 py-0.5" style={{ background: '#D1FAE5', fontSize: 7, fontWeight: 600, color: '#065F46' }}>● ACTIVE</div>
                            <span style={{ fontSize: 8, color: '#6B7280' }}>Expire le {new Date(selectedStudent.recharge.date_expiration).toLocaleDateString('fr-FR')}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-center justify-center">
                      <div className="bg-white rounded-lg p-2" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.1)', border: '2px solid #E5E7EB' }}>
                        <QRCodeCanvas value={JSON.stringify({ type: 'transport', matricule: selectedStudent.matricule, id: selectedStudent.id })} size={90} level="H" includeMargin={false} />
                      </div>
                      <p style={{ fontSize: 6, color: '#9CA3AF', marginTop: 3 }}>Scanner pour valider</p>
                    </div>
                  </div>
                   <div className="absolute bottom-1.5 left-4 right-4 flex justify-between items-center z-10">
                     <p style={{ fontSize: 7, color: '#111827', fontWeight: 700 }}>{schoolConfig?.ville || 'Conakry, Guinée'}</p>
                     <p style={{ fontSize: 6, color: '#111827', fontWeight: 600 }}>Année scolaire 2025-2026</p>
                   </div>
                </div>

                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setSelectedStudent(null)}>Fermer</Button>
                  <Button onClick={exportCard}><Download className="h-4 w-4 mr-1" /> Exporter PNG</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Tab: Validation bus */}
        <TabsContent value="validation" className="mt-4">
          <ValidationTransportBus />
        </TabsContent>

        {/* Tab: Gestion */}
        <TabsContent value="gestion" className="mt-4">
          <GestionTransport />
        </TabsContent>
      </Tabs>
      )}
    </div>
  );
}
