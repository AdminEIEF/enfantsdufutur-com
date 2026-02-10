import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator } from 'lucide-react';

export default function Depenses() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Calculator className="h-7 w-7 text-primary" /> Dépenses
      </h1>
      <Card><CardHeader><CardTitle>Enregistrement des Dépenses</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Dépenses par service : Scolarité, Transport, Boutique, Cantine.</p></CardContent>
      </Card>
    </div>
  );
}
