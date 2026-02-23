import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Clock, Plus, Trash2, Pencil, CalendarDays } from 'lucide-react';

const JOURS = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

const CRENEAUX_DEFAULT = [
  '07:30', '08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00', '16:00',
];

const COULEURS_MATIERES = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
];

interface SlotForm {
  matiere_id: string;
  enseignant_id: string;
  jour_semaine: number;
  heure_debut: string;
  heure_fin: string;
  salle: string;
}

const emptySlot: SlotForm = {
  matiere_id: '', enseignant_id: '', jour_semaine: 1,
  heure_debut: '08:00', heure_fin: '09:00', salle: '',
};

export default function EmploiDuTemps() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClasseId, setSelectedClasseId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SlotForm>(emptySlot);

  // Fetch classes grouped
  const { data: classes = [] } = useQuery({
    queryKey: ['edt-classes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('classes')
        .select('id, nom, niveaux:niveau_id(nom, cycles:cycle_id(nom))')
        .order('nom');
      return data || [];
    },
  });

  // Fetch matieres
  const { data: matieres = [] } = useQuery({
    queryKey: ['edt-matieres'],
    queryFn: async () => {
      const { data } = await supabase.from('matieres').select('id, nom').order('nom');
      return data || [];
    },
  });

  // Fetch enseignants
  const { data: enseignants = [] } = useQuery({
    queryKey: ['edt-enseignants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('employes')
        .select('id, nom, prenom, categorie')
        .eq('categorie', 'enseignant')
        .eq('statut', 'actif')
        .order('nom');
      return data || [];
    },
  });

  // Fetch timetable for selected class
  const { data: slots = [] } = useQuery({
    queryKey: ['emploi-du-temps', selectedClasseId],
    queryFn: async () => {
      if (!selectedClasseId) return [];
      const { data, error } = await supabase
        .from('emploi_du_temps')
        .select('*, matieres:matiere_id(id, nom), employes:enseignant_id(id, nom, prenom)')
        .eq('classe_id', selectedClasseId)
        .order('jour_semaine')
        .order('heure_debut');
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedClasseId,
  });

  const saveMutation = useMutation({
    mutationFn: async (formData: SlotForm) => {
      const payload: any = {
        classe_id: selectedClasseId,
        matiere_id: formData.matiere_id,
        enseignant_id: formData.enseignant_id || null,
        jour_semaine: formData.jour_semaine,
        heure_debut: formData.heure_debut,
        heure_fin: formData.heure_fin,
        salle: formData.salle || null,
      };
      if (editingId) {
        const { error } = await supabase.from('emploi_du_temps').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from('emploi_du_temps').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emploi-du-temps', selectedClasseId] });
      toast.success(editingId ? 'Créneau modifié' : 'Créneau ajouté');
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptySlot);
    },
    onError: (e: any) => toast.error(e.message?.includes('unique') ? 'Ce créneau existe déjà pour cette classe' : e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('emploi_du_temps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emploi-du-temps', selectedClasseId] });
      toast.success('Créneau supprimé');
    },
  });

  // Build dynamic time slots from data + defaults
  const CRENEAUX = useMemo(() => {
    const allTimes = new Set(CRENEAUX_DEFAULT);
    slots.forEach((s: any) => {
      if (s.heure_debut) allTimes.add(s.heure_debut.slice(0, 5));
    });
    return [...allTimes].sort();
  }, [slots]);

  // Build color map for matieres
  const matiereColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    const uniqueMatieres = [...new Set(slots.map((s: any) => s.matiere_id))];
    uniqueMatieres.forEach((id, i) => {
      map[id as string] = COULEURS_MATIERES[i % COULEURS_MATIERES.length];
    });
    return map;
  }, [slots]);

  const openNew = (jour?: number, heure?: string) => {
    setEditingId(null);
    const heureIdx = heure ? CRENEAUX.indexOf(heure) : -1;
    const nextHeure = heureIdx >= 0 && heureIdx < CRENEAUX.length - 1 ? CRENEAUX[heureIdx + 1] : '09:00';
    setForm({
      ...emptySlot,
      jour_semaine: jour || 1,
      heure_debut: heure || '08:00',
      heure_fin: nextHeure,
    });
    setDialogOpen(true);
  };

  const openEdit = (slot: any) => {
    setEditingId(slot.id);
    setForm({
      matiere_id: slot.matiere_id,
      enseignant_id: slot.enseignant_id || '',
      jour_semaine: slot.jour_semaine,
      heure_debut: slot.heure_debut,
      heure_fin: slot.heure_fin,
      salle: slot.salle || '',
    });
    setDialogOpen(true);
  };

  const getSlot = (jour: number, heure: string) =>
    slots.find((s: any) => s.jour_semaine === jour && s.heure_debut === heure + ':00');

  const selectedClasse = classes.find((c: any) => c.id === selectedClasseId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Emploi du Temps
          </h1>
          <p className="text-sm text-muted-foreground">Gérez les créneaux horaires par classe avec enseignants et matières</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedClasseId || '__none__'} onValueChange={v => setSelectedClasseId(v === '__none__' ? '' : v)}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Choisir une classe —</SelectItem>
              {classes.map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {(c as any).niveaux?.cycles?.nom} — {(c as any).niveaux?.nom} — {c.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedClasseId && (
            <Button onClick={() => openNew()} className="gap-2">
              <Plus className="h-4 w-4" /> Ajouter créneau
            </Button>
          )}
        </div>
      </div>

      {!selectedClasseId ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Sélectionnez une classe</p>
            <p className="text-sm">pour afficher et gérer son emploi du temps</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              📅 {(selectedClasse as any)?.niveaux?.nom} — {selectedClasse?.nom}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse min-w-[700px]">
                <thead>
                  <tr>
                    <th className="border px-2 py-2 bg-muted text-left w-16 font-semibold">Heure</th>
                    {JOURS.map(j => (
                      <th key={j.value} className="border px-2 py-2 bg-muted text-center font-semibold">{j.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CRENEAUX.map(heure => (
                    <tr key={heure}>
                      <td className="border px-2 py-3 font-medium text-muted-foreground bg-muted/30">{heure}</td>
                      {JOURS.map(jour => {
                        const slot = getSlot(jour.value, heure);
                        if (!slot) {
                          return (
                            <td
                              key={jour.value}
                              className="border px-1 py-1 text-center cursor-pointer hover:bg-accent/30 transition-colors"
                              onDoubleClick={() => openNew(jour.value, heure)}
                              title="Double-clic pour ajouter"
                            >
                              <span className="text-muted-foreground/30">+</span>
                            </td>
                          );
                        }
                        const colorClass = matiereColorMap[slot.matiere_id] || COULEURS_MATIERES[0];
                        return (
                          <td key={jour.value} className="border px-0.5 py-0.5">
                            <div
                              className={`rounded-md px-1.5 py-1.5 ${colorClass} cursor-pointer hover:opacity-80 transition-opacity relative group`}
                              onClick={() => openEdit(slot)}
                            >
                              <div className="font-semibold text-[11px] leading-tight">{slot.matieres?.nom}</div>
                              {slot.employes && (
                                <div className="text-[10px] opacity-80 mt-0.5">
                                  👤 {slot.employes.prenom} {slot.employes.nom}
                                </div>
                              )}
                              {slot.salle && (
                                <div className="text-[10px] opacity-70">🏫 {slot.salle}</div>
                              )}
                              <div className="text-[9px] opacity-60 mt-0.5">
                                {slot.heure_debut?.slice(0, 5)} — {slot.heure_fin?.slice(0, 5)}
                              </div>
                              <button
                                className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background/50"
                                onClick={e => {
                                  e.stopPropagation();
                                  if (confirm('Supprimer ce créneau ?')) deleteMutation.mutate(slot.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">💡 Double-cliquez sur une case vide pour ajouter un créneau. Cliquez sur un créneau pour le modifier.</p>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier le créneau' : 'Nouveau créneau'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={e => {
              e.preventDefault();
              if (!form.matiere_id) return toast.error('Veuillez choisir une matière');
              saveMutation.mutate(form);
            }}
          >
            <div>
              <Label className="text-xs">Matière *</Label>
              <Select value={form.matiere_id || '__none__'} onValueChange={v => setForm({ ...form, matiere_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choisir —</SelectItem>
                  {matieres.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.nom}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Enseignant</Label>
              <Select value={form.enseignant_id || '__none__'} onValueChange={v => setForm({ ...form, enseignant_id: v === '__none__' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Non assigné —</SelectItem>
                  {enseignants.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.prenom} {e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Jour *</Label>
                <Select value={String(form.jour_semaine)} onValueChange={v => setForm({ ...form, jour_semaine: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOURS.map(j => <SelectItem key={j.value} value={String(j.value)}>{j.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Salle</Label>
                <Input value={form.salle} onChange={e => setForm({ ...form, salle: e.target.value })} placeholder="Ex: Salle A2" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Heure début *</Label>
                <Input type="time" value={form.heure_debut} onChange={e => setForm({ ...form, heure_debut: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Heure fin *</Label>
                <Input type="time" value={form.heure_fin} onChange={e => setForm({ ...form, heure_fin: e.target.value })} />
              </div>
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
