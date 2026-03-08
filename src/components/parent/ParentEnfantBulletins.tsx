import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, FileText } from 'lucide-react';

interface Props {
  bulletinPublications: any[];
}

export default function ParentEnfantBulletins({ bulletinPublications }: Props) {
  if (bulletinPublications.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">
            Les bulletins seront disponibles après la publication des résultats par l'administration.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {bulletinPublications.map((pub: any) => (
        <Card key={pub.id} className="border-primary/20">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Bulletin — {pub.periodes?.nom}</p>
                <p className="text-xs text-muted-foreground">
                  Publié le {new Date(pub.published_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            <Badge variant="default" className="bg-green-600 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Disponible
            </Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
