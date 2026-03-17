import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DollarSign, Check, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

export default function TresorierAvances() {
  const { data: avances = [], isLoading } = useQuery({
    queryKey: ['avances-tresorier'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avances_salaire')
        .select('*, employes(nom, prenom, matricule)')
        .in('statut', ['approuve', 'rembourse'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const enCours = avances.filter((a: any) => a.statut === 'approuve');
  const totalRestant = enCours.reduce((s: number, a: any) => s + (Number(a.montant) - Number(a.montant_rembourse || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <DollarSign className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Avances sur Salaire</h1>
          <p className="text-sm text-muted-foreground">Avances validées par le personnel, prêtes pour le paiement</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="pt-4 text-center">
            <Check className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-xl font-bold">{enCours.length}</div>
            <p className="text-xs text-muted-foreground">Validées en cours</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-xl font-bold">{totalRestant.toLocaleString()} GNF</div>
            <p className="text-xs text-muted-foreground">Montant restant à rembourser</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Avances validées — Suivi des remboursements</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employé</TableHead>
                <TableHead>Matricule</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Remboursé</TableHead>
                <TableHead>Restant</TableHead>
                <TableHead>Mois déduction</TableHead>
                <TableHead>Statut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
              ) : avances.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune avance validée</TableCell></TableRow>
              ) : avances.map((a: any) => {
                const restant = Number(a.montant) - Number(a.montant_rembourse || 0);
                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                    <TableCell className="font-mono text-xs">{a.employes?.matricule}</TableCell>
                    <TableCell className="font-bold">{Number(a.montant).toLocaleString()} GNF</TableCell>
                    <TableCell className="text-emerald-600">{Number(a.montant_rembourse || 0).toLocaleString()} GNF</TableCell>
                    <TableCell className={`font-bold ${restant > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{restant.toLocaleString()} GNF</TableCell>
                    <TableCell className="text-sm">{a.mois_remboursement || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.statut === 'rembourse' ? 'default' : 'secondary'}>
                        {a.statut === 'rembourse' ? 'Remboursé' : 'Approuvé pour le paiement'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
