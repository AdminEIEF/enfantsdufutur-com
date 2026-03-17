import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, History, Banknote, HandCoins, ArrowDownCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Mouvement {
  id: string;
  type: 'salaire' | 'avance' | 'avance_soutien';
  employe_nom: string;
  employe_prenom: string;
  matricule: string;
  categorie: string;
  montant: number;
  date: string;
  details: string;
}

function fmtNum(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function TresorierHistorique() {
  const [mouvements, setMouvements] = useState<Mouvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [paiRes, avRes, avSoutienRes, empRes] = await Promise.all([
        supabase.from('paiements_tresorier').select('id, employe_id, montant, date_paiement, mois, annee'),
        supabase.from('avances_salaire').select('id, employe_id, montant, created_at, statut, motif').in('statut', ['approuve', 'paye', 'rembourse']),
        supabase.from('avances_salaire').select('id, employe_id, montant, created_at, statut, motif').eq('statut', 'paye'),
        supabase.from('employes').select('id, nom, prenom, matricule, categorie'),
      ]);

      const empMap: Record<string, any> = {};
      (empRes.data || []).forEach(e => { empMap[e.id] = e; });

      const SOUTIEN_CATS = ['hygiene', 'securite_primaire', 'securite_lycee', 'chauffeur', 'infirmiere', 'cantine', 'librairie', 'surveillant'];

      const mvts: Mouvement[] = [];

      // Paiements salaires
      (paiRes.data || []).forEach(p => {
        const emp = empMap[p.employe_id];
        if (!emp) return;
        mvts.push({
          id: `sal-${p.id}`,
          type: 'salaire',
          employe_nom: emp.nom,
          employe_prenom: emp.prenom,
          matricule: emp.matricule,
          categorie: emp.categorie,
          montant: Number(p.montant),
          date: p.date_paiement,
          details: `Salaire ${p.mois}/${p.annee}`,
        });
      });

      // Avances (RH approved)
      const seenAvIds = new Set<string>();
      (avRes.data || []).forEach(a => {
        const emp = empMap[a.employe_id];
        if (!emp) return;
        if (SOUTIEN_CATS.includes(emp.categorie)) return; // soutien handled separately
        seenAvIds.add(a.id);
        mvts.push({
          id: `av-${a.id}`,
          type: 'avance',
          employe_nom: emp.nom,
          employe_prenom: emp.prenom,
          matricule: emp.matricule,
          categorie: emp.categorie,
          montant: Number(a.montant),
          date: a.created_at,
          details: `Avance — ${a.statut}`,
        });
      });

      // Avances soutien
      (avSoutienRes.data || []).forEach(a => {
        if (seenAvIds.has(a.id)) return;
        const emp = empMap[a.employe_id];
        if (!emp) return;
        if (!SOUTIEN_CATS.includes(emp.categorie)) return;
        mvts.push({
          id: `avs-${a.id}`,
          type: 'avance_soutien',
          employe_nom: emp.nom,
          employe_prenom: emp.prenom,
          matricule: emp.matricule,
          categorie: emp.categorie,
          montant: Number(a.montant),
          date: a.created_at,
          details: `Avance soutien — ${a.statut}`,
        });
      });

      // Sort by date desc
      mvts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMouvements(mvts);
      setLoading(false);
    };

    fetchAll();
  }, []);

  const filtered = mouvements.filter(m => {
    const matchType = typeFilter === 'all' || m.type === typeFilter;
    const matchSearch = `${m.employe_nom} ${m.employe_prenom} ${m.matricule} ${m.details}`.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const totalSalaires = filtered.filter(m => m.type === 'salaire').reduce((s, m) => s + m.montant, 0);
  const totalAvances = filtered.filter(m => m.type === 'avance' || m.type === 'avance_soutien').reduce((s, m) => s + m.montant, 0);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'salaire': return <Banknote className="h-4 w-4 text-emerald-600" />;
      case 'avance': return <ArrowDownCircle className="h-4 w-4 text-orange-500" />;
      case 'avance_soutien': return <HandCoins className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'salaire': return <Badge className="bg-emerald-100 text-emerald-700 border-0">Salaire</Badge>;
      case 'avance': return <Badge className="bg-orange-100 text-orange-700 border-0">Avance</Badge>;
      case 'avance_soutien': return <Badge className="bg-red-100 text-red-700 border-0">Avance Soutien</Badge>;
      default: return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <History className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Historique des mouvements</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Banknote className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Total salaires versés</p>
              <p className="text-lg font-bold">{fmtNum(totalSalaires)} GNF</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <HandCoins className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground">Total avances versées</p>
              <p className="text-lg font-bold">{fmtNum(totalAvances)} GNF</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <History className="h-8 w-8 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Nombre de mouvements</p>
              <p className="text-lg font-bold">{filtered.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom, matricule…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les types</SelectItem>
              <SelectItem value="salaire">Salaires</SelectItem>
              <SelectItem value="avance">Avances</SelectItem>
              <SelectItem value="avance_soutien">Avances Soutien</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Aucun mouvement trouvé.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Employé</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Détails</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(m.date), 'dd MMM yyyy', { locale: fr })}
                      </TableCell>
                      <TableCell>{getTypeBadge(m.type)}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(m.type)}
                          {m.employe_prenom} {m.employe_nom}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{m.matricule}</TableCell>
                      <TableCell className="text-sm">{m.details}</TableCell>
                      <TableCell className="text-right font-bold">{fmtNum(m.montant)} GNF</TableCell>
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
