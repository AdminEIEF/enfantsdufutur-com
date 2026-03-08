import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Clock, AlertCircle, ClipboardList, ChevronDown, ChevronUp, FileText, MessageSquare } from 'lucide-react';

interface Props {
  devoirs: any[];
  soumissions: any[];
}

export default function ParentEnfantDevoirs({ devoirs, soumissions }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        const isExpanded = expandedId === d.id;
        const isQuiz = d.type_devoir === 'quiz';

        let statusBadge;
        if (estSoumis && soumission.note !== null && soumission.note !== undefined) {
          const noteMax = soumission.is_quiz ? soumission.score_max : d.note_max;
          statusBadge = (
            <Badge variant="default" className="bg-green-600 text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" /> {soumission.note}/{noteMax}
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
            <CardContent className="py-3 space-y-0">
              <button
                className="w-full flex items-center justify-between gap-3 text-left"
                onClick={() => setExpandedId(isExpanded ? null : d.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{d.titre}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{d.matieres?.nom || '—'}</span>
                    <span>•</span>
                    <span>Limite: {dateLimite.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}</span>
                    {isQuiz && <Badge variant="outline" className="text-[10px] py-0 px-1">Quiz</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {statusBadge}
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3 text-sm">
                  {/* Description du devoir */}
                  {d.description && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">📝 Consigne</p>
                      <p className="text-foreground whitespace-pre-line text-sm bg-muted/50 rounded-md p-2.5">{d.description}</p>
                    </div>
                  )}

                  {/* Sujet en fichier */}
                  {d.sujet_url && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">📎 Sujet joint</p>
                      <a
                        href={d.sujet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline bg-muted/50 rounded-md px-3 py-2"
                      >
                        <FileText className="h-4 w-4" />
                        {d.sujet_nom || 'Télécharger le sujet'}
                      </a>
                    </div>
                  )}

                  {/* Informations de soumission */}
                  {estSoumis && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">📋 Soumission</p>
                      <div className="bg-muted/50 rounded-md p-2.5 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          Soumis le {new Date(soumission.soumis_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>

                        {soumission.fichier_nom && (
                          <div className="flex items-center gap-2 text-xs">
                            <FileText className="h-3 w-3 text-blue-500" />
                            <span>{soumission.fichier_nom}</span>
                          </div>
                        )}

                        {soumission.note !== null && soumission.note !== undefined && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Note :</span>
                            <span className="font-bold text-base text-foreground">
                              {soumission.note}/{soumission.is_quiz ? soumission.score_max : d.note_max}
                            </span>
                          </div>
                        )}

                        {soumission.commentaire && (
                          <div className="mt-2 pt-2 border-t border-border/50">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-0.5">Commentaire de l'enseignant</p>
                                <p className="text-sm text-foreground">{soumission.commentaire}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Non soumis */}
                  {!estSoumis && !estExpire && (
                    <div className="bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 rounded-md p-2.5 text-xs">
                      ⏳ Ce devoir n'a pas encore été rendu. Date limite : {dateLimite.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </div>
                  )}

                  {!estSoumis && estExpire && (
                    <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 rounded-md p-2.5 text-xs">
                      ❌ Ce devoir n'a pas été rendu avant la date limite du {dateLimite.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
