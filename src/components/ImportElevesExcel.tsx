import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, Download, CheckCircle2, XCircle, Loader2, FileSpreadsheet, ArrowRight, Eye, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { readExcelFile, exportToExcel } from '@/lib/excelUtils';

// System fields that can be mapped
const SYSTEM_FIELDS = [
  { key: 'nom', label: 'Nom', required: true },
  { key: 'prenom', label: 'Prénom', required: true },
  { key: 'sexe', label: 'Sexe (M/F)', required: false },
  { key: 'date_naissance', label: 'Date de naissance', required: false },
  { key: 'classe', label: 'Classe', required: true },
  { key: 'telephone_parent', label: 'Téléphone parent', required: false },
  { key: 'email_parent', label: 'Email parent', required: false },
  { key: 'nom_prenom_pere', label: 'Nom & Prénom du père', required: false },
  { key: 'nom_prenom_mere', label: 'Nom & Prénom de la mère', required: false },
  { key: 'adresse', label: 'Adresse', required: false },
  { key: 'nom_famille', label: 'Nom de famille (groupe)', required: false },
];

// Auto-detect mapping based on common column name patterns
function autoDetectMapping(excelColumns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const lower = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  for (const col of excelColumns) {
    const l = lower(col);
    if (['nom', 'nom_eleve', 'nom eleve', 'last name', 'surname', 'family name'].includes(l)) {
      mapping[col] = 'nom';
    } else if (['prenom', 'prenom_eleve', 'prenom eleve', 'first name', 'given name', 'prenoms'].includes(l)) {
      mapping[col] = 'prenom';
    } else if (['sexe', 'genre', 'sex', 'gender'].includes(l)) {
      mapping[col] = 'sexe';
    } else if (['date de naissance', 'date_naissance', 'dob', 'naissance', 'date naissance', 'ne(e) le', 'ne le', 'nee le'].includes(l)) {
      mapping[col] = 'date_naissance';
    } else if (['classe', 'class', 'niveau', 'classe_nom'].includes(l)) {
      mapping[col] = 'classe';
    } else if (['telephone parent', 'telephone_parent', 'tel parent', 'tel', 'telephone', 'phone', 'tel.', 'contact', 'numero parent'].includes(l)) {
      mapping[col] = 'telephone_parent';
    } else if (['email', 'email_parent', 'email parent', 'courriel', 'mail'].includes(l)) {
      mapping[col] = 'email_parent';
    } else if (['nom pere', 'nom_prenom_pere', 'pere', 'father', 'nom du pere', 'nom & prenom du pere', 'nom et prenom du pere', 'nom prenom pere'].includes(l)) {
      mapping[col] = 'nom_prenom_pere';
    } else if (['nom mere', 'nom_prenom_mere', 'mere', 'mother', 'nom de la mere', 'nom & prenom de la mere', 'nom et prenom de la mere', 'nom prenom mere'].includes(l)) {
      mapping[col] = 'nom_prenom_mere';
    } else if (['adresse', 'address', 'domicile'].includes(l)) {
      mapping[col] = 'adresse';
    } else if (['nom famille', 'nom_famille', 'famille', 'family'].includes(l)) {
      mapping[col] = 'nom_famille';
    }
  }
  return mapping;
}

interface ImportResult {
  nom: string;
  prenom: string;
  status: 'success' | 'error' | 'duplicate';
  matricule?: string;
  password?: string;
  familyCode?: string;
  error?: string;
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

export default function ImportElevesExcel({ classes }: { classes: any[] }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const resetState = () => {
    setStep('upload');
    setRawRows([]);
    setExcelColumns([]);
    setColumnMapping({});
    setResults([]);
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) resetState();
  };

  // Step 1: Read file and detect columns
  const handleFileSelect = async (file: File) => {
    try {
      const rows = await readExcelFile(file);
      if (!rows.length) {
        toast({ title: 'Fichier vide', variant: 'destructive' });
        return;
      }
      const cols = Object.keys(rows[0]);
      setRawRows(rows);
      setExcelColumns(cols);
      setColumnMapping(autoDetectMapping(cols));
      setStep('mapping');
    } catch (err: any) {
      toast({ title: 'Erreur de lecture', description: err.message, variant: 'destructive' });
    }
  };

  // Mapped fields validation
  const mappedFields = useMemo(() => {
    const mapped = new Set(Object.values(columnMapping).filter(Boolean));
    return {
      hasNom: mapped.has('nom'),
      hasPrenom: mapped.has('prenom'),
      hasClasse: mapped.has('classe'),
      allRequired: mapped.has('nom') && mapped.has('prenom') && mapped.has('classe'),
    };
  }, [columnMapping]);

  // Preview data using current mapping
  const previewData = useMemo(() => {
    const reverseMap: Record<string, string> = {};
    for (const [excelCol, sysField] of Object.entries(columnMapping)) {
      if (sysField) reverseMap[sysField] = excelCol;
    }
    return rawRows.slice(0, 10).map(row => ({
      nom: String(row[reverseMap['nom']] || '').trim(),
      prenom: String(row[reverseMap['prenom']] || '').trim(),
      sexe: String(row[reverseMap['sexe']] || '').trim(),
      classe: String(row[reverseMap['classe']] || '').trim(),
      date_naissance: String(row[reverseMap['date_naissance']] || '').trim(),
      telephone_parent: String(row[reverseMap['telephone_parent']] || '').trim(),
    }));
  }, [rawRows, columnMapping]);

  // Build class lookup
  const classMap = useMemo(() => {
    const map: Record<string, string> = {};
    classes.forEach((c: any) => {
      map[c.nom.trim().toLowerCase()] = c.id;
      // Also add variants without accents and spaces
      const normalized = c.nom.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      map[normalized] = c.id;
    });
    return map;
  }, [classes]);

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let pwd = '';
    for (let i = 0; i < 6; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    return pwd;
  };

  // Step 3: Execute import
  const executeImport = async () => {
    setImporting(true);
    setStep('importing');

    const reverseMap: Record<string, string> = {};
    for (const [excelCol, sysField] of Object.entries(columnMapping)) {
      if (sysField) reverseMap[sysField] = excelCol;
    }

    const importResults: ImportResult[] = [];
    let successCount = 0;

    // Get current matricule count once
    const now = new Date();
    const prefix = `EDU-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const { count: existingCount } = await supabase
      .from('eleves')
      .select('*', { count: 'exact', head: true })
      .like('matricule', `${prefix}%`);
    let seqCounter = (existingCount || 0);

    for (const row of rawRows) {
      const getValue = (field: string) => {
        const col = reverseMap[field];
        return col ? String(row[col] || '').trim() : '';
      };

      const nom = getValue('nom');
      const prenom = getValue('prenom');
      const sexe = getValue('sexe').toUpperCase();
      const dateNaissance = getValue('date_naissance');
      const classeNom = getValue('classe');
      const telephone = getValue('telephone_parent');
      const email = getValue('email_parent');
      const nomPere = getValue('nom_prenom_pere');
      const nomMere = getValue('nom_prenom_mere');
      const adresse = getValue('adresse');
      const nomFamille = getValue('nom_famille') || nom;

      if (!nom || !prenom) {
        importResults.push({ nom: nom || '?', prenom: prenom || '?', status: 'error', error: 'Nom ou prénom manquant' });
        continue;
      }

      // Find class
      const classeNomNorm = classeNom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const classeId = classMap[classeNom.toLowerCase()] || classMap[classeNomNorm];
      if (!classeId) {
        importResults.push({ nom, prenom, status: 'error', error: `Classe "${classeNom}" introuvable` });
        continue;
      }

      // Check for duplicate (same nom + prenom + classe)
      const { count: dupCount } = await supabase
        .from('eleves')
        .select('*', { count: 'exact', head: true })
        .eq('nom', nom)
        .eq('prenom', prenom)
        .eq('classe_id', classeId)
        .is('deleted_at', null);

      if (dupCount && dupCount > 0) {
        importResults.push({ nom, prenom, status: 'duplicate', error: 'Élève déjà existant dans cette classe' });
        continue;
      }

      try {
        // Create family
        const familyCode = 'FAM-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const { data: newFamille, error: famErr } = await supabase.from('familles').insert({
          nom_famille: nomFamille.toUpperCase(),
          telephone_pere: telephone || null,
          email_parent: email || null,
          adresse: adresse || null,
          code_acces: familyCode,
        } as any).select('id').single();
        if (famErr) throw famErr;

        // Generate matricule
        seqCounter++;
        const matricule = `${prefix}-${String(seqCounter).padStart(4, '0')}`;
        const password = generatePassword();

        // Create student
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
          nom_prenom_pere: nomPere || null,
          nom_prenom_mere: nomMere || null,
        } as any);
        if (insertErr) throw insertErr;

        importResults.push({ nom, prenom, status: 'success', matricule, password, familyCode });
        successCount++;
      } catch (err: any) {
        importResults.push({ nom, prenom, status: 'error', error: err.message || 'Erreur insertion' });
      }
    }

    setResults(importResults);
    setStep('results');
    setImporting(false);
    qc.invalidateQueries({ queryKey: ['eleves'] });
    qc.invalidateQueries({ queryKey: ['eleves-full'] });
    qc.invalidateQueries({ queryKey: ['familles'] });
    toast({
      title: 'Import terminé',
      description: `${successCount} créé(s), ${importResults.filter(r => r.status === 'duplicate').length} doublon(s), ${importResults.filter(r => r.status === 'error').length} erreur(s)`,
    });
  };

  const exportResults = () => {
    if (!results.length) return;
    const data = results.map(r => ({
      Nom: r.nom,
      Prénom: r.prenom,
      Statut: r.status === 'success' ? 'Créé' : r.status === 'duplicate' ? 'Doublon' : 'Erreur',
      Matricule: r.matricule || '',
      'Mot de passe': r.password || '',
      'Code famille': r.familyCode || '',
      Erreur: r.error || '',
    }));
    exportToExcel(data, 'rapport_import_eleves', 'Résultats');
  };

  const downloadTemplate = () => {
    const template = [
      { Nom: 'DIALLO', Prénom: 'Mamadou', Sexe: 'M', 'Date de naissance': '2015-03-10', Classe: '6ème A', 'Téléphone Parent': '622123456', 'Email Parent': '', 'Nom & Prénom du père': 'Mamadou Diallo', 'Nom & Prénom de la mère': 'Fatoumata Bah', Adresse: 'Ratoma' },
      { Nom: 'BAH', Prénom: 'Fatoumata', Sexe: 'F', 'Date de naissance': '2016-07-22', Classe: 'CP1', 'Téléphone Parent': '628789012', 'Email Parent': '', 'Nom & Prénom du père': '', 'Nom & Prénom de la mère': 'Mariama Bah', Adresse: '' },
    ];
    exportToExcel(template, 'modele_import_eleves', 'Élèves');
    toast({ title: 'Modèle téléchargé' });
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Import Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Importation d'élèves depuis Excel
          </DialogTitle>
        </DialogHeader>

        {/* ── Step 1: Upload ── */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <p className="text-sm font-medium">Chargez votre fichier Excel existant</p>
                <p className="text-xs text-muted-foreground">
                  Vous pourrez mapper les colonnes de votre fichier aux champs du système à l'étape suivante. Formats acceptés : .xlsx, .xls
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="text-sm"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium">Ou utiliser notre modèle</p>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" /> Télécharger le modèle
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Step 2: Column Mapping ── */}
        {step === 'mapping' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{rawRows.length} ligne(s) détectée(s) — {excelColumns.length} colonne(s)</p>
                <p className="text-xs text-muted-foreground">Associez chaque colonne de votre fichier à un champ du système</p>
              </div>
              <Badge variant="outline">{excelColumns.length} colonnes</Badge>
            </div>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="grid gap-3">
                  {excelColumns.map(col => {
                    const sampleValues = rawRows.slice(0, 3).map(r => String(r[col] || '')).filter(Boolean).join(', ');
                    return (
                      <div key={col} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{col}</p>
                          <p className="text-xs text-muted-foreground truncate">Ex: {sampleValues || '(vide)'}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={columnMapping[col] || '_ignore'}
                          onValueChange={val => setColumnMapping(prev => ({ ...prev, [col]: val === '_ignore' ? '' : val }))}
                        >
                          <SelectTrigger className="w-52">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_ignore">— Ignorer —</SelectItem>
                            {SYSTEM_FIELDS.map(f => {
                              const alreadyMapped = Object.entries(columnMapping).some(
                                ([k, v]) => v === f.key && k !== col
                              );
                              return (
                                <SelectItem key={f.key} value={f.key} disabled={alreadyMapped}>
                                  {f.label} {f.required ? '*' : ''} {alreadyMapped ? '(déjà assigné)' : ''}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {!mappedFields.allRequired && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Champs obligatoires manquants :
                {!mappedFields.hasNom && ' Nom'}
                {!mappedFields.hasPrenom && ' Prénom'}
                {!mappedFields.hasClasse && ' Classe'}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={resetState}>Annuler</Button>
              <Button onClick={() => setStep('preview')} disabled={!mappedFields.allRequired}>
                <Eye className="h-4 w-4 mr-2" /> Prévisualiser
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Aperçu des {Math.min(10, rawRows.length)} premières lignes sur {rawRows.length}</p>
              <Badge variant="outline">{rawRows.length} total</Badge>
            </div>

            <ScrollArea className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Sexe</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Date naiss.</TableHead>
                    <TableHead>Tél. parent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.nom || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell>{row.prenom || <span className="text-destructive">—</span>}</TableCell>
                      <TableCell>{row.sexe || '—'}</TableCell>
                      <TableCell>
                        {classMap[row.classe.toLowerCase()] || classMap[row.classe.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')]
                          ? <span>{row.classe}</span>
                          : <span className="text-destructive">{row.classe || '—'} ✗</span>
                        }
                      </TableCell>
                      <TableCell className="text-xs">{row.date_naissance || '—'}</TableCell>
                      <TableCell className="text-xs">{row.telephone_parent || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="rounded-lg border bg-muted/50 p-3 space-y-1">
              <p className="text-sm font-medium">Résumé de l'importation</p>
              <ul className="text-xs text-muted-foreground space-y-0.5">
                <li>• {rawRows.length} élève(s) à importer</li>
                <li>• Une famille sera créée pour chaque élève</li>
                <li>• Matricules et mots de passe générés automatiquement</li>
                <li>• Les doublons (même nom + prénom + classe) seront ignorés</li>
              </ul>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep('mapping')}>Retour au mapping</Button>
              <Button onClick={executeImport}>
                <Upload className="h-4 w-4 mr-2" /> Lancer l'import ({rawRows.length} élèves)
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 4: Importing ── */}
        {step === 'importing' && (
          <div className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Import en cours… {rawRows.length} élève(s) à traiter</p>
          </div>
        )}

        {/* ── Step 5: Results ── */}
        {step === 'results' && results.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Rapport d'import</p>
              <div className="flex gap-2">
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" /> {results.filter(r => r.status === 'success').length} créé(s)
                </Badge>
                {results.some(r => r.status === 'duplicate') && (
                  <Badge variant="secondary" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> {results.filter(r => r.status === 'duplicate').length} doublon(s)
                  </Badge>
                )}
                {results.some(r => r.status === 'error') && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> {results.filter(r => r.status === 'error').length} erreur(s)
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="border rounded-md max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Prénom</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Matricule</TableHead>
                    <TableHead>Mot de passe</TableHead>
                    <TableHead>Code famille</TableHead>
                    <TableHead>Remarque</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.nom}</TableCell>
                      <TableCell>{r.prenom}</TableCell>
                      <TableCell>
                        {r.status === 'success' && <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Créé</Badge>}
                        {r.status === 'duplicate' && <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" /> Doublon</Badge>}
                        {r.status === 'error' && <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erreur</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.matricule || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.password || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{r.familyCode || '—'}</TableCell>
                      <TableCell className="text-xs text-destructive">{r.error || ''}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={exportResults}>
                <Download className="h-4 w-4 mr-2" /> Exporter le rapport
              </Button>
              <Button variant="outline" size="sm" onClick={resetState}>
                Nouvel import
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
