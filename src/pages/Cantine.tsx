import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScanLine, Search, Utensils, Wallet, History, QrCode, Plus, AlertTriangle, CreditCard, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';

// ─── Hooks ───────────────────────────────────────────────
function useElevesCantine() {
  return useQuery({
    queryKey: ['eleves-cantine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, solde_cantine, option_cantine, qr_code, classes(nom)')
        .eq('option_cantine', true)
        .order('nom');
      if (error) throw error;
      return data;
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

function usePlatsCantine() {
  return useQuery({
    queryKey: ['plats-cantine'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifs')
        .select('*')
        .eq('categorie', 'cantine')
        .order('label');
      if (error) throw error;
      return data;
    },
  });
}

export default function Cantine() {
  const qc = useQueryClient();
  const { data: eleves = [], isLoading } = useElevesCantine();
  const { data: plats = [] } = usePlatsCantine();
  const [search, setSearch] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEleveId, setHistoryEleveId] = useState<string | null>(null);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [badgeEleve, setBadgeEleve] = useState<any>(null);
  const [selectedPlatId, setSelectedPlatId] = useState<string | null>(null);

  const { data: repasHistory = [] } = useRepasHistory(historyEleveId);
  const { data: paiementsCantine = [] } = usePaiementsCantine(selectedEleve?.id || historyEleveId);

  const selectedPlat = plats.find((p: any) => p.id === selectedPlatId);

  // Scan QR code or search by matricule
  const findEleve = (code: string) => {
    const found = eleves.find(
      (e: any) => e.qr_code === code || e.matricule === code || e.id === code
    );
    if (found) {
      setSelectedEleve(found);
      setSelectedPlatId(null);
    } else {
      toast.error('Élève introuvable');
    }
    setScanInput('');
  };

  // Débiter un repas
  const debitRepas = useMutation({
    mutationFn: async () => {
      if (!selectedEleve || !selectedPlat) throw new Error('Sélectionnez un élève et un repas');
      const montant = Number(selectedPlat.montant);
      const solde = Number(selectedEleve.solde_cantine || 0);
      if (solde < montant) throw new Error('Solde insuffisant');

      const { error: repasError } = await supabase.from('repas_cantine').insert({
        eleve_id: selectedEleve.id,
        montant_debite: montant,
        plat_nom: selectedPlat.label,
      } as any);
      if (repasError) throw repasError;

      const { error: updateError } = await supabase
        .from('eleves')
        .update({ solde_cantine: solde - montant })
        .eq('id', selectedEleve.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-cantine'] });
      qc.invalidateQueries({ queryKey: ['repas-history'] });
      toast.success(`${selectedPlat?.label} débité pour ${selectedEleve?.prenom} ${selectedEleve?.nom}`);
      setSelectedEleve(null);
      setSelectedPlatId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Generate QR code for eleve
  const generateQR = useMutation({
    mutationFn: async (eleveId: string) => {
      const qrValue = `CANTINE-${eleveId}`;
      const { error } = await supabase
        .from('eleves')
        .update({ qr_code: qrValue })
        .eq('id', eleveId);
      if (error) throw error;
      return qrValue;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-cantine'] });
      toast.success('QR Code généré');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = eleves.filter((e: any) =>
    `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalInscrits = eleves.length;
  const defaultTarif = plats.length > 0 ? Math.min(...plats.map((p: any) => Number(p.montant))) : 1000;
  const soldeFaible = eleves.filter((e: any) => Number(e.solde_cantine || 0) < defaultTarif).length;
  const totalSolde = eleves.reduce((s: number, e: any) => s + Number(e.solde_cantine || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ScanLine className="h-7 w-7 text-primary" /> Cantine & QR Code
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Solde insuffisant</p>
                <p className="text-2xl font-bold text-destructive">{soldeFaible}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scanner */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScanLine className="h-5 w-5" /> Scanner un badge</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 max-w-md">
            <Input
              placeholder="Scanner QR Code ou saisir matricule…"
              value={scanInput}
              onChange={e => setScanInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && scanInput) findEleve(scanInput); }}
              autoFocus
            />
            <Button onClick={() => scanInput && findEleve(scanInput)}>Rechercher</Button>
          </div>

          {selectedEleve && (
            <div className="mt-4 p-4 rounded-lg border bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{selectedEleve.prenom} {selectedEleve.nom}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEleve.classes?.nom} • Matricule: {selectedEleve.matricule || '—'}
                  </p>
                  <p className="text-xl font-bold mt-2">
                    Crédit restant : <span className={Number(selectedEleve.solde_cantine || 0) < defaultTarif ? 'text-destructive' : 'text-accent'}>
                      {Number(selectedEleve.solde_cantine || 0).toLocaleString()} GNF
                    </span>
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => { setHistoryEleveId(selectedEleve.id); setHistoryOpen(true); }}>
                  <History className="h-4 w-4 mr-1" /> Historique
                </Button>
              </div>

              {/* Menu des repas */}
              <div>
                <Label className="text-sm font-medium">Choisir un repas :</Label>
                {plats.length === 0 ? (
                  <p className="text-sm text-muted-foreground mt-1">Aucun plat configuré. Ajoutez des plats dans Configuration &gt; Tarifs (catégorie Cantine).</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {plats.map((p: any) => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPlatId(p.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${selectedPlatId === p.id ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                      >
                        <p className="font-medium text-sm">{p.label}</p>
                        <p className="text-xs text-muted-foreground">{Number(p.montant).toLocaleString()} GNF</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Validation */}
              {selectedPlat && (
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div>
                    <p className="text-sm"><strong>{selectedPlat.label}</strong> — {Number(selectedPlat.montant).toLocaleString()} GNF</p>
                    <p className="text-xs text-muted-foreground">
                      Solde après débit : {(Number(selectedEleve.solde_cantine || 0) - Number(selectedPlat.montant)).toLocaleString()} GNF
                    </p>
                  </div>
                  <Button
                    onClick={() => debitRepas.mutate()}
                    disabled={debitRepas.isPending || Number(selectedEleve.solde_cantine || 0) < Number(selectedPlat.montant)}
                  >
                    {Number(selectedEleve.solde_cantine || 0) < Number(selectedPlat.montant) ? (
                      <><AlertTriangle className="h-4 w-4 mr-1" /> Solde insuffisant</>
                    ) : (
                      <><CheckCircle className="h-4 w-4 mr-1" /> Valider le repas</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Liste élèves cantine */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Élève</TableHead>
                <TableHead>Classe</TableHead>
                <TableHead>Solde</TableHead>
                <TableHead>QR Code</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Aucun élève inscrit à la cantine</TableCell></TableRow>
              ) : filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.prenom} {e.nom}</TableCell>
                  <TableCell>{e.classes?.nom || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={Number(e.solde_cantine || 0) < defaultTarif ? 'destructive' : 'default'}>
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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEleve(e); setSelectedPlatId(null); }}>
                        <Utensils className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setHistoryEleveId(e.id); setHistoryOpen(true); }}>
                        <History className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                          <TableCell>{(r as any).plat_nom || '—'}</TableCell>
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
    </div>
  );
}
