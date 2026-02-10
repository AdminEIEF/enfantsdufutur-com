import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';

export default function Notifications() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <Bell className="h-7 w-7 text-primary" /> Notifications
      </h1>
      <Card><CardHeader><CardTitle>Centre de Notifications</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Relances réinscription, alertes retard de paiement, notifications cantine.</p></CardContent>
      </Card>
    </div>
  );
}
