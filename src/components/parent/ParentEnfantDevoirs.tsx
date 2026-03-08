import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, AlertCircle, ClipboardList } from 'lucide-react';

interface Props {
  devoirs: any[];
  soumissions: any[];
}

export default function ParentEnfantDevoirs({ devoirs, soumissions }: Props) {
  if (devoirs.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucun devoir enregistré pour cette classe</p>
        </CardContent>
      </Card>
    );
  }

  const now = new Date();

  return (
    <div className="space-y-2">
      {devoirs.map((d: any) => {
        const soumission = soumissions.find((s: any) => s.devoir_id === d.id);
        const dateLimite = new Date(d.date_limite);
        const estExpire = dateLimite < now;
        const estSoumis = !!soumission;

        let statusBadge;
        if (estSoumis && soumission.note !== null) {
          statusBadge = (
            <Badge variant="default" className="bg-green-600 text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> Corrigé ({soumission.note}/{d.note_max})
            </Badge>
          );
        } else if (estSoumis) {
          statusBadge = (
            <Badge variant="default" className="bg-blue-600 text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> Soumis
            </Badge>
          );
        } else if (estExpire) {
          statusBadge = (
            <Badge variant="destructive" className="text-xs gap-1">
              <AlertCircle className="h-3 w-3" /> Non rendu
            </Badge>
          );
        } else {
          statusBadge = (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 text-xs gap-1">
              <Clock className="h-3 w-3" /> En attente
            </Badge>
          );
        }

        return (
          <Card key={d.id} className={!estSoumis && !estExpire ? 'border-orange-200' : ''}>
            <CardContent className="py-3 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{d.titre}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{d.matieres?.nom || '—'}</span>
                  <span>•</span>
                  <span>Limite: {dateLimite.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              {statusBadge}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
