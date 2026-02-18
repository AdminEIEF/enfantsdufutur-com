import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UtensilsCrossed, Plus, Search, CheckCircle, Loader2, Clock, XCircle, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { generateRecuGeneriquePDF } from '@/lib/generateRecuGeneriquePDF';

interface Props {
  eleves: any[];
  familles?: any[];
}

export default function CantineDirectePanel({ eleves, familles = [] }: Props) {
  const queryClient = useQueryClient();
  const [openDirect, setOpenDirect] = useState(false);
  const [familleId, setFamilleId] = useState('');
  const [eleveId, setEleveId] = useState('');
  const [montant, setMontant] = useState('');
  const [searchOrdre, setSearchOrdre] = useState('');

  const selectedEleve = eleves.find((e: any) => e.id === eleveId);

  // Élèves de la famille sélectionnée avec option cantine
  const elevesFamille = useMemo(() => {
    if (!familleId) return [];
    return eleves.filter((e: any) => e.famille_id === familleId && e.option_cantine);
  }, [eleves, familleId]);

  // Familles qui ont au moins un enfant avec option cantine
  const famillesAvecCantine = useMemo(() => {
    const familleIds = new Set(
      eleves.filter((e: any) => e.option_cantine && e.famille_id).map((e: any) => e.famille_id)
    );
    return familles.filter((f: any) => familleIds.has(f.id));
  }, [eleves, familles]);

  // Fetch pending cantine orders
  const { data: ordresEnAttente = [], isLoading: loadingOrdres } = useQuery({
    queryKey: ['ordres-cantine-en-attente'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordres_cantine' as any)
        .select('*, eleves:eleve_id(prenom, nom, matricule, solde_cantine), familles:famille_id(nom_famille)')
        .eq('statut', 'en_attente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent validated/all orders
  const { data: ordresRecents = [] } = useQuery({
    queryKey: ['ordres-cantine-recents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordres_cantine' as any)
        .select('*, eleves:eleve_id(prenom, nom, matricule), familles:famille_id(nom_famille)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // Direct recharge mutation
  const rechargeDirect = useMutation({
    mutationFn: async () => {
      if (!eleveId || !montant || Number(montant) <= 0) throw new Error('Élève et montant requis');
      
      // Create payment record (trigger will credit solde_cantine)
      const { error } = await supabase.from('paiements').insert({
        eleve_id: eleveId,
        montant: Number(montant),
        type_paiement: 'cantine',
        canal: 'especes',
        mois_concerne: 'Recharge directe',
      } as any);
      if (error) throw error;

      // Also record in ordres_cantine for tracking
      const familleId = selectedEleve?.famille_id;
      if (familleId) {
        await supabase.from('ordres_cantine' as any).insert({
          famille_id: familleId,
          eleve_id: eleveId,
          montant: Number(montant),
          code_transaction: 'DIR-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          statut: 'valide',
          canal: 'direct_caisse',
          validated_at: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      queryClient.invalidateQueries({ queryKey: ['ordres-cantine-en-attente'] });
      queryClient.invalidateQueries({ queryKey: ['ordres-cantine-recents'] });
      toast({ title: '✅ Recharge effectuée', description: `${Number(montant).toLocaleString()} GNF crédités sur le compte cantine` });

      // Generate receipt
      const famille = familles.find((f: any) => f.id === familleId);
      if (selectedEleve) {
        generateRecuGeneriquePDF({
          type: 'cantine',
          typeLabel: 'Recharge Cantine (Directe)',
          eleve: `${selectedEleve.prenom} ${selectedEleve.nom}`,
          matricule: selectedEleve.matricule || '',
          classe: selectedEleve.classes?.nom || '',
          montant: Number(montant),
          mois: 'Recharge directe',
          canal: 'Espèces',
          reference: null,
          date: new Date().toLocaleDateString('fr-FR'),
          details: `Famille: ${famille?.nom_famille || '—'} • Nouveau solde: ${((selectedEleve.solde_cantine || 0) + Number(montant)).toLocaleString()} GNF`,
        });
      }

      setFamilleId('');
      setEleveId('');
      setMontant('');
      setOpenDirect(false);
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  // Validate pending order
  const validerOrdre = useMutation({
    mutationFn: async (ordre: any) => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cantine-ordre`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ action: 'validate_ordre', ordre_id: ordre.id }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      return { ...data, ordre };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['ordres-cantine-en-attente'] });
      queryClient.invalidateQueries({ queryKey: ['ordres-cantine-recents'] });
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      queryClient.invalidateQueries({ queryKey: ['eleves'] });
      toast({ title: '✅ Ordre validé', description: 'Le solde cantine a été crédité et le parent notifié' });

      // Generate receipt
      const o = result.ordre;
      generateRecuGeneriquePDF({
        type: 'cantine',
        typeLabel: 'Recharge Cantine (Ordonnée)',
        eleve: `${o.eleves?.prenom || ''} ${o.eleves?.nom || ''}`,
        matricule: o.eleves?.matricule || '',
        classe: '',
        montant: Number(o.montant),
        mois: 'Recharge ordonnée',
        canal: 'Espèces',
        reference: o.code_transaction,
        date: new Date().toLocaleDateString('fr-FR'),
        details: `Famille: ${o.familles?.nom_famille || '—'} • Code: ${o.code_transaction}`,
      });
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const filteredOrdres = useMemo(() => {
    if (!searchOrdre) return ordresEnAttente;
    const s = searchOrdre.toLowerCase();
    return ordresEnAttente.filter((o: any) =>
      o.code_transaction?.toLowerCase().includes(s) ||
      (o as any).eleves?.prenom?.toLowerCase().includes(s) ||
      (o as any).eleves?.nom?.toLowerCase().includes(s) ||
      (o as any).familles?.nom_famille?.toLowerCase().includes(s)
    );
  }, [ordresEnAttente, searchOrdre]);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="file-attente">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="file-attente">
              <Clock className="h-4 w-4 mr-1" /> File d'attente ({ordresEnAttente.length})
            </TabsTrigger>
            <TabsTrigger value="historique-ordres">
              <CheckCircle className="h-4 w-4 mr-1" /> Historique
            </TabsTrigger>
          </TabsList>
          <Dialog open={openDirect} onOpenChange={setOpenDirect}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" /> Recharge Directe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <UtensilsCrossed className="h-5 w-5 text-primary" />
                  Recharge Cantine Directe
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Famille *</Label>
                  <Select value={familleId} onValueChange={(v) => { setFamilleId(v); setEleveId(''); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner la famille" /></SelectTrigger>
                    <SelectContent>
                      {famillesAvecCantine.map((f: any) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nom_famille}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {familleId && (
                <div className="space-y-2">
                  <Label>Élève *</Label>
                  <Select value={eleveId} onValueChange={setEleveId}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner l'élève" /></SelectTrigger>
                    <SelectContent>
                      {elevesFamille.map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.prenom} {e.nom} {e.matricule ? `(${e.matricule})` : ''} — Solde: {(e.solde_cantine || 0).toLocaleString()} GNF
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                )}
                {selectedEleve && (
                  <div className="bg-muted/50 rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Solde actuel</p>
                    <p className="font-bold text-lg text-primary">{(selectedEleve.solde_cantine || 0).toLocaleString()} GNF</p>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Montant reçu en espèces (GNF) *</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 100000"
                    value={montant}
                    onChange={e => setMontant(e.target.value)}
                    min={1000}
                  />
                </div>
                {montant && Number(montant) > 0 && selectedEleve && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground">Après recharge</p>
                    <p className="font-bold text-green-700">
                      {((selectedEleve.solde_cantine || 0) + Number(montant)).toLocaleString()} GNF
                    </p>
                  </div>
                )}
                <Button
                  onClick={() => rechargeDirect.mutate()}
                  disabled={rechargeDirect.isPending}
                  className="w-full"
                >
                  {rechargeDirect.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Valider la recharge
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <TabsContent value="file-attente" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher par code, nom..."
              value={searchOrdre}
              onChange={e => setSearchOrdre(e.target.value)}
              className="pl-9"
            />
          </div>

          {loadingOrdres ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredOrdres.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Aucun ordre en attente de validation</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredOrdres.map((o: any) => (
                <Card key={o.id} className="border-amber-200 bg-amber-50/30">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 font-mono">
                            <QrCode className="h-3 w-3 mr-1" />
                            {o.code_transaction}
                          </Badge>
                          <span className="text-sm font-semibold">
                            {(o as any).eleves?.prenom} {(o as any).eleves?.nom}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Famille {(o as any).familles?.nom_famille} • {new Date(o.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="font-bold text-lg">{Number(o.montant).toLocaleString()} GNF</p>
                        <Button
                          size="sm"
                          onClick={() => validerOrdre.mutate(o)}
                          disabled={validerOrdre.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" /> Valider
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="historique-ordres" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Famille</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordresRecents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun ordre</TableCell>
                    </TableRow>
                  ) : ordresRecents.map((o: any) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-xs">{format(new Date(o.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}</TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-xs">{o.code_transaction}</Badge></TableCell>
                      <TableCell className="font-medium">{(o as any).eleves?.prenom} {(o as any).eleves?.nom}</TableCell>
                      <TableCell className="text-xs">{(o as any).familles?.nom_famille || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={o.canal === 'direct_caisse' ? 'secondary' : 'outline'}>
                          {o.canal === 'direct_caisse' ? '💵 Direct' : '📱 Ordre parent'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">{Number(o.montant).toLocaleString()} GNF</TableCell>
                      <TableCell>
                        <Badge variant={o.statut === 'valide' ? 'default' : o.statut === 'en_attente' ? 'secondary' : 'destructive'}
                          className={o.statut === 'valide' ? 'bg-green-600' : ''}>
                          {o.statut === 'valide' ? '✓ Validé' : o.statut === 'en_attente' ? '⏳ En attente' : '✗ Annulé'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
