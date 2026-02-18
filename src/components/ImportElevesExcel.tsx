import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, Download, CheckCircle2, XCircle, Loader2, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { readExcelFile, exportToExcel } from '@/lib/excelUtils';

interface ImportResult {
  nom: string;
  prenom: string;
  status: 'success' | 'error';
  matricule?: string;
  password?: string;
  error?: string;
}

export default function ImportElevesExcel({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const downloadTemplate = () => {
    const template = [
      { Nom: 'DIALLO', Prénom: 'Mamadou', Sexe: 'M', 'Date de naissance': '2015-03-10', 'Téléphone Parent': '622123456', Classe: '6ème A' },
      { Nom: 'BAH', Prénom: 'Fatoumata', Sexe: 'F', 'Date de naissance': '2016-07-22', 'Téléphone Parent': '628789012', Classe: 'CP1' },
    ];
    exportToExcel(template, 'modele_import_eleves', 'Élèves');
    toast({ title: 'Modèle téléchargé' });
  };

  const generateMatricule = async () => {
    const now = new Date();
    const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await supabase
      .from('eleves')
      .select('*', { count: 'exact', head: true })
      .like('matricule', `${prefix}%`);
    const seq = String((count || 0) + 1).padStart(4, '0');
    return `${prefix}-${seq}`;
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setResults([]);
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) {
        toast({ title: 'Fichier vide', variant: 'destructive' });
        setImporting(false);
        return;
      }

      // Build class name -> id map (case-insensitive, trimmed)
      const classMap: Record<string, string> = {};
      classes.forEach((c: any) => {
        classMap[c.nom.trim().toLowerCase()] = c.id;
      });

      const importResults: ImportResult[] = [];
      let successCount = 0;

      for (const row of rows) {
        const nom = String(row['Nom'] || row['nom'] || '').trim();
        const prenom = String(row['Prénom'] || row['prenom'] || row['Prenom'] || '').trim();
        const sexe = String(row['Sexe'] || row['sexe'] || '').trim().toUpperCase();
        const dateNaissance = String(row['Date de naissance'] || row['date_naissance'] || '').trim();
        const telephone = String(row['Téléphone Parent'] || row['telephone_parent'] || row['Telephone Parent'] || row['Tel'] || '').trim();
        const classeNom = String(row['Classe'] || row['classe'] || '').trim();

        if (!nom || !prenom) {
          importResults.push({ nom: nom || '?', prenom: prenom || '?', status: 'error', error: 'Nom ou prénom manquant' });
          continue;
        }

        const classeId = classMap[classeNom.toLowerCase()];
        if (!classeId) {
          importResults.push({ nom, prenom, status: 'error', error: `Classe "${classeNom}" introuvable` });
          continue;
        }

        try {
          // Generate unique matricule (increment for batch)
          const now = new Date();
          const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
          const { count } = await supabase
            .from('eleves')
            .select('*', { count: 'exact', head: true })
            .like('matricule', `${prefix}%`);
          const seq = String((count || 0) + 1).padStart(4, '0');
          const matricule = `${prefix}-${seq}`;
          const password = generatePassword();

          // Auto-create family
          const codeAcces = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
          const { data: newFamille, error: famErr } = await supabase.from('familles').insert({
            nom_famille: nom.toUpperCase(),
            telephone_pere: telephone || null,
            code_acces: codeAcces,
          } as any).select('id').single();

          if (famErr) throw famErr;

          const { error: insertErr } = await supabase.from('eleves').insert({
            nom,
            prenom,
            sexe: sexe === 'M' || sexe === 'F' ? sexe : null,
            date_naissance: dateNaissance || null,
            classe_id: classeId,
            famille_id: newFamille.id,
            matricule,
            qr_code: matricule,
            mot_de_passe_eleve: password,
            statut: 'inscrit',
          } as any);

          if (insertErr) throw insertErr;

          importResults.push({ nom, prenom, status: 'success', matricule, password });
          successCount++;
        } catch (err: any) {
          importResults.push({ nom, prenom, status: 'error', error: err.message || 'Erreur insertion' });
        }
      }

      setResults(importResults);
      setShowResults(true);
      qc.invalidateQueries({ queryKey: ['eleves'] });
      qc.invalidateQueries({ queryKey: ['eleves-full'] });
      qc.invalidateQueries({ queryKey: ['familles'] });
      toast({
        title: 'Import terminé',
        description: `${successCount} réussi(s), ${importResults.length - successCount} erreur(s)`,
      });
    } catch (err: any) {
      toast({ title: 'Erreur de lecture', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const exportResults = () => {
    if (!results.length) return;
    const data = results.map(r => ({
      Nom: r.nom,
      Prénom: r.prenom,
      Statut: r.status === 'success' ? 'Créé' : 'Erreur',
      Matricule: r.matricule || '',
      'Mot de passe': r.password || '',
      Erreur: r.error || '',
    }));
    exportToExcel(data, 'rapport_import_eleves', 'Résultats');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Import Excel</Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Importation massive d'élèves</DialogTitle></DialogHeader>

          <div className="space-y-4">
            {/* Step 1: Download template */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">1. Télécharger le modèle Excel</p>
                <p className="text-xs text-muted-foreground">
                  Colonnes : <strong>Nom, Prénom, Sexe, Date de naissance, Téléphone Parent, Classe</strong>
                </p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" /> Télécharger le modèle
                </Button>
              </CardContent>
            </Card>

            {/* Step 2: Upload */}
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">2. Importer le fichier rempli</p>
                <p className="text-xs text-muted-foreground">
                  Le système vérifie les classes, génère les matricules et mots de passe automatiquement.
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="text-sm"
                    disabled={importing}
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleImport(f);
                    }}
                  />
                  {importing && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              </CardContent>
            </Card>

            {/* Results */}
            {showResults && results.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span>Rapport d'import</span>
                    <div className="flex gap-2">
                      <Badge variant="default" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> {results.filter(r => r.status === 'success').length} créé(s)
                      </Badge>
                      {results.some(r => r.status === 'error') && (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" /> {results.filter(r => r.status === 'error').length} erreur(s)
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prénom</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Mot de passe</TableHead>
                        <TableHead>Erreur</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.nom}</TableCell>
                          <TableCell>{r.prenom}</TableCell>
                          <TableCell>
                            {r.status === 'success' ? (
                              <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Créé</Badge>
                            ) : (
                              <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erreur</Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{r.matricule || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{r.password || '—'}</TableCell>
                          <TableCell className="text-xs text-destructive">{r.error || ''}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="p-3 border-t">
                    <Button variant="outline" size="sm" onClick={exportResults}>
                      <Download className="h-4 w-4 mr-2" /> Exporter le rapport
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
