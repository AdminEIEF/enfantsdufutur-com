import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { ClipboardList, Search, User, Users, UserCheck, Edit, QrCode, Printer, Download, ShieldCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { useToast } from '@/hooks/use-toast';
import { exportToExcel } from '@/lib/excelUtils';
import { generateBadgeRetrait } from '@/lib/generateBadgeRetrait';

const MOIS_SCOLAIRES = ['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'];
type TrancheConfig = { label: string; mois: string[]; montant: number };

export default function Eleves() {
  const [search, setSearch] = useState('');
  const [filterCycle, setFilterCycle] = useState('all');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'famille' | 'individuel'>('all');
  const [selected, setSelected] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [badgeEleve, setBadgeEleve] = useState<any>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['eleves-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('*, classes(nom, niveau_id, niveaux:niveau_id(nom, frais_scolarite, cycle_id, cycles:cycle_id(nom, id))), familles(id, nom_famille, telephone_pere, telephone_mere, email_parent)')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: cycles = [] } = useQuery({
    queryKey: ['cycles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cycles').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['classes-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, niveaux:niveau_id(nom, cycle_id)').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: mandatairesAll = [] } = useQuery({
    queryKey: ['mandataires-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('mandataires').select('*').order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const { data: paiementsAll = [] } = useQuery({
    queryKey: ['paiements-all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('paiements').select('*').eq('type_paiement', 'scolarite');
      if (error) throw error;
      return data;
    },
  });

  const { data: tranchesConfig = {} } = useQuery({
    queryKey: ['parametres-tranches-v2'],
    queryFn: async () => {
      const { data, error } = await supabase.from('parametres').select('*').eq('cle', 'tranches_paiement_v2').maybeSingle();
      if (error) throw error;
      if (data?.valeur && typeof data.valeur === 'object' && !Array.isArray(data.valeur)) {
        return data.valeur as Record<string, TrancheConfig[]>;
      }
      return {} as Record<string, TrancheConfig[]>;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { id, ...rest } = updates;
      const { error } = await supabase.from('eleves').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-full'] });
      setEditing(null);
      toast({ title: 'Élève mis à jour' });
    },
  });

  const filteredClasses = filterCycle === 'all'
    ? classes
    : classes.filter((c: any) => c.niveaux?.cycle_id === filterCycle);

  const filtered = eleves.filter((e: any) => {
    const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase());
    const matchCycle = filterCycle === 'all' || e.classes?.niveaux?.cycles?.id === filterCycle;
    const matchClasse = filterClasse === 'all' || e.classe_id === filterClasse;
    const isFamille = !!e.famille_id;
    const matchType = filterType === 'all' || (filterType === 'famille' ? isFamille : !isFamille);
    return matchSearch && matchCycle && matchClasse && matchType;
  });

  const totalFamille = eleves.filter((e: any) => !!e.famille_id).length;
  const totalIndividuel = eleves.filter((e: any) => !e.famille_id).length;

  const handleSaveEdit = () => {
    if (!editing) return;
    updateMutation.mutate({
      id: editing.id,
      nom: editing.nom,
      prenom: editing.prenom,
      sexe: editing.sexe,
      date_naissance: editing.date_naissance,
      classe_id: editing.classe_id,
      transport_zone: editing.transport_zone,
      option_cantine: editing.option_cantine,
    });
  };

  const buildQrData = (eleve: any) => {
    const baseUrl = window.location.origin;
    return JSON.stringify({
      matricule: eleve.matricule || '',
      nom: eleve.nom,
      prenom: eleve.prenom,
      classe: eleve.classes?.nom || '',
      sexe: eleve.sexe || '',
      url: `${baseUrl}/eleves?matricule=${encodeURIComponent(eleve.matricule || eleve.id)}`,
    });
  };

  const printBadge = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow || !badgeEleve) return;
    const qrValue = buildQrData(badgeEleve);
    printWindow.document.write(`<!DOCTYPE html><html><head><title>Badge ${badgeEleve.prenom} ${badgeEleve.nom}</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; }
        .badge { border: 2px solid #333; border-radius: 12px; padding: 24px; width: 320px; text-align: center; }
        .badge h2 { margin: 0 0 4px; font-size: 18px; }
        .badge .school { color: #666; font-size: 12px; margin-bottom: 16px; }
        .badge .name { font-size: 22px; font-weight: bold; margin: 12px 0 4px; }
        .badge .info { color: #555; font-size: 13px; }
        .badge .matricule { font-family: monospace; font-size: 14px; margin-top: 8px; color: #333; }
        .qr { margin: 16px auto; }
      </style></head><body>
      <div class="badge">
        <h2>Carte Scolaire</h2>
        <p class="school">${badgeEleve.classes?.niveaux?.cycles?.nom || ''} — ${badgeEleve.classes?.nom || ''}</p>
        <div class="qr"><svg id="qr"></svg></div>
        <p class="name">${badgeEleve.prenom} ${badgeEleve.nom}</p>
        <p class="info">${badgeEleve.sexe || ''} • ${badgeEleve.date_naissance || ''}</p>
        <p class="matricule">${badgeEleve.matricule || '—'}</p>
      </div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
      <script>
        QRCode.toCanvas(document.createElement('canvas'), ${JSON.stringify(qrValue)}, { width: 150 }, function(err, canvas) {
          document.querySelector('.qr').appendChild(canvas);
          setTimeout(() => window.print(), 300);
        });
      <\/script>
      </body></html>`);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-7 w-7 text-primary" /> Élèves
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold">{eleves.length}</p><p className="text-xs text-muted-foreground">Total élèves</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-blue-500" />
          <div><p className="text-2xl font-bold">{totalFamille}</p><p className="text-xs text-muted-foreground">En famille</p></div>
        </CardContent></Card>
        <Card><CardContent className="pt-4 flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-orange-500" />
          <div><p className="text-2xl font-bold">{totalIndividuel}</p><p className="text-xs text-muted-foreground">Individuels</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher nom, prénom, matricule..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCycle} onValueChange={v => { setFilterCycle(v); setFilterClasse('all'); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Cycle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les cycles</SelectItem>
            {cycles.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {filteredClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="famille">En famille</SelectItem>
            <SelectItem value="individuel">Individuel</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
          const rows = filtered.map((e: any) => ({
            Matricule: e.matricule || '',
            Nom: e.nom,
            Prénom: e.prenom,
            Sexe: e.sexe || '',
            'Date de naissance': e.date_naissance || '',
            Cycle: e.classes?.niveaux?.cycles?.nom || '',
            Classe: e.classes?.nom || '',
            Statut: e.statut,
            'Nom du père': e.nom_prenom_pere || '',
            'Nom de la mère': e.nom_prenom_mere || '',
            Famille: e.familles?.nom_famille || '',
            'Tél. père': e.familles?.telephone_pere || '',
            'Tél. mère': e.familles?.telephone_mere || '',
            Email: e.familles?.email_parent || '',
            Cantine: e.option_cantine ? 'Oui' : 'Non',
            'Solde cantine': Number(e.solde_cantine || 0),
            Transport: e.transport_zone || '',
            'Uniforme scolaire': e.uniforme_scolaire ? 'Oui' : 'Non',
            'Uniforme sport': e.uniforme_sport ? 'Oui' : 'Non',
            'Livret': e.checklist_livret ? 'Oui' : 'Non',
            'Rames': e.checklist_rames ? 'Oui' : 'Non',
            'Marqueurs': e.checklist_marqueurs ? 'Oui' : 'Non',
            'Photo': e.checklist_photo ? 'Oui' : 'Non',
          }));
          exportToExcel(rows, `eleves_${new Date().toISOString().slice(0, 10)}`, 'Élèves');
          toast({ title: 'Export réussi', description: `${rows.length} élève(s) exporté(s)` });
        }}>
          <Download className="h-4 w-4 mr-1" /> Exporter Excel
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Matricule</TableHead><TableHead>Nom</TableHead><TableHead>Prénom</TableHead>
                <TableHead>Sexe</TableHead><TableHead>Cycle</TableHead><TableHead>Classe</TableHead>
                <TableHead>Statut</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun élève trouvé</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => setSelected(e)}>
                  <TableCell>
                    {e.famille_id ? (
                      <Badge variant="default" className="gap-1 text-xs"><Users className="h-3 w-3" />Famille</Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-xs"><UserCheck className="h-3 w-3" />Individuel</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.matricule || '—'}</TableCell>
                  <TableCell className="font-medium">{e.nom}</TableCell>
                  <TableCell>{e.prenom}</TableCell>
                  <TableCell>{e.sexe || '—'}</TableCell>
                  <TableCell><Badge variant="outline">{e.classes?.niveaux?.cycles?.nom || '—'}</Badge></TableCell>
                  <TableCell>{e.classes?.nom || '—'}</TableCell>
                  <TableCell><Badge variant={e.statut === 'inscrit' ? 'default' : 'secondary'}>{e.statut}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end" onClick={ev => ev.stopPropagation()}>
                      <Button size="icon" variant="ghost" onClick={() => setEditing({ ...e })}><Edit className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => setBadgeEleve(e)}><QrCode className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">{filtered.length} élève(s) trouvé(s)</div>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><User className="h-5 w-5" /> {selected?.prenom} {selected?.nom}</DialogTitle></DialogHeader>
          {selected && (() => {
            const niveauId = selected.classes?.niveau_id || null;
            const eleveTranches: TrancheConfig[] = (niveauId && tranchesConfig[niveauId]) ? tranchesConfig[niveauId] : [];
            const elevePaiements = paiementsAll.filter((p: any) => p.eleve_id === selected.id);
            const moisPayes = elevePaiements.map((p: any) => p.mois_concerne).filter(Boolean) as string[];
            const fraisAnnuels = Number(selected.classes?.niveaux?.frais_scolarite || 0);
            const totalPaye = elevePaiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
            const resteAPayer = Math.max(0, fraisAnnuels * 9 - totalPaye);

            // Build month -> tranche map
            const moisToTranche: Record<string, TrancheConfig> = {};
            eleveTranches.forEach(t => t.mois.forEach(m => { moisToTranche[m] = t; }));

            // Check if a tranche is fully paid (all its months are paid)
            const isTranchePaid = (t: TrancheConfig) => t.mois.every(m => moisPayes.includes(m));

            return (
            <Tabs defaultValue="info" className="mt-2">
              <TabsList className="grid w-full grid-cols-4"><TabsTrigger value="info">Infos</TabsTrigger><TabsTrigger value="scolarite">Scolarité</TabsTrigger><TabsTrigger value="options">Options</TabsTrigger><TabsTrigger value="famille">Famille</TabsTrigger></TabsList>
              <TabsContent value="info" className="space-y-3 text-sm mt-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><strong>Matricule:</strong> {selected.matricule || '—'}</div>
                  <div><strong>Sexe:</strong> {selected.sexe || '—'}</div>
                  <div><strong>Date de naissance:</strong> {selected.date_naissance || '—'}</div>
                  <div><strong>Statut:</strong> <Badge>{selected.statut}</Badge></div>
                  <div><strong>Cycle:</strong> {selected.classes?.niveaux?.cycles?.nom || '—'}</div>
                  <div><strong>Classe:</strong> {selected.classes?.nom || '—'}</div>
                </div>
                <div className="flex items-center gap-2">
                  <strong>Type:</strong>
                  {selected.famille_id ? <Badge className="gap-1"><Users className="h-3 w-3" />En famille — {selected.familles?.nom_famille}</Badge> : <Badge variant="outline" className="gap-1"><UserCheck className="h-3 w-3" />Individuel</Badge>}
                </div>
              </TabsContent>

              {/* Scolarité tab - month-by-month status */}
              <TabsContent value="scolarite" className="space-y-3 text-sm mt-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Total annuel</p>
                    <p className="font-bold">{(fraisAnnuels * 9).toLocaleString()} GNF</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-xs text-muted-foreground">Payé</p>
                    <p className="font-bold text-green-600">{totalPaye.toLocaleString()} GNF</p>
                  </div>
                  <div className={`rounded-lg p-2 ${resteAPayer === 0 ? 'bg-green-50 dark:bg-green-950' : 'bg-destructive/10'}`}>
                    <p className="text-xs text-muted-foreground">Reste</p>
                    <p className={`font-bold ${resteAPayer === 0 ? 'text-green-600' : 'text-destructive'}`}>{resteAPayer.toLocaleString()} GNF</p>
                  </div>
                </div>

                {eleveTranches.length > 0 ? (
                  <div className="space-y-3">
                    {eleveTranches.map((t, idx) => {
                      const tranchePaid = isTranchePaid(t);
                      return (
                        <div key={idx} className={`rounded-lg border p-3 ${tranchePaid ? 'border-green-300 bg-green-50 dark:bg-green-950' : 'border-destructive/30 bg-destructive/5'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold text-sm">{t.label}</span>
                            <span className="text-xs font-medium">{t.montant.toLocaleString()} GNF</span>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {t.mois.map(m => {
                              const paid = moisPayes.includes(m);
                              return (
                                <div key={m} className={`text-center text-xs rounded py-1 px-1 ${paid ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                                  {m.slice(0, 3)}
                                  <span className="block text-[10px]">{paid ? '✓' : '✗'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Statut par mois :</p>
                    <div className="grid grid-cols-5 gap-1.5">
                      {MOIS_SCOLAIRES.map(m => {
                        const paid = moisPayes.includes(m);
                        return (
                          <div key={m} className={`text-center text-xs rounded py-1.5 px-1 ${paid ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-destructive/10 text-destructive'}`}>
                            {m.slice(0, 3)}
                            <span className="block text-[10px]">{paid ? '✓ Payé' : '✗ Impayé'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="options" className="space-y-3 text-sm mt-3">
                <div>
                  <h4 className="font-semibold mb-1">Check-list</h4>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant={selected.checklist_livret ? 'default' : 'outline'}>Livret {selected.checklist_livret ? '✓' : '✗'}</Badge>
                    <Badge variant={selected.checklist_rames ? 'default' : 'outline'}>Rames {selected.checklist_rames ? '✓' : '✗'}</Badge>
                    <Badge variant={selected.checklist_marqueurs ? 'default' : 'outline'}>Marqueurs {selected.checklist_marqueurs ? '✓' : '✗'}</Badge>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Options</h4>
                  <div className="flex gap-2 flex-wrap">
                    {selected.transport_zone && <Badge variant="outline">Transport: {selected.transport_zone}</Badge>}
                    {selected.option_cantine && <Badge variant="outline">Cantine</Badge>}
                    {selected.uniforme_scolaire && <Badge variant="outline">Uniforme scolaire</Badge>}
                    {selected.uniforme_sport && <Badge variant="outline">Uniforme sport</Badge>}
                    {selected.uniforme_polo_lacoste && <Badge variant="outline">Polo Lacoste</Badge>}
                    {selected.uniforme_karate && <Badge variant="outline">Karaté</Badge>}
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="famille" className="space-y-3 text-sm mt-3">
                {selected.familles ? (
                  <div>
                    <h4 className="font-semibold mb-1">Famille: {selected.familles.nom_famille}</h4>
                    <div className="text-muted-foreground space-y-1">
                      {selected.familles.telephone_pere && <p>Tél. père: {selected.familles.telephone_pere}</p>}
                      {selected.familles.telephone_mere && <p>Tél. mère: {selected.familles.telephone_mere}</p>}
                      {selected.familles.email_parent && <p>Email: {selected.familles.email_parent}</p>}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Élève inscrit individuellement, non rattaché à une famille.</p>
                )}
              </TabsContent>
            </Tabs>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Modifier l'élève</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nom</Label><Input value={editing.nom} onChange={e => setEditing({ ...editing, nom: e.target.value })} /></div>
                <div><Label>Prénom</Label><Input value={editing.prenom} onChange={e => setEditing({ ...editing, prenom: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Sexe</Label>
                  <Select value={editing.sexe || ''} onValueChange={v => setEditing({ ...editing, sexe: v })}>
                    <SelectTrigger><SelectValue placeholder="Sexe" /></SelectTrigger>
                    <SelectContent><SelectItem value="M">M</SelectItem><SelectItem value="F">F</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label>Date de naissance</Label><Input type="date" value={editing.date_naissance || ''} onChange={e => setEditing({ ...editing, date_naissance: e.target.value })} /></div>
              </div>
              <div><Label>Classe</Label>
                <Select value={editing.classe_id || ''} onValueChange={v => setEditing({ ...editing, classe_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Classe" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>{updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge QR dialog */}
      <Dialog open={!!badgeEleve} onOpenChange={() => setBadgeEleve(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" /> Badge QR</DialogTitle></DialogHeader>
          {badgeEleve && (() => {
            const cycleName = badgeEleve.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
            const isCrecheMaternelle = cycleName.includes('crèche') || cycleName.includes('creche') || cycleName.includes('maternelle');
            const eleveMandataires = (mandatairesAll as any[]).filter((m: any) => m.eleve_id === badgeEleve.id);

            return (
              <div className="text-center space-y-4">
                <div className="border rounded-xl p-6 space-y-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Carte Scolaire</p>
                  <p className="text-xs text-muted-foreground">{badgeEleve.classes?.niveaux?.cycles?.nom} — {badgeEleve.classes?.nom}</p>
                  {badgeEleve.photo_url && (
                    <img src={badgeEleve.photo_url} alt={badgeEleve.prenom} className="w-20 h-20 rounded-full object-cover border-2 border-primary mx-auto" />
                  )}
                  <div className="flex justify-center">
                    <QRCodeSVG value={buildQrData(badgeEleve)} size={150} />
                  </div>
                  <p className="text-lg font-bold">{badgeEleve.prenom} {badgeEleve.nom}</p>
                  <p className="text-sm text-muted-foreground">{badgeEleve.sexe} • {badgeEleve.date_naissance || ''}</p>
                  <p className="font-mono text-sm">{badgeEleve.matricule || '—'}</p>
                </div>

                {/* Mandataires preview for Crèche/Maternelle */}
                {isCrecheMaternelle && eleveMandataires.length > 0 && (
                  <div className="border rounded-lg p-3 text-left space-y-2">
                    <p className="text-xs font-semibold flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-orange-600" /> Personnes autorisées</p>
                    {eleveMandataires.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 text-sm">
                        {m.photo_url ? (
                          <img src={m.photo_url} className="w-8 h-8 rounded-full object-cover border" alt={m.prenom} />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">👤</div>
                        )}
                        <span className="font-medium">{m.prenom} {m.nom}</span>
                        <span className="text-muted-foreground text-xs">({m.lien_parente})</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 justify-center flex-wrap">
                  <Button onClick={printBadge} className="gap-2"><Printer className="h-4 w-4" /> Badge standard</Button>
                  {isCrecheMaternelle && eleveMandataires.length > 0 && (
                    <Button
                      variant="outline"
                      className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
                      onClick={() => generateBadgeRetrait({
                        eleve: {
                          nom: badgeEleve.nom,
                          prenom: badgeEleve.prenom,
                          matricule: badgeEleve.matricule || '',
                          classe: badgeEleve.classes?.nom || '',
                          cycle: badgeEleve.classes?.niveaux?.cycles?.nom || '',
                          photo_url: badgeEleve.photo_url,
                        },
                        mandataires: eleveMandataires,
                        qrValue: buildQrData(badgeEleve),
                      })}
                    >
                      <ShieldCheck className="h-4 w-4" /> Badge de retrait
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
