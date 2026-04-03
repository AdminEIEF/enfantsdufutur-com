import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { KeyRound, Search, Eye, EyeOff, Copy, Loader2, GraduationCap, Users, Briefcase, RefreshCw, CheckCircle2, UserCircle, Phone, Mail, MapPin, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

function generatePassword(length = 8) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

function generateSimpleCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pwd = '';
  for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  return pwd;
}

const normalize = (v = '') => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// Helpers to persist generated passwords/codes in localStorage
const STORAGE_KEY_ELEVES = 'sup_pwd_eleves';
const STORAGE_KEY_FAMILLES = 'sup_pwd_familles';

function getSavedPasswords(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch { return {}; }
}

function savePassword(key: string, id: string, pwd: string) {
  const all = getSavedPasswords(key);
  all[id] = pwd;
  localStorage.setItem(key, JSON.stringify(all));
}

export default function SuperviseurPasswordPanel() {
  const [tab, setTab] = useState('eleves');
  const [search, setSearch] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedPwd, setGeneratedPwd] = useState<{ id: string; pwd: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwdIds, setShowPwdIds] = useState<Set<string>>(new Set());

  // Data stores
  const [eleves, setEleves] = useState<any[]>([]);
  const [employes, setEmployes] = useState<any[]>([]);
  const [familles, setFamilles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters for eleves
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedNiveau, setSelectedNiveau] = useState('all');
  const [selectedClasse, setSelectedClasse] = useState('all');

  // Alphabet filter for familles
  const [selectedLetter, setSelectedLetter] = useState('all');

  // Alphabet filter for employes
  const [selectedLetterEmp, setSelectedLetterEmp] = useState('all');
  // Category filter for employes
  const [selectedCategorie, setSelectedCategorie] = useState('all');

  // Detail dialog
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailType, setDetailType] = useState<'eleve' | 'famille' | 'employe' | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [familleDetail, setFamilleDetail] = useState<any>(null);
  const [familleEnfants, setFamilleEnfants] = useState<any[]>([]);

  // Load niveaux with cycles on mount
  useEffect(() => {
    supabase
      .from('niveaux')
      .select('id, nom, cycle_id, cycles(nom)')
      .order('ordre', { ascending: true })
      .then(({ data }) => setNiveaux(data || []));
  }, []);

  // Load classes when niveau changes
  useEffect(() => {
    if (selectedNiveau === 'all') {
      supabase.from('classes').select('id, nom, niveau_id').order('nom').then(({ data }) => setClasses(data || []));
    } else {
      supabase.from('classes').select('id, nom, niveau_id').eq('niveau_id', selectedNiveau).order('nom').then(({ data }) => setClasses(data || []));
    }
    setSelectedClasse('all');
  }, [selectedNiveau]);

  // Load data when tab changes
  useEffect(() => {
    setLoading(true);
    setGeneratedPwd(null);
    setSearch('');
    setSelectedLetter('all');
    setSelectedLetterEmp('all');
    setSelectedCategorie('all');
    if (tab === 'eleves') {
      supabase
        .from('eleves')
        .select('id, nom, prenom, matricule, classe_id, famille_id, classes(nom, niveau_id)')
        .is('deleted_at', null)
        .order('nom')
        .then(async ({ data, count }) => {
          let all = data || [];
          // Handle pagination if more than 1000 rows
          if (all.length === 1000) {
            let offset = 1000;
            let more = true;
            while (more) {
              const { data: next } = await supabase.from('eleves')
                .select('id, nom, prenom, matricule, classe_id, famille_id, classes(nom, niveau_id)')
                .is('deleted_at', null).order('nom').range(offset, offset + 999);
              if (next && next.length > 0) { all = [...all, ...next]; offset += next.length; } else { more = false; }
            }
          }
          setEleves(all);
          setLoading(false);
        });
    } else if (tab === 'employes') {
      supabase
        .from('employes')
        .select('id, nom, prenom, matricule, poste, categorie, telephone, email')
        .eq('statut', 'actif')
        .order('nom')
        .then(({ data }) => { setEmployes(data || []); setLoading(false); });
    } else if (tab === 'familles') {
      supabase
        .from('familles')
        .select('id, nom_famille, telephone_pere, telephone_mere, email_parent, adresse')
        .order('nom_famille')
        .then(({ data }) => { setFamilles(data || []); setLoading(false); });
    }
  }, [tab]);

  // Filtered results
  const results = useMemo(() => {
    const q = normalize(search);
    const terms = q.split(/\s+/).filter(Boolean);

    if (tab === 'eleves') {
      let list = eleves;
      if (selectedNiveau !== 'all') {
        list = list.filter(e => (e.classes as any)?.niveau_id === selectedNiveau);
      }
      if (selectedClasse !== 'all') {
        list = list.filter(e => e.classe_id === selectedClasse);
      }
      if (terms.length > 0) {
        list = list.filter(e => {
          const h = normalize(`${e.prenom} ${e.nom} ${e.matricule || ''}`);
          return terms.every(t => h.includes(t));
        });
      }
      return list;
    } else if (tab === 'employes') {
      let list = employes;
      if (selectedCategorie !== 'all') {
        list = list.filter(e => e.categorie === selectedCategorie);
      }
      if (selectedLetterEmp !== 'all') {
        list = list.filter(e => normalize(e.nom).startsWith(selectedLetterEmp.toLowerCase()));
      }
      if (terms.length > 0) {
        list = list.filter(e => {
          const h = normalize(`${e.prenom} ${e.nom} ${e.matricule || ''} ${e.poste || ''} ${e.telephone || ''}`);
          return terms.every(t => h.includes(t));
        });
      }
      return list;
    } else {
      let list = familles;
      if (selectedLetter !== 'all') {
        list = list.filter(f => normalize(f.nom_famille).startsWith(selectedLetter.toLowerCase()));
      }
      if (terms.length > 0) {
        list = list.filter(f => {
          const h = normalize(`${f.nom_famille} ${f.telephone_pere || ''} ${f.telephone_mere || ''}`);
          return terms.every(t => h.includes(t));
        });
      }
      return list;
    }
  }, [tab, search, eleves, employes, familles, selectedNiveau, selectedClasse, selectedLetter, selectedLetterEmp, selectedCategorie]);

  // Open famille detail
  const openFamilleDetail = async (familleId: string) => {
    setDetailType('famille');
    setDetailLoading(true);
    setDetailItem(null);
    setFamilleEnfants([]);

    const [famRes, enfantsRes] = await Promise.all([
      supabase.from('familles').select('*').eq('id', familleId).single(),
      supabase.from('eleves').select('id, nom, prenom, matricule, classes(nom)').eq('famille_id', familleId).is('deleted_at', null),
    ]);
    setFamilleDetail(famRes.data);
    setFamilleEnfants(enfantsRes.data || []);
    setDetailLoading(false);
  };

  // Open eleve detail -> show famille
  const openEleveFamily = async (item: any) => {
    if (item.famille_id) {
      openFamilleDetail(item.famille_id);
    } else {
      toast.info('Cet élève n\'est rattaché à aucune famille');
    }
  };

  const handleGenerate = async (item: any) => {
    setGeneratingId(item.id);
    try {
      if (tab === 'eleves') {
        const pwd = generateSimpleCode();
        const { error } = await supabase.from('eleves').update({ mot_de_passe_eleve: pwd } as any).eq('id', item.id);
        if (error) throw error;
        setGeneratedPwd({ id: item.id, pwd });
        toast.success(`Mot de passe généré pour ${item.prenom} ${item.nom}`);
      } else if (tab === 'employes') {
        const pwd = generatePassword(8);
        const { error } = await supabase.from('employes').update({ mot_de_passe: pwd } as any).eq('id', item.id);
        if (error) throw error;
        setGeneratedPwd({ id: item.id, pwd });
        toast.success(`Mot de passe généré pour ${item.prenom} ${item.nom}`);
      } else if (tab === 'familles') {
        const code = generateSimpleCode();
        const { error } = await supabase.from('familles').update({ code_acces: code } as any).eq('id', item.id);
        if (error) throw error;
        setGeneratedPwd({ id: item.id, pwd: code });
        toast.success(`Code d'accès généré pour ${item.nom_famille}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setGeneratingId(null);
    }
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set(employes.map(e => e.categorie));
    return Array.from(cats).sort();
  }, [employes]);

  const categorieLabels: Record<string, string> = {
    enseignant: 'Enseignant',
    administration: 'Administration',
    direction: 'Direction',
    service: 'Service',
    soutien: 'Soutien',
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-5 w-5 text-primary" />
            Gestion des mots de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="eleves" className="text-xs gap-1">
                <GraduationCap className="h-3.5 w-3.5" /> Élèves
              </TabsTrigger>
              <TabsTrigger value="employes" className="text-xs gap-1">
                <Briefcase className="h-3.5 w-3.5" /> Employés
              </TabsTrigger>
              <TabsTrigger value="familles" className="text-xs gap-1">
                <Users className="h-3.5 w-3.5" /> Familles
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Filters for eleves tab */}
          {tab === 'eleves' && (
            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedNiveau} onValueChange={setSelectedNiveau}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Tous les niveaux" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les niveaux</SelectItem>
                  {niveaux.map(n => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.nom} ({(n.cycles as any)?.nom})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedClasse} onValueChange={setSelectedClasse}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Toutes les classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les classes</SelectItem>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filters for employes tab */}
          {tab === 'employes' && (
            <div className="space-y-2">
              <Select value={selectedCategorie} onValueChange={setSelectedCategorie}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Toutes catégories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les catégories</SelectItem>
                  {uniqueCategories.map(c => (
                    <SelectItem key={c} value={c}>{categorieLabels[c] || c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex flex-wrap gap-1">
                <Button
                  variant={selectedLetterEmp === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 w-8 text-[10px] px-0"
                  onClick={() => setSelectedLetterEmp('all')}
                >
                  Tous
                </Button>
                {ALPHABET.map(l => (
                  <Button
                    key={l}
                    variant={selectedLetterEmp === l ? 'default' : 'outline'}
                    size="sm"
                    className="h-6 w-6 text-[10px] px-0"
                    onClick={() => setSelectedLetterEmp(l)}
                  >
                    {l}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Alphabet filter for familles tab */}
          {tab === 'familles' && (
            <div className="flex flex-wrap gap-1">
              <Button
                variant={selectedLetter === 'all' ? 'default' : 'outline'}
                size="sm"
                className="h-6 w-8 text-[10px] px-0"
                onClick={() => setSelectedLetter('all')}
              >
                Tous
              </Button>
              {ALPHABET.map(l => (
                <Button
                  key={l}
                  variant={selectedLetter === l ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 w-6 text-[10px] px-0"
                  onClick={() => setSelectedLetter(l)}
                >
                  {l}
                </Button>
              ))}
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 h-9"
              placeholder={
                tab === 'familles' ? 'Rechercher par nom ou téléphone...' :
                tab === 'employes' ? 'Rechercher par nom, matricule ou téléphone...' :
                'Rechercher un élève...'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Results count */}
          <p className="text-xs text-muted-foreground">
            {results.length} résultat{results.length !== 1 ? 's' : ''}
          </p>

          {/* Results list */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <div className="border rounded-lg divide-y max-h-[350px] overflow-y-auto">
              {results.map((item) => (
                <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {tab === 'familles' ? item.nom_famille : `${item.prenom} ${item.nom}`}
                      </p>
                      {/* Link to famille for eleves */}
                      {tab === 'eleves' && item.famille_id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0"
                          title="Voir la famille"
                          onClick={() => openEleveFamily(item)}
                        >
                          <Users className="h-3 w-3 text-primary" />
                        </Button>
                      )}
                      {/* Link to detail for familles */}
                      {tab === 'familles' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0"
                          title="Détails famille"
                          onClick={() => openFamilleDetail(item.id)}
                        >
                          <ExternalLink className="h-3 w-3 text-primary" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {tab === 'eleves' && `${item.matricule || '—'} • ${(item as any).classes?.nom || '—'}`}
                      {tab === 'employes' && `${item.matricule} • ${item.poste} ${item.telephone ? '• ' + item.telephone : ''}`}
                      {tab === 'familles' && `${item.telephone_pere ? '📱 Père: ' + item.telephone_pere : ''} ${item.telephone_mere ? '📱 Mère: ' + item.telephone_mere : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {generatedPwd?.id === item.id ? (
                      <div className="flex items-center gap-1">
                        <code className="text-sm font-mono font-bold bg-muted px-2 py-0.5 rounded">
                          {showPwd ? generatedPwd.pwd : '••••••'}
                        </code>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPwd(!showPwd)}>
                          {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(generatedPwd.pwd); toast.success('Copié !'); }}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        disabled={generatingId === item.id}
                        onClick={() => handleGenerate(item)}
                      >
                        {generatingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        )}
                        Générer
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">Aucun résultat trouvé</p>
          )}
        </CardContent>
      </Card>

      {/* Famille detail dialog */}
      <Dialog open={detailType === 'famille'} onOpenChange={(o) => { if (!o) { setDetailType(null); setFamilleDetail(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Détails de la famille
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : familleDetail ? (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h3 className="font-semibold text-lg">{familleDetail.nom_famille}</h3>
                {familleDetail.telephone_pere && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Père : {familleDetail.telephone_pere}</span>
                  </div>
                )}
                {familleDetail.telephone_mere && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>Mère : {familleDetail.telephone_mere}</span>
                  </div>
                )}
                {familleDetail.email_parent && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{familleDetail.email_parent}</span>
                  </div>
                )}
                {familleDetail.adresse && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{familleDetail.adresse}</span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2">Enfants ({familleEnfants.length})</h4>
                {familleEnfants.length > 0 ? (
                  <div className="space-y-1.5">
                    {familleEnfants.map(e => (
                      <div key={e.id} className="flex items-center gap-2 bg-muted/30 rounded-md px-3 py-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{e.prenom} {e.nom}</p>
                          <p className="text-xs text-muted-foreground">{e.matricule || '—'} • {(e.classes as any)?.nom || '—'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Aucun enfant rattaché</p>
                )}
              </div>

              {/* Generate code for this famille */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Code d'accès parent</span>
                  {generatedPwd?.id === familleDetail.id ? (
                    <div className="flex items-center gap-1">
                      <code className="text-sm font-mono font-bold bg-muted px-2 py-0.5 rounded">
                        {showPwd ? generatedPwd.pwd : '••••••'}
                      </code>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowPwd(!showPwd)}>
                        {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(generatedPwd.pwd); toast.success('Copié !'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      disabled={generatingId === familleDetail.id}
                      onClick={() => handleGenerate({ ...familleDetail, nom_famille: familleDetail.nom_famille })}
                    >
                      {generatingId === familleDetail.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      )}
                      Générer
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
