import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Library } from 'lucide-react';

export default function Bibliotheque() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Library className="h-7 w-7 text-primary" /> Bibliothèque Numérique
      </h1>
      <Card><CardHeader><CardTitle>Dossiers Élèves</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Navigation par Cycle &gt; Niveau &gt; Classe. Historique complet de chaque élève.</p></CardContent>
      </Card>
    </div>
  );
}
