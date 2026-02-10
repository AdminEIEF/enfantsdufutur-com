import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function Orientation() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BarChart3 className="h-7 w-7 text-primary" /> Orientation
      </h1>
      <Card><CardHeader><CardTitle>Analyse d'Orientation</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Radar des compétences par pôle et suggestions d'orientation.</p></CardContent>
      </Card>
    </div>
  );
}
