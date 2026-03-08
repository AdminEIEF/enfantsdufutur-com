import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogIn, LogOut, Clock, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Props {
  pointages: any[];
}

export default function ParentEnfantPointage({ pointages }: Props) {
  if (!pointages || pointages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Aucun pointage enregistré récemment</p>
        </CardContent>
      </Card>
    );
  }

  const sorted = [...pointages].sort((a, b) => new Date(b.date_pointage).getTime() - new Date(a.date_pointage).getTime());
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayEntry = sorted.find(p => p.date_pointage === today);
  const totalRetards = pointages.filter(p => p.en_retard).length;

  return (
    <div className="space-y-4">
      {/* Retard counter */}
      {totalRetards > 0 && (
        <Card className="border-2 border-red-400 bg-red-50 dark:bg-red-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-sm text-red-700 dark:text-red-400">
                  {totalRetards} retard{totalRetards > 1 ? 's' : ''} enregistré{totalRetards > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-muted-foreground">sur les 30 derniers jours (heure limite : 08h10)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today status */}
      {todayEntry ? (
        <Card className={`border-2 ${
          todayEntry.en_retard ? 'border-red-400' :
          todayEntry.heure_depart ? 'border-orange-400' : 'border-emerald-400'
        }`}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                todayEntry.en_retard ? 'bg-red-100 dark:bg-red-900/30' :
                todayEntry.heure_depart ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'
              }`}>
                {todayEntry.en_retard ? (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                ) : todayEntry.heure_depart ? (
                  <LogOut className="h-5 w-5 text-orange-600" />
                ) : (
                  <LogIn className="h-5 w-5 text-emerald-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-sm">Aujourd'hui</p>
                <div className="flex gap-3 text-xs text-muted-foreground mt-0.5">
                  {todayEntry.heure_arrivee && (
                    <span>Arrivée : <span className="font-medium text-foreground">{format(new Date(todayEntry.heure_arrivee), 'HH:mm')}</span></span>
                  )}
                  {todayEntry.heure_depart && (
                    <span>Départ : <span className="font-medium text-foreground">{format(new Date(todayEntry.heure_depart), 'HH:mm')}</span></span>
                  )}
                </div>
                {todayEntry.en_retard && (
                  <Badge className="bg-red-100 text-red-700 text-[10px] mt-1">En retard</Badge>
                )}
                {!todayEntry.en_retard && !todayEntry.heure_depart && todayEntry.heure_arrivee && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px] mt-1">À l'école</Badge>
                )}
                {todayEntry.heure_depart && (
                  <Badge variant="outline" className="text-[10px] mt-1">A quitté l'école</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-muted">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-muted">
                <Clock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Aujourd'hui</p>
                <p className="text-xs text-muted-foreground">Pas encore arrivé(e)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card>
        <CardContent className="pt-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Historique (30 derniers jours)
          </h4>
          <div className="space-y-1.5">
            {sorted.map(p => (
              <div key={p.id} className={`flex items-center justify-between text-sm border rounded px-3 py-2 ${p.en_retard ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                <span className="font-medium min-w-[100px]">
                  {format(new Date(p.date_pointage), 'EEE dd MMM', { locale: fr })}
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {p.heure_arrivee && (
                    <span className={p.en_retard ? 'text-red-600' : 'text-emerald-600'}>↓ {format(new Date(p.heure_arrivee), 'HH:mm')}</span>
                  )}
                  {p.heure_depart && (
                    <span className="text-orange-600">↑ {format(new Date(p.heure_depart), 'HH:mm')}</span>
                  )}
                  {p.en_retard && (
                    <Badge className="bg-red-100 text-red-700 text-[10px]">Retard</Badge>
                  )}
                  {!p.en_retard && !p.heure_depart && p.heure_arrivee && (
                    <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Présent</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
