import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ScanLine, Search, Utensils, Wallet, History, QrCode, Plus, AlertTriangle,
  CreditCard, CheckCircle, Package, BarChart3, TrendingUp, Minus, Camera, FileText, Printer
} from 'lucide-react';
import RapportJournalierPanel from '@/components/RapportJournalierPanel';
import CarteCantine from '@/components/CarteCantine';
import PlancheCarteCantine from '@/components/PlancheCarteCantine';
import BordereauRemiseCartes from '@/components/BordereauRemiseCartes';
import QRScannerDialog from '@/components/QRScannerDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent
} from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

// ─── Types ───────────────────────────────────────────────
interface PlatCantine {
  id: string;
  nom: string;
  prix: number;
  stock_journalier: number;
  stock_restant: number;
  date_stock: string;
  actif: boolean;
}

// ─── Hooks ───────────────────────────────────────────────
function useElevesCantine() {
  return useQuery({
    queryKey: ['eleves-cantine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, solde_cantine, option_cantine, qr_code, statut, photo_url, transport_zone, classes(nom), familles(telephone_pere, telephone_mere)')
        .is('deleted_at', null)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

function usePlatsCantine() {
  return useQuery({
    queryKey: ['plats-cantine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plats_cantine' as any)
        .select('*')
        .eq('actif', true)
        .order('nom');
      if (error) throw error;
      return (data || []) as unknown as PlatCantine[];
    },
  });
}

function useRepasHistory(eleveId: string | null) {
  return useQuery({
    queryKey: ['repas-history', eleveId],
    enabled: !!eleveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repas_cantine')
        .select('*')
        .eq('eleve_id', eleveId!)
        .order('date_repas', { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
  });
}

function usePaiementsCantine(eleveId: string | null) {
  return useQuery({
    queryKey: ['paiements-cantine', eleveId],
    enabled: !!eleveId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('*')
        .eq('eleve_id', eleveId!)
        .eq('type_paiement', 'cantine')
        .order('date_paiement', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

function useRepasToday() {
  const today = new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['repas-today', today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repas_cantine')
        .select('*')
        .gte('date_repas', `${today}T00:00:00`)
        .lte('date_repas', `${today}T23:59:59`)
        .order('date_repas', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function useRepasWeek() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  return useQuery({
    queryKey: ['repas-week'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repas_cantine')
        .select('*')
        .gte('date_repas', weekStart.toISOString())
        .order('date_repas', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Colors for charts ──────────────────────────────────
const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(142 76% 36%)',
  'hsl(38 92% 50%)',
  'hsl(280 65% 60%)',
  'hsl(0 84% 60%)',
];

export default function Cantine() {
  const qc = useQueryClient();
  const { data: eleves = [], isLoading } = useElevesCantine();
  const { data: plats = [] } = usePlatsCantine();
  const { data: repasToday = [] } = useRepasToday();
  const { data: repasWeek = [] } = useRepasWeek();
  const [search, setSearch] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEleveId, setHistoryEleveId] = useState<string | null>(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [badgeEleve, setBadgeEleve] = useState<any>(null);
  const [selectedPlatIds, setSelectedPlatIds] = useState<Record<string, number>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [newPlat, setNewPlat] = useState({ nom: '', prix: '', stock: '' });
  const [activeTab, setActiveTab] = useState('vente');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [carteEleve, setCarteEleve] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [plancheOpen, setPlancheOpen] = useState(false);
  const [bordereauOpen, setBordereauOpen] = useState(false);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e: any) => e.id)));
    }
  };

  const { data: repasHistory = [] } = useRepasHistory(historyEleveId);
  const { data: paiementsCantine = [] } = usePaiementsCantine(selectedEleve?.id || historyEleveId);

  const selectedPlatsItems = useMemo(() => {
    return Object.entries(selectedPlatIds)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const plat = plats.find(p => p.id === id);
        return plat ? { ...plat, quantite: qty } : null;
      })
      .filter(Boolean) as (PlatCantine & { quantite: number })[];
  }, [selectedPlatIds, plats]);

  const totalPlats = selectedPlatsItems.reduce((s, p) => s + Number(p.prix) * p.quantite, 0);

  // ─── Scan ──────────────────────────────────────────
  const findEleve = (code: string) => {
    const found = eleves.find(
      (e: any) => e.qr_code === code || e.matricule === code || e.id === code
    );
    if (found) {
      if (found.statut === 'suspendu') {
        toast.error(`⚠️ ${found.prenom} ${found.nom} est suspendu(e). Régularisation requise.`);
        return;
      }
      if (!found.option_cantine) {
        toast.warning(`${found.prenom} ${found.nom} n'a pas l'option cantine activée.`);
      }
      setSelectedEleve(found);
      setSelectedPlatIds({});
    } else {
      toast.error('Élève introuvable');
    }
    setScanInput('');
  };

  const handleQRScan = (matricule: string) => {
    findEleve(matricule);
  };

  // ─── Ajouter un plat ──────────────────────────────
  const addPlat = useMutation({
    mutationFn: async () => {
      if (!newPlat.nom || !newPlat.prix) throw new Error('Nom et prix requis');
      const stock = Number(newPlat.stock) || 100;
      const { error } = await supabase.from('plats_cantine' as any).insert({
        nom: newPlat.nom,
        prix: Number(newPlat.prix),
        stock_journalier: stock,
        stock_restant: stock,
        date_stock: new Date().toISOString().split('T')[0],
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plats-cantine'] });
      toast.success('Plat ajouté');
      setNewPlat({ nom: '', prix: '', stock: '' });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Reset stock journalier ────────────────────────
  const resetStock = useMutation({
    mutationFn: async (plat: PlatCantine) => {
      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('plats_cantine' as any)
        .update({ stock_restant: plat.stock_journalier, date_stock: today } as any)
        .eq('id', plat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plats-cantine'] });
      toast.success('Stock réinitialisé');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Toggle plat actif ─────────────────────────────
  const togglePlat = useMutation({
    mutationFn: async ({ id, actif }: { id: string; actif: boolean }) => {
      const { error } = await supabase
        .from('plats_cantine' as any)
        .update({ actif } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plats-cantine'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Débiter les repas ──────────────────────────────
  const debitRepas = useMutation({
    mutationFn: async () => {
      if (!selectedEleve || selectedPlatsItems.length === 0) throw new Error('Sélectionnez un élève et au moins un repas');
      const solde = Number(selectedEleve.solde_cantine || 0);
      if (solde < totalPlats) throw new Error('Solde Insuffisant - Merci de recharger');

      for (const item of selectedPlatsItems) {
        if (item.stock_restant < item.quantite) throw new Error(`Stock insuffisant pour ${item.nom}`);
      }

      // Insert each repas entry
      for (const item of selectedPlatsItems) {
        for (let i = 0; i < item.quantite; i++) {
          const { error: repasError } = await supabase.from('repas_cantine').insert({
            eleve_id: selectedEleve.id,
            montant_debite: Number(item.prix),
            plat_nom: item.nom,
            plat_id: item.id,
          } as any);
          if (repasError) throw repasError;
        }

        // Decrement stock
        const { error: stockError } = await supabase
          .from('plats_cantine' as any)
          .update({ stock_restant: item.stock_restant - item.quantite } as any)
          .eq('id', item.id);
        if (stockError) throw stockError;
      }

      // Debit solde
      const { error: updateError } = await supabase
        .from('eleves')
        .update({ solde_cantine: solde - totalPlats })
        .eq('id', selectedEleve.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-cantine'] });
      qc.invalidateQueries({ queryKey: ['repas-history'] });
      qc.invalidateQueries({ queryKey: ['repas-today'] });
      qc.invalidateQueries({ queryKey: ['plats-cantine'] });
      const noms = selectedPlatsItems.map(p => `${p.nom}${p.quantite > 1 ? ` ×${p.quantite}` : ''}`).join(', ');
      toast.success(`${noms} débité(s) pour ${selectedEleve?.prenom} ${selectedEleve?.nom}`);
      setSelectedEleve(null);
      setSelectedPlatIds({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Generate QR ───────────────────────────────────
  const generateQR = useMutation({
    mutationFn: async (eleveId: string) => {
      const qrValue = `CANTINE-${eleveId}`;
      const { error } = await supabase.from('eleves').update({ qr_code: qrValue }).eq('id', eleveId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-cantine'] });
      toast.success('QR Code généré');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ─── Filtered eleves ──────────────────────────────
  const filtered = eleves.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  // ─── Stats ─────────────────────────────────────────
  const totalInscrits = eleves.length;
  const minPrix = plats.length > 0 ? Math.min(...plats.map(p => Number(p.prix))) : 1000;
  const soldeFaible = eleves.filter((e: any) => Number(e.solde_cantine || 0) < minPrix).length;
  const totalSolde = eleves.reduce((s: number, e: any) => s + Number(e.solde_cantine || 0), 0);
  const caToday = repasToday.reduce((s, r: any) => s + Number(r.montant_debite || 0), 0);

  // ─── Inventaire du jour ────────────────────────────
  const inventaireJour = useMemo(() => {
    const map: Record<string, { nom: string; vendu: number; ca: number }> = {};
    repasToday.forEach((r: any) => {
      const nom = r.plat_nom || 'Inconnu';
      if (!map[nom]) map[nom] = { nom, vendu: 0, ca: 0 };
      map[nom].vendu += 1;
      map[nom].ca += Number(r.montant_debite || 0);
    });
    return Object.values(map).sort((a, b) => b.vendu - a.vendu);
  }, [repasToday]);

  // ─── Analytics: Top repas (week) ───────────────────
  const topRepas = useMemo(() => {
    const map: Record<string, number> = {};
    repasWeek.forEach((r: any) => {
      const nom = r.plat_nom || 'Inconnu';
      map[nom] = (map[nom] || 0) + 1;
    });
    return Object.entries(map)
      .map(([nom, count]) => ({ nom, count }))
      .sort((a, b) => b.count - a.count);
  }, [repasWeek]);

  // ─── Analytics: Weekly evolution ───────────────────
  const weeklyEvolution = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
      days[key] = 0;
    }
    repasWeek.forEach((r: any) => {
      const d = new Date(r.date_repas);
      const key = d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' });
      if (key in days) days[key]++;
    });
    return Object.entries(days).map(([jour, repas]) => ({ jour, repas }));
  }, [repasWeek]);

  const chartConfig = {
    repas: { label: 'Repas vendus', color: 'hsl(var(--primary))' },
    count: { label: 'Quantité', color: 'hsl(var(--primary))' },
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ScanLine className="h-7 w-7 text-primary" /> Cantine & QR Code
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Utensils className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Inscrits cantine</p>
                <p className="text-2xl font-bold">{totalInscrits}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Solde total</p>
                <p className="text-2xl font-bold">{totalSolde.toLocaleString()} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">CA du jour</p>
                <p className="text-2xl font-bold">{caToday.toLocaleString()} GNF</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Solde insuffisant</p>
                <p className="text-2xl font-bold text-destructive">{soldeFaible}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="vente"><Utensils className="h-4 w-4 mr-1" /> Vente</TabsTrigger>
          <TabsTrigger value="menu"><Package className="h-4 w-4 mr-1" /> Gestion Menu</TabsTrigger>
          <TabsTrigger value="inventaire"><CreditCard className="h-4 w-4 mr-1" /> Inventaire du Jour</TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 mr-1" /> Statistiques</TabsTrigger>
          <TabsTrigger value="rapport"><FileText className="h-4 w-4 mr-1" /> Rapport Journalier</TabsTrigger>
        </TabsList>

        {/* ═══ TAB: VENTE ═══ */}
        <TabsContent value="vente" className="space-y-4">
          {/* Scanner */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scanner un badge</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 max-w-md">
                <div className="relative flex-1">
                  <Input
                    placeholder="Scanner QR Code ou saisir matricule…"
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && scanInput) findEleve(scanInput); }}
                    autoFocus
                    className="pr-10"
                  />
                  <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setScannerOpen(true)} title="Scanner par caméra">
                    <Camera className="h-4 w-4 text-primary" />
                  </Button>
                </div>
                <Button onClick={() => scanInput && findEleve(scanInput)}>Rechercher</Button>
              </div>
              <QRScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} onScan={handleQRScan} title="Scanner Badge Cantine" />

              {selectedEleve && (
                <div className="mt-4 p-4 rounded-lg border bg-card space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold">{selectedEleve.prenom} {selectedEleve.nom}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedEleve.classes?.nom} • Matricule: {selectedEleve.matricule || '—'}
                      </p>
                      <p className="text-xl font-bold mt-2">
                        Crédit restant : <span className={Number(selectedEleve.solde_cantine || 0) < minPrix ? 'text-destructive' : 'text-green-600'}>
                          {Number(selectedEleve.solde_cantine || 0).toLocaleString()} GNF
                        </span>
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setHistoryEleveId(selectedEleve.id); setHistoryOpen(true); }}>
                      <History className="h-4 w-4 mr-1" /> Historique
                    </Button>
                  </div>

                  {/* Choix des repas (multi-sélection) */}
                  <div>
                    <Label className="text-sm font-medium">Choisir les repas :</Label>
                    {plats.length === 0 ? (
                      <p className="text-sm text-muted-foreground mt-1">Aucun plat configuré. Allez dans l'onglet "Gestion Menu" pour ajouter des plats.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                        {plats.map(p => {
                          const outOfStock = p.stock_restant <= 0;
                          const qty = selectedPlatIds[p.id] || 0;
                          const isSelected = qty > 0;
                          return (
                            <div key={p.id} className={`p-3 rounded-lg border text-left transition-all ${outOfStock ? 'border-destructive/30 bg-destructive/5 opacity-60' : isSelected ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}>
                              <p className="font-medium text-sm">{p.nom}</p>
                              <p className="text-xs text-muted-foreground">{Number(p.prix).toLocaleString()} GNF</p>
                              <div className="flex items-center gap-1 mt-1">
                                <Package className="h-3 w-3" />
                                <span className={`text-xs font-mono ${outOfStock ? 'text-destructive' : p.stock_restant < 10 ? 'text-orange-500' : 'text-muted-foreground'}`}>{outOfStock ? 'Épuisé' : `${p.stock_restant} restants`}</span>
                              </div>
                              {!outOfStock && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Button variant="outline" size="icon" className="h-6 w-6" disabled={qty <= 0} onClick={() => setSelectedPlatIds(prev => ({ ...prev, [p.id]: Math.max(0, (prev[p.id] || 0) - 1) }))}><Minus className="h-3 w-3" /></Button>
                                  <span className="text-sm font-bold w-6 text-center">{qty}</span>
                                  <Button variant="outline" size="icon" className="h-6 w-6" disabled={qty >= p.stock_restant} onClick={() => setSelectedPlatIds(prev => ({ ...prev, [p.id]: (prev[p.id] || 0) + 1 }))}><Plus className="h-3 w-3" /></Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Validation multi-plats */}
                  {selectedPlatsItems.length > 0 && (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      {Number(selectedEleve.solde_cantine || 0) < totalPlats ? (
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-5 w-5" />
                          <div>
                            <p className="font-bold">Solde Insuffisant - Merci de recharger</p>
                            <p className="text-xs">Solde: {Number(selectedEleve.solde_cantine || 0).toLocaleString()} GNF — Requis: {totalPlats.toLocaleString()} GNF</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {selectedPlatsItems.map(p => (
                            <div key={p.id} className="flex justify-between text-sm"><span>{p.nom} × {p.quantite}</span><span className="font-bold">{(Number(p.prix) * p.quantite).toLocaleString()} GNF</span></div>
                          ))}
                          <div className="flex items-center justify-between pt-2 border-t">
                            <div>
                              <p className="text-sm font-bold">Total : {totalPlats.toLocaleString()} GNF</p>
                              <p className="text-xs text-muted-foreground">Solde après débit : {(Number(selectedEleve.solde_cantine || 0) - totalPlats).toLocaleString()} GNF</p>
                            </div>
                            <Button onClick={() => debitRepas.mutate()} disabled={debitRepas.isPending}><CheckCircle className="h-4 w-4 mr-1" /> Valider les repas</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Liste élèves */}
          <div className="flex items-center gap-3 justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex gap-2">
                <Button onClick={() => setPlancheOpen(true)} className="gap-2">
                  <Printer className="h-4 w-4" /> Imprimer cartes ({selectedIds.size})
                </Button>
                <Button onClick={() => setBordereauOpen(true)} variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" /> Bordereau ({selectedIds.size})
                </Button>
              </div>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length} onCheckedChange={toggleAll} />
                    </TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Solde</TableHead>
                    <TableHead>QR Code</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun élève inscrit à la cantine</TableCell></TableRow>
                  ) : filtered.map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell><Checkbox checked={selectedIds.has(e.id)} onCheckedChange={() => toggleSelect(e.id)} /></TableCell>
                      <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                      <TableCell>{e.classes?.nom || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={Number(e.solde_cantine || 0) < minPrix ? 'destructive' : 'default'}>
                          {Number(e.solde_cantine || 0).toLocaleString()} GNF
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {e.qr_code ? (
                          <Button variant="ghost" size="sm" onClick={() => { setBadgeEleve(e); setBadgeOpen(true); }}>
                            <QrCode className="h-4 w-4 mr-1" /> Voir
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => generateQR.mutate(e.id)}>
                            <Plus className="h-4 w-4 mr-1" /> Générer
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedEleve(e); setSelectedPlatIds({}); }}>
                            <Utensils className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setHistoryEleveId(e.id); setHistoryOpen(true); }}>
                            <History className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setCarteEleve(e)} title="Carte cantine">
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: GESTION MENU ═══ */}
        <TabsContent value="menu" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Plus className="h-5 w-5" /> Ajouter un plat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div>
                  <Label>Nom du plat</Label>
                  <Input placeholder="Ex: Riz Gras" value={newPlat.nom} onChange={e => setNewPlat(p => ({ ...p, nom: e.target.value }))} />
                </div>
                <div>
                  <Label>Prix unitaire (GNF)</Label>
                  <Input type="number" placeholder="Ex: 5000" value={newPlat.prix} onChange={e => setNewPlat(p => ({ ...p, prix: e.target.value }))} />
                </div>
                <div>
                  <Label>Stock journalier</Label>
                  <Input type="number" placeholder="Ex: 100" value={newPlat.stock} onChange={e => setNewPlat(p => ({ ...p, stock: e.target.value }))} />
                </div>
                <Button onClick={() => addPlat.mutate()} disabled={addPlat.isPending}>
                  <Plus className="h-4 w-4 mr-1" /> Ajouter
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Menu actuel</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plat</TableHead>
                    <TableHead>Prix</TableHead>
                    <TableHead>Stock initial</TableHead>
                    <TableHead>Stock restant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plats.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun plat configuré</TableCell></TableRow>
                  ) : plats.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nom}</TableCell>
                      <TableCell>{Number(p.prix).toLocaleString()} GNF</TableCell>
                      <TableCell>{p.stock_journalier}</TableCell>
                      <TableCell>
                        <Badge variant={p.stock_restant <= 0 ? 'destructive' : p.stock_restant < 10 ? 'secondary' : 'default'}>
                          {p.stock_restant}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.actif ? 'default' : 'secondary'}>
                          {p.actif ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => resetStock.mutate(p)}>
                            Réinitialiser
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: INVENTAIRE DU JOUR ═══ */}
        <TabsContent value="inventaire" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Repas vendus aujourd'hui</p>
                <p className="text-3xl font-bold">{repasToday.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">CA du jour</p>
                <p className="text-3xl font-bold text-green-600">{caToday.toLocaleString()} GNF</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground">Types de repas servis</p>
                <p className="text-3xl font-bold">{inventaireJour.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Détail par plat</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plat</TableHead>
                    <TableHead>Vendus</TableHead>
                    <TableHead>Chiffre d'affaires</TableHead>
                    <TableHead>Stock restant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventaireJour.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Aucun repas vendu aujourd'hui</TableCell></TableRow>
                  ) : inventaireJour.map(item => {
                    const platMatch = plats.find(p => p.nom === item.nom);
                    return (
                      <TableRow key={item.nom}>
                        <TableCell className="font-medium">{item.nom}</TableCell>
                        <TableCell>{item.vendu}</TableCell>
                        <TableCell className="font-mono">{item.ca.toLocaleString()} GNF</TableCell>
                        <TableCell>
                          {platMatch ? (
                            <Badge variant={platMatch.stock_restant <= 0 ? 'destructive' : 'default'}>
                              {platMatch.stock_restant}
                            </Badge>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: STATISTIQUES ═══ */}
        <TabsContent value="stats" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top repas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top des repas (7 derniers jours)</CardTitle>
              </CardHeader>
              <CardContent>
                {topRepas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <PieChart>
                      <Pie
                        data={topRepas}
                        dataKey="count"
                        nameKey="nom"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ nom, count }) => `${nom}: ${count}`}
                      >
                        {topRepas.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            {/* Évolution hebdo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Consommation hebdomadaire</CardTitle>
              </CardHeader>
              <CardContent>
                {weeklyEvolution.every(d => d.repas === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>
                ) : (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart data={weeklyEvolution}>
                      <XAxis dataKey="jour" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="repas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Repas les moins populaires */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Repas les moins populaires</CardTitle>
            </CardHeader>
            <CardContent>
              {topRepas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pas de données</p>
              ) : (
                <div className="space-y-2">
                  {[...topRepas].reverse().slice(0, 3).map(r => (
                    <div key={r.nom} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm font-medium">{r.nom}</span>
                      <Badge variant="secondary">{r.count} ventes</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TAB: RAPPORT JOURNALIER ═══ */}
        <TabsContent value="rapport" className="space-y-4">
          <RapportJournalierPanel service="Cantine" />
        </TabsContent>
      </Tabs>

      {/* Dialog historique repas + paiements */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Historique Cantine</DialogTitle></DialogHeader>
          <Tabs defaultValue="consommation">
            <TabsList className="w-full">
              <TabsTrigger value="consommation" className="flex-1">🍽️ Consommation</TabsTrigger>
              <TabsTrigger value="recharges" className="flex-1">💳 Paiements/Recharges</TabsTrigger>
            </TabsList>
            <TabsContent value="consommation">
              <div className="max-h-[400px] overflow-y-auto">
                {repasHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun repas enregistré</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Repas</TableHead>
                        <TableHead>Montant</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {repasHistory.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs">{new Date(r.date_repas).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                          <TableCell>{r.plat_nom || '—'}</TableCell>
                          <TableCell className="font-mono">{Number(r.montant_debite).toLocaleString()} GNF</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
            <TabsContent value="recharges">
              <div className="max-h-[400px] overflow-y-auto">
                {paiementsCantine.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun paiement cantine enregistré</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Canal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paiementsCantine.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs">{new Date(p.date_paiement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                          <TableCell className="font-mono text-green-600">+{Number(p.montant).toLocaleString()} GNF</TableCell>
                          <TableCell><Badge variant="outline">{p.canal}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2">💡 Les paiements « Cantine » effectués dans Paiements créditent automatiquement le solde cantine.</p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Dialog badge QR */}
      <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Badge Cantine</DialogTitle></DialogHeader>
          {badgeEleve && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG value={JSON.stringify({
                  matricule: badgeEleve.matricule || '',
                  nom: badgeEleve.nom,
                  prenom: badgeEleve.prenom,
                  classe: badgeEleve.classes?.nom || '',
                  url: `${window.location.origin}/eleves?matricule=${encodeURIComponent(badgeEleve.matricule || badgeEleve.id)}`,
                })} size={180} />
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">{badgeEleve.prenom} {badgeEleve.nom}</p>
                <p className="text-sm text-muted-foreground">{badgeEleve.classes?.nom} • {badgeEleve.matricule || '—'}</p>
              </div>
              <Button variant="outline" onClick={() => window.print()}>Imprimer le badge</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Carte Cantine */}
      <Dialog open={!!carteEleve} onOpenChange={() => setCarteEleve(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Carte Cantine</DialogTitle></DialogHeader>
          {carteEleve && (
            <CarteCantine
              nom={carteEleve.nom}
              prenom={carteEleve.prenom}
              matricule={carteEleve.matricule || '—'}
              classe={carteEleve.classes?.nom || '—'}
              photo_url={carteEleve.photo_url}
              telephone_pere={carteEleve.familles?.telephone_pere}
              telephone_mere={carteEleve.familles?.telephone_mere}
              qrValue={JSON.stringify({
                matricule: carteEleve.matricule || '',
                nom: carteEleve.nom,
                prenom: carteEleve.prenom,
                classe: carteEleve.classes?.nom || '',
                type: 'cantine',
              })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Planche A4 */}
      {plancheOpen && (
        <PlancheCarteCantine
          eleves={
            (eleves || [])
              .filter((e: any) => selectedIds.has(e.id))
              .map((e: any) => ({
                id: e.id,
                nom: e.nom,
                prenom: e.prenom,
                matricule: e.matricule,
                classe: e.classes?.nom || '—',
                photo_url: e.photo_url,
                telephone_pere: e.familles?.telephone_pere,
                telephone_mere: e.familles?.telephone_mere,
              }))
          }
          onClose={() => setPlancheOpen(false)}
        />
      )}

      {bordereauOpen && (
        <BordereauRemiseCartes
          eleves={
            (eleves || [])
              .filter((e: any) => selectedIds.has(e.id))
              .map((e: any) => ({
                id: e.id,
                nom: e.nom,
                prenom: e.prenom,
                matricule: e.matricule,
                classe: e.classes?.nom || '—',
                option_cantine: e.option_cantine,
                transport_zone: e.transport_zone,
              }))
          }
          onClose={() => setBordereauOpen(false)}
        />
      )}
    </div>
  );
}
