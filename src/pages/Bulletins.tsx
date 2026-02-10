import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award } from 'lucide-react';

export default function Bulletins() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Award className="h-7 w-7 text-primary" /> Bulletins
      </h1>
      <Card><CardHeader><CardTitle>Génération des Bulletins</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Génération et impression des bulletins scolaires.</p></CardContent>
      </Card>
    </div>
  );
}
