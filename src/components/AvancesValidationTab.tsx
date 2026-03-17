import { useState } from 'react';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

export default function AvancesValidationTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [refuseTarget, setRefuseTarget] = useState<string | null>(null);
  const [refuseMotif, setRefuseMotif] = useState('');

  const { data: avances = [], isLoading } = useQuery({
    queryKey: ['avances-all-personnel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const enAttente = avances.filter((a: any) => a.statut === 'en_attente');
  const approuvees = avances.filter((a: any) => a.statut === 'approuve' || a.statut === 'paye');
  const refusees = avances.filter((a: any) => a.statut === 'refuse');

  const handleAvance = async (id: string, statut: 'approuve' | 'refuse', motif?: string) => {
    const avance = avances.find((a: any) => a.id === id);
    await supabase.from('avances_salaire').update({
      statut,
      motif: statut === 'refuse' && motif ? motif : undefined,
      traite_par: user?.id,
      traite_at: new Date().toISOString(),
    }).eq('id', id);

    if (avance?.employe_id) {
      await supabase.from('employee_notifications').insert({
        employe_id: avance.employe_id,
        titre: statut === 'approuve' ? '✅ Avance approuvée' : '❌ Avance refusée',
        message: statut === 'approuve'
          ? `Votre demande d'avance de ${Number(avance.montant).toLocaleString()} GNF a été approuvée et transmise au trésorier pour paiement.`
          : `Votre demande d'avance de ${Number(avance.montant).toLocaleString()} GNF a été refusée.${motif ? ' Motif: ' + motif : ''}`,
        type: statut === 'approuve' ? 'info' : 'alerte',
      });
    }
    toast({ title: statut === 'approuve' ? '✅ Avance approuvée' : '❌ Avance refusée' });
    qc.invalidateQueries({ queryKey: ['avances-all-personnel'] });
  };

  const confirmRefuse = async () => {
    if (refuseTarget) {
      await handleAvance(refuseTarget, 'refuse', refuseMotif);
      setRefuseTarget(null);
      setRefuseMotif('');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">Demandes en attente de validation ({enAttente.length})</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : enAttente.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune demande en attente</TableCell></TableRow>
              ) : enAttente.map((a: any) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                  <TableCell className="font-mono text-xs">{a.employes?.matricule}</TableCell>
                  <TableCell className="font-bold">{Number(a.montant).toLocaleString()} GNF</TableCell>
                  <TableCell className="text-sm max-w-40 truncate">{a.motif || '—'}</TableCell>
                  <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => handleAvance(a.id, 'approuve')}>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => { setRefuseTarget(a.id); setRefuseMotif(''); }}>
                        <X className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {approuvees.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Avances validées — transmises au trésorier</CardTitle></CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Date validation</TableHead>
                  <TableHead>Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approuvees.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                    <TableCell className="font-bold">{Number(a.montant).toLocaleString()} GNF</TableCell>
                    <TableCell className="text-sm">{a.traite_at ? format(new Date(a.traite_at), 'dd/MM/yyyy') : '—'}</TableCell>
                    <TableCell><Badge variant={a.statut === 'paye' ? 'default' : 'secondary'}>{a.statut === 'paye' ? '💰 Payée' : 'Transmise au trésorier'}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {refusees.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Avances refusées</CardTitle></CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Motif refus</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {refusees.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                    <TableCell>{Number(a.montant).toLocaleString()} GNF</TableCell>
                    <TableCell className="text-sm">{a.motif || '—'}</TableCell>
                    <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <Dialog open={!!refuseTarget} onOpenChange={() => setRefuseTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Motif du refus</DialogTitle></DialogHeader>
          <Textarea value={refuseMotif} onChange={e => setRefuseMotif(e.target.value)} placeholder="Motif du refus (optionnel)..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefuseTarget(null)}>Annuler</Button>
            <Button variant="destructive" onClick={confirmRefuse}>Refuser</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
