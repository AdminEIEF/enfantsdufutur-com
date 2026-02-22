import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, AlertTriangle, TrendingUp, Package, ShoppingBag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import { generateRapportJournalierPDF } from '@/lib/generateRapportJournalierPDF';

interface Props {
  service: 'Boutique' | 'Cantine' | 'Librairie';
}

export default function RapportJournalierPanel({ service }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(today);
  const { data: schoolConfig } = useSchoolConfig();

  // ─── Boutique data ─────────────────────────────────
  const { data: boutiqueArticles = [] } = useQuery({
    queryKey: ['rapport-boutique-articles'],
    queryFn: async () => {
      const { data } = await supabase.from('boutique_articles').select('*').order('nom');
      return data || [];
    },
    enabled: service === 'Boutique',
  });

  const { data: boutiqueVentes = [] } = useQuery({
    queryKey: ['rapport-boutique-ventes', date],
    queryFn: async () => {
      const { data } = await supabase
        .from('boutique_vente_items')
        .select('*, boutique_ventes!inner(created_at, montant_final, eleve_id)')
        .gte('boutique_ventes.created_at', `${date}T00:00:00`)
        .lte('boutique_ventes.created_at', `${date}T23:59:59`);
      return (data || []) as any[];
    },
    enabled: service === 'Boutique',
  });

  // ─── Cantine data ─────────────────────────────────
  const { data: cantinePlats = [] } = useQuery({
    queryKey: ['rapport-cantine-plats'],
    queryFn: async () => {
      const { data } = await supabase.from('plats_cantine').select('*').order('nom');
      return (data || []) as any[];
    },
    enabled: service === 'Cantine',
  });

  const { data: cantineRepas = [] } = useQuery({
    queryKey: ['rapport-cantine-repas', date],
    queryFn: async () => {
      const { data } = await supabase
        .from('repas_cantine')
        .select('*')
        .gte('date_repas', `${date}T00:00:00`)
        .lte('date_repas', `${date}T23:59:59`);
      return (data || []) as any[];
    },
    enabled: service === 'Cantine',
  });

  // ─── Librairie data ─────────────────────────────────
  const { data: librairieArticles = [] } = useQuery({
    queryKey: ['rapport-librairie-articles'],
    queryFn: async () => {
      const { data } = await supabase.from('articles').select('*').order('nom');
      return (data || []) as any[];
    },
    enabled: service === 'Librairie',
  });

  const { data: librairieVentes = [] } = useQuery({
    queryKey: ['rapport-librairie-ventes', date],
    queryFn: async () => {
      const { data } = await supabase
        .from('ventes_articles')
        .select('*')
        .gte('created_at', `${date}T00:00:00`)
        .lte('created_at', `${date}T23:59:59`);
      return (data || []) as any[];
    },
    enabled: service === 'Librairie',
  });

  // ─── Build unified report data ─────────────────────
  const reportData = useMemo(() => {
    let items: { nom: string; quantiteVendue: number; montant: number; stockActuel: number; seuilAlerte: number }[] = [];
    let totalVentes = 0;
    let totalTransactions = 0;

    if (service === 'Boutique') {
      const ventesMap = new Map<string, { qty: number; montant: number }>();
      boutiqueVentes.forEach((v: any) => {
        const existing = ventesMap.get(v.article_id) || { qty: 0, montant: 0 };
        existing.qty += v.quantite;
        existing.montant += v.prix_unitaire * v.quantite;
        ventesMap.set(v.article_id, existing);
      });
      
      items = boutiqueArticles.map((a: any) => {
        const vente = ventesMap.get(a.id) || { qty: 0, montant: 0 };
        return { nom: `${a.nom} (${a.taille})`, quantiteVendue: vente.qty, montant: vente.montant, stockActuel: a.stock, seuilAlerte: a.seuil_alerte_stock };
      });
      totalVentes = items.reduce((s, i) => s + i.montant, 0);
      // Count unique vente_ids
      const uniqueVentes = new Set(boutiqueVentes.map((v: any) => v.vente_id));
      totalTransactions = uniqueVentes.size;
    }

    if (service === 'Cantine') {
      const repasMap = new Map<string, { qty: number; montant: number }>();
      cantineRepas.forEach((r: any) => {
        const key = r.plat_id || r.plat_nom || 'inconnu';
        const existing = repasMap.get(key) || { qty: 0, montant: 0 };
        existing.qty += 1;
        existing.montant += Number(r.montant_debite);
        repasMap.set(key, existing);
      });

      items = cantinePlats.map((p: any) => {
        const vente = repasMap.get(p.id) || { qty: 0, montant: 0 };
        return { nom: p.nom, quantiteVendue: vente.qty, montant: vente.montant, stockActuel: p.stock_restant, seuilAlerte: Math.floor(p.stock_journalier * 0.1) };
      });
      totalVentes = cantineRepas.reduce((s: number, r: any) => s + Number(r.montant_debite), 0);
      totalTransactions = cantineRepas.length;
    }

    if (service === 'Librairie') {
      const ventesMap = new Map<string, { qty: number; montant: number }>();
      librairieVentes.forEach((v: any) => {
        const existing = ventesMap.get(v.article_id) || { qty: 0, montant: 0 };
        existing.qty += v.quantite || 1;
        existing.montant += (v.prix_unitaire || 0) * (v.quantite || 1);
        ventesMap.set(v.article_id, existing);
      });

      items = librairieArticles.map((a: any) => {
        const vente = ventesMap.get(a.id) || { qty: 0, montant: 0 };
        return { nom: a.nom, quantiteVendue: vente.qty, montant: vente.montant, stockActuel: a.stock, seuilAlerte: a.seuil_alerte_stock };
      });
      totalVentes = items.reduce((s, i) => s + i.montant, 0);
      totalTransactions = librairieVentes.length;
    }

    return { items, totalVentes, totalTransactions };
  }, [service, boutiqueArticles, boutiqueVentes, cantinePlats, cantineRepas, librairieArticles, librairieVentes]);

  const lowStockItems = reportData.items.filter(i => i.stockActuel <= i.seuilAlerte);
  const soldItems = reportData.items.filter(i => i.quantiteVendue > 0).sort((a, b) => b.montant - a.montant);

  const handleGeneratePDF = () => {
    generateRapportJournalierPDF({
      service,
      date,
      items: reportData.items,
      totalVentes: reportData.totalVentes,
      totalTransactions: reportData.totalTransactions,
      school: {
        nom: schoolConfig?.nom || 'École',
        soustitre: schoolConfig?.soustitre,
        logo_url: schoolConfig?.logo_url,
        ville: schoolConfig?.ville,
      },
    });
  };

  const serviceIcon = service === 'Boutique' ? '🛍️' : service === 'Cantine' ? '🍽️' : '📚';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> {serviceIcon} Rapport Journalier — {service}
        </h2>
        <div className="flex items-center gap-3">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-[180px]" />
          <Button onClick={handleGeneratePDF} className="gap-2">
            <Download className="h-4 w-4" /> Générer PDF
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <ShoppingBag className="h-7 w-7 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Transactions</p>
              <p className="text-xl font-bold">{reportData.totalTransactions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <TrendingUp className="h-7 w-7 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">CA du jour</p>
              <p className="text-xl font-bold">{reportData.totalVentes.toLocaleString()} <span className="text-xs font-normal">GNF</span></p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <Package className="h-7 w-7 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Articles vendus</p>
              <p className="text-xl font-bold">{soldItems.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={lowStockItems.length > 0 ? 'border-destructive/40' : ''}>
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <AlertTriangle className={`h-7 w-7 ${lowStockItems.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
            <div>
              <p className="text-xs text-muted-foreground">Alertes stock</p>
              <p className="text-xl font-bold">{lowStockItems.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales table */}
      {soldItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">📊 Ventes du {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR')}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Article</TableHead>
                  <TableHead className="text-center">Qté vendue</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soldItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.nom}</TableCell>
                    <TableCell className="text-center">{item.quantiteVendue}</TableCell>
                    <TableCell className="text-right font-mono font-semibold">{item.montant.toLocaleString()} GNF</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-center">{soldItems.reduce((s, i) => s + i.quantiteVendue, 0)}</TableCell>
                  <TableCell className="text-right font-mono">{reportData.totalVentes.toLocaleString()} GNF</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {soldItems.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune vente enregistrée pour le {new Date(date + 'T12:00:00').toLocaleDateString('fr-FR')}
          </CardContent>
        </Card>
      )}

      {/* Inventory snapshot */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">📦 État de l'inventaire</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Article</TableHead>
                <TableHead className="text-center">Stock actuel</TableHead>
                <TableHead className="text-center">Seuil alerte</TableHead>
                <TableHead className="text-center">Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportData.items.map((item, i) => {
                const isLow = item.stockActuel <= item.seuilAlerte;
                return (
                  <TableRow key={i} className={isLow ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">{item.nom}</TableCell>
                    <TableCell className="text-center font-mono">{item.stockActuel}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{item.seuilAlerte}</TableCell>
                    <TableCell className="text-center">
                      {isLow ? (
                        <Badge variant="destructive" className="text-[10px]">⚠️ Critique</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-300">✓ OK</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Low stock alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Articles en alerte ({lowStockItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {lowStockItems.map((item, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-destructive">•</span>
                  <strong>{item.nom}</strong> — {item.stockActuel} restant(s) (seuil: {item.seuilAlerte})
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
