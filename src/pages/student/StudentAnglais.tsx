import { useState, useCallback, useEffect, useRef } from 'react';
import { StudentLayout } from '@/components/StudentLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Trophy, Star, Heart, RotateCcw, Volume2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ───
interface ExerciseBase { id: number; }
interface TranslateExercise extends ExerciseBase {
  type: 'translate';
  emoji: string;
  word_en: string;
  options: string[];
  correct: string;
}
interface MatchExercise extends ExerciseBase {
  type: 'match';
  instruction: string;
  pairs: { en: string; fr: string }[];
}
interface FillExercise extends ExerciseBase {
  type: 'fill';
  sentence: string;
  blank: string;
  options: string[];
  correct: string;
}
interface ListenExercise extends ExerciseBase {
  type: 'listen';
  emoji: string;
  word_en: string;
  options: string[];
  correct: string;
}
interface ImageExercise extends ExerciseBase {
  type: 'image';
  instruction: string;
  word_en: string;
  emojis: { emoji: string; label: string }[];
  correct: string;
}
interface OrderExercise extends ExerciseBase {
  type: 'order';
  instruction: string;
  words: string[];
  correct: string[];
}

type Exercise = TranslateExercise | MatchExercise | FillExercise | ListenExercise | ImageExercise | OrderExercise;

// ─── Lessons Data ───
interface Lesson {
  id: number;
  title: string;
  emoji: string;
  color: string;
  exercises: Exercise[];
}

const LESSONS: Lesson[] = [
  {
    id: 1, title: 'Les animaux', emoji: '🐶', color: '#38a169',
    exercises: [
      { id: 1, type: 'translate', emoji: '🐱', word_en: 'Cat', options: ['Chien', 'Chat', 'Oiseau', 'Poisson'], correct: 'Chat' },
      { id: 2, type: 'image', instruction: 'Quel est le "Dog" ?', word_en: 'Dog', emojis: [{ emoji: '🐱', label: 'Cat' }, { emoji: '🐶', label: 'Dog' }, { emoji: '🐦', label: 'Bird' }, { emoji: '🐟', label: 'Fish' }], correct: 'Dog' },
      { id: 3, type: 'translate', emoji: '🐦', word_en: 'Bird', options: ['Oiseau', 'Chien', 'Souris', 'Cheval'], correct: 'Oiseau' },
      { id: 4, type: 'fill', sentence: 'The ___ swims in the water.', blank: '___', options: ['Cat', 'Fish', 'Dog', 'Bird'], correct: 'Fish' },
      { id: 5, type: 'listen', emoji: '🐴', word_en: 'Horse', options: ['Horse', 'House', 'Hose', 'Hope'], correct: 'Horse' },
      { id: 6, type: 'order', instruction: 'Remets les mots en ordre :', words: ['cat', 'is', 'The', 'small'], correct: ['The', 'cat', 'is', 'small'] },
      { id: 7, type: 'translate', emoji: '🐟', word_en: 'Fish', options: ['Vache', 'Poisson', 'Lapin', 'Canard'], correct: 'Poisson' },
      { id: 8, type: 'image', instruction: 'Trouve le "Bird"', word_en: 'Bird', emojis: [{ emoji: '🐟', label: 'Fish' }, { emoji: '🐦', label: 'Bird' }, { emoji: '🐶', label: 'Dog' }, { emoji: '🐴', label: 'Horse' }], correct: 'Bird' },
    ],
  },
  {
    id: 2, title: 'Les couleurs', emoji: '🌈', color: '#3182ce',
    exercises: [
      { id: 1, type: 'translate', emoji: '🔴', word_en: 'Red', options: ['Bleu', 'Rouge', 'Vert', 'Jaune'], correct: 'Rouge' },
      { id: 2, type: 'translate', emoji: '🔵', word_en: 'Blue', options: ['Rouge', 'Noir', 'Bleu', 'Blanc'], correct: 'Bleu' },
      { id: 3, type: 'image', instruction: 'Quel est "Green" ?', word_en: 'Green', emojis: [{ emoji: '🔴', label: 'Red' }, { emoji: '🟢', label: 'Green' }, { emoji: '🔵', label: 'Blue' }, { emoji: '🟡', label: 'Yellow' }], correct: 'Green' },
      { id: 4, type: 'fill', sentence: 'The sun is ___.', blank: '___', options: ['Blue', 'Yellow', 'Green', 'Red'], correct: 'Yellow' },
      { id: 5, type: 'translate', emoji: '⚫', word_en: 'Black', options: ['Blanc', 'Noir', 'Gris', 'Rose'], correct: 'Noir' },
      { id: 6, type: 'order', instruction: 'Remets en ordre :', words: ['is', 'The', 'red', 'apple'], correct: ['The', 'apple', 'is', 'red'] },
      { id: 7, type: 'listen', emoji: '⚪', word_en: 'White', options: ['White', 'Wheat', 'Wait', 'Wide'], correct: 'White' },
      { id: 8, type: 'translate', emoji: '🟢', word_en: 'Green', options: ['Vert', 'Bleu', 'Orange', 'Violet'], correct: 'Vert' },
    ],
  },
  {
    id: 3, title: 'Les fruits', emoji: '🍎', color: '#e53e3e',
    exercises: [
      { id: 1, type: 'translate', emoji: '🍎', word_en: 'Apple', options: ['Banane', 'Pomme', 'Orange', 'Fraise'], correct: 'Pomme' },
      { id: 2, type: 'image', instruction: 'Trouve le "Banana"', word_en: 'Banana', emojis: [{ emoji: '🍎', label: 'Apple' }, { emoji: '🍌', label: 'Banana' }, { emoji: '🍇', label: 'Grapes' }, { emoji: '🍊', label: 'Orange' }], correct: 'Banana' },
      { id: 3, type: 'translate', emoji: '🍊', word_en: 'Orange', options: ['Citron', 'Mangue', 'Orange', 'Cerise'], correct: 'Orange' },
      { id: 4, type: 'fill', sentence: 'I like to eat a ___.', blank: '___', options: ['Banana', 'Table', 'Chair', 'Book'], correct: 'Banana' },
      { id: 5, type: 'order', instruction: 'Remets en ordre :', words: ['eat', 'apples', 'I', 'red'], correct: ['I', 'eat', 'red', 'apples'] },
      { id: 6, type: 'listen', emoji: '🍇', word_en: 'Grapes', options: ['Grapes', 'Grass', 'Grape', 'Groups'], correct: 'Grapes' },
      { id: 7, type: 'translate', emoji: '🍓', word_en: 'Strawberry', options: ['Framboise', 'Fraise', 'Cerise', 'Myrtille'], correct: 'Fraise' },
      { id: 8, type: 'translate', emoji: '🍌', word_en: 'Banana', options: ['Ananas', 'Kiwi', 'Banane', 'Poire'], correct: 'Banane' },
    ],
  },
  {
    id: 4, title: 'Le corps', emoji: '🧍', color: '#805ad5',
    exercises: [
      { id: 1, type: 'translate', emoji: '👀', word_en: 'Eyes', options: ['Oreilles', 'Yeux', 'Nez', 'Bouche'], correct: 'Yeux' },
      { id: 2, type: 'translate', emoji: '👃', word_en: 'Nose', options: ['Nez', 'Main', 'Pied', 'Bras'], correct: 'Nez' },
      { id: 3, type: 'image', instruction: 'Trouve "Hand"', word_en: 'Hand', emojis: [{ emoji: '👂', label: 'Ear' }, { emoji: '✋', label: 'Hand' }, { emoji: '👃', label: 'Nose' }, { emoji: '🦶', label: 'Foot' }], correct: 'Hand' },
      { id: 4, type: 'fill', sentence: 'I have two ___.', blank: '___', options: ['Nose', 'Hands', 'Head', 'Mouth'], correct: 'Hands' },
      { id: 5, type: 'translate', emoji: '👄', word_en: 'Mouth', options: ['Tête', 'Doigt', 'Bouche', 'Genou'], correct: 'Bouche' },
      { id: 6, type: 'order', instruction: 'Remets en ordre :', words: ['big', 'are', 'My', 'eyes'], correct: ['My', 'eyes', 'are', 'big'] },
      { id: 7, type: 'listen', emoji: '👂', word_en: 'Ear', options: ['Ear', 'Air', 'Are', 'Era'], correct: 'Ear' },
      { id: 8, type: 'translate', emoji: '🦶', word_en: 'Foot', options: ['Main', 'Pied', 'Tête', 'Jambe'], correct: 'Pied' },
    ],
  },
  {
    id: 5, title: 'Les chiffres', emoji: '🔢', color: '#dd6b20',
    exercises: [
      { id: 1, type: 'translate', emoji: '1️⃣', word_en: 'One', options: ['Deux', 'Un', 'Trois', 'Quatre'], correct: 'Un' },
      { id: 2, type: 'translate', emoji: '5️⃣', word_en: 'Five', options: ['Six', 'Quatre', 'Cinq', 'Sept'], correct: 'Cinq' },
      { id: 3, type: 'fill', sentence: 'I have ___ fingers on one hand.', blank: '___', options: ['Three', 'Five', 'Ten', 'Two'], correct: 'Five' },
      { id: 4, type: 'translate', emoji: '🔟', word_en: 'Ten', options: ['Neuf', 'Huit', 'Dix', 'Sept'], correct: 'Dix' },
      { id: 5, type: 'listen', emoji: '3️⃣', word_en: 'Three', options: ['Three', 'Tree', 'Free', 'There'], correct: 'Three' },
      { id: 6, type: 'order', instruction: 'Remets en ordre :', words: ['have', 'dogs', 'two', 'I'], correct: ['I', 'have', 'two', 'dogs'] },
      { id: 7, type: 'translate', emoji: '7️⃣', word_en: 'Seven', options: ['Six', 'Huit', 'Sept', 'Neuf'], correct: 'Sept' },
      { id: 8, type: 'image', instruction: 'Trouve "Three"', word_en: 'Three', emojis: [{ emoji: '1️⃣', label: 'One' }, { emoji: '2️⃣', label: 'Two' }, { emoji: '3️⃣', label: 'Three' }, { emoji: '4️⃣', label: 'Four' }], correct: 'Three' },
    ],
  },
  {
    id: 6, title: 'La famille', emoji: '👨‍👩‍👧‍👦', color: '#d53f8c',
    exercises: [
      { id: 1, type: 'translate', emoji: '👩', word_en: 'Mother', options: ['Père', 'Mère', 'Sœur', 'Frère'], correct: 'Mère' },
      { id: 2, type: 'translate', emoji: '👨', word_en: 'Father', options: ['Père', 'Oncle', 'Fils', 'Grand-père'], correct: 'Père' },
      { id: 3, type: 'image', instruction: 'Trouve "Sister"', word_en: 'Sister', emojis: [{ emoji: '👨', label: 'Father' }, { emoji: '👧', label: 'Sister' }, { emoji: '👦', label: 'Brother' }, { emoji: '👩', label: 'Mother' }], correct: 'Sister' },
      { id: 4, type: 'fill', sentence: 'My ___ is my father\'s wife.', blank: '___', options: ['Sister', 'Mother', 'Brother', 'Father'], correct: 'Mother' },
      { id: 5, type: 'translate', emoji: '👦', word_en: 'Brother', options: ['Sœur', 'Cousin', 'Frère', 'Tante'], correct: 'Frère' },
      { id: 6, type: 'listen', emoji: '👧', word_en: 'Sister', options: ['Sister', 'Sitter', 'Mister', 'Lister'], correct: 'Sister' },
      { id: 7, type: 'order', instruction: 'Remets en ordre :', words: ['is', 'mother', 'kind', 'My'], correct: ['My', 'mother', 'is', 'kind'] },
      { id: 8, type: 'translate', emoji: '👴', word_en: 'Grandfather', options: ['Grand-mère', 'Grand-père', 'Oncle', 'Cousin'], correct: 'Grand-père' },
    ],
  },
];

// ─── TTS helper ───
function speak(text: string) {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    u.rate = 0.8;
    u.pitch = 1.1;
    speechSynthesis.speak(u);
  }
}

// ─── Sub-components ───

function TranslateCard({ ex, onAnswer }: { ex: TranslateExercise; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    speak(ex.word_en);
    setTimeout(() => onAnswer(opt === ex.correct), 1200);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">Traduis ce mot en français :</p>
      <div className="flex flex-col items-center gap-2">
        <motion.button
          className="text-6xl"
          whileTap={{ scale: 0.9 }}
          onClick={() => speak(ex.word_en)}
        >
          {ex.emoji}
        </motion.button>
        <span className="text-2xl font-bold text-foreground" style={{ fontFamily: 'Nunito, sans-serif' }}>
          {ex.word_en}
        </span>
        <button onClick={() => speak(ex.word_en)} className="text-primary text-xs flex items-center gap-1">
          <Volume2 className="h-3 w-3" /> Écouter
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ex.options.map(opt => {
          const isCorrect = opt === ex.correct;
          const isSelected = opt === selected;
          return (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl border-2 font-bold text-base transition-all ${
                !answered
                  ? 'border-border bg-card hover:border-primary/50 text-foreground'
                  : isSelected && isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                    : isSelected && !isCorrect
                      ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
                      : isCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
                        : 'border-border bg-card text-muted-foreground opacity-50'
              }`}
              onClick={() => handleSelect(opt)}
              disabled={answered}
              style={{ fontFamily: 'Nunito, sans-serif' }}
            >
              {opt}
              {answered && isCorrect && <CheckCircle2 className="inline h-4 w-4 ml-1" />}
              {answered && isSelected && !isCorrect && <XCircle className="inline h-4 w-4 ml-1" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ImageCard({ ex, onAnswer }: { ex: ImageExercise; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  const handleSelect = (label: string) => {
    if (answered) return;
    setSelected(label);
    speak(ex.word_en);
    setTimeout(() => onAnswer(label === ex.correct), 1200);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">{ex.instruction}</p>
      <div className="flex items-center justify-center gap-1">
        <button onClick={() => speak(ex.word_en)} className="text-primary flex items-center gap-1 text-sm">
          <Volume2 className="h-4 w-4" /> <span className="font-bold text-lg">{ex.word_en}</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ex.emojis.map(item => {
          const isCorrect = item.label === ex.correct;
          const isSelected = item.label === selected;
          return (
            <motion.button
              key={item.label}
              whileTap={{ scale: 0.95 }}
              className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${
                !answered
                  ? 'border-border bg-card hover:border-primary/50'
                  : isSelected && isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : isSelected && !isCorrect
                      ? 'border-red-500 bg-red-50 dark:bg-red-950'
                      : isCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-950'
                        : 'border-border bg-card opacity-50'
              }`}
              onClick={() => handleSelect(item.label)}
              disabled={answered}
            >
              <span className="text-4xl">{item.emoji}</span>
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function FillCard({ ex, onAnswer }: { ex: FillExercise; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt === ex.correct), 1200);
  };

  const parts = ex.sentence.split(ex.blank);

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">Complète la phrase :</p>
      <div className="text-center text-xl font-bold text-foreground" style={{ fontFamily: 'Nunito, sans-serif' }}>
        {parts[0]}
        <span className={`inline-block min-w-[80px] px-2 py-1 mx-1 rounded-lg border-2 border-dashed ${
          selected
            ? selected === ex.correct ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700' : 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700'
            : 'border-primary/40 text-primary'
        }`}>
          {selected || '?'}
        </span>
        {parts[1]}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ex.options.map(opt => {
          const isCorrect = opt === ex.correct;
          const isSelected = opt === selected;
          return (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl border-2 font-bold transition-all ${
                !answered
                  ? 'border-border bg-card hover:border-primary/50 text-foreground'
                  : isSelected && isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700'
                    : isSelected && !isCorrect
                      ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700'
                      : 'border-border bg-card text-muted-foreground opacity-50'
              }`}
              onClick={() => handleSelect(opt)}
              disabled={answered}
              style={{ fontFamily: 'Nunito, sans-serif' }}
            >
              {opt}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function ListenCard({ ex, onAnswer }: { ex: ListenExercise; onAnswer: (correct: boolean) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const answered = selected !== null;

  useEffect(() => { speak(ex.word_en); }, [ex.word_en]);

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setTimeout(() => onAnswer(opt === ex.correct), 1200);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">Écoute et choisis le bon mot :</p>
      <div className="flex flex-col items-center gap-3">
        <motion.button
          className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center"
          whileTap={{ scale: 0.9 }}
          onClick={() => speak(ex.word_en)}
        >
          <Volume2 className="h-10 w-10 text-primary" />
        </motion.button>
        <span className="text-4xl">{ex.emoji}</span>
        <p className="text-xs text-muted-foreground">Clique pour réécouter</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {ex.options.map(opt => {
          const isCorrect = opt === ex.correct;
          const isSelected = opt === selected;
          return (
            <motion.button
              key={opt}
              whileTap={{ scale: 0.95 }}
              className={`p-3 rounded-xl border-2 font-bold transition-all ${
                !answered
                  ? 'border-border bg-card hover:border-primary/50 text-foreground'
                  : isSelected && isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700'
                    : isSelected && !isCorrect
                      ? 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700'
                      : 'border-border bg-card text-muted-foreground opacity-50'
              }`}
              onClick={() => handleSelect(opt)}
              disabled={answered}
              style={{ fontFamily: 'Nunito, sans-serif' }}
            >
              {opt}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

function OrderCard({ ex, onAnswer }: { ex: OrderExercise; onAnswer: (correct: boolean) => void }) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(() => [...ex.words].sort(() => Math.random() - 0.5));
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleWordClick = (word: string) => {
    if (answered) return;
    const newPlaced = [...placed, word];
    const newAvailable = available.filter((_, i) => i !== available.indexOf(word));
    setPlaced(newPlaced);
    setAvailable(newAvailable);

    if (newPlaced.length === ex.correct.length) {
      const correct = JSON.stringify(newPlaced) === JSON.stringify(ex.correct);
      setIsCorrect(correct);
      setAnswered(true);
      setTimeout(() => onAnswer(correct), 1200);
    }
  };

  const handleRemove = (idx: number) => {
    if (answered) return;
    const word = placed[idx];
    setPlaced(placed.filter((_, i) => i !== idx));
    setAvailable([...available, word]);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm font-medium text-muted-foreground">{ex.instruction}</p>
      {/* Sentence area */}
      <div className={`min-h-[50px] p-3 rounded-xl border-2 border-dashed flex flex-wrap gap-2 ${
        answered
          ? isCorrect ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-red-500 bg-red-50 dark:bg-red-950'
          : 'border-primary/30 bg-primary/5'
      }`}>
        {placed.length === 0 && <span className="text-muted-foreground text-sm">Clique sur les mots dans le bon ordre...</span>}
        {placed.map((word, idx) => (
          <motion.button
            key={`${word}-${idx}`}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="px-3 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-sm"
            onClick={() => handleRemove(idx)}
            disabled={answered}
            style={{ fontFamily: 'Nunito, sans-serif' }}
          >
            {word}
          </motion.button>
        ))}
      </div>
      {/* Word bank */}
      <div className="flex flex-wrap gap-2 justify-center">
        {available.map((word, idx) => (
          <motion.button
            key={`${word}-${idx}`}
            whileTap={{ scale: 0.9 }}
            className="px-4 py-2 rounded-xl border-2 border-border bg-card font-bold text-foreground hover:border-primary/50 transition-all"
            onClick={() => handleWordClick(word)}
            disabled={answered}
            style={{ fontFamily: 'Nunito, sans-serif' }}
          >
            {word}
          </motion.button>
        ))}
      </div>
      {answered && (
        <p className={`text-center text-sm font-bold ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
          {isCorrect ? '✅ Correct !' : `❌ Réponse : "${ex.correct.join(' ')}"`}
        </p>
      )}
    </div>
  );
}

// ─── Main Component ───
export default function StudentAnglais() {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [completedLessons, setCompletedLessons] = useState<Set<number>>(() => {
    try {
      const stored = localStorage.getItem('anglais_completed');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const currentExercise = selectedLesson?.exercises[exerciseIdx] ?? null;
  const progress = selectedLesson ? ((exerciseIdx) / selectedLesson.exercises.length) * 100 : 0;

  const handleAnswer = useCallback((correct: boolean) => {
    if (correct) {
      setScore(s => s + 10 + streak * 2);
      setStreak(s => s + 1);
      setFeedback('correct');
    } else {
      setLives(l => l - 1);
      setStreak(0);
      setFeedback('wrong');
    }

    setTimeout(() => {
      setFeedback(null);
      if (!correct && lives <= 1) {
        setShowResult(true);
        return;
      }
      if (selectedLesson && exerciseIdx + 1 >= selectedLesson.exercises.length) {
        const newCompleted = new Set(completedLessons);
        newCompleted.add(selectedLesson.id);
        setCompletedLessons(newCompleted);
        localStorage.setItem('anglais_completed', JSON.stringify([...newCompleted]));
        setShowResult(true);
      } else {
        setExerciseIdx(i => i + 1);
      }
    }, 800);
  }, [exerciseIdx, selectedLesson, lives, streak, completedLessons]);

  const startLesson = (lesson: Lesson) => {
    setSelectedLesson(lesson);
    setExerciseIdx(0);
    setLives(3);
    setScore(0);
    setStreak(0);
    setShowResult(false);
    setFeedback(null);
  };

  const passed = lives > 0;
  const stars = lives === 3 ? 3 : lives === 2 ? 2 : 1;

  // ─── Lesson selection screen ───
  if (!selectedLesson) {
    return (
      <StudentLayout>
        <div className="space-y-4 max-w-lg mx-auto">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Nunito, sans-serif' }}>
              🇬🇧 Apprends l'Anglais !
            </h2>
            <p className="text-sm text-muted-foreground">Choisis une leçon et amuse-toi !</p>
          </div>

          <div className="grid gap-3">
            {LESSONS.map((lesson, idx) => {
              const isCompleted = completedLessons.has(lesson.id);
              const isLocked = idx > 0 && !completedLessons.has(LESSONS[idx - 1].id);

              return (
                <motion.div key={lesson.id} whileHover={!isLocked ? { scale: 1.02 } : {}} whileTap={!isLocked ? { scale: 0.98 } : {}}>
                  <Button
                    className={`w-full h-16 justify-start gap-4 text-left rounded-2xl text-base font-bold ${isLocked ? 'opacity-50' : ''}`}
                    variant={isCompleted ? 'default' : 'outline'}
                    disabled={isLocked}
                    onClick={() => startLesson(lesson)}
                  >
                    <span className="text-3xl">{lesson.emoji}</span>
                    <div className="flex-1">
                      <div>{lesson.title}</div>
                      <div className="text-xs font-normal opacity-70">
                        {isCompleted ? '✅ Terminé' : isLocked ? '🔒 Bloqué' : `${lesson.exercises.length} exercices`}
                      </div>
                    </div>
                    {isCompleted && <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        </div>
      </StudentLayout>
    );
  }

  // ─── Exercise screen ───
  return (
    <StudentLayout>
      <div className="space-y-3 max-w-lg mx-auto">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedLesson(null)} className="text-xs">
            ← Retour
          </Button>
          <div className="flex-1">
            <Progress value={progress} className="h-3 rounded-full" />
          </div>
          <div className="flex items-center gap-1">
            {[1, 2, 3].map(i => (
              <Heart key={i} className={`h-5 w-5 ${i <= lives ? 'text-red-500 fill-red-500' : 'text-muted'}`} />
            ))}
          </div>
        </div>

        {/* Score & streak */}
        <div className="flex items-center justify-between text-sm">
          <Badge variant="secondary" className="gap-1">
            <Star className="h-3 w-3" /> {score} pts
          </Badge>
          {streak > 1 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-orange-500 font-bold text-sm"
            >
              🔥 {streak} d'affilée !
            </motion.div>
          )}
        </div>

        {/* Feedback overlay */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`text-center py-2 rounded-xl font-bold text-lg ${
                feedback === 'correct'
                  ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
              }`}
            >
              {feedback === 'correct' ? '✅ Bravo !' : '❌ Oups !'}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exercise card */}
        <Card className="border-2 border-primary/10">
          <CardContent className="pt-5 pb-6">
            <AnimatePresence mode="wait">
              {currentExercise && (
                <motion.div
                  key={`${selectedLesson.id}-${exerciseIdx}`}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -30 }}
                  transition={{ duration: 0.25 }}
                >
                  {currentExercise.type === 'translate' && <TranslateCard ex={currentExercise} onAnswer={handleAnswer} />}
                  {currentExercise.type === 'image' && <ImageCard ex={currentExercise} onAnswer={handleAnswer} />}
                  {currentExercise.type === 'fill' && <FillCard ex={currentExercise} onAnswer={handleAnswer} />}
                  {currentExercise.type === 'listen' && <ListenCard ex={currentExercise} onAnswer={handleAnswer} />}
                  {currentExercise.type === 'order' && <OrderCard ex={currentExercise} onAnswer={handleAnswer} />}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Exercice {exerciseIdx + 1} / {selectedLesson.exercises.length}
        </p>

        {/* Result dialog */}
        <Dialog open={showResult} onOpenChange={setShowResult}>
          <DialogContent className="text-center max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center justify-center gap-2">
                {passed ? <><Trophy className="h-7 w-7 text-yellow-500" /> Leçon terminée ! 🎉</> : <>😢 Plus de vies</>}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-3 pt-2">
                  {passed && (
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3].map(s => (
                        <Star key={s} className={`h-8 w-8 ${s <= stars ? 'text-yellow-400 fill-yellow-400' : 'text-muted'}`} />
                      ))}
                    </div>
                  )}
                  <p className="text-lg font-bold text-foreground">Score : {score} pts</p>
                  <p className="text-sm text-muted-foreground">
                    {passed ? 'Tu peux passer à la leçon suivante !' : 'Réessaie, tu vas y arriver ! 💪'}
                  </p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button onClick={() => startLesson(selectedLesson)} className="w-full">
                <RotateCcw className="h-4 w-4 mr-1" /> {passed ? 'Refaire' : 'Réessayer'}
              </Button>
              <Button variant="outline" onClick={() => { setShowResult(false); setSelectedLesson(null); }} className="w-full">
                Retour aux leçons
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </StudentLayout>
  );
}
