import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Banknote, FileText, Shield, BookOpen, Bus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Niveau {
  id: string;
  nom: string;
  ordre: number;
  frais_scolarite: number;
  frais_inscription: number;
  frais_reinscription: number;
  frais_dossier: number;
  frais_assurance: number;
  frais_examen: number;
  total_inscription_fixe: number;
  total_reinscription_fixe: number;
  remise_reinscription: number;
  cycle_id: string;
}

interface Cycle {
  id: string;
  nom: string;
  ordre: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('fr-GN', { style: 'decimal' }).format(n) + ' GNF';

export default function LandingTarifs() {
  const [selectedNiveauId, setSelectedNiveauId] = useState<string>('');
  const [mode, setMode] = useState<'inscription' | 'reinscription'>('inscription');

  const { data: cycles } = useQuery({
    queryKey: ['landing-cycles'],
    queryFn: async () => {
      const { data } = await supabase.from('cycles').select('id, nom, ordre').order('ordre');
      return (data ?? []) as Cycle[];
    },
  });

  const { data: niveaux } = useQuery({
    queryKey: ['landing-niveaux'],
    queryFn: async () => {
      const { data } = await supabase
        .from('niveaux')
        .select('id, nom, ordre, frais_scolarite, frais_inscription, frais_reinscription, frais_dossier, frais_assurance, frais_examen, total_inscription_fixe, total_reinscription_fixe, remise_reinscription, cycle_id')
        .order('ordre');
      return (data ?? []) as Niveau[];
    },
  });

  const selectedNiveau = niveaux?.find((n) => n.id === selectedNiveauId);
  const selectedCycle = cycles?.find((c) => c.id === selectedNiveau?.cycle_id);

  const groupedNiveaux = cycles?.map((c) => ({
    cycle: c,
    niveaux: (niveaux ?? []).filter((n) => n.cycle_id === c.id),
  })).filter((g) => g.niveaux.length > 0);

  const fraisItems = selectedNiveau
    ? [
        { label: 'Frais de scolarité (annuel)', value: selectedNiveau.frais_scolarite, icon: BookOpen, color: 'text-blue-600 bg-blue-100' },
        ...(mode === 'inscription'
          ? [{ label: "Frais d'inscription", value: selectedNiveau.frais_inscription, icon: FileText, color: 'text-emerald-600 bg-emerald-100' }]
          : [{ label: 'Frais de réinscription', value: selectedNiveau.frais_reinscription, icon: GraduationCap, color: 'text-violet-600 bg-violet-100' }]
        ),
        { label: 'Frais de dossier', value: selectedNiveau.frais_dossier, icon: Banknote, color: 'text-amber-600 bg-amber-100' },
        { label: 'Frais d\'assurance', value: selectedNiveau.frais_assurance, icon: Shield, color: 'text-rose-600 bg-rose-100' },
        ...(selectedNiveau.frais_examen > 0
          ? [{ label: 'Frais d\'examen (classe d\'examen)', value: selectedNiveau.frais_examen, icon: GraduationCap, color: 'text-indigo-600 bg-indigo-100' }]
          : []
        ),
      ]
    : [];

  const calcTotal = fraisItems.reduce((s, f) => s + f.value, 0);
  const fixeInscr = selectedNiveau ? Number(selectedNiveau.total_inscription_fixe ?? 0) : 0;
  const fixeReinscr = selectedNiveau ? Number(selectedNiveau.total_reinscription_fixe ?? 0) : 0;
  const remise = selectedNiveau ? Number(selectedNiveau.remise_reinscription ?? 0) : 0;
  const totalBrut = mode === 'inscription'
    ? (fixeInscr > 0 ? fixeInscr : calcTotal)
    : (fixeReinscr > 0 ? fixeReinscr : calcTotal);
  const totalFrais = mode === 'reinscription' && remise > 0 ? totalBrut - remise : totalBrut;
  const isFixe = mode === 'inscription' ? fixeInscr > 0 : fixeReinscr > 0;

  return (
    <section id="tarifs" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="text-center mb-10">
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          <Banknote className="inline-block mr-2 h-7 w-7 text-primary" />
          Tarifs &amp; Frais Scolaires
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
          Consultez les frais détaillés pour chaque niveau. Sélectionnez un niveau pour afficher la fiche de renseignements.
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center gap-2 mb-6">
        <button
          onClick={() => setMode('inscription')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
            mode === 'inscription'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Nouvelle inscription
        </button>
        <button
          onClick={() => setMode('reinscription')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
            mode === 'reinscription'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          Réinscription
        </button>
      </div>

      {/* Level Selector */}
      <div className="max-w-md mx-auto mb-10">
        <Select value={selectedNiveauId} onValueChange={setSelectedNiveauId}>
          <SelectTrigger className="h-12 text-base border-2 border-primary/30 focus:border-primary">
            <SelectValue placeholder="Choisir un niveau scolaire..." />
          </SelectTrigger>
          <SelectContent>
            {groupedNiveaux?.map((group) => (
              <div key={group.cycle.id}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  {group.cycle.nom}
                </div>
                {group.niveaux.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.nom}
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Fee Card */}
      <AnimatePresence mode="wait">
        {selectedNiveau && (
          <motion.div
            key={selectedNiveau.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <GraduationCap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl sm:text-2xl" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {selectedNiveau.nom}
                    </CardTitle>
                    {selectedCycle && (
                      <Badge variant="secondary" className="mt-1">
                        {selectedCycle.nom}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {fraisItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:shadow-md transition-shadow"
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${item.color}`}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                        <p className="text-base font-bold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                          {item.value > 0 ? fmt(item.value) : '—'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm sm:text-base">
                      Total estimé ({mode === 'inscription' ? 'nouvelle inscription' : 'réinscription'})
                    </span>
                    {isFixe && <Badge variant="secondary" className="ml-2 text-[10px]">Forfait classe d'examen</Badge>}
                  </div>
                  <span className="text-lg sm:text-xl font-bold text-primary" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                    {fmt(totalFrais)}
                  </span>
                </div>

                <p className="text-[11px] text-muted-foreground mt-3 text-center italic">
                  * Les frais de transport, cantine et uniformes ne sont pas inclus. Contactez l'administration pour plus de détails.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedNiveauId && (
        <div className="text-center py-10 text-muted-foreground">
          <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sélectionnez un niveau ci-dessus pour consulter les tarifs</p>
        </div>
      )}
    </section>
  );
}
