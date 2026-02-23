import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { GraduationCap, CheckCircle2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function PreInscriptionPublic() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    prenom_eleve: '',
    nom_eleve: '',
    date_naissance: '',
    sexe: '',
    nom_parent: '',
    telephone_parent: '',
    email_parent: '',
    niveau_id: '',
    option_cantine: false,
    option_transport: false,
    option_uniformes: false,
  });

  const { data: niveaux = [] } = useQuery({
    queryKey: ['niveaux-public'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('niveaux')
        .select('id, nom, cycle_id, cycles:cycle_id(nom, ordre)')
        .order('ordre');
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.prenom_eleve || !form.nom_eleve || !form.nom_parent || !form.telephone_parent) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        prenom_eleve: form.prenom_eleve.trim(),
        nom_eleve: form.nom_eleve.trim(),
        nom_parent: form.nom_parent.trim(),
        telephone_parent: form.telephone_parent.trim(),
        option_cantine: form.option_cantine,
        option_transport: form.option_transport,
        option_uniformes: form.option_uniformes,
      };
      if (form.date_naissance) payload.date_naissance = form.date_naissance;
      if (form.sexe) payload.sexe = form.sexe;
      if (form.email_parent) payload.email_parent = form.email_parent.trim();
      if (form.niveau_id) payload.niveau_id = form.niveau_id;

      const { error } = await supabase.from('pre_inscriptions').insert(payload);
      if (error) throw error;
      setSubmitted(true);
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">Demande envoyée !</h2>
            <p className="text-muted-foreground">
              Votre demande de pré-inscription a été enregistrée avec succès. 
              L'administration vous contactera pour fixer un rendez-vous.
            </p>
            <p className="text-sm text-muted-foreground">
              Un membre de l'équipe vous rappellera au <strong>{form.telephone_parent}</strong>.
            </p>
            <Link to="/">
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" /> Retour à l'accueil
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Group niveaux by cycle
  const cycleMap = new Map<string, { cycleName: string; ordre: number; niveaux: typeof niveaux }>();
  niveaux.forEach((n: any) => {
    const key = n.cycle_id;
    if (!cycleMap.has(key)) {
      cycleMap.set(key, { cycleName: n.cycles?.nom || '', ordre: n.cycles?.ordre ?? 0, niveaux: [] });
    }
    cycleMap.get(key)!.niveaux.push(n);
  });
  const sortedCycles = [...cycleMap.entries()].sort((a, b) => a[1].ordre - b[1].ordre);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <nav className="bg-background border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm">EI Enfants du Futur</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Accueil
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Pré-inscription en ligne</h1>
          <p className="text-muted-foreground">
            Remplissez ce formulaire pour soumettre une demande de pré-inscription. 
            Notre équipe vous contactera pour un rendez-vous.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Infos Élève */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations de l'élève</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prénom *</Label>
                  <Input value={form.prenom_eleve} onChange={e => setForm(f => ({ ...f, prenom_eleve: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Nom *</Label>
                  <Input value={form.nom_eleve} onChange={e => setForm(f => ({ ...f, nom_eleve: e.target.value }))} required />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date de naissance</Label>
                  <Input type="date" value={form.date_naissance} onChange={e => setForm(f => ({ ...f, date_naissance: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sexe</Label>
                  <Select value={form.sexe} onValueChange={v => setForm(f => ({ ...f, sexe: v }))}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">Masculin</SelectItem>
                      <SelectItem value="F">Féminin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Niveau souhaité</Label>
                <Select value={form.niveau_id} onValueChange={v => setForm(f => ({ ...f, niveau_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner un niveau" /></SelectTrigger>
                  <SelectContent>
                    {sortedCycles.map(([cycleId, { cycleName, niveaux: cycleNiveaux }]) => (
                      <div key={cycleId}>
                        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{cycleName}</div>
                        {cycleNiveaux.map((n: any) => (
                          <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Infos Parent */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Informations du parent/tuteur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet *</Label>
                <Input value={form.nom_parent} onChange={e => setForm(f => ({ ...f, nom_parent: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Téléphone *</Label>
                  <Input type="tel" value={form.telephone_parent} onChange={e => setForm(f => ({ ...f, telephone_parent: e.target.value }))} required placeholder="+224 6XX XXX XXX" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email_parent} onChange={e => setForm(f => ({ ...f, email_parent: e.target.value }))} placeholder="optionnel" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Options souhaitées</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox id="cantine" checked={form.option_cantine} onCheckedChange={v => setForm(f => ({ ...f, option_cantine: !!v }))} />
                <Label htmlFor="cantine" className="cursor-pointer">Cantine scolaire</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="transport" checked={form.option_transport} onCheckedChange={v => setForm(f => ({ ...f, option_transport: !!v }))} />
                <Label htmlFor="transport" className="cursor-pointer">Transport scolaire</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="uniformes" checked={form.option_uniformes} onCheckedChange={v => setForm(f => ({ ...f, option_uniformes: !!v }))} />
                <Label htmlFor="uniformes" className="cursor-pointer">Kit uniformes complet</Label>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Envoi en cours…' : 'Soumettre ma demande de pré-inscription'}
          </Button>
        </form>
      </div>
    </div>
  );
}
