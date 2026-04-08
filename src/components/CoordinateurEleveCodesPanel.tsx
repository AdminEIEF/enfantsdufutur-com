import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyRound, Search, Eye, EyeOff, Copy, Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

const normalize = (v = '') => v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

interface Props {
  type: 'primaire' | 'secondaire';
}

export default function CoordinateurEleveCodesPanel({ type }: Props) {
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showIds, setShowIds] = useState<Set<string>>(new Set());
  const [niveaux, setNiveaux] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedNiveau, setSelectedNiveau] = useState('all');
  const [selectedClasse, setSelectedClasse] = useState('all');

  const cycleFilter = type === 'primaire'
    ? ['Crèche', 'Maternelle', 'Primaire']
    : ['Collège', 'Lycée'];

  useEffect(() => {
    supabase.from('niveaux').select('id, nom, cycle_id, cycles(nom)').order('ordre').then(({ data }) => {
      const filtered = (data || []).filter((n: any) => cycleFilter.includes(n.cycles?.nom));
      setNiveaux(filtered);
    });
  }, []);

  useEffect(() => {
    const q = selectedNiveau === 'all'
      ? supabase.from('classes').select('id, nom, niveau_id').in('niveau_id', niveaux.map(n => n.id)).order('nom')
      : supabase.from('classes').select('id, nom, niveau_id').eq('niveau_id', selectedNiveau).order('nom');
    q.then(({ data }) => setClasses(data || []));
    setSelectedClasse('all');
  }, [selectedNiveau, niveaux]);

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('generated_student_codes' as any)
      .select('eleve_id, password_plain, eleves(id, nom, prenom, matricule, classe_id, classes(nom, niveau_id, niveaux(nom, cycles(nom))))') as any;
    
    // Filter by cycle
    const filtered = (data || []).filter((c: any) => {
      const cycleName = c.eleves?.classes?.niveaux?.cycles?.nom;
      return cycleFilter.includes(cycleName);
    });
    setCodes(filtered);
    setLoading(false);
  };

  const results = useMemo(() => {
    let list = codes;
    if (selectedNiveau !== 'all') {
      list = list.filter(c => c.eleves?.classes?.niveau_id === selectedNiveau);
    }
    if (selectedClasse !== 'all') {
      list = list.filter(c => c.eleves?.classe_id === selectedClasse);
    }
    const q = normalize(search);
    if (q) {
      const terms = q.split(/\s+/);
      list = list.filter(c => {
        const h = normalize(`${c.eleves?.prenom} ${c.eleves?.nom} ${c.eleves?.matricule || ''}`);
        return terms.every((t: string) => h.includes(t));
      });
    }
    return list;
  }, [codes, search, selectedNiveau, selectedClasse]);

  const handleExport = () => {
    const lines = ['Matricule,Nom,Prénom,Classe,Mot de passe'];
    results.forEach((c: any) => {
      lines.push(`"${c.eleves?.matricule || ''}","${c.eleves?.nom}","${c.eleves?.prenom}","${c.eleves?.classes?.nom || ''}","${c.password_plain}"`);
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `codes_eleves_${type}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (codes.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" />
          Identifiants élèves
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedNiveau} onValueChange={setSelectedNiveau}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Tous les niveaux" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {niveaux.map(n => <SelectItem key={n.id} value={n.id}>{n.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedClasse} onValueChange={setSelectedClasse}>
            <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Toutes les classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9 h-9" placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Button size="sm" variant="outline" className="text-xs gap-1 h-9" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">{results.length} élève{results.length !== 1 ? 's' : ''}</p>

        <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
          {results.map((c: any) => {
            const isVisible = showIds.has(c.eleve_id);
            return (
              <div key={c.eleve_id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.eleves?.prenom} {c.eleves?.nom}</p>
                  <p className="text-xs text-muted-foreground">{c.eleves?.matricule || '—'} • {c.eleves?.classes?.nom || '—'}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <code className="text-sm font-mono font-bold bg-muted px-2 py-0.5 rounded">
                    {isVisible ? c.password_plain : '••••••'}
                  </code>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setShowIds(prev => {
                      const next = new Set(prev);
                      if (next.has(c.eleve_id)) next.delete(c.eleve_id); else next.add(c.eleve_id);
                      return next;
                    });
                  }}>
                    {isVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(c.password_plain); toast.success('Copié !'); }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
