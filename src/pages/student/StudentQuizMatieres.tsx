import { useState, useEffect, useCallback } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useStudentAuth } from '@/hooks/useStudentAuth';
import { Trophy, RotateCcw, Star, CheckCircle2, XCircle, Loader2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  matiere: string;
}

const TOTAL_QUESTIONS = 10;

// Banque de questions par famille de matière
const QUESTION_BANKS: Record<string, QuizQuestion[]> = {
  mathematiques: [
    { question: "Quel est le résultat de 15 × 12 ?", options: ["160", "170", "180", "190"], correctIndex: 2, matiere: "Mathématiques" },
    { question: "Combien de côtés a un hexagone ?", options: ["5", "6", "7", "8"], correctIndex: 1, matiere: "Mathématiques" },
    { question: "Quel est le PGCD de 12 et 18 ?", options: ["3", "6", "9", "12"], correctIndex: 1, matiere: "Mathématiques" },
    { question: "Combien vaut π approximativement ?", options: ["2.14", "3.14", "4.14", "3.41"], correctIndex: 1, matiere: "Mathématiques" },
    { question: "Quel est le carré de 13 ?", options: ["156", "169", "143", "196"], correctIndex: 1, matiere: "Mathématiques" },
    { question: "Quelle est la racine carrée de 144 ?", options: ["10", "11", "12", "14"], correctIndex: 2, matiere: "Mathématiques" },
    { question: "Combien de degrés dans un triangle ?", options: ["90°", "180°", "270°", "360°"], correctIndex: 1, matiere: "Mathématiques" },
    { question: "Que vaut 2⁵ ?", options: ["16", "25", "32", "64"], correctIndex: 2, matiere: "Mathématiques" },
  ],
  francais: [
    { question: "Quel est le pluriel de 'cheval' ?", options: ["Chevals", "Chevaux", "Chevales", "Chevauxs"], correctIndex: 1, matiere: "Français" },
    { question: "Le mot 'beau' est un :", options: ["Nom", "Verbe", "Adjectif", "Adverbe"], correctIndex: 2, matiere: "Français" },
    { question: "Quel est le contraire de 'modeste' ?", options: ["Humble", "Orgueilleux", "Simple", "Discret"], correctIndex: 1, matiere: "Français" },
    { question: "Combien de temps y a-t-il dans la conjugaison française ?", options: ["4", "6", "8", "10"], correctIndex: 2, matiere: "Français" },
    { question: "Quel est le féminin de 'acteur' ?", options: ["Acteure", "Actresse", "Actrice", "Acteuse"], correctIndex: 2, matiere: "Français" },
    { question: "'Courir' est un verbe du :", options: ["1er groupe", "2ème groupe", "3ème groupe", "4ème groupe"], correctIndex: 2, matiere: "Français" },
    { question: "Quel est le synonyme de 'rapide' ?", options: ["Lent", "Véloce", "Lourd", "Calme"], correctIndex: 1, matiere: "Français" },
    { question: "Quelle figure de style : 'La mer était un miroir' ?", options: ["Comparaison", "Métaphore", "Hyperbole", "Litote"], correctIndex: 1, matiere: "Français" },
  ],
  sciences: [
    { question: "Quel organe pompe le sang ?", options: ["Le foie", "Le cœur", "Le rein", "Le poumon"], correctIndex: 1, matiere: "Sciences" },
    { question: "De quoi est composé l'eau ?", options: ["H2O", "CO2", "NaCl", "O2"], correctIndex: 0, matiere: "Sciences" },
    { question: "Quel gaz respirons-nous principalement ?", options: ["CO2", "Azote", "Oxygène", "Hélium"], correctIndex: 2, matiere: "Sciences" },
    { question: "Combien d'os a le corps humain adulte ?", options: ["106", "156", "206", "256"], correctIndex: 2, matiere: "Sciences" },
    { question: "Quel est l'organe le plus grand du corps ?", options: ["Le foie", "Le cerveau", "La peau", "L'intestin"], correctIndex: 2, matiere: "Sciences" },
    { question: "Quelle est la planète la plus chaude ?", options: ["Mercure", "Vénus", "Mars", "Jupiter"], correctIndex: 1, matiere: "Sciences" },
  ],
  histoire: [
    { question: "En quelle année la Guinée est devenue indépendante ?", options: ["1956", "1958", "1960", "1962"], correctIndex: 1, matiere: "Histoire" },
    { question: "Qui était le premier président de la Guinée ?", options: ["Lansana Conté", "Sékou Touré", "Alpha Condé", "Dadis Camara"], correctIndex: 1, matiere: "Histoire" },
    { question: "Quand a eu lieu la Révolution française ?", options: ["1689", "1789", "1889", "1799"], correctIndex: 1, matiere: "Histoire" },
    { question: "Qui a dit 'Non' au référendum de 1958 ?", options: ["Senghor", "Sékou Touré", "Houphouët", "Modibo Keita"], correctIndex: 1, matiere: "Histoire" },
    { question: "En quelle année a débuté la 2nde Guerre mondiale ?", options: ["1935", "1937", "1939", "1941"], correctIndex: 2, matiere: "Histoire" },
    { question: "L'Empire du Mali a été fondé par :", options: ["Samory Touré", "Soundjata Keita", "Kankan Moussa", "Askia Mohamed"], correctIndex: 1, matiere: "Histoire" },
  ],
  geographie: [
    { question: "Quelle est la capitale de la Guinée ?", options: ["Kankan", "Conakry", "Labé", "Nzérékoré"], correctIndex: 1, matiere: "Géographie" },
    { question: "Combien de régions naturelles a la Guinée ?", options: ["3", "4", "5", "6"], correctIndex: 1, matiere: "Géographie" },
    { question: "Quel fleuve traverse Kankan ?", options: ["Niger", "Milo", "Konkouré", "Gambie"], correctIndex: 1, matiere: "Géographie" },
    { question: "Quel est le plus grand continent ?", options: ["Afrique", "Europe", "Asie", "Amérique"], correctIndex: 2, matiere: "Géographie" },
    { question: "Le Mont Nimba se trouve en :", options: ["Basse Guinée", "Moyenne Guinée", "Haute Guinée", "Guinée Forestière"], correctIndex: 3, matiere: "Géographie" },
    { question: "Quel océan borde la Guinée ?", options: ["Indien", "Pacifique", "Atlantique", "Arctique"], correctIndex: 2, matiere: "Géographie" },
  ],
  physique: [
    { question: "Quelle est l'unité de la force ?", options: ["Watt", "Joule", "Newton", "Pascal"], correctIndex: 2, matiere: "Physique" },
    { question: "La vitesse de la lumière est d'environ :", options: ["300 km/s", "3 000 km/s", "30 000 km/s", "300 000 km/s"], correctIndex: 3, matiere: "Physique" },
    { question: "Quelle est l'unité de la tension électrique ?", options: ["Ampère", "Volt", "Ohm", "Watt"], correctIndex: 1, matiere: "Physique" },
    { question: "L'eau bout à quelle température ?", options: ["90°C", "100°C", "110°C", "120°C"], correctIndex: 1, matiere: "Physique" },
    { question: "Quelle loi dit F = m × a ?", options: ["1ère loi de Newton", "2ème loi de Newton", "Loi d'Ohm", "Loi de Coulomb"], correctIndex: 1, matiere: "Physique" },
  ],
  chimie: [
    { question: "Quel est le symbole chimique de l'or ?", options: ["Ag", "Au", "Fe", "Cu"], correctIndex: 1, matiere: "Chimie" },
    { question: "Combien d'éléments dans le tableau périodique ?", options: ["98", "108", "118", "128"], correctIndex: 2, matiere: "Chimie" },
    { question: "Quel gaz est nécessaire à la combustion ?", options: ["Azote", "Hydrogène", "Oxygène", "CO2"], correctIndex: 2, matiere: "Chimie" },
    { question: "Le pH de l'eau pure est :", options: ["5", "7", "9", "14"], correctIndex: 1, matiere: "Chimie" },
    { question: "Quel est le symbole du fer ?", options: ["Fr", "Fe", "Fi", "Fa"], correctIndex: 1, matiere: "Chimie" },
  ],
  anglais: [
    { question: "What is the past tense of 'go'?", options: ["Goed", "Gone", "Went", "Going"], correctIndex: 2, matiere: "Anglais" },
    { question: "'She ___ to school every day.' ", options: ["go", "goes", "going", "gone"], correctIndex: 1, matiere: "Anglais" },
    { question: "What is the plural of 'child'?", options: ["Childs", "Children", "Childes", "Childrens"], correctIndex: 1, matiere: "Anglais" },
    { question: "What does 'beautiful' mean?", options: ["Laid", "Beau/Belle", "Grand", "Petit"], correctIndex: 1, matiere: "Anglais" },
    { question: "'I ___ a student.' — correct verb?", options: ["is", "are", "am", "be"], correctIndex: 2, matiere: "Anglais" },
  ],
  arabe: [
    { question: "Comment dit-on 'Bonjour' en arabe ?", options: ["Shukran", "Marhaba", "Ma'a salama", "Afwan"], correctIndex: 1, matiere: "Arabe" },
    { question: "Combien de lettres dans l'alphabet arabe ?", options: ["24", "26", "28", "30"], correctIndex: 2, matiere: "Arabe" },
    { question: "Quel est le sens d'écriture en arabe ?", options: ["Gauche à droite", "Droite à gauche", "Haut en bas", "Bas en haut"], correctIndex: 1, matiere: "Arabe" },
    { question: "Comment dit-on 'Merci' en arabe ?", options: ["Marhaba", "Afwan", "Shukran", "Salam"], correctIndex: 2, matiere: "Arabe" },
  ],
  education_civique: [
    { question: "Quelle est la devise de la Guinée ?", options: ["Liberté, Égalité, Fraternité", "Travail, Justice, Solidarité", "Unité, Progrès, Justice", "Paix, Travail, Patrie"], correctIndex: 1, matiere: "Éducation Civique" },
    { question: "Quelles sont les couleurs du drapeau guinéen ?", options: ["Vert-Jaune-Bleu", "Rouge-Jaune-Vert", "Blanc-Bleu-Rouge", "Vert-Blanc-Orange"], correctIndex: 1, matiere: "Éducation Civique" },
    { question: "Quel document garantit les droits fondamentaux ?", options: ["Le Code civil", "La Constitution", "Le Journal officiel", "Le règlement intérieur"], correctIndex: 1, matiere: "Éducation Civique" },
    { question: "À quel âge vote-t-on en Guinée ?", options: ["16 ans", "18 ans", "20 ans", "21 ans"], correctIndex: 1, matiere: "Éducation Civique" },
  ],
};

// Map matière names to question bank keys
function getQuestionBankKey(matiereName: string): string | null {
  const lower = matiereName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (lower.includes('math')) return 'mathematiques';
  if (lower.includes('francais') || lower.includes('français') || lower.includes('lecture') || lower.includes('grammaire') || lower.includes('dictee') || lower.includes('redaction') || lower.includes('expression')) return 'francais';
  if (lower.includes('science') || lower.includes('svt') || lower.includes('biologie')) return 'sciences';
  if (lower.includes('histoire')) return 'histoire';
  if (lower.includes('geo')) return 'geographie';
  if (lower.includes('physique') || lower.includes('pct')) return 'physique';
  if (lower.includes('chimie')) return 'chimie';
  if (lower.includes('anglais') || lower.includes('english')) return 'anglais';
  if (lower.includes('arabe')) return 'arabe';
  if (lower.includes('civique') || lower.includes('edhc') || lower.includes('ecm')) return 'education_civique';
  return null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudentQuizMatieres() {
  const { session } = useStudentAuth();
  const [matieres, setMatieres] = useState<{ id: string; nom: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMatiere, setSelectedMatiere] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/student-data`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ token: session.token, action: 'cours' }),
          }
        );
        const data = await resp.json();
        const cms = data.classe_matieres || [];
        const matList: { id: string; nom: string }[] = cms
          .map((cm: any) => cm.matieres)
          .filter((m: any) => m && getQuestionBankKey(m.nom));
        // Deduplicate
        const unique = Array.from(new Map(matList.map((m: any) => [m.id, m])).values());
        setMatieres(unique);
      } catch {
        toast.error('Erreur de chargement');
      } finally {
        setLoading(false);
      }
    })();
  }, [session]);

  const startQuiz = useCallback((matiereName: string) => {
    const key = getQuestionBankKey(matiereName);
    if (!key || !QUESTION_BANKS[key]) return;
    const pool = shuffle(QUESTION_BANKS[key]);
    setQuestions(pool.slice(0, Math.min(TOTAL_QUESTIONS, pool.length)));
    setSelectedMatiere(matiereName);
    setCurrentQ(0);
    setScore(0);
    setAnswered(null);
    setFinished(false);
  }, []);

  const handleAnswer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
    if (idx === questions[currentQ].correctIndex) setScore(s => s + 1);
    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        setFinished(true);
      } else {
        setCurrentQ(q => q + 1);
        setAnswered(null);
      }
    }, 1200);
  };

  const MATIERE_COLORS = [
    { bg: 'from-blue-500 to-blue-600', light: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-600' },
    { bg: 'from-emerald-500 to-emerald-600', light: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600' },
    { bg: 'from-violet-500 to-violet-600', light: 'bg-violet-50 dark:bg-violet-950/30', text: 'text-violet-600' },
    { bg: 'from-amber-500 to-amber-600', light: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-600' },
    { bg: 'from-rose-500 to-rose-600', light: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-600' },
    { bg: 'from-cyan-500 to-cyan-600', light: 'bg-cyan-50 dark:bg-cyan-950/30', text: 'text-cyan-600' },
    { bg: 'from-orange-500 to-orange-600', light: 'bg-orange-50 dark:bg-orange-950/30', text: 'text-orange-600' },
    { bg: 'from-pink-500 to-pink-600', light: 'bg-pink-50 dark:bg-pink-950/30', text: 'text-pink-600' },
    { bg: 'from-teal-500 to-teal-600', light: 'bg-teal-50 dark:bg-teal-950/30', text: 'text-teal-600' },
    { bg: 'from-indigo-500 to-indigo-600', light: 'bg-indigo-50 dark:bg-indigo-950/30', text: 'text-indigo-600' },
  ];

  const MATIERE_EMOJIS: Record<string, string> = {
    mathematiques: '🔢', francais: '📖', sciences: '🔬', histoire: '📜',
    geographie: '🌍', physique: '⚡', chimie: '🧪', anglais: '🇬🇧',
    arabe: '🕌', education_civique: '🏛️',
  };

  if (!selectedMatiere) {
    return (
      <StudentLayout>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Quiz Matières</h2>
              <p className="text-xs text-muted-foreground">Teste tes connaissances par matière</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : matieres.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Aucune matière avec quiz disponible
              </CardContent>
            </Card>
          ) : (() => {
            // Group matieres into pages of 6 (2x3)
            const pages: typeof matieres[] = [];
            for (let i = 0; i < matieres.length; i += 6) {
              pages.push(matieres.slice(i, i + 6));
            }
            return (
              <div className="space-y-3">
                <div className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-3 -mx-2 px-2 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
                  {pages.map((page, pageIdx) => (
                    <div key={pageIdx} className="snap-center shrink-0 w-full">
                      <div className="grid grid-cols-3 grid-rows-2 gap-2.5">
                        {page.map((m, i) => {
                          const globalIdx = pageIdx * 6 + i;
                          const color = MATIERE_COLORS[globalIdx % MATIERE_COLORS.length];
                          const key = getQuestionBankKey(m.nom);
                          const emoji = key ? MATIERE_EMOJIS[key] || '📚' : '📚';
                          return (
                            <motion.div
                              key={m.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: i * 0.05, type: 'spring', damping: 20 }}
                            >
                              <Card
                                className="cursor-pointer overflow-hidden border-0 shadow-md hover:shadow-xl transition-all active:scale-[0.95]"
                                onClick={() => startQuiz(m.nom)}
                              >
                                <div className={`h-1.5 bg-gradient-to-r ${color.bg}`} />
                                <CardContent className="p-3 flex flex-col items-center gap-1.5">
                                  <motion.span
                                    className="text-2xl"
                                    whileHover={{ scale: 1.2, rotate: 10 }}
                                    transition={{ type: 'spring', stiffness: 300 }}
                                  >
                                    {emoji}
                                  </motion.span>
                                  <p className="text-xs font-semibold text-center leading-tight line-clamp-2">{m.nom}</p>
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                                    {QUESTION_BANKS[key!]?.length || 0} Q
                                  </Badge>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                {pages.length > 1 && (
                  <div className="flex justify-center gap-1.5">
                    {pages.map((_, idx) => (
                      <div key={idx} className="w-2 h-2 rounded-full bg-primary/30" />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </StudentLayout>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    const stars = pct >= 90 ? 3 : pct >= 60 ? 2 : pct >= 40 ? 1 : 0;
    return (
      <StudentLayout>
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto">
          <Card className="overflow-hidden border-0 shadow-xl">
            <div className="bg-gradient-to-br from-primary via-primary/80 to-accent p-6 text-center text-white">
              <Trophy className="h-12 w-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">Quiz terminé !</h2>
              <p className="text-sm opacity-80">{selectedMatiere}</p>
            </div>
            <CardContent className="p-6 space-y-4 text-center">
              <div className="flex justify-center gap-1">
                {[1, 2, 3].map(s => (
                  <Star key={s} className={`h-8 w-8 ${s <= stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/20'}`} />
                ))}
              </div>
              <p className="text-3xl font-extrabold">{score}/{questions.length}</p>
              <p className="text-sm text-muted-foreground">{pct}% de bonnes réponses</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => startQuiz(selectedMatiere)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Rejouer
                </Button>
                <Button className="flex-1" onClick={() => { setSelectedMatiere(null); setQuestions([]); }}>
                  Autres matières
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </StudentLayout>
    );
  }

  const q = questions[currentQ];
  const progress = ((currentQ + (answered !== null ? 1 : 0)) / questions.length) * 100;

  return (
    <StudentLayout>
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedMatiere(null); setQuestions([]); }}>
            ← Retour
          </Button>
          <Badge variant="outline">{selectedMatiere}</Badge>
          <span className="text-sm font-bold">{currentQ + 1}/{questions.length}</span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground font-medium">
            <span>Progression</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
            />
          </div>
          <div className="flex gap-[2px]">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < currentQ ? 'bg-emerald-500' : i === currentQ && answered !== null ? 'bg-emerald-500' : i === currentQ ? 'bg-primary animate-pulse' : 'bg-muted'
                }`}
              />
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ type: 'spring', damping: 20 }}
          >
            <Card className="border-0 shadow-lg">
              <CardContent className="p-5 space-y-4">
                <p className="text-base font-semibold leading-relaxed">{q.question}</p>
                <div className="grid gap-2">
                  {q.options.map((opt, idx) => {
                    let variant = 'outline' as const;
                    let extraClass = 'hover:bg-muted/60 active:scale-[0.98] transition-all';
                    if (answered !== null) {
                      if (idx === q.correctIndex) extraClass = 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-950/30';
                      else if (idx === answered) extraClass = 'bg-red-50 border-red-500 text-red-700 dark:bg-red-950/30';
                      else extraClass = 'opacity-50';
                    }
                    return (
                      <motion.div key={idx} whileTap={{ scale: answered === null ? 0.97 : 1 }}>
                        <Button
                          variant={variant}
                          className={`w-full justify-start text-left h-auto py-3 px-4 text-sm ${extraClass}`}
                          onClick={() => handleAnswer(idx)}
                          disabled={answered !== null}
                        >
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold mr-3 shrink-0">
                            {String.fromCharCode(65 + idx)}
                          </span>
                          <span className="flex-1">{opt}</span>
                          {answered !== null && idx === q.correctIndex && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
                          {answered !== null && idx === answered && idx !== q.correctIndex && <XCircle className="h-4 w-4 text-red-600 shrink-0" />}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        <div className="text-center">
          <Badge variant="secondary" className="text-xs">
            Score : {score}/{currentQ + (answered !== null ? 1 : 0)}
          </Badge>
        </div>
      </div>
    </StudentLayout>
  );
}
