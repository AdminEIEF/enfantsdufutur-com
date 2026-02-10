import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

export default function Familles() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Users className="h-7 w-7 text-primary" /> Familles
      </h1>
      <Card><CardHeader><CardTitle>Gestion des Familles</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Gestion des familles et des liens entre enfants inscrits.</p></CardContent>
      </Card>
    </div>
  );
}
