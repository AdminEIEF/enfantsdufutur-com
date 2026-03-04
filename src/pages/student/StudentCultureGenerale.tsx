import { useState, useCallback } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { GraduationCap, Trophy, RotateCcw, Star, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  category: string;
  emoji: string;
}

type QuizCategory = 'all' | 'sciences' | 'geographie' | 'histoire' | 'animaux' | 'corps_humain';

const QUIZ_CATEGORIES: { key: QuizCategory; label: string; emoji: string }[] = [
  { key: 'all', label: 'Tout', emoji: '🌈' },
  { key: 'sciences', label: 'Sciences', emoji: '🔬' },
  { key: 'geographie', label: 'Géographie', emoji: '🌍' },
  { key: 'histoire', label: 'Histoire', emoji: '📜' },
  { key: 'animaux', label: 'Animaux', emoji: '🦁' },
  { key: 'corps_humain', label: 'Corps humain', emoji: '🫀' },
];

const ALL_QUESTIONS: QuizQuestion[] = [
  // Sciences
  { question: "Quelle planète est la plus proche du Soleil ?", options: ["Vénus", "Mercure", "Mars", "Jupiter"], correctIndex: 1, category: 'sciences', emoji: '🪐' },
  { question: "Quel gaz les plantes produisent-elles ?", options: ["Azote", "CO2", "Oxygène", "Hydrogène"], correctIndex: 2, category: 'sciences', emoji: '🌿' },
  { question: "Combien de planètes y a-t-il dans notre système solaire ?", options: ["7", "8", "9", "10"], correctIndex: 1, category: 'sciences', emoji: '🌌' },
  { question: "L'eau bout à quelle température ?", options: ["90°C", "100°C", "110°C", "80°C"], correctIndex: 1, category: 'sciences', emoji: '💧' },
  { question: "Quel est le métal le plus léger ?", options: ["Fer", "Aluminium", "Lithium", "Cuivre"], correctIndex: 2, category: 'sciences', emoji: '⚗️' },
  { question: "Comment s'appelle le satellite naturel de la Terre ?", options: ["Le Soleil", "La Lune", "Mars", "Vénus"], correctIndex: 1, category: 'sciences', emoji: '🌙' },
  { question: "Qu'est-ce qui fait que le ciel est bleu ?", options: ["L'eau", "Le vent", "La lumière du soleil", "Les nuages"], correctIndex: 2, category: 'sciences', emoji: '☀️' },

  // Géographie
  { question: "Quel est le plus grand continent ?", options: ["Afrique", "Europe", "Asie", "Amérique"], correctIndex: 2, category: 'geographie', emoji: '🗺️' },
  { question: "Quel est le plus long fleuve d'Afrique ?", options: ["Le Congo", "Le Niger", "Le Nil", "Le Zambèze"], correctIndex: 2, category: 'geographie', emoji: '🏞️' },
  { question: "Quelle est la capitale de la Guinée ?", options: ["Dakar", "Conakry", "Bamako", "Abidjan"], correctIndex: 1, category: 'geographie', emoji: '🇬🇳' },
  { question: "Combien y a-t-il de continents ?", options: ["5", "6", "7", "8"], correctIndex: 2, category: 'geographie', emoji: '🌐' },
  { question: "Quel est l'océan le plus grand ?", options: ["Atlantique", "Indien", "Pacifique", "Arctique"], correctIndex: 2, category: 'geographie', emoji: '🌊' },
  { question: "Dans quel pays se trouve la Tour Eiffel ?", options: ["Italie", "Espagne", "Angleterre", "France"], correctIndex: 3, category: 'geographie', emoji: '🗼' },
  { question: "Quel est le plus grand pays d'Afrique ?", options: ["Nigeria", "Algérie", "Congo", "Soudan"], correctIndex: 1, category: 'geographie', emoji: '🌍' },
  { question: "Quel est le désert le plus grand du monde ?", options: ["Gobi", "Kalahari", "Sahara", "Antarctique"], correctIndex: 2, category: 'geographie', emoji: '🏜️' },

  // Histoire
  { question: "Qui a découvert l'Amérique en 1492 ?", options: ["Vasco de Gama", "Christophe Colomb", "Magellan", "Marco Polo"], correctIndex: 1, category: 'histoire', emoji: '⛵' },
  { question: "En quelle année la Guinée est-elle devenue indépendante ?", options: ["1958", "1960", "1962", "1955"], correctIndex: 0, category: 'histoire', emoji: '🇬🇳' },
  { question: "Qui était le premier président de la Guinée ?", options: ["Lansana Conté", "Ahmed Sékou Touré", "Alpha Condé", "Moussa Dadis Camara"], correctIndex: 1, category: 'histoire', emoji: '👤' },
  { question: "Les pyramides ont été construites par quel peuple ?", options: ["Les Romains", "Les Grecs", "Les Égyptiens", "Les Perses"], correctIndex: 2, category: 'histoire', emoji: '🏛️' },
  { question: "Combien de temps a duré la Seconde Guerre mondiale ?", options: ["4 ans", "5 ans", "6 ans", "7 ans"], correctIndex: 2, category: 'histoire', emoji: '📖' },

  // Animaux
  { question: "Quel est le plus grand animal terrestre ?", options: ["La girafe", "L'éléphant", "Le rhinocéros", "L'hippopotame"], correctIndex: 1, category: 'animaux', emoji: '🐘' },
  { question: "Combien de pattes a une araignée ?", options: ["6", "8", "10", "4"], correctIndex: 1, category: 'animaux', emoji: '🕷️' },
  { question: "Quel animal est le plus rapide ?", options: ["Le lion", "Le guépard", "Le lièvre", "L'aigle"], correctIndex: 1, category: 'animaux', emoji: '🐆' },
  { question: "Comment s'appelle le bébé du chat ?", options: ["Un poulain", "Un chiot", "Un chaton", "Un agneau"], correctIndex: 2, category: 'animaux', emoji: '🐱' },
  { question: "Quel animal produit le miel ?", options: ["La guêpe", "Le papillon", "La mouche", "L'abeille"], correctIndex: 3, category: 'animaux', emoji: '🐝' },
  { question: "Quel est le plus grand poisson ?", options: ["La baleine", "Le requin-baleine", "Le dauphin", "Le thon"], correctIndex: 1, category: 'animaux', emoji: '🐋' },
  { question: "Combien de pattes a un insecte ?", options: ["4", "6", "8", "10"], correctIndex: 1, category: 'animaux', emoji: '🦗' },

  // Corps humain
  { question: "Combien d'os a le corps humain adulte ?", options: ["106", "156", "206", "256"], correctIndex: 2, category: 'corps_humain', emoji: '🦴' },
  { question: "Quel organe pompe le sang ?", options: ["Le foie", "Le cerveau", "Le cœur", "Les poumons"], correctIndex: 2, category: 'corps_humain', emoji: '❤️' },
  { question: "Combien de dents a un adulte ?", options: ["28", "30", "32", "36"], correctIndex: 2, category: 'corps_humain', emoji: '🦷' },
  { question: "Quel est le plus grand organe du corps ?", options: ["Le foie", "Le cerveau", "La peau", "Les poumons"], correctIndex: 2, category: 'corps_humain', emoji: '🫁' },
  { question: "Quel sens est associé aux oreilles ?", options: ["La vue", "Le goût", "L'ouïe", "Le toucher"], correctIndex: 2, category: 'corps_humain', emoji: '👂' },
  { question: "De quoi est composé le sang en majorité ?", options: ["Eau", "Fer", "Oxygène", "Calcium"], correctIndex: 0, category: 'corps_humain', emoji: '🩸' },
];

const TOTAL_QUESTIONS = 10;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function StudentCultureGenerale() {
  const [selectedCat, setSelectedCat] = useState<QuizCategory | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameOver, setGameOver] = useState(false);

  const startQuiz = useCallback((cat: QuizCategory) => {
    setSelectedCat(cat);
    const pool = cat === 'all' ? ALL_QUESTIONS : ALL_QUESTIONS.filter(q => q.category === cat);
    const shuffled = shuffle(pool).slice(0, TOTAL_QUESTIONS);
    setQuestions(shuffled);
    setCurrentQ(0);
    setScore(0);
    setSelected(null);
    setShowResult(false);
    setGameOver(false);
  }, []);

  const handleAnswer = (index: number) => {
    if (showResult) return;
    setSelected(index);
    setShowResult(true);
    if (index === questions[currentQ].correctIndex) {
      setScore(s => s + 1);
    }
    setTimeout(() => {
      if (currentQ + 1 >= questions.length) {
        setGameOver(true);
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
        setShowResult(false);
      }
    }, 1500);
  };

  const resetQuiz = () => {
    setSelectedCat(null);
    setGameOver(false);
    setQuestions([]);
  };

  const getStars = () => {
    const pct = score / questions.length;
    if (pct >= 0.9) return 3;
    if (pct >= 0.7) return 2;
    if (pct >= 0.5) return 1;
    return 0;
  };

  const getMessage = () => {
    const pct = score / questions.length;
    if (pct === 1) return 'Incroyable ! Tu sais tout ! 🏆';
    if (pct >= 0.8) return 'Excellent ! Tu es très cultivé(e) ! 🌟';
    if (pct >= 0.6) return 'Bien joué ! Continue d\'apprendre ! 💪';
    if (pct >= 0.4) return 'Pas mal ! Tu vas t\'améliorer ! 📚';
    return 'Continue de lire et d\'apprendre ! 🎯';
  };

  // Menu screen
  if (!selectedCat) {
    return (
      <StudentLayout>
        <div className="space-y-5">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <GraduationCap className="h-6 w-6 text-emerald-600" /> Culture Générale 🧠
          </h2>
          <p className="text-sm text-muted-foreground">Choisis une catégorie pour tester tes connaissances !</p>

          <div className="grid grid-cols-2 gap-3">
            {QUIZ_CATEGORIES.map(cat => (
              <motion.div key={cat.key} whileTap={{ scale: 0.95 }}>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-emerald-300"
                  onClick={() => startQuiz(cat.key)}
                >
                  <CardContent className="py-6 flex flex-col items-center gap-2">
                    <span className="text-4xl">{cat.emoji}</span>
                    <span className="font-bold">{cat.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {cat.key === 'all'
                        ? `${ALL_QUESTIONS.length} questions`
                        : `${ALL_QUESTIONS.filter(q => q.category === cat.key).length} questions`}
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </StudentLayout>
    );
  }

  // Game over screen
  if (gameOver) {
    const stars = getStars();
    return (
      <StudentLayout>
        <div className="space-y-5">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <Card className="border-2 border-emerald-200">
              <CardContent className="py-8 flex flex-col items-center gap-4">
                <Trophy className="h-16 w-16 text-yellow-500" />
                <h2 className="text-2xl font-bold">Résultat</h2>
                <div className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <Star
                      key={i}
                      className={`h-10 w-10 ${i <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted-foreground/30'}`}
                    />
                  ))}
                </div>
                <p className="text-4xl font-bold text-emerald-600">{score}/{questions.length}</p>
                <p className="text-center text-muted-foreground">{getMessage()}</p>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={resetQuiz}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Menu
                  </Button>
                  <Button onClick={() => startQuiz(selectedCat!)} className="bg-emerald-600 hover:bg-emerald-700">
                    <ChevronRight className="h-4 w-4 mr-2" /> Rejouer
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </StudentLayout>
    );
  }

  // Question screen
  const q = questions[currentQ];
  if (!q) return null;

  return (
    <StudentLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={resetQuiz}>← Menu</Button>
          <Badge variant="outline">{score} ✓</Badge>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Question {currentQ + 1}/{questions.length}</span>
            <span>{q.emoji} {QUIZ_CATEGORIES.find(c => c.key === q.category)?.label || ''}</span>
          </div>
          <Progress value={((currentQ + 1) / questions.length) * 100} className="h-2" />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-2 border-emerald-200">
              <CardContent className="py-8 flex flex-col items-center gap-5">
                <span className="text-4xl">{q.emoji}</span>
                <p className="text-lg font-bold text-center" style={{ fontFamily: 'Nunito, sans-serif' }}>
                  {q.question}
                </p>
                <div className="grid gap-2 w-full max-w-sm">
                  {q.options.map((opt, i) => {
                    let extraClass = 'text-left font-medium py-4 px-4 justify-start';

                    if (showResult) {
                      if (i === q.correctIndex) {
                        extraClass += ' bg-green-500 text-white border-green-500';
                      } else if (i === selected) {
                        extraClass += ' bg-red-500 text-white border-red-500';
                      } else {
                        extraClass += ' opacity-50';
                      }
                    } else {
                      extraClass += ' hover:border-emerald-400';
                    }

                    return (
                      <motion.div key={i} whileTap={{ scale: 0.97 }}>
                        <Button
                          variant="outline"
                          className={`w-full ${extraClass}`}
                          onClick={() => handleAnswer(i)}
                          disabled={showResult}
                        >
                          <span className="font-bold mr-3 text-muted-foreground">{String.fromCharCode(65 + i)}.</span>
                          {opt}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
                {showResult && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                    {selected === q.correctIndex ? (
                      <><CheckCircle2 className="h-6 w-6 text-green-500" /><span className="font-bold text-green-600">Bonne réponse !</span></>
                    ) : (
                      <><XCircle className="h-6 w-6 text-red-500" /><span className="font-bold text-red-600">C'était : {q.options[q.correctIndex]}</span></>
                    )}
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </StudentLayout>
  );
}
