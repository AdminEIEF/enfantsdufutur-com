import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

interface TresorerieTabProps {
  paiements: any[];
  bulletins: any[];
  avances: any[];
  employes: any[];
}

export function TresorerieTab({ paiements, bulletins, avances, employes }: TresorerieTabProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Total tuition income (all scolarite + transport + inscription + reinscription payments)
    const totalRecettes = paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
    const recettesMois = paiements
      .filter((p: any) => {
        const d = new Date(p.date_paiement);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((s: number, p: any) => s + Number(p.montant), 0);

    // Total salary expenses (from bulletins)
    const totalSalaires = bulletins.reduce((s: number, b: any) => s + Number(b.salaire_net), 0);
    const salairesMois = bulletins
      .filter((b: any) => b.mois === currentMonth + 1 && b.annee === currentYear)
      .reduce((s: number, b: any) => s + Number(b.salaire_net), 0);

    // Mass salariale théorique (all active employees)
    const masseSalariale = employes
      .filter((e: any) => e.statut === 'actif')
      .reduce((s: number, e: any) => s + Number(e.salaire_base), 0);

    // Total approved avances
    const totalAvancesApprouvees = avances
      .filter((a: any) => a.statut === 'approuve' || a.statut === 'rembourse')
      .reduce((s: number, a: any) => s + Number(a.montant), 0);
    const totalAvancesRemboursees = avances
      .filter((a: any) => a.statut === 'approuve' || a.statut === 'rembourse')
      .reduce((s: number, a: any) => s + Number(a.montant_rembourse), 0);
    const soldeAvances = totalAvancesApprouvees - totalAvancesRemboursees;

    // Balance
    const solde = totalRecettes - totalSalaires - soldeAvances;
    const couvertureMois = masseSalariale > 0 ? Math.floor(solde / masseSalariale) : 0;

    // Monthly breakdown
    const mensuel: Record<string, { recettes: number; salaires: number; avances: number }> = {};
    for (let m = 0; m < 12; m++) {
      const key = `${MOIS_NOMS[m + 1]}`;
      mensuel[key] = { recettes: 0, salaires: 0, avances: 0 };
    }
    paiements.forEach((p: any) => {
      const d = new Date(p.date_paiement);
      if (d.getFullYear() === currentYear) {
        const key = MOIS_NOMS[d.getMonth() + 1];
        if (mensuel[key]) mensuel[key].recettes += Number(p.montant);
      }
    });
    bulletins.forEach((b: any) => {
      if (b.annee === currentYear) {
        const key = MOIS_NOMS[b.mois];
        if (mensuel[key]) mensuel[key].salaires += Number(b.salaire_net);
      }
    });

    return { totalRecettes, recettesMois, totalSalaires, salairesMois, masseSalariale, totalAvancesApprouvees, soldeAvances, solde, couvertureMois, mensuel };
  }, [paiements, bulletins, avances, employes]);

  // Avances with remaining balance
  const avancesEnCours = avances.filter((a: any) => a.statut === 'approuve' && Number(a.montant) - Number(a.montant_rembourse) > 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <div className="text-lg font-bold">{stats.totalRecettes.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Recettes totales (GNF)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-lg font-bold">{stats.totalSalaires.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Salaires versés (GNF)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <div className="text-lg font-bold">{stats.soldeAvances.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Avances en cours (GNF)</p>
          </CardContent>
        </Card>
        <Card className={stats.solde < 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-4 text-center">
            <Wallet className="h-5 w-5 mx-auto mb-1" />
            <div className={`text-lg font-bold ${stats.solde < 0 ? 'text-destructive' : 'text-emerald-600'}`}>
              {stats.solde.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Solde trésorerie (GNF)</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert */}
      {stats.couvertureMois < 2 && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            <strong>Attention :</strong> La trésorerie ne couvre que {stats.couvertureMois} mois de masse salariale ({stats.masseSalariale.toLocaleString()} GNF/mois).
          </p>
        </div>
      )}

      {/* Masse salariale info */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Capacité de paiement</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Masse salariale mensuelle</span>
            <span className="font-bold">{stats.masseSalariale.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recettes ce mois</span>
            <span className="font-bold text-emerald-600">{stats.recettesMois.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Salaires versés ce mois</span>
            <span className="font-bold text-destructive">{stats.salairesMois.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="text-muted-foreground">Couverture restante</span>
            <Badge variant={stats.couvertureMois >= 3 ? 'default' : stats.couvertureMois >= 1 ? 'secondary' : 'destructive'}>
              {stats.couvertureMois} mois
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Flux mensuel */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Flux mensuel {new Date().getFullYear()}</CardTitle></CardHeader>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mois</TableHead>
                <TableHead className="text-right">Recettes</TableHead>
                <TableHead className="text-right">Salaires</TableHead>
                <TableHead className="text-right">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(stats.mensuel).map(([mois, v]) => {
                const solde = v.recettes - v.salaires;
                if (v.recettes === 0 && v.salaires === 0) return null;
                return (
                  <TableRow key={mois}>
                    <TableCell className="font-medium">{mois}</TableCell>
                    <TableCell className="text-right text-emerald-600">{v.recettes.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">{v.salaires.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-bold ${solde >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                      {solde.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Avances en cours */}
      {avancesEnCours.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Avances en cours de remboursement</CardTitle></CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employé</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Remboursé</TableHead>
                  <TableHead>Restant</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {avancesEnCours.map((a: any) => {
                  const restant = Number(a.montant) - Number(a.montant_rembourse);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.employes?.prenom} {a.employes?.nom}</TableCell>
                      <TableCell>{Number(a.montant).toLocaleString()} GNF</TableCell>
                      <TableCell className="text-emerald-600">{Number(a.montant_rembourse).toLocaleString()} GNF</TableCell>
                      <TableCell className="font-bold text-destructive">{restant.toLocaleString()} GNF</TableCell>
                      <TableCell className="text-sm">{format(new Date(a.created_at), 'dd/MM/yyyy')}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
