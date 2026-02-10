import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

export default function Inscriptions() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <UserPlus className="h-7 w-7 text-primary" /> Inscriptions
      </h1>
      <Card><CardHeader><CardTitle>Module Inscriptions</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Le module d'inscription sera implémenté ici : formulaire complet, check-list, calcul des frais avec réduction fratrie.</p></CardContent>
      </Card>
    </div>
  );
}
