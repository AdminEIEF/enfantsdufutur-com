import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { exportToExcel } from '@/lib/excelUtils';
import { sortClasses } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const MOIS_SCOLAIRES = [
  'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
];

interface EleveImpaye {
  id: string;
  nom: string;
  matricule: string;
  classe: string;
  classeId: string;
  zone: string | null;
  transportForfaitaire: boolean;
  transportLabel: string;
  siblingCount: number;
  resteScolarite: number;
  resteTransport: number;
  totalReste: number;
  moisImpayesScolarite: string[];
  moisImpayesTransport: string[];
  fraisMensuel: number;
  prixTransport: number;
  familleId: string | null;
  familleName: string;
}

interface FamilleGroup {
  familleId: string;
  familleName: string;
  eleves: EleveImpaye[];
  totalScolarite: number;
  totalTransport: number;
  totalReste: number;
  classes: string[];
}

export default function Impayes() {
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'scolarite' | 'transport'>('all');
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());

  const { data: eleves = [], isLoading } = useQuery({
    queryKey: ['impayes-eleves'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, famille_id, classes(nom, niveau_id, niveaux:niveau_id(frais_scolarite)), zones_transport:zone_transport_id(id, nom, prix_mensuel), zone_transport_id')
        .eq('statut', 'inscrit')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });

  const { data: paiements = [] } = useQuery({
    queryKey: ['impayes-paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('eleve_id, montant, type_paiement, mois_concerne');
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ['impayes-classes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('id, nom, niveaux:niveau_id(nom, ordre, cycles:cycle_id(ordre))');
      if (error) throw error;
      return sortClasses(data || []);
    },
  });

  const { data: familles = [] } = useQuery({
    queryKey: ['impayes-familles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('familles').select('id, nom_famille');
      if (error) throw error;
      return data;
    },
  });

  const familleMap = useMemo(() => {
    const map: Record<string, string> = {};
    familles.forEach((f: any) => { map[f.id] = f.nom_famille; });
    return map;
  }, [familles]);

  const familySizes = useMemo(() => {
    const map: Record<string, number> = {};
    eleves.forEach((e: any) => {
      if (e.famille_id) map[e.famille_id] = (map[e.famille_id] || 0) + 1;
    });
    return map;
  }, [eleves]);

  const familyTransportData = useMemo(() => {
    const map: Record<string, { totalAnnuel: number; totalPaye: number; moisPayes: string[]; firstEleveId: string }> = {};
    eleves.forEach((e: any) => {
      if (!e.famille_id) return;
      const siblingCount = familySizes[e.famille_id] || 1;
      if (siblingCount < 3) return;
      const prixTransport = Number((e.zones_transport as any)?.prix_mensuel || 0);
      const paiementsTransport = paiements.filter((p: any) => p.eleve_id === e.id && p.type_paiement === 'transport');
      const payeTransport = paiementsTransport.reduce((s: number, p: any) => s + Number(p.montant), 0);
      const moisPayes = paiementsTransport.map((p: any) => p.mois_concerne).filter(Boolean);
      if (!map[e.famille_id]) {
        map[e.famille_id] = { totalAnnuel: prixTransport * 10, totalPaye: payeTransport, moisPayes, firstEleveId: e.id };
      } else {
        const annuel = prixTransport * 10;
        if (annuel > map[e.famille_id].totalAnnuel) map[e.famille_id].totalAnnuel = annuel;
        map[e.famille_id].totalPaye += payeTransport;
        moisPayes.forEach(m => { if (!map[e.famille_id].moisPayes.includes(m)) map[e.famille_id].moisPayes.push(m); });
      }
    });
    return map;
  }, [eleves, paiements, familySizes]);

  const impayes: EleveImpaye[] = useMemo(() => {
    return eleves.map((e: any) => {
      const fraisAnnuel = Number(e.classes?.niveaux?.frais_scolarite || 0);
      const prixTransport = Number((e.zones_transport as any)?.prix_mensuel || 0);
      const siblingCount = e.famille_id ? (familySizes[e.famille_id] || 1) : 1;
      const transportForfaitaire = siblingCount >= 3;
      const paiementsEleve = paiements.filter((p: any) => p.eleve_id === e.id);
      const paiementsScolarite = paiementsEleve.filter((p: any) => p.type_paiement === 'scolarite');
      const totalPayeScolarite = paiementsScolarite.reduce((s: number, p: any) => s + Number(p.montant), 0);
      const resteScolarite = Math.max(0, fraisAnnuel - totalPayeScolarite);
      const moisPayesScolarite = paiementsScolarite.map((p: any) => p.mois_concerne).filter(Boolean);
      const moisImpayesScolarite = MOIS_SCOLAIRES.filter(m => !moisPayesScolarite.includes(m));

      let resteTransport = 0;
      let moisImpayesTransport: string[] = [];
      let transportLabel = '';

      if (transportForfaitaire && e.famille_id) {
        const ftd = familyTransportData[e.famille_id];
        if (ftd && ftd.firstEleveId === e.id) {
          resteTransport = Math.max(0, ftd.totalAnnuel - ftd.totalPaye);
          moisImpayesTransport = MOIS_SCOLAIRES.filter(m => !ftd.moisPayes.includes(m));
          transportLabel = `Forfait famille (${siblingCount})`;
        }
      } else {
        const paiementsTransport = paiementsEleve.filter((p: any) => p.type_paiement === 'transport');
        const totalPayeTransport = paiementsTransport.reduce((s: number, p: any) => s + Number(p.montant), 0);
        resteTransport = Math.max(0, prixTransport * 10 - totalPayeTransport);
        const moisPayesTransport = paiementsTransport.map((p: any) => p.mois_concerne).filter(Boolean);
        moisImpayesTransport = e.zone_transport_id ? MOIS_SCOLAIRES.filter(m => !moisPayesTransport.includes(m)) : [];
      }

      return {
        id: e.id,
        nom: `${e.prenom} ${e.nom}`,
        matricule: e.matricule || '—',
        classe: e.classes?.nom || '—',
        classeId: e.classe_id,
        zone: (e.zones_transport as any)?.nom || null,
        transportForfaitaire,
        transportLabel,
        siblingCount,
        resteScolarite,
        resteTransport,
        totalReste: resteScolarite + resteTransport,
        moisImpayesScolarite,
        moisImpayesTransport,
        fraisMensuel: fraisAnnuel > 0 ? Math.ceil(fraisAnnuel / 10) : 0,
        prixTransport,
        familleId: e.famille_id,
        familleName: e.famille_id ? (familleMap[e.famille_id] || 'Sans nom') : `Individuel (${e.prenom} ${e.nom})`,
      };
    }).filter(e => {
      if (filterType === 'scolarite') return e.resteScolarite > 0;
      if (filterType === 'transport') return e.resteTransport > 0;
      return e.totalReste > 0;
    });
  }, [eleves, paiements, familySizes, familyTransportData, filterType, familleMap]);

  const filtered = impayes.filter(e => {
    const matchSearch = `${e.nom} ${e.matricule} ${e.familleName}`.toLowerCase().includes(search.toLowerCase());
    const matchClasse = filterClasse === 'all' || e.classeId === filterClasse;
    return matchSearch && matchClasse;
  });

  // Group by family
  const familleGroups: FamilleGroup[] = useMemo(() => {
    const map: Record<string, FamilleGroup> = {};
    filtered.forEach(e => {
      const key = e.familleId || e.id;
      if (!map[key]) {
        map[key] = {
          familleId: key,
          familleName: e.familleName,
          eleves: [],
          totalScolarite: 0,
          totalTransport: 0,
          totalReste: 0,
          classes: [],
        };
      }
      map[key].eleves.push(e);
      map[key].totalScolarite += e.resteScolarite;
      map[key].totalTransport += e.resteTransport;
      map[key].totalReste += e.totalReste;
      if (!map[key].classes.includes(e.classe)) map[key].classes.push(e.classe);
    });
    return Object.values(map).sort((a, b) => b.totalReste - a.totalReste);
  }, [filtered]);

  const totalImpaye = familleGroups.reduce((s, f) => s + f.totalReste, 0);
  const totalImpayeScolarite = familleGroups.reduce((s, f) => s + f.totalScolarite, 0);
  const totalImpayeTransport = familleGroups.reduce((s, f) => s + f.totalTransport, 0);

  const toggleFamily = (id: string) => {
    setExpandedFamilies(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFamilies(new Set(familleGroups.map(f => f.familleId)));
  };
  const collapseAll = () => setExpandedFamilies(new Set());

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <AlertTriangle className="h-7 w-7 text-destructive" /> Impayés par Famille
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Impayés</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalImpaye.toLocaleString()} GNF</p><p className="text-xs text-muted-foreground">{familleGroups.length} famille(s)</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Impayés Scolarité</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalImpayeScolarite.toLocaleString()} GNF</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Impayés Transport</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalImpayeTransport.toLocaleString()} GNF</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Élèves concernés</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{filtered.length}</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher famille, élève..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            <SelectItem value="scolarite">Scolarité</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 ml-auto">
          <Button variant="ghost" size="sm" onClick={expandAll}>Tout déplier</Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>Tout replier</Button>
          <Button variant="outline" size="sm" onClick={() => {
            const rows = filtered.map(e => ({
              Famille: e.familleName,
              Matricule: e.matricule,
              Élève: e.nom,
              Classe: e.classe,
              Zone: e.zone || '',
              'Impayé Scolarité (GNF)': e.resteScolarite,
              'Mois impayés scolarité': e.moisImpayesScolarite.join(', '),
              'Impayé Transport (GNF)': e.resteTransport,
              'Mois impayés transport': e.moisImpayesTransport.join(', '),
              'Total Impayé (GNF)': e.totalReste,
            }));
            exportToExcel(rows, `impayes_${new Date().toISOString().slice(0, 10)}`, 'Impayés');
            toast({ title: 'Export réussi', description: `${rows.length} ligne(s)` });
          }}>
            <Download className="h-4 w-4 mr-1" /> Exporter
          </Button>
        </div>
      </div>

      {/* Table grouped by family */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Famille / Élève</TableHead>
                <TableHead>Classe(s)</TableHead>
                <TableHead className="text-right">Scolarité</TableHead>
                <TableHead className="text-center">Mois (S)</TableHead>
                <TableHead className="text-right">Transport</TableHead>
                <TableHead className="text-center">Mois (T)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : familleGroups.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Aucun impayé 🎉</TableCell></TableRow>
              ) : familleGroups.map(fam => {
                const isExpanded = expandedFamilies.has(fam.familleId);
                return (
                  <FamilleRows key={fam.familleId} famille={fam} isExpanded={isExpanded} onToggle={() => toggleFamily(fam.familleId)} />
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{familleGroups.length} famille(s) · {filtered.length} élève(s) avec impayés</p>
    </div>
  );
}

function FamilleRows({ famille, isExpanded, onToggle }: { famille: FamilleGroup; isExpanded: boolean; onToggle: () => void }) {
  return (
    <>
      {/* Family summary row */}
      <TableRow className="bg-muted/30 cursor-pointer hover:bg-muted/60" onClick={onToggle}>
        <TableCell className="px-2">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </TableCell>
        <TableCell className="font-semibold">
          {famille.familleName}
          <Badge variant="secondary" className="ml-2 text-[10px]">{famille.eleves.length} enfant(s)</Badge>
        </TableCell>
        <TableCell>
          <div className="flex gap-1 flex-wrap">
            {famille.classes.map(c => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
          </div>
        </TableCell>
        <TableCell className="text-right font-mono">
          {famille.totalScolarite > 0 ? <span className="text-destructive font-semibold">{famille.totalScolarite.toLocaleString()} F</span> : <span className="text-green-600">✓</span>}
        </TableCell>
        <TableCell></TableCell>
        <TableCell className="text-right font-mono">
          {famille.totalTransport > 0 ? <span className="text-destructive font-semibold">{famille.totalTransport.toLocaleString()} F</span> : <span className="text-green-600">✓</span>}
        </TableCell>
        <TableCell></TableCell>
        <TableCell className="text-right font-bold text-destructive text-base">{famille.totalReste.toLocaleString()} F</TableCell>
      </TableRow>

      {/* Expanded children */}
      {isExpanded && famille.eleves.map(e => (
        <TableRow key={e.id} className="bg-background">
          <TableCell></TableCell>
          <TableCell className="pl-8">
            <span className="text-sm">{e.nom}</span>
            <span className="ml-2 font-mono text-xs text-muted-foreground">{e.matricule}</span>
            {e.transportLabel && <Badge variant="outline" className="ml-1 text-[10px]">{e.transportLabel}</Badge>}
          </TableCell>
          <TableCell className="text-sm">{e.classe}</TableCell>
          <TableCell className="text-right font-mono text-sm">
            {e.resteScolarite > 0 ? <span className="text-destructive">{e.resteScolarite.toLocaleString()} F</span> : <span className="text-green-600">✓</span>}
          </TableCell>
          <TableCell className="text-center text-xs">{e.moisImpayesScolarite.length > 0 ? e.moisImpayesScolarite.map(m => m.slice(0, 3)).join(', ') : '—'}</TableCell>
          <TableCell className="text-right font-mono text-sm">
            {e.resteTransport > 0 ? <span className="text-destructive">{e.resteTransport.toLocaleString()} F</span> : e.zone ? <span className="text-green-600">✓</span> : '—'}
          </TableCell>
          <TableCell className="text-center text-xs">{e.moisImpayesTransport.length > 0 ? e.moisImpayesTransport.map(m => m.slice(0, 3)).join(', ') : '—'}</TableCell>
          <TableCell className="text-right font-mono font-semibold text-sm text-destructive">{e.totalReste.toLocaleString()} F</TableCell>
        </TableRow>
      ))}
    </>
  );
}
