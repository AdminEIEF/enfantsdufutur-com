import { useState, useCallback, useEffect } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calculator, Trophy, RotateCcw, Star, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Operation = '+' | '-' | '×' | '÷';
type Difficulty = 'facile' | 'moyen' | 'difficile';

interface Question {
  a: number;
  b: number;
  op: Operation;
  answer: number;
  options: number[];
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; emoji: string; color: string; range: [number, number] }> = {
  facile: { label: 'Facile', emoji: '🌱', color: 'bg-green-500', range: [1, 10] },
  moyen: { label: 'Moyen', emoji: '🔥', color: 'bg-orange-500', range: [5, 25] },
  difficile: { label: 'Difficile', emoji: '🚀', color: 'bg-red-500', range: [10, 50] },
};

const OPERATIONS: { key: Operation; label: string; emoji: string }[] = [
  { key: '+', label: 'Addition', emoji: '➕' },
  { key: '-', label: 'Soustraction', emoji: '➖' },
  { key: '×', label: 'Multiplication', emoji: '✖️' },
  { key: '÷', label: 'Division', emoji: '➗' },
];

const TOTAL_QUESTIONS = 10;

function generateQuestion(op: Operation, difficulty: Difficulty): Question {
  const [min, max] = DIFFICULTY_CONFIG[difficulty].range;
  let a: number, b: number, answer: number;

  switch (op) {
    case '+':
      a = Math.floor(Math.random() * (max - min + 1)) + min;
      b = Math.floor(Math.random() * (max - min + 1)) + min;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * (max - min + 1)) + min;
      b = Math.floor(Math.random() * a) + 1;
      answer = a - b;
      break;
    case '×':
      const mMax = difficulty === 'facile' ? 5 : difficulty === 'moyen' ? 10 : 12;
      a = Math.floor(Math.random() * mMax) + 1;
      b = Math.floor(Math.random() * mMax) + 1;
      answer = a * b;
      break;
    case '÷':
      b = Math.floor(Math.random() * (difficulty === 'facile' ? 5 : 10)) + 2;
      answer = Math.floor(Math.random() * (difficulty === 'facile' ? 5 : 10)) + 1;
      a = b * answer;
      break;
    default:
      a = 1; b = 1; answer = 2;
  }

  // Generate wrong options
  const wrongAnswers = new Set<number>();
  while (wrongAnswers.size < 3) {
    const offset = Math.floor(Math.random() * 10) - 5;
    const wrong = answer + (offset === 0 ? 1 : offset);
    if (wrong !== answer && wrong >= 0) wrongAnswers.add(wrong);
  }

  const options = [...wrongAnswers, answer].sort(() => Math.random() - 0.5);
  return { a, b, op, answer, options };
}

export default function StudentCalculMental() {
  const [selectedOp, setSelectedOp] = useState<Operation | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('facile');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const startGame = useCallback((op: Operation) => {
    setSelectedOp(op);
    const qs = Array.from({ length: TOTAL_QUESTIONS }, () => generateQuestion(op, difficulty));
    setQuestions(qs);
    setCurrentQ(0);
    setScore(0);
    setSelected(null);
    setShowResult(false);
    setGameOver(false);
    setStreak(0);
  }, [difficulty]);

  const handleAnswer = (value: number) => {
    if (showResult) return;
    setSelected(value);
    setShowResult(true);
    const correct = value === questions[currentQ].answer;
    if (correct) {
      setScore(s => s + 1);
      setStreak(s => {
        const newS = s + 1;
        if (newS > bestStreak) setBestStreak(newS);
        return newS;
      });
    } else {
      setStreak(0);
    }

    setTimeout(() => {
      if (currentQ + 1 >= TOTAL_QUESTIONS) {
        setGameOver(true);
      } else {
        setCurrentQ(q => q + 1);
        setSelected(null);
        setShowResult(false);
      }
    }, 1200);
  };

  const resetGame = () => {
    setSelectedOp(null);
    setGameOver(false);
    setQuestions([]);
    setCurrentQ(0);
    setScore(0);
  };

  const getStars = () => {
    if (score >= 9) return 3;
    if (score >= 7) return 2;
    if (score >= 5) return 1;
    return 0;
  };

  const getMessage = () => {
    if (score === TOTAL_QUESTIONS) return 'Parfait ! Tu es un champion ! 🏆';
    if (score >= 8) return 'Excellent travail ! 🌟';
    if (score >= 6) return 'Bien joué ! Continue ! 💪';
    if (score >= 4) return 'Pas mal, tu peux t\'améliorer ! 📚';
    return 'Continue de t\'entraîner ! 🎯';
  };

  // Menu screen
  if (!selectedOp) {
    return (
      <StudentLayout>
        <div className="space-y-5">
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: 'Nunito, sans-serif' }}>
            <Calculator className="h-6 w-6 text-purple-600" /> Calcul Mental 🧮
          </h2>

          {/* Difficulty selector */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Choisis ton niveau :</p>
            <div className="flex gap-2">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map(d => (
                <Button
                  key={d}
                  variant={difficulty === d ? 'default' : 'outline'}
                  size="sm"
                  className={difficulty === d ? DIFFICULTY_CONFIG[d].color + ' text-white' : ''}
                  onClick={() => setDifficulty(d)}
                >
                  {DIFFICULTY_CONFIG[d].emoji} {DIFFICULTY_CONFIG[d].label}
                </Button>
              ))}
            </div>
          </div>

          {/* Operation selector */}
          <div className="grid grid-cols-2 gap-3">
            {OPERATIONS.map(op => (
              <motion.div key={op.key} whileTap={{ scale: 0.95 }}>
                <Card
                  className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-purple-300"
                  onClick={() => startGame(op.key)}
                >
                  <CardContent className="py-6 flex flex-col items-center gap-2">
                    <span className="text-4xl">{op.emoji}</span>
                    <span className="font-bold text-lg">{op.label}</span>
                    <Badge variant="outline" className="text-xs">{TOTAL_QUESTIONS} questions</Badge>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {bestStreak > 0 && (
            <div className="text-center text-sm text-muted-foreground">
              🔥 Meilleure série : <span className="font-bold text-orange-600">{bestStreak}</span> réponses correctes d'affilée
            </div>
          )}
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
            <Card className="border-2 border-purple-200">
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
                <p className="text-4xl font-bold text-purple-600">{score}/{TOTAL_QUESTIONS}</p>
                <p className="text-center text-muted-foreground">{getMessage()}</p>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={resetGame}>
                    <RotateCcw className="h-4 w-4 mr-2" /> Menu
                  </Button>
                  <Button onClick={() => startGame(selectedOp!)} className="bg-purple-600 hover:bg-purple-700">
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
  return (
    <StudentLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={resetGame}>← Menu</Button>
          <div className="flex items-center gap-2">
            {streak >= 3 && <Badge className="bg-orange-500 text-white">🔥 {streak}</Badge>}
            <Badge variant="outline">{score} ✓</Badge>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Question {currentQ + 1}/{TOTAL_QUESTIONS}</span>
            <span>{DIFFICULTY_CONFIG[difficulty].emoji} {DIFFICULTY_CONFIG[difficulty].label}</span>
          </div>
          <Progress value={((currentQ + 1) / TOTAL_QUESTIONS) * 100} className="h-2" />
        </div>

        {/* Question */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ}
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -50, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="border-2 border-purple-200">
              <CardContent className="py-10 flex flex-col items-center gap-6">
                <p className="text-5xl font-bold tracking-wider" style={{ fontFamily: 'Nunito, sans-serif' }}>
                  {q.a} {q.op} {q.b} = ?
                </p>
                <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                  {q.options.map((opt, i) => {
                    let variant: 'outline' | 'default' | 'destructive' = 'outline';
                    let extraClass = 'text-lg font-bold py-6 hover:border-purple-400';

                    if (showResult) {
                      if (opt === q.answer) {
                        extraClass = 'text-lg font-bold py-6 bg-green-500 text-white border-green-500';
                      } else if (opt === selected) {
                        extraClass = 'text-lg font-bold py-6 bg-red-500 text-white border-red-500';
                      } else {
                        extraClass = 'text-lg font-bold py-6 opacity-50';
                      }
                    }

                    return (
                      <motion.div key={i} whileTap={{ scale: 0.9 }}>
                        <Button
                          variant={variant}
                          className={`w-full ${extraClass}`}
                          onClick={() => handleAnswer(opt)}
                          disabled={showResult}
                        >
                          {opt}
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
                {showResult && (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                    {selected === q.answer ? (
                      <><CheckCircle2 className="h-6 w-6 text-green-500" /><span className="font-bold text-green-600">Bravo !</span></>
                    ) : (
                      <><XCircle className="h-6 w-6 text-red-500" /><span className="font-bold text-red-600">La réponse était {q.answer}</span></>
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
