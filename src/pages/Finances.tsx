import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function Finances() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BarChart3 className="h-7 w-7 text-primary" /> Tableau Financier
      </h1>
      <Card><CardHeader><CardTitle>Indice de Rentabilité</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Tableau de bord financier avec indice de rentabilité mensuel par service.</p></CardContent>
      </Card>
    </div>
  );
}
