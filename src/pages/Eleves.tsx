import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export default function Eleves() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ClipboardList className="h-7 w-7 text-primary" /> Élèves
      </h1>
      <Card><CardHeader><CardTitle>Liste des Élèves</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Recherche, filtrage et consultation des dossiers élèves.</p></CardContent>
      </Card>
    </div>
  );
}
