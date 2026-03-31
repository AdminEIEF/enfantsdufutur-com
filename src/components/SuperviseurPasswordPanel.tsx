import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KeyRound, Search, Eye, EyeOff, Copy, Loader2, GraduationCap, Users, Briefcase, RefreshCw, CheckCircle2 } from 'lucide-react';
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

export default function SuperviseurPasswordPanel() {
  const [tab, setTab] = useState('eleves');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generatedPwd, setGeneratedPwd] = useState<{ id: string; pwd: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const terms = search.trim().split(/\s+/).filter(Boolean);
      
      if (tab === 'eleves') {
        // Fetch all active students then filter client-side for multi-term search
        const { data } = await supabase
          .from('eleves')
          .select('id, nom, prenom, matricule, classe_id, classes(nom)')
          .is('deleted_at', null)
          .limit(1000);
        const filtered = (data || []).filter(e => {
          const haystack = `${e.prenom} ${e.nom} ${e.matricule || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return terms.every(t => haystack.includes(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
        });
        setResults(filtered.slice(0, 20));
      } else if (tab === 'employes') {
        const { data } = await supabase
          .from('employes')
          .select('id, nom, prenom, matricule, poste, categorie')
          .eq('statut', 'actif')
          .limit(1000);
        const filtered = (data || []).filter(e => {
          const haystack = `${e.prenom} ${e.nom} ${e.matricule || ''} ${e.poste || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return terms.every(t => haystack.includes(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
        });
        setResults(filtered.slice(0, 20));
      } else if (tab === 'familles') {
        const { data } = await supabase
          .from('familles')
          .select('id, nom_famille, telephone_pere, telephone_mere, email_parent')
          .limit(1000);
        const filtered = (data || []).filter(f => {
          const haystack = `${f.nom_famille} ${f.telephone_pere || ''} ${f.telephone_mere || ''} ${f.email_parent || ''}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return terms.every(t => haystack.includes(t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")));
        });
        setResults(filtered.slice(0, 20));
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSearching(false);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-5 w-5 text-primary" />
          Gestion des mots de passe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={tab} onValueChange={(v) => { setTab(v); setResults([]); setSearch(''); setGeneratedPwd(null); }}>
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

        <div className="flex gap-2">
          <Input
            placeholder={tab === 'familles' ? 'Rechercher une famille...' : 'Rechercher par nom ou matricule...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button size="sm" onClick={handleSearch} disabled={searching}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="border rounded-lg divide-y max-h-[300px] overflow-y-auto">
            {results.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {tab === 'familles' ? item.nom_famille : `${item.prenom} ${item.nom}`}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {tab === 'eleves' && `${item.matricule || '—'} • ${(item as any).classes?.nom || '—'}`}
                    {tab === 'employes' && `${item.matricule} • ${item.poste}`}
                    {tab === 'familles' && `${item.telephone_pere || item.telephone_mere || '—'}`}
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
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
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
        )}

        {results.length === 0 && search && !searching && (
          <p className="text-center text-sm text-muted-foreground py-4">Aucun résultat trouvé</p>
        )}

        {!search && (
          <p className="text-center text-xs text-muted-foreground py-2">
            Recherchez un {tab === 'familles' ? 'nom de famille' : 'nom ou matricule'} pour générer ou réinitialiser un mot de passe.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
