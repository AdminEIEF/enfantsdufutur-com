import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { sortClasses } from '@/lib/utils';
import {
  CalendarDays, Plus, ChevronLeft, ChevronRight, Trash2, Pencil, Clock, MapPin
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';

const EVENT_TYPES = [
  { value: 'examen', label: 'Examen / Contrôle', color: '#ef4444' },
  { value: 'vacances', label: 'Vacances', color: '#22c55e' },
  { value: 'ferie', label: 'Jour férié', color: '#f59e0b' },
  { value: 'conseil', label: 'Conseil de classe', color: '#8b5cf6' },
  { value: 'reunion', label: 'Réunion', color: '#06b6d4' },
  { value: 'rentree', label: 'Rentrée', color: '#ec4899' },
  { value: 'remise_notes', label: 'Remise des notes', color: '#f97316' },
  { value: 'general', label: 'Général', color: '#3b82f6' },
];

const getTypeInfo = (type: string) => EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[EVENT_TYPES.length - 1];

interface ClasseMatiere {
  classe_id: string;
  matiere_id: string;
}

interface EventForm {
  titre: string;
  description: string;
  type: string;
  date_debut: string;
  date_fin: string;
  heure_debut: string;
  heure_fin: string;
  classe_id: string;
  matiere_id: string;
  couleur: string;
  classes_matieres: ClasseMatiere[];
}

const emptyForm: EventForm = {
  titre: '', description: '', type: 'general', date_debut: '', date_fin: '',
  heure_debut: '', heure_fin: '', classe_id: '', matiere_id: '', couleur: '#3b82f6',
  classes_matieres: [],
};

export default function CalendrierScolaire() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);

  // Fetch events with linked classes
  const { data: events = [] } = useQuery({
    queryKey: ['evenements-calendrier'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evenements_calendrier')
        .select('*, classes(nom), matieres(nom)')
        .order('date_debut');
      if (error) throw error;

      // Fetch all event-class links
      const { data: ecLinks } = await supabase
        .from('evenement_classes')
        .select('evenement_id, classe_id, matiere_id, classes:classe_id(nom), matieres:matiere_id(nom)');

      // Attach links to events
      return (data || []).map((ev: any) => ({
        ...ev,
        evenement_classes: (ecLinks || []).filter((l: any) => l.evenement_id === ev.id),
      }));
    },
  });

  // Fetch classes & matieres for form
  const { data: classes = [] } = useQuery({
    queryKey: ['classes-cal'],
    queryFn: async () => {
      const { data } = await supabase.from('classes').select('id, nom, niveaux:niveau_id(nom, ordre, cycles:cycle_id(ordre))');
      return sortClasses(data || []);
    },
  });

  const { data: matieres = [] } = useQuery({
    queryKey: ['matieres-cal'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('ordre');
      return data || [];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (formData: EventForm) => {
      const payload: any = {
        titre: formData.titre,
        description: formData.description || null,
        type: formData.type,
        date_debut: formData.date_debut,
        date_fin: formData.date_fin || null,
        heure_debut: formData.heure_debut || null,
        heure_fin: formData.heure_fin || null,
        classe_id: formData.classes_matieres.length === 1 ? formData.classes_matieres[0].classe_id : null,
        matiere_id: formData.classes_matieres.length === 1 ? (formData.classes_matieres[0].matiere_id || null) : null,
        couleur: formData.couleur,
      };

      let eventId = editingId;
      if (editingId) {
        const { error } = await supabase.from('evenements_calendrier').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { data: inserted, error } = await supabase.from('evenements_calendrier').insert(payload).select('id').single();
        if (error) throw error;
        eventId = inserted.id;
      }

      // Sync evenement_classes
      if (eventId) {
        await supabase.from('evenement_classes').delete().eq('evenement_id', eventId);
        if (formData.classes_matieres.length > 0) {
          const links = formData.classes_matieres.map(cm => ({
            evenement_id: eventId!,
            classe_id: cm.classe_id,
            matiere_id: cm.matiere_id || null,
          }));
          const { error: linkErr } = await supabase.from('evenement_classes').insert(links);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements-calendrier'] });
      toast.success(editingId ? 'Événement modifié' : 'Événement ajouté');
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('evenements_calendrier').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evenements-calendrier'] });
      toast.success('Événement supprimé');
    },
  });

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to Monday (1)
  const startPad = (getDay(monthStart) + 6) % 7;
  const prevDays = Array.from({ length: startPad }, (_, i) => {
    const d = new Date(monthStart);
    d.setDate(d.getDate() - startPad + i);
    return d;
  });
  const totalCells = prevDays.length + daysInMonth.length;
  const endPad = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  const nextDays = Array.from({ length: endPad }, (_, i) => {
    const d = new Date(monthEnd);
    d.setDate(d.getDate() + i + 1);
    return d;
  });
  const allDays = [...prevDays, ...daysInMonth, ...nextDays];

  const eventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd');
    return events.filter((e: any) => {
      const start = e.date_debut;
      const end = e.date_fin || e.date_debut;
      return dayStr >= start && dayStr <= end;
    });
  };

  const selectedEvents = selectedDate ? eventsForDay(selectedDate) : [];

  const openNew = (date?: Date) => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      date_debut: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
    });
    setDialogOpen(true);
  };

  const openEdit = (ev: any) => {
    setEditingId(ev.id);
    const ecList: ClasseMatiere[] = (ev.evenement_classes || []).map((ec: any) => ({
      classe_id: ec.classe_id,
      matiere_id: ec.matiere_id || '',
    }));
    // Fallback: if no evenement_classes but has classe_id on event
    if (ecList.length === 0 && ev.classe_id) {
      ecList.push({ classe_id: ev.classe_id, matiere_id: ev.matiere_id || '' });
    }
    setForm({
      titre: ev.titre,
      description: ev.description || '',
      type: ev.type,
      date_debut: ev.date_debut,
      date_fin: ev.date_fin || '',
      heure_debut: ev.heure_debut || '',
      heure_fin: ev.heure_fin || '',
      classe_id: ev.classe_id || '',
      matiere_id: ev.matiere_id || '',
      couleur: ev.couleur || '#3b82f6',
      classes_matieres: ecList,
    });
    setDialogOpen(true);
  };

  // Upcoming events
  const upcomingEvents = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return events
      .filter((e: any) => (e.date_fin || e.date_debut) >= todayStr)
      .slice(0, 8);
  }, [events]);

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            Calendrier Scolaire
          </h1>
          <p className="text-sm text-muted-foreground">Gestion des événements académiques, vacances, examens et réunions</p>
        </div>
        <Button onClick={() => openNew()} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvel événement
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-lg capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {weekDays.map(d => (
                <div key={d} className="bg-muted p-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
              ))}
              {allDays.map((day, idx) => {
                const dayEvents = eventsForDay(day);
                const inMonth = isSameMonth(day, currentMonth);
                const selected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);
                return (
                  <div
                    key={idx}
                    className={`bg-background p-1 min-h-[80px] cursor-pointer transition-colors hover:bg-accent/30 ${!inMonth ? 'opacity-40' : ''} ${selected ? 'ring-2 ring-primary ring-inset' : ''}`}
                    onClick={() => setSelectedDate(day)}
                    onDoubleClick={() => openNew(day)}
                  >
                    <div className={`text-xs font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${today ? 'bg-primary text-primary-foreground' : ''}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((ev: any) => {
                        const classesInfo = ev.evenement_classes?.length > 0
                          ? ev.evenement_classes.map((ec: any) => `${ec.classes?.nom || ''}${ec.matieres?.nom ? ' (' + ec.matieres.nom + ')' : ''}`).join(', ')
                          : (ev.matieres?.nom || '');
                        return (
                          <div
                            key={ev.id}
                            className="text-[10px] leading-tight px-1 py-0.5 rounded truncate text-white font-medium"
                            style={{ backgroundColor: ev.couleur || getTypeInfo(ev.type).color }}
                            title={`${ev.titre}${classesInfo ? ' — ' + classesInfo : ''}`}
                          >
                            {ev.titre}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Selected day events */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {selectedDate ? format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr }) : 'Sélectionnez un jour'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedDate && selectedEvents.length === 0 && (
                <p className="text-xs text-muted-foreground">Aucun événement ce jour</p>
              )}
              <div className="space-y-2">
                {selectedEvents.map((ev: any) => {
                  const typeInfo = getTypeInfo(ev.type);
                  return (
                    <div key={ev.id} className="border rounded-lg p-2 space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ev.couleur || typeInfo.color }} />
                            <span className="text-sm font-medium truncate">{ev.titre}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px] mt-0.5">{typeInfo.label}</Badge>
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEdit(ev)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => {
                            if (confirm('Supprimer cet événement ?')) deleteMutation.mutate(ev.id);
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {ev.description && <p className="text-[10px] text-muted-foreground">{ev.description}</p>}
                      {(ev.heure_debut || ev.heure_fin) && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {ev.heure_debut?.slice(0, 5)} {ev.heure_fin ? `— ${ev.heure_fin.slice(0, 5)}` : ''}
                        </p>
                      )}
                      {/* Show classes & matières from evenement_classes */}
                      {ev.evenement_classes?.length > 0 ? (
                        <div className="space-y-0.5 mt-1">
                          {ev.evenement_classes.map((ec: any, i: number) => (
                            <p key={i} className="text-[10px] text-muted-foreground">
                              📚 {ec.classes?.nom || '?'}{ec.matieres?.nom ? ` — 📖 ${ec.matieres.nom}` : ''}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <>
                          {ev.classes?.nom && <p className="text-[10px] text-muted-foreground">📚 {ev.classes.nom}</p>}
                          {ev.matieres?.nom && <Badge variant="outline" className="text-[10px] mt-0.5">📖 {ev.matieres.nom}</Badge>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              {selectedDate && (
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs" onClick={() => openNew(selectedDate)}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter un événement
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Prochains événements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {upcomingEvents.map((ev: any) => {
                  const typeInfo = getTypeInfo(ev.type);
                  return (
                     <div key={ev.id} className="flex items-start gap-2 text-xs">
                       <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: ev.couleur || typeInfo.color }} />
                       <div className="flex-1 min-w-0">
                         <div className="font-medium truncate">{ev.titre}</div>
                         {ev.evenement_classes?.length > 0 ? (
                           ev.evenement_classes.map((ec: any, i: number) => (
                             <div key={i} className="text-muted-foreground">
                               📚 {ec.classes?.nom}{ec.matieres?.nom ? ` — ${ec.matieres.nom}` : ''}
                             </div>
                           ))
                         ) : (
                           <>
                             {ev.matieres?.nom && <div className="text-muted-foreground">📖 {ev.matieres.nom}</div>}
                             {ev.classes?.nom && <div className="text-muted-foreground">📚 {ev.classes.nom}</div>}
                           </>
                         )}
                         {ev.description && (
                           <div className="text-muted-foreground line-clamp-2">{ev.description}</div>
                         )}
                         <div className="text-muted-foreground">
                           {format(new Date(ev.date_debut), 'd MMM', { locale: fr })}
                           {ev.date_fin && ev.date_fin !== ev.date_debut ? ` — ${format(new Date(ev.date_fin), 'd MMM', { locale: fr })}` : ''}
                         </div>
                       </div>
                     </div>
                  );
                })}
                {upcomingEvents.length === 0 && <p className="text-xs text-muted-foreground">Aucun événement à venir</p>}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Légende</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1">
                {EVENT_TYPES.map(t => (
                  <div key={t.value} className="flex items-center gap-1.5 text-[10px]">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    {t.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier l\'événement' : 'Nouvel événement'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              if (!form.titre || !form.date_debut) return toast.error('Titre et date requis');
              saveMutation.mutate(form);
            }}
          >
            <div>
              <Label className="text-xs">Titre *</Label>
              <Input value={form.titre} onChange={e => setForm({ ...form, titre: e.target.value })} placeholder="Ex: Examen de fin de semestre" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={form.type} onValueChange={v => {
                  const typeInfo = getTypeInfo(v);
                  setForm({ ...form, type: v, couleur: typeInfo.color });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Couleur</Label>
                <Input type="color" value={form.couleur} onChange={e => setForm({ ...form, couleur: e.target.value })} className="h-9" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date début *</Label>
                <Input type="date" value={form.date_debut} onChange={e => setForm({ ...form, date_debut: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Date fin</Label>
                <Input type="date" value={form.date_fin} onChange={e => setForm({ ...form, date_fin: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Heure début</Label>
                <Input type="time" value={form.heure_debut} onChange={e => setForm({ ...form, heure_debut: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Heure fin</Label>
                <Input type="time" value={form.heure_fin} onChange={e => setForm({ ...form, heure_fin: e.target.value })} />
              </div>
            </div>
            {/* Multi-class selection */}
            <div>
              <Label className="text-xs font-semibold">Classes concernées (optionnel)</Label>
              <p className="text-[10px] text-muted-foreground mb-2">Cochez les classes et choisissez la matière pour chacune</p>
              <div className="max-h-[200px] overflow-y-auto border rounded-lg p-2 space-y-1.5">
                {classes.map((c: any) => {
                  const entry = form.classes_matieres.find(cm => cm.classe_id === c.id);
                  const isChecked = !!entry;
                  return (
                    <div key={c.id} className="flex items-center gap-2">
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setForm({ ...form, classes_matieres: [...form.classes_matieres, { classe_id: c.id, matiere_id: '' }] });
                          } else {
                            setForm({ ...form, classes_matieres: form.classes_matieres.filter(cm => cm.classe_id !== c.id) });
                          }
                        }}
                      />
                      <span className="text-xs font-medium w-24 truncate">{c.nom}</span>
                      {isChecked && (
                        <Select
                          value={entry?.matiere_id || '__none__'}
                          onValueChange={v => {
                            setForm({
                              ...form,
                              classes_matieres: form.classes_matieres.map(cm =>
                                cm.classe_id === c.id ? { ...cm, matiere_id: v === '__none__' ? '' : v } : cm
                              ),
                            });
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs flex-1">
                            <SelectValue placeholder="Matière..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Aucune matière —</SelectItem>
                            {matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
              {form.classes_matieres.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">{form.classes_matieres.length} classe(s) sélectionnée(s)</p>
              )}
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Détails de l'événement..." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
