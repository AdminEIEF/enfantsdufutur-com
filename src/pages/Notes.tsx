import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

export default function Notes() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
        <BookOpen className="h-7 w-7 text-primary" /> Saisie des Notes
      </h1>
      <Card><CardHeader><CardTitle>Module Notes</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">Saisie des notes par période, matière et classe.</p></CardContent>
      </Card>
    </div>
  );
}
