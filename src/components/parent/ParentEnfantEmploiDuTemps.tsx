import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from 'lucide-react';

const JOURS = ['', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface Props {
  emploiDuTemps: any[];
}

export default function ParentEnfantEmploiDuTemps({ emploiDuTemps }: Props) {
  if (emploiDuTemps.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Aucun emploi du temps disponible</p>
        </CardContent>
      </Card>
    );
  }

  // Group by day
  const parJour: Record<number, any[]> = {};
  emploiDuTemps.forEach((c: any) => {
    if (!parJour[c.jour_semaine]) parJour[c.jour_semaine] = [];
    parJour[c.jour_semaine].push(c);
  });

  return (
    <div className="space-y-3">
      {Object.entries(parJour)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([jour, cours]) => (
          <Card key={jour}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-primary">
                {JOURS[Number(jour)] || `Jour ${jour}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {cours.map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 py-1.5 px-3 rounded-lg bg-muted/50 border">
                  <div className="text-xs font-mono text-muted-foreground w-20 shrink-0">
                    {c.heure_debut?.slice(0, 5)} - {c.heure_fin?.slice(0, 5)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.matieres?.nom || '—'}</p>
                    {c.employes && (
                      <p className="text-xs text-muted-foreground">
                        {c.employes.prenom} {c.employes.nom}
                      </p>
                    )}
                  </div>
                  {c.salle && (
                    <span className="text-xs text-muted-foreground">Salle {c.salle}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
