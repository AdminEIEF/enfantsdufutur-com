import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

const MOIS_NOMS = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

const SERVICE_LABELS: Record<string, string> = {
  scolarite: 'Scolarité', transport: 'Transport', cantine: 'Cantine',
  uniforme: 'Boutique', fournitures: 'Librairie', autre: 'Autre',
};
const DEP_SERVICE_MAP: Record<string, string> = {
  'Transport': 'transport', 'Cantine': 'cantine', 'Boutique': 'uniforme',
  'Librairie': 'fournitures', 'Fonctionnement': 'autre', 'Autre': 'autre',
};

interface FinanceTresorerieTabProps {
  paiements: any[];
  depenses: any[];
  bulletins: any[];
  employes: any[];
  avances: any[];
}

export function FinanceTresorerieTab({ paiements, depenses, bulletins, employes, avances }: FinanceTresorerieTabProps) {
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const totalRecettes = paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);
    const totalDepensesValidees = depenses.reduce((s: number, d: any) => s + Number(d.montant), 0);
    const totalSalaires = bulletins.reduce((s: number, b: any) => s + Number(b.salaire_net), 0);

    const masseSalariale = employes
      .filter((e: any) => e.statut === 'actif')
      .reduce((s: number, e: any) => s + Number(e.salaire_base), 0);

    const totalAvancesEnCours = avances
      .filter((a: any) => a.statut === 'approuve')
      .reduce((s: number, a: any) => s + (Number(a.montant) - Number(a.montant_rembourse)), 0);

    const totalCharges = totalDepensesValidees + totalSalaires + totalAvancesEnCours;
    const soldeNet = totalRecettes - totalCharges;
    const couvertureMois = masseSalariale > 0 ? Math.floor((totalRecettes - totalDepensesValidees) / masseSalariale) : 0;

    // Recettes du mois
    const recettesMois = paiements
      .filter((p: any) => { const d = new Date(p.date_paiement); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })
      .reduce((s: number, p: any) => s + Number(p.montant), 0);
    const salairesMois = bulletins
      .filter((b: any) => b.mois === currentMonth + 1 && b.annee === currentYear)
      .reduce((s: number, b: any) => s + Number(b.salaire_net), 0);

    return { totalRecettes, totalDepensesValidees, totalSalaires, totalCharges, soldeNet, masseSalariale, couvertureMois, totalAvancesEnCours, recettesMois, salairesMois };
  }, [paiements, depenses, bulletins, employes, avances]);

  // Bilan par service: recettes vs (dépenses + quote-part salaires)
  const bilanParService = useMemo(() => {
    const services = Object.values(SERVICE_LABELS);
    const totalRecettes = paiements.reduce((s: number, p: any) => s + Number(p.montant), 0);

    return services.map(label => {
      const paiKey = Object.entries(SERVICE_LABELS).find(([, v]) => v === label)?.[0];
      const recettes = paiKey ? paiements.filter((p: any) => p.type_paiement === paiKey).reduce((sum: number, p: any) => sum + Number(p.montant), 0) : 0;
      const depKey = Object.entries(DEP_SERVICE_MAP).find(([, v]) => v === paiKey)?.[0] || label;
      const dep = depenses.filter((d: any) => d.service === depKey).reduce((sum: number, d: any) => sum + Number(d.montant), 0);

      // Quote-part des salaires proportionnelle aux recettes du service
      const quotePart = totalRecettes > 0 ? Math.round(stats.totalSalaires * (recettes / totalRecettes)) : 0;
      const totalChargesService = dep + quotePart;
      const margeNette = recettes - totalChargesService;
      const couverture = totalChargesService > 0 ? parseFloat((recettes / totalChargesService).toFixed(2)) : recettes > 0 ? 999 : 0;

      return { service: label, recettes, depenses: dep, salaires: quotePart, totalCharges: totalChargesService, marge: margeNette, couverture };
    }).filter(s => s.recettes > 0 || s.depenses > 0);
  }, [paiements, depenses, stats.totalSalaires]);

  // Chart data for service balance
  const chartData = bilanParService.map(s => ({
    service: s.service,
    recettes: s.recettes,
    depenses: s.depenses,
    salaires: s.salaires,
  }));

  // Monthly flux: recettes vs (dépenses + salaires)
  const fluxMensuel = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const result: { mois: string; recettes: number; depenses: number; salaires: number }[] = [];

    for (let m = 0; m < 12; m++) {
      const rec = paiements
        .filter((p: any) => { const d = new Date(p.date_paiement); return d.getMonth() === m && d.getFullYear() === currentYear; })
        .reduce((s: number, p: any) => s + Number(p.montant), 0);
      const dep = depenses
        .filter((d: any) => { const dd = new Date(d.date_depense); return dd.getMonth() === m && dd.getFullYear() === currentYear; })
        .reduce((s: number, d: any) => s + Number(d.montant), 0);
      const sal = bulletins
        .filter((b: any) => b.mois === m + 1 && b.annee === currentYear)
        .reduce((s: number, b: any) => s + Number(b.salaire_net), 0);

      if (rec > 0 || dep > 0 || sal > 0) {
        result.push({ mois: MOIS_NOMS[m + 1], recettes: rec, depenses: dep, salaires: sal });
      }
    }
    return result;
  }, [paiements, depenses, bulletins]);

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-success" />
            <div className="text-lg font-bold">{stats.totalRecettes.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Recettes totales</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <TrendingDown className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <div className="text-lg font-bold">{stats.totalDepensesValidees.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Dépenses validées</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <DollarSign className="h-5 w-5 mx-auto mb-1 text-orange-500" />
            <div className="text-lg font-bold">{stats.totalSalaires.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Salaires versés</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <Wallet className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-lg font-bold">{stats.totalAvancesEnCours.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Avances en cours</p>
          </CardContent>
        </Card>
        <Card className={stats.soldeNet < 0 ? 'border-destructive' : ''}>
          <CardContent className="pt-4 text-center">
            {stats.soldeNet >= 0 ? <CheckCircle className="h-5 w-5 mx-auto mb-1 text-success" /> : <XCircle className="h-5 w-5 mx-auto mb-1 text-destructive" />}
            <div className={`text-lg font-bold ${stats.soldeNet >= 0 ? 'text-success' : 'text-destructive'}`}>
              {stats.soldeNet.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Solde net trésorerie</p>
          </CardContent>
        </Card>
      </div>

      {/* Alert couverture */}
      {stats.couvertureMois < 2 && (
        <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            <strong>Attention :</strong> Les recettes après dépenses ne couvrent que {stats.couvertureMois} mois de masse salariale ({stats.masseSalariale.toLocaleString()} GNF/mois). Minimum recommandé : 2 mois.
          </p>
        </div>
      )}

      {/* Capacité de paiement */}
      <Card>
        <CardHeader><CardTitle className="text-base">Capacité de paiement du personnel</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Masse salariale mensuelle théorique</span>
            <span className="font-bold">{stats.masseSalariale.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Recettes ce mois</span>
            <span className="font-bold text-success">{stats.recettesMois.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Salaires versés ce mois</span>
            <span className="font-bold text-destructive">{stats.salairesMois.toLocaleString()} GNF</span>
          </div>
          <div className="flex justify-between text-sm border-t pt-2">
            <span className="font-medium">Couverture salariale</span>
            <Badge variant={stats.couvertureMois >= 3 ? 'default' : stats.couvertureMois >= 1 ? 'secondary' : 'destructive'}>
              {stats.couvertureMois} mois
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Bilan par service : recettes vs charges */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bilan par service : Recettes vs Charges totales</CardTitle>
          <p className="text-sm text-muted-foreground">Charges = Dépenses directes + Quote-part salaires (proportionnelle aux recettes)</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="service" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString()} GNF`} />
                <Legend />
                <Bar dataKey="recettes" fill="#22c55e" name="Recettes" radius={[4, 4, 0, 0]} />
                <Bar dataKey="depenses" fill="#ef4444" name="Dépenses" radius={[4, 4, 0, 0]} />
                <Bar dataKey="salaires" fill="#f97316" name="Quote-part salaires" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead className="text-right">Recettes</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Salaires</TableHead>
                  <TableHead className="text-right">Total charges</TableHead>
                  <TableHead className="text-right">Marge nette</TableHead>
                  <TableHead className="text-center">Verdict</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bilanParService.map((s) => (
                  <TableRow key={s.service}>
                    <TableCell className="font-medium">{s.service}</TableCell>
                    <TableCell className="text-right text-success">{s.recettes.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-destructive">{s.depenses.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-orange-500">{s.salaires.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold">{s.totalCharges.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-bold ${s.marge >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {s.marge.toLocaleString()} GNF
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={s.couverture >= 1.5 ? 'default' : s.couverture >= 1 ? 'secondary' : 'destructive'}>
                        {s.couverture >= 1.5 ? '✅ Excédent' : s.couverture >= 1 ? '⚖️ Équilibre' : '❌ Déficit'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total row */}
                <TableRow className="bg-muted/30 font-bold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right text-success">{stats.totalRecettes.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-destructive">{stats.totalDepensesValidees.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-orange-500">{stats.totalSalaires.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{stats.totalCharges.toLocaleString()}</TableCell>
                  <TableCell className={`text-right ${stats.soldeNet >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {stats.soldeNet.toLocaleString()} GNF
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={stats.soldeNet >= 0 ? 'default' : 'destructive'}>
                      {stats.soldeNet >= 0 ? '✅ Viable' : '❌ Déficitaire'}
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Flux mensuel */}
      {fluxMensuel.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Flux mensuel {new Date().getFullYear()} : Recettes vs Salaires + Dépenses</CardTitle></CardHeader>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mois</TableHead>
                  <TableHead className="text-right">Recettes</TableHead>
                  <TableHead className="text-right">Dépenses</TableHead>
                  <TableHead className="text-right">Salaires</TableHead>
                  <TableHead className="text-right">Solde</TableHead>
                  <TableHead className="text-center">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fluxMensuel.map((f) => {
                  const solde = f.recettes - f.depenses - f.salaires;
                  return (
                    <TableRow key={f.mois}>
                      <TableCell className="font-medium">{f.mois}</TableCell>
                      <TableCell className="text-right text-success">{f.recettes.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-destructive">{f.depenses.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-orange-500">{f.salaires.toLocaleString()}</TableCell>
                      <TableCell className={`text-right font-bold ${solde >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {solde.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={solde >= 0 ? 'default' : 'destructive'} className="text-xs">
                          {solde >= 0 ? 'OK' : 'Déficit'}
                        </Badge>
                      </TableCell>
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
