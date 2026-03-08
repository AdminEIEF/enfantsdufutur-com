import { Card, CardContent } from '@/components/ui/card';
import { UtensilsCrossed } from 'lucide-react';

interface Props {
  repas: any[];
  soldeCantine: number;
}

export default function ParentEnfantCantine({ repas, soldeCantine }: Props) {
  return (
    <div className="space-y-4">
      <Card className="border-green-200 bg-green-50/50">
        <CardContent className="pt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Solde cantine</p>
            <p className="text-2xl font-bold text-green-700">{soldeCantine.toLocaleString()} GNF</p>
          </div>
          <UtensilsCrossed className="h-8 w-8 text-green-300" />
        </CardContent>
      </Card>

      <h3 className="text-sm font-semibold">Repas récents (30 derniers jours)</h3>
      {repas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">Aucun repas enregistré</p>
      ) : (
        <div className="space-y-2">
          {repas.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{r.plat_nom || 'Repas'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.date_repas).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                </div>
                <p className="text-sm font-semibold text-red-600">-{r.montant_debite.toLocaleString()} GNF</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
