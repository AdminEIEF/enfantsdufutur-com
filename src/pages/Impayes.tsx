import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Search, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { exportToExcel } from '@/lib/excelUtils';
import { toast } from '@/hooks/use-toast';

const MOIS_SCOLAIRES = [
  'Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
];

export default function Impayes() {
  const [search, setSearch] = useState('');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterType, setFilterType] = useState<'all' | 'scolarite' | 'transport'>('all');

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
      const { data, error } = await supabase.from('classes').select('id, nom').order('nom');
      if (error) throw error;
      return data;
    },
  });

  // Count siblings per family for flat rate
  const familySizes = useMemo(() => {
    const map: Record<string, number> = {};
    eleves.forEach((e: any) => {
      if (e.famille_id) map[e.famille_id] = (map[e.famille_id] || 0) + 1;
    });
    return map;
  }, [eleves]);

  // Pre-compute family transport: for forfait families (3+), group transport as single charge
  const familyTransportData = useMemo(() => {
    const map: Record<string, { totalAnnuel: number; totalPaye: number; moisPayes: string[]; firstEleveId: string }> = {};
    eleves.forEach((e: any) => {
      if (!e.famille_id) return;
      const siblingCount = familySizes[e.famille_id] || 1;
      if (siblingCount < 3) return; // Only forfait for 3+
      
      const prixTransport = Number((e.zones_transport as any)?.prix_mensuel || 0);
      const paiementsTransport = paiements.filter((p: any) => p.eleve_id === e.id && p.type_paiement === 'transport');
      const payeTransport = paiementsTransport.reduce((s: number, p: any) => s + Number(p.montant), 0);
      const moisPayes = paiementsTransport.map((p: any) => p.mois_concerne).filter(Boolean);

      if (!map[e.famille_id]) {
        map[e.famille_id] = { totalAnnuel: prixTransport * 10, totalPaye: payeTransport, moisPayes, firstEleveId: e.id };
      } else {
        // Use highest transport price as the flat rate
        const annuel = prixTransport * 10;
        if (annuel > map[e.famille_id].totalAnnuel) map[e.famille_id].totalAnnuel = annuel;
        map[e.famille_id].totalPaye += payeTransport;
        moisPayes.forEach(m => { if (!map[e.famille_id].moisPayes.includes(m)) map[e.famille_id].moisPayes.push(m); });
      }
    });
    return map;
  }, [eleves, paiements, familySizes]);

  const impayes = useMemo(() => {
    return eleves.map((e: any) => {
      const fraisAnnuel = Number(e.classes?.niveaux?.frais_scolarite || 0);
      const prixTransport = Number((e.zones_transport as any)?.prix_mensuel || 0);

      const siblingCount = e.famille_id ? (familySizes[e.famille_id] || 1) : 1;
      const transportForfaitaire = siblingCount >= 3;

      const paiementsEleve = paiements.filter((p: any) => p.eleve_id === e.id);
      const paiementsScolarite = paiementsEleve.filter((p: any) => p.type_paiement === 'scolarite');

      const totalPayeScolarite = paiementsScolarite.reduce((s: number, p: any) => s + Number(p.montant), 0);

      const totalAnnuelScolarite = fraisAnnuel;
      const resteScolarite = Math.max(0, totalAnnuelScolarite - totalPayeScolarite);

      const moisPayesScolarite = paiementsScolarite.map((p: any) => p.mois_concerne).filter(Boolean);
      const moisImpayesScolarite = MOIS_SCOLAIRES.filter(m => !moisPayesScolarite.includes(m));

      // Transport: if forfait famille, only show on first student of the family
      let resteTransport = 0;
      let moisImpayesTransport: string[] = [];
      let transportLabel = '';

      if (transportForfaitaire && e.famille_id) {
        const ftd = familyTransportData[e.famille_id];
        if (ftd && ftd.firstEleveId === e.id) {
          // This is the first student: show grouped family transport
          resteTransport = Math.max(0, ftd.totalAnnuel - ftd.totalPaye);
          moisImpayesTransport = MOIS_SCOLAIRES.filter(m => !ftd.moisPayes.includes(m));
          transportLabel = `Forfait famille (${siblingCount})`;
        }
        // Other students in forfait family: resteTransport = 0, no months
      } else {
        // Individual transport
        const paiementsTransport = paiementsEleve.filter((p: any) => p.type_paiement === 'transport');
        const totalPayeTransport = paiementsTransport.reduce((s: number, p: any) => s + Number(p.montant), 0);
        const totalAnnuelTransport = prixTransport * 10;
        resteTransport = Math.max(0, totalAnnuelTransport - totalPayeTransport);
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
      };
    }).filter(e => {
      if (filterType === 'scolarite') return e.resteScolarite > 0;
      if (filterType === 'transport') return e.resteTransport > 0;
      return e.totalReste > 0;
    });
  }, [eleves, paiements, familySizes, familyTransportData, filterType]);

  const filtered = impayes.filter(e => {
    const matchSearch = `${e.nom} ${e.matricule}`.toLowerCase().includes(search.toLowerCase());
    const matchClasse = filterClasse === 'all' || e.classeId === filterClasse;
    return matchSearch && matchClasse;
  });

  const totalImpaye = filtered.reduce((s, e) => s + e.totalReste, 0);
  const totalImpayeScolarite = filtered.reduce((s, e) => s + e.resteScolarite, 0);
  const totalImpayeTransport = filtered.reduce((s, e) => s + e.resteTransport, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <AlertTriangle className="h-7 w-7 text-destructive" /> Récapitulatif des Impayés
      </h1>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Impayés</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalImpaye.toLocaleString()} GNF</p><p className="text-xs text-muted-foreground">{filtered.length} élève(s) concerné(s)</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Impayés Scolarité</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalImpayeScolarite.toLocaleString()} GNF</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Impayés Transport</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-destructive">{totalImpayeTransport.toLocaleString()} GNF</p></CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
        <Button variant="outline" size="sm" className="ml-auto" onClick={() => {
          const rows = filtered.map(e => ({
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

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matricule</TableHead>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Zone</TableHead>
                <TableHead className="text-right">Impayé Scolarité</TableHead>
                <TableHead className="text-center">Mois impayés (S)</TableHead>
                <TableHead className="text-right">Impayé Transport</TableHead>
                <TableHead className="text-center">Mois impayés (T)</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun impayé 🎉</TableCell></TableRow>
              ) : filtered.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.matricule}</TableCell>
                  <TableCell className="font-medium">
                    {e.nom}
                    {e.transportLabel && (
                      <Badge variant="outline" className="ml-1 text-[10px]">{e.transportLabel}</Badge>
                    )}
                  </TableCell>
                  <TableCell>{e.classe}</TableCell>
                  <TableCell>{e.zone ? <Badge variant="outline">{e.zone}</Badge> : '—'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {e.resteScolarite > 0 ? <span className="text-destructive font-semibold">{e.resteScolarite.toLocaleString()} F</span> : <span className="text-green-600">✓</span>}
                  </TableCell>
                  <TableCell className="text-center text-xs">{e.moisImpayesScolarite.length > 0 ? e.moisImpayesScolarite.map(m => m.slice(0, 3)).join(', ') : '—'}</TableCell>
                  <TableCell className="text-right font-mono">
                    {e.resteTransport > 0 ? <span className="text-destructive font-semibold">{e.resteTransport.toLocaleString()} F</span> : e.zone ? <span className="text-green-600">✓</span> : '—'}
                  </TableCell>
                  <TableCell className="text-center text-xs">{e.moisImpayesTransport.length > 0 ? e.moisImpayesTransport.map(m => m.slice(0, 3)).join(', ') : '—'}</TableCell>
                  <TableCell className="text-right font-bold text-destructive">{e.totalReste.toLocaleString()} F</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-sm text-muted-foreground">{filtered.length} élève(s) avec impayés</p>
    </div>
  );
}
