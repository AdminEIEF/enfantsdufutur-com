import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';

export default function Reinscription() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <RefreshCw className="h-7 w-7 text-primary" /> Réinscription
      </h1>
      <Card><CardHeader><CardTitle>Campagne de Réinscription</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Gestion des réinscriptions simplifiées en fin d'année scolaire.</p></CardContent>
      </Card>
    </div>
  );
}
