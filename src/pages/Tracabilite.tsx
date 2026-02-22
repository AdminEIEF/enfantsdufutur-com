import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ClipboardList, Utensils, ShoppingBag, BookOpen, Calendar, User, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Operation = {
  id: string;
  type: 'cantine' | 'boutique' | 'librairie';
  heure: string;
  montant: number;
  detail: string;
  operateur_email: string | null;
};

function useTracabilite(date: string) {
  return useQuery({
    queryKey: ['tracabilite', date],
    queryFn: async () => {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;

      // Fetch all sources in parallel
      const [repasRes, boutiqueRes, librairieOldRes, librairieNewRes, profilesRes] = await Promise.all([
        supabase
          .from('repas_cantine')
          .select('id, date_repas, montant_debite, plat_nom, created_by, eleves(nom, prenom)')
          .gte('date_repas', dayStart)
          .lte('date_repas', dayEnd)
          .order('date_repas', { ascending: false }),
        supabase
          .from('boutique_ventes')
          .select('id, created_at, montant_final, created_by, eleves(nom, prenom)')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('created_at', { ascending: false }),
        // Legacy librairie sales (ventes_articles)
        supabase
          .from('ventes_articles')
          .select('id, created_at, prix_unitaire, quantite, created_by, articles(nom), eleves(nom, prenom)')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('created_at', { ascending: false }),
        // New librairie direct sales (commandes_articles)
        supabase
          .from('commandes_articles')
          .select('id, created_at, prix_unitaire, quantite, article_nom, eleve_id, eleves(nom, prenom)')
          .eq('source', 'vente_directe')
          .eq('article_type', 'librairie')
          .gte('created_at', dayStart)
          .lte('created_at', dayEnd)
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, email, nom, prenom'),
      ]);

      const profiles = (profilesRes.data || []).reduce((acc, p) => {
        acc[p.user_id] = p.email || `${p.prenom} ${p.nom}`;
        return acc;
      }, {} as Record<string, string>);

      const ops: Operation[] = [];

      (repasRes.data || []).forEach((r: any) => {
        ops.push({
          id: r.id,
          type: 'cantine',
          heure: format(new Date(r.date_repas), 'HH:mm', { locale: fr }),
          montant: r.montant_debite,
          detail: `${r.eleves?.prenom} ${r.eleves?.nom} — ${r.plat_nom || 'Repas'}`,
          operateur_email: r.created_by ? profiles[r.created_by] || r.created_by : null,
        });
      });

      (boutiqueRes.data || []).forEach((b: any) => {
        ops.push({
          id: b.id,
          type: 'boutique',
          heure: format(new Date(b.created_at), 'HH:mm', { locale: fr }),
          montant: b.montant_final,
          detail: `Vente à ${b.eleves?.prenom} ${b.eleves?.nom}`,
          operateur_email: b.created_by ? profiles[b.created_by] || b.created_by : null,
        });
      });

      // Legacy librairie sales
      (librairieOldRes.data || []).forEach((l: any) => {
        ops.push({
          id: l.id,
          type: 'librairie',
          heure: format(new Date(l.created_at), 'HH:mm', { locale: fr }),
          montant: l.prix_unitaire * l.quantite,
          detail: `${l.articles?.nom} x${l.quantite} — ${l.eleves?.prenom} ${l.eleves?.nom}`,
          operateur_email: l.created_by ? profiles[l.created_by] || l.created_by : null,
        });
      });

      // New librairie direct sales (commandes_articles)
      (librairieNewRes.data || []).forEach((l: any) => {
        ops.push({
          id: l.id,
          type: 'librairie',
          heure: format(new Date(l.created_at), 'HH:mm', { locale: fr }),
          montant: l.prix_unitaire * l.quantite,
          detail: `${l.article_nom} x${l.quantite} — ${l.eleves?.prenom} ${l.eleves?.nom}`,
          operateur_email: null,
        });
      });

      // Sort by time descending
      ops.sort((a, b) => b.heure.localeCompare(a.heure));

      return ops;
    },
  });
}

const typeConfig = {
  cantine: { label: 'Cantine', icon: Utensils, color: 'bg-orange-100 text-orange-800' },
  boutique: { label: 'Boutique', icon: ShoppingBag, color: 'bg-purple-100 text-purple-800' },
  librairie: { label: 'Librairie', icon: BookOpen, color: 'bg-blue-100 text-blue-800' },
} as const;

export default function Tracabilite() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [filterType, setFilterType] = useState<string>('all');
  const { data: operations = [], isLoading } = useTracabilite(date);

  const filtered = useMemo(() => {
    if (filterType === 'all') return operations;
    return operations.filter((o) => o.type === filterType);
  }, [operations, filterType]);

  const totals = useMemo(() => {
    const t = { cantine: 0, boutique: 0, librairie: 0, total: 0 };
    operations.forEach((o) => {
      t[o.type] += o.montant;
      t.total += o.montant;
    });
    return t;
  }, [operations]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardList className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Traçabilité Journalière</h1>
          <p className="text-muted-foreground text-sm">Toutes les opérations du jour par module et opérateur</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {(Object.keys(typeConfig) as Array<keyof typeof typeConfig>).map((key) => {
          const cfg = typeConfig[key];
          return (
            <Card key={key}>
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className={`p-2 rounded-lg ${cfg.color}`}>
                  <cfg.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{cfg.label}</p>
                  <p className="text-lg font-bold">{totals[key].toLocaleString()} GNF</p>
                  <p className="text-xs text-muted-foreground">{operations.filter(o => o.type === key).length} opérations</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 text-green-800">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Jour</p>
              <p className="text-lg font-bold">{totals.total.toLocaleString()} GNF</p>
              <p className="text-xs text-muted-foreground">{operations.length} opérations</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Module</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="cantine">Cantine</SelectItem>
                <SelectItem value="boutique">Boutique</SelectItem>
                <SelectItem value="librairie">Librairie</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Operations table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Opérations du {format(new Date(date), 'EEEE d MMMM yyyy', { locale: fr })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Chargement…</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Aucune opération pour cette journée.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Heure</TableHead>
                  <TableHead className="w-28">Module</TableHead>
                  <TableHead>Détail</TableHead>
                  <TableHead className="w-36">Opérateur</TableHead>
                  <TableHead className="w-32 text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((op) => {
                  const cfg = typeConfig[op.type];
                  return (
                    <TableRow key={`${op.type}-${op.id}`}>
                      <TableCell className="font-mono text-sm">{op.heure}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`${cfg.color} border-0 text-xs`}>
                          <cfg.icon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{op.detail}</TableCell>
                      <TableCell className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {op.operateur_email || '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">{op.montant.toLocaleString()} F</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
