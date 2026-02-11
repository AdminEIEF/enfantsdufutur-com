import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

const CANAUX = [
  { value: 'especes', label: 'Espèces' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'mtn_momo', label: 'MTN MoMo' },
];

const TYPES = [
  { value: 'scolarite', label: 'Scolarité' },
  { value: 'transport', label: 'Transport' },
  { value: 'cantine', label: 'Cantine' },
  { value: 'uniforme', label: 'Uniforme/Boutique' },
  { value: 'fournitures', label: 'Fournitures' },
];

export default function Paiements() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const [eleveId, setEleveId] = useState('');
  const [montant, setMontant] = useState('');
  const [canal, setCanal] = useState('especes');
  const [typePaiement, setTypePaiement] = useState('scolarite');
  const [reference, setReference] = useState('');

  const { data: paiements = [], isLoading } = useQuery({
    queryKey: ['paiements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paiements')
        .select('*, eleves(nom, prenom, matricule)')
        .order('date_paiement', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: eleves = [] } = useQuery({
    queryKey: ['eleves-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('eleves').select('id, nom, prenom, matricule').order('nom');
      if (error) throw error;
      return data;
    },
  });

  const createPaiement = useMutation({
    mutationFn: async () => {
      if (!eleveId || !montant || parseFloat(montant) <= 0) throw new Error('Élève et montant valide requis');
      const { error } = await supabase.from('paiements').insert({
        eleve_id: eleveId, montant: parseFloat(montant), canal, type_paiement: typePaiement,
        reference: reference || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paiements'] });
      toast({ title: 'Paiement enregistré' });
      setEleveId(''); setMontant(''); setCanal('especes'); setTypePaiement('scolarite'); setReference('');
      setOpen(false);
    },
    onError: (err: Error) => toast({ title: 'Erreur', description: err.message, variant: 'destructive' }),
  });

  const filtered = paiements.filter((p: any) =>
    `${p.eleves?.nom} ${p.eleves?.prenom} ${p.reference || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalRecettes = paiements.reduce((sum: number, p: any) => sum + Number(p.montant), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CreditCard className="h-7 w-7 text-primary" /> Paiements
        </h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Nouveau Paiement</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Enregistrer un paiement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Élève *</Label>
                <Select value={eleveId} onValueChange={setEleveId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner l'élève" /></SelectTrigger>
                  <SelectContent>
                    {eleves.map((e: any) => (
                      <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom} {e.matricule ? `(${e.matricule})` : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Montant (FCFA) *</Label><Input type="number" value={montant} onChange={e => setMontant(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={typePaiement} onValueChange={setTypePaiement}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Canal</Label>
                  <Select value={canal} onValueChange={setCanal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CANAUX.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Référence</Label><Input value={reference} onChange={e => setReference(e.target.value)} placeholder="N° transaction (optionnel)" /></div>
              <Button onClick={() => createPaiement.mutate()} disabled={createPaiement.isPending} className="w-full">Enregistrer le paiement</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Recettes</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{totalRecettes.toLocaleString()} FCFA</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nombre de paiements</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{paiements.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Paiement moyen</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{paiements.length > 0 ? Math.round(totalRecettes / paiements.length).toLocaleString() : 0} FCFA</p></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead><TableHead>Élève</TableHead><TableHead>Type</TableHead>
                <TableHead>Montant</TableHead><TableHead>Canal</TableHead><TableHead>Référence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun paiement</TableCell></TableRow>
              ) : filtered.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs">{new Date(p.date_paiement).toLocaleDateString('fr-FR')}</TableCell>
                  <TableCell className="font-medium">{p.eleves?.prenom} {p.eleves?.nom}</TableCell>
                  <TableCell><Badge variant="outline">{TYPES.find(t => t.value === p.type_paiement)?.label || p.type_paiement}</Badge></TableCell>
                  <TableCell className="font-mono font-bold">{Number(p.montant).toLocaleString()} FCFA</TableCell>
                  <TableCell><Badge variant={p.canal === 'especes' ? 'secondary' : 'default'}>{CANAUX.find(c => c.value === p.canal)?.label || p.canal}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.reference || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
