import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings } from 'lucide-react';

export default function Configuration() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Settings className="h-7 w-7 text-primary" /> Configuration
      </h1>
      <Card><CardHeader><CardTitle>Paramètres de l'école</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Gestion des cycles, niveaux, classes, tarifs, réductions fratrie et périodes scolaires.</p></CardContent>
      </Card>
    </div>
  );
}
