import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScanLine } from 'lucide-react';

export default function Cantine() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <ScanLine className="h-7 w-7 text-primary" /> Cantine & QR Code
      </h1>
      <Card><CardHeader><CardTitle>Scanner QR Code</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Scan du badge élève pour débiter le repas et notifier les parents.</p></CardContent>
      </Card>
    </div>
  );
}
