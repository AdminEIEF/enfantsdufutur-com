import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScanLine, Search, Utensils, Wallet, History, QrCode, Plus, AlertTriangle } from 'lucide-react';
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

function useTarifRepas() {
  return useQuery({
    queryKey: ['tarif-repas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tarifs')
        .select('montant')
        .eq('categorie', 'cantine')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.montant ?? 1000;
    },
  });
}

export default function Cantine() {
  const qc = useQueryClient();
  const { data: eleves = [], isLoading } = useElevesCantine();
  const { data: tarifRepas } = useTarifRepas();
  const [search, setSearch] = useState('');
  const [scanInput, setScanInput] = useState('');
  const [selectedEleve, setSelectedEleve] = useState<any>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyEleveId, setHistoryEleveId] = useState<string | null>(null);
  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(5000);
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [badgeEleve, setBadgeEleve] = useState<any>(null);

  const { data: repasHistory = [] } = useRepasHistory(historyEleveId);

  // Scan QR code or search by matricule
  const findEleve = (code: string) => {
    const found = eleves.find(
      (e: any) => e.qr_code === code || e.matricule === code || e.id === code
    );
    if (found) {
      setSelectedEleve(found);
    } else {
      toast.error('Élève introuvable');
    }
    setScanInput('');
  };

  // Débiter un repas
  const debitRepas = useMutation({
    mutationFn: async (eleve: any) => {
      const montant = Number(tarifRepas) || 1000;
      const nouveauSolde = Number(eleve.solde_cantine || 0) - montant;
      if (nouveauSolde < 0) throw new Error('Solde insuffisant');

      const { error: repasError } = await supabase.from('repas_cantine').insert({
        eleve_id: eleve.id,
        montant_debite: montant,
      });
      if (repasError) throw repasError;

      const { error: updateError } = await supabase
        .from('eleves')
        .update({ solde_cantine: nouveauSolde })
        .eq('id', eleve.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-cantine'] });
      toast.success(`Repas débité pour ${selectedEleve?.prenom} ${selectedEleve?.nom}`);
      setSelectedEleve(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Recharger le solde
  const rechargeSolde = useMutation({
    mutationFn: async () => {
      if (!selectedEleve) throw new Error('Aucun élève sélectionné');
      const nouveauSolde = Number(selectedEleve.solde_cantine || 0) + rechargeAmount;
      const { error } = await supabase
        .from('eleves')
        .update({ solde_cantine: nouveauSolde })
        .eq('id', selectedEleve.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eleves-cantine'] });
      toast.success(`Solde rechargé de ${rechargeAmount.toLocaleString()} GNF`);
      setRechargeOpen(false);
      setSelectedEleve(null);
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
  const soldeFaible = eleves.filter((e: any) => Number(e.solde_cantine || 0) < Number(tarifRepas || 1000)).length;
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
              <AlertTriangle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-sm text-muted-foreground">Solde insuffisant</p>
                <p className="text-2xl font-bold text-warning">{soldeFaible}</p>
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
            <div className="mt-4 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-bold">{selectedEleve.prenom} {selectedEleve.nom}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedEleve.classes?.nom} • Matricule: {selectedEleve.matricule || '—'}
                  </p>
                  <p className="text-xl font-bold mt-2">
                    Solde: <span className={Number(selectedEleve.solde_cantine || 0) < Number(tarifRepas || 1000) ? 'text-destructive' : 'text-accent'}>
                      {Number(selectedEleve.solde_cantine || 0).toLocaleString()} GNF
                    </span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => debitRepas.mutate(selectedEleve)}
                    disabled={debitRepas.isPending || Number(selectedEleve.solde_cantine || 0) < Number(tarifRepas || 1000)}
                  >
                    <Utensils className="h-4 w-4 mr-2" /> Débiter repas ({Number(tarifRepas || 1000).toLocaleString()} F)
                  </Button>
                  <Button variant="outline" onClick={() => { setRechargeOpen(true); }}>
                    <Wallet className="h-4 w-4 mr-2" /> Recharger
                  </Button>
                </div>
              </div>
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
                    <Badge variant={Number(e.solde_cantine || 0) < Number(tarifRepas || 1000) ? 'destructive' : 'default'}>
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
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedEleve(e); }}>
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

      {/* Dialog recharge */}
      <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Recharger le solde cantine</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Élève: <strong>{selectedEleve?.prenom} {selectedEleve?.nom}</strong><br />
              Solde actuel: <strong>{Number(selectedEleve?.solde_cantine || 0).toLocaleString()} GNF</strong>
            </p>
            <div><Label>Montant à créditer (GNF)</Label><Input type="number" value={rechargeAmount} onChange={e => setRechargeAmount(Number(e.target.value))} min={0} /></div>
          </div>
          <DialogFooter><Button onClick={() => rechargeSolde.mutate()} disabled={rechargeSolde.isPending}>Recharger</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog historique repas */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Historique des repas</DialogTitle></DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {repasHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun repas enregistré</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repasHistory.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{new Date(r.date_repas).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell>{Number(r.montant_debite).toLocaleString()} GNF</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog badge QR */}
      <Dialog open={badgeOpen} onOpenChange={setBadgeOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Badge Cantine</DialogTitle></DialogHeader>
          {badgeEleve && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-lg border">
                <QRCodeSVG value={badgeEleve.qr_code || ''} size={180} />
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
