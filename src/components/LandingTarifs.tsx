import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { GraduationCap, Banknote, FileText, Shield, BookOpen, Sparkles, TrendingDown, CheckCircle2 } from 'lucide-react';
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

const fraisColors = [
  { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 border-blue-200', text: 'text-blue-700', icon: 'text-white' },
  { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: 'text-white' },
  { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: 'text-white' },
  { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: 'text-white' },
  { bg: 'from-violet-500 to-violet-600', light: 'bg-violet-50 border-violet-200', text: 'text-violet-700', icon: 'text-white' },
  { bg: 'from-indigo-500 to-indigo-600', light: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', icon: 'text-white' },
];

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
        { label: 'Frais de scolarité', sub: 'Annuel', value: selectedNiveau.frais_scolarite, icon: BookOpen },
        ...(mode === 'inscription'
          ? [{ label: "Frais d'inscription", sub: 'Unique', value: selectedNiveau.frais_inscription, icon: FileText }]
          : [{ label: 'Frais de réinscription', sub: 'Ancien élève', value: selectedNiveau.frais_reinscription, icon: GraduationCap }]
        ),
        { label: 'Frais de dossier', sub: 'Administratif', value: selectedNiveau.frais_dossier, icon: Banknote },
        { label: "Frais d'assurance", sub: 'Protection', value: selectedNiveau.frais_assurance, icon: Shield },
        ...(selectedNiveau.frais_examen > 0
          ? [{ label: "Frais d'examen", sub: "Classe d'examen", value: selectedNiveau.frais_examen, icon: GraduationCap }]
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
      {/* Header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-200 mb-4">
            <Sparkles className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-700">Transparence totale</span>
          </div>
          <h2
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-3 bg-gradient-to-r from-foreground via-foreground/80 to-foreground bg-clip-text"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Tarifs & Frais Scolaires
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
            Consultez les frais détaillés pour chaque niveau. Sélectionnez un niveau pour afficher la fiche complète.
          </p>
        </motion.div>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-2xl bg-muted/60 p-1.5 border border-border/50 shadow-sm">
          <button
            onClick={() => setMode('inscription')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              mode === 'inscription'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🆕 Nouvelle inscription
          </button>
          <button
            onClick={() => setMode('reinscription')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
              mode === 'reinscription'
                ? 'bg-gradient-to-r from-violet-500 to-violet-600 text-white shadow-lg shadow-violet-500/25'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            🔄 Réinscription
          </button>
        </div>
      </div>

      {/* Level Selector */}
      <div className="max-w-md mx-auto mb-10">
        <Select value={selectedNiveauId} onValueChange={setSelectedNiveauId}>
          <SelectTrigger className="h-14 text-base rounded-2xl border-2 border-primary/20 bg-background shadow-lg hover:border-primary/40 transition-colors focus:border-primary focus:ring-4 focus:ring-primary/10">
            <SelectValue placeholder="🎓 Choisir un niveau scolaire..." />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {groupedNiveaux?.map((group) => (
              <div key={group.cycle.id}>
                <div className="px-3 py-2 text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/50 border-b">
                  {group.cycle.nom}
                </div>
                {group.niveaux.map((n) => (
                  <SelectItem key={n.id} value={n.id} className="py-2.5 text-sm font-medium">
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
            key={selectedNiveau.id + mode}
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="rounded-3xl overflow-hidden border-2 border-primary/10 shadow-2xl bg-background">
              {/* Card Header */}
              <div className="relative overflow-hidden bg-gradient-to-r from-primary/15 via-primary/5 to-transparent p-6 sm:p-8">
                <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/10 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative flex flex-wrap items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg shadow-primary/20">
                    <GraduationCap className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-extrabold" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {selectedNiveau.nom}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {selectedCycle && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15">
                          {selectedCycle.nom}
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {mode === 'inscription' ? '🆕 Inscription' : '🔄 Réinscription'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Items Grid */}
              <div className="p-6 sm:p-8">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {fraisItems.map((item, idx) => {
                    const color = fraisColors[idx % fraisColors.length];
                    return (
                      <motion.div
                        key={item.label}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.08, duration: 0.3 }}
                        className={`group relative rounded-2xl border ${color.light} p-4 hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color.bg} flex items-center justify-center shrink-0 shadow-md group-hover:scale-105 transition-transform`}>
                            <item.icon className={`h-5 w-5 ${color.icon}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-xs font-semibold ${color.text} uppercase tracking-wide`}>{item.sub}</p>
                            <p className="text-sm text-foreground/80 mt-0.5 leading-tight">{item.label}</p>
                            <p className="text-lg font-extrabold mt-1.5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                              {item.value > 0 ? fmt(item.value) : '—'}
                            </p>
                          </div>
                        </div>
                        {item.value > 0 && (
                          <div className="absolute top-3 right-3">
                            <CheckCircle2 className={`h-4 w-4 ${color.text} opacity-40`} />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Remise Banner */}
                {mode === 'reinscription' && remise > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="mt-6 flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shrink-0 shadow-md">
                      <TrendingDown className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-green-800">Remise anciens élèves appliquée</p>
                      <p className="text-xs text-green-600 mt-0.5">Réduction de 15% accordée à nos fidèles élèves</p>
                    </div>
                    <span className="text-lg font-extrabold text-green-700" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      -{fmt(remise)}
                    </span>
                  </motion.div>
                )}

                {/* Total Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/80 text-primary-foreground shadow-xl shadow-primary/20"
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="text-sm font-medium opacity-90">
                        Total estimé • {mode === 'inscription' ? 'Nouvelle inscription' : 'Réinscription'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {isFixe && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20">
                            FORFAIT
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-2xl sm:text-3xl font-black tracking-tight" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                      {fmt(totalFrais)}
                    </span>
                  </div>
                </motion.div>

                <p className="text-[11px] text-muted-foreground mt-4 text-center italic">
                  * Les frais de transport, cantine et uniformes ne sont pas inclus. Contactez l'administration pour plus de détails.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedNiveauId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-14"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-muted/50 flex items-center justify-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground">Sélectionnez un niveau ci-dessus pour consulter les tarifs</p>
        </motion.div>
      )}
    </section>
  );
}
