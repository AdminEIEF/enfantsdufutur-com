import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { LogIn, LogOut, Clock, ChevronLeft, ChevronRight, Calendar, AlertTriangle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, isWithinInterval, addMonths, subMonths, isSameMonth } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export default function PointageHistorique() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [pointages, setPointages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMonthPointages = useCallback(async () => {
    setLoading(true);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data } = await supabase
      .from('pointages_eleves')
      .select('*, eleves:eleve_id(nom, prenom, matricule, classes:classe_id(nom))')
      .gte('date_pointage', start)
      .lte('date_pointage', end)
      .order('date_pointage', { ascending: false })
      .order('created_at', { ascending: false });

    setPointages(data || []);
    setLoading(false);
  }, [currentMonth]);

  useEffect(() => {
    fetchMonthPointages();
  }, [fetchMonthPointages]);

  // Group by weeks
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });

  const weekGroups = weeks.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekPointages = pointages.filter(p => {
      const d = new Date(p.date_pointage);
      return isWithinInterval(d, { start: weekStart, end: weekEnd }) && isSameMonth(d, currentMonth);
    });

    // Group by day within the week
    const dayMap: Record<string, any[]> = {};
    weekPointages.forEach(p => {
      const day = p.date_pointage;
      if (!dayMap[day]) dayMap[day] = [];
      dayMap[day].push(p);
    });

    const days = Object.keys(dayMap).sort();
    const totalRetards = weekPointages.filter(p => p.en_retard).length;
    const totalPresents = weekPointages.filter(p => p.heure_arrivee).length;

    return {
      weekStart,
      weekEnd,
      pointages: weekPointages,
      days,
      dayMap,
      totalRetards,
      totalPresents,
    };
  }).filter(w => w.pointages.length > 0);

  // Monthly stats
  const monthTotalPresents = pointages.filter(p => p.heure_arrivee).length;
  const monthTotalRetards = pointages.filter(p => p.en_retard).length;
  const uniqueDays = [...new Set(pointages.map(p => p.date_pointage))].length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Historique mensuel
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Monthly summary */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold">{uniqueDays}</p>
            <p className="text-[11px] text-muted-foreground">Jours d'école</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-lg font-bold">{monthTotalPresents}</p>
            <p className="text-[11px] text-muted-foreground">Pointages</p>
          </div>
          <div className={`rounded-lg p-3 text-center ${monthTotalRetards > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-muted/50'}`}>
            <p className={`text-lg font-bold ${monthTotalRetards > 0 ? 'text-red-600' : ''}`}>{monthTotalRetards}</p>
            <p className="text-[11px] text-muted-foreground">Retards</p>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-8">Chargement...</p>
        ) : weekGroups.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucun pointage ce mois</p>
        ) : (
          <Accordion type="multiple" defaultValue={[weekGroups[0]?.weekStart.toISOString()]} className="space-y-2">
            {weekGroups.map((week) => (
              <AccordionItem key={week.weekStart.toISOString()} value={week.weekStart.toISOString()} className="border rounded-lg px-3">
                <AccordionTrigger className="py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-2">
                    <span className="text-sm font-semibold">
                      Semaine du {format(week.weekStart, 'dd MMM', { locale: fr })} au {format(week.weekEnd, 'dd MMM', { locale: fr })}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {week.totalPresents} pointage{week.totalPresents > 1 ? 's' : ''}
                      </Badge>
                      {week.totalRetards > 0 && (
                        <Badge className="bg-red-100 text-red-700 text-[10px]">
                          {week.totalRetards} retard{week.totalRetards > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-2">
                    {week.days.map(day => (
                      <div key={day}>
                        <p className="text-xs font-semibold text-muted-foreground mb-1.5 capitalize">
                          {format(new Date(day), 'EEEE dd MMMM', { locale: fr })}
                        </p>
                        <div className="space-y-1">
                          {week.dayMap[day].map((p: any) => (
                            <div key={p.id} className={`flex items-center justify-between text-sm border rounded px-3 py-2 ${p.en_retard ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : ''}`}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {(p.eleves as any)?.prenom} {(p.eleves as any)?.nom}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {(p.eleves as any)?.matricule}
                                </Badge>
                                <span className="text-xs text-muted-foreground hidden sm:inline">
                                  {(p.eleves as any)?.classes?.nom}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-xs">
                                {p.heure_arrivee && (
                                  <span className={`font-medium ${p.en_retard ? 'text-red-600' : 'text-emerald-600'}`}>
                                    ↓ {format(new Date(p.heure_arrivee), 'HH:mm')}
                                  </span>
                                )}
                                {p.heure_depart && (
                                  <span className="text-orange-600 font-medium">
                                    ↑ {format(new Date(p.heure_depart), 'HH:mm')}
                                  </span>
                                )}
                                {p.en_retard && (
                                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}
