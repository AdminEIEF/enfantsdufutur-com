import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

export default function Paiements() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <CreditCard className="h-7 w-7 text-primary" /> Paiements
      </h1>
      <Card><CardHeader><CardTitle>Enregistrement des Paiements</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Paiements multi-canaux : Espèces, Orange Money, MTN MoMo.</p></CardContent>
      </Card>
    </div>
  );
}
