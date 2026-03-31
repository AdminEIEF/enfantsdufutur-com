import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Users, GraduationCap, Phone, Mail, MapPin, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2 } from 'lucide-react';

interface Eleve {
  id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  sexe: string | null;
  classe_id: string | null;
  statut: string;
  date_naissance: string | null;
  photo_url: string | null;
  nom_prenom_pere: string | null;
  nom_prenom_mere: string | null;
  created_at: string;
  classes?: any;
  familles?: any;
}

export default function CoordinateurSecondaireEleves() {
  const [eleves, setEleves] = useState<Eleve[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClasse, setFilterClasse] = useState('all');
  const [filterNiveau, setFilterNiveau] = useState('all');
  const [selectedEleve, setSelectedEleve] = useState<Eleve | null>(null);

  useEffect(() => {
    fetchEleves();
  }, []);

  const fetchEleves = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('eleves')
      .select('id, nom, prenom, matricule, sexe, classe_id, statut, date_naissance, photo_url, nom_prenom_pere, nom_prenom_mere, created_at, famille_id, classes(nom, niveau_id, niveaux:niveau_id(nom, cycle_id, cycles:cycle_id(nom))), familles:famille_id(nom_famille, telephone_pere, telephone_mere, email_parent, adresse)')
      .is('deleted_at', null)
      .order('nom');

    const allEleves = (data as any) || [];
    const secondaryEleves = allEleves.filter((e: any) => {
      const cycleName = e.classes?.niveaux?.cycles?.nom?.toLowerCase() || '';
      return cycleName.includes('collège') || cycleName.includes('lycée') || cycleName.includes('secondaire');
    });
    setEleves(secondaryEleves);
    setLoading(false);
  };

  const classes = useMemo(() => {
    const map = new Map<string, string>();
    eleves.forEach(e => {
      if (e.classes && e.classe_id) {
        const niveauName = e.classes?.niveaux?.nom;
        if (filterNiveau === 'all' || niveauName === filterNiveau) {
          map.set(e.classe_id, e.classes.nom);
        }
      }
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [eleves, filterNiveau]);

  const niveaux = useMemo(() => {
    const set = new Set<string>();
    eleves.forEach(e => {
      const niveauName = e.classes?.niveaux?.nom;
      if (niveauName) set.add(niveauName);
    });
    return Array.from(set).sort();
  }, [eleves]);

  const filtered = useMemo(() => {
    return eleves.filter(e => {
      const matchSearch = `${e.nom} ${e.prenom} ${e.matricule || ''}`.toLowerCase().includes(searchTerm.toLowerCase());
      const matchClasse = filterClasse === 'all' || e.classe_id === filterClasse;
      const niveauName = e.classes?.niveaux?.nom;
      const matchNiveau = filterNiveau === 'all' || niveauName === filterNiveau;
      return matchSearch && matchClasse && matchNiveau;
    });
  }, [eleves, searchTerm, filterClasse, filterNiveau]);

  const garcons = filtered.filter(e => e.sexe === 'M').length;
  const filles = filtered.filter(e => e.sexe === 'F').length;

  const getInitials = (e: Eleve) => `${e.prenom?.[0] || ''}${e.nom?.[0] || ''}`.toUpperCase();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-6 w-6 text-primary" />
        <h1 className="text-xl sm:text-2xl font-bold">Élèves du Secondaire</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">{filtered.length}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <span className="text-blue-600 font-bold text-lg">♂</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{garcons}</p>
              <p className="text-xs text-muted-foreground">Garçons</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500/10 to-pink-500/5 border-pink-200 dark:border-pink-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <span className="text-pink-600 font-bold text-lg">♀</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-pink-600">{filles}</p>
              <p className="text-xs text-muted-foreground">Filles</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher par nom, prénom ou matricule..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterNiveau} onValueChange={setFilterNiveau}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les niveaux</SelectItem>
            {niveaux.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterClasse} onValueChange={setFilterClasse}>
          <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les classes</SelectItem>
            {classes.map(([id, nom]) => <SelectItem key={id} value={id}>{nom}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid 2 colonnes */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Aucun élève trouvé</CardContent></Card>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{filtered.length} élève(s) affiché(s)</p>
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((eleve) => (
              <Card
                key={eleve.id}
                className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${eleve.sexe === 'M' ? 'border-l-blue-500' : eleve.sexe === 'F' ? 'border-l-pink-500' : 'border-l-muted'}`}
                onClick={() => setSelectedEleve(eleve)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={eleve.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-xs">
                      {getInitials(eleve)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{eleve.nom} {eleve.prenom}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] font-mono">{eleve.matricule || '—'}</Badge>
                      <Badge className={`text-[10px] border-0 ${eleve.sexe === 'M' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'}`}>
                        {eleve.sexe === 'M' ? '♂' : '♀'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{eleve.classes?.nom || '—'} • {eleve.classes?.niveaux?.nom || ''}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Dialog Détail */}
      <Dialog open={!!selectedEleve} onOpenChange={() => setSelectedEleve(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Détail de l'élève</DialogTitle>
          </DialogHeader>
          {selectedEleve && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={selectedEleve.photo_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                    {getInitials(selectedEleve)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-bold">{selectedEleve.prenom} {selectedEleve.nom}</p>
                  <Badge variant="outline" className="font-mono text-xs">{selectedEleve.matricule || '—'}</Badge>
                  <Badge className={`ml-2 text-xs border-0 ${selectedEleve.sexe === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                    {selectedEleve.sexe === 'M' ? 'Garçon' : 'Fille'}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Classe</p>
                    <p className="font-medium">{selectedEleve.classes?.nom || '—'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Niveau</p>
                    <p className="font-medium">{selectedEleve.classes?.niveaux?.nom || '—'}</p>
                  </div>
                </div>

                {selectedEleve.date_naissance && (
                  <div className="bg-muted/30 rounded-lg p-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Date de naissance</p>
                      <p className="font-medium">{new Date(selectedEleve.date_naissance).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                )}

                {(selectedEleve.nom_prenom_pere || selectedEleve.nom_prenom_mere) && (
                  <div className="bg-muted/30 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-2">Parents</p>
                    {selectedEleve.nom_prenom_pere && <p className="text-sm">👨 {selectedEleve.nom_prenom_pere}</p>}
                    {selectedEleve.nom_prenom_mere && <p className="text-sm mt-1">👩 {selectedEleve.nom_prenom_mere}</p>}
                  </div>
                )}

                {selectedEleve.familles && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                    <p className="text-xs text-muted-foreground mb-1">Contact famille</p>
                    {selectedEleve.familles.telephone_pere && (
                      <p className="text-sm flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> Père : {selectedEleve.familles.telephone_pere}</p>
                    )}
                    {selectedEleve.familles.telephone_mere && (
                      <p className="text-sm flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> Mère : {selectedEleve.familles.telephone_mere}</p>
                    )}
                    {selectedEleve.familles.email_parent && (
                      <p className="text-sm flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {selectedEleve.familles.email_parent}</p>
                    )}
                    {selectedEleve.familles.adresse && (
                      <p className="text-sm flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-muted-foreground" /> {selectedEleve.familles.adresse}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
