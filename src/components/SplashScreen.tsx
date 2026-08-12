import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSchoolConfig } from '@/hooks/useSchoolConfig';
import schoolLogo from '@/assets/school-logo.png';

interface SplashScreenProps {
  onComplete: () => void;
  subtitle?: string;
}

export default function SplashScreen({ onComplete, subtitle }: SplashScreenProps) {
  const { data: config } = useSchoolConfig();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onComplete, 600);
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const schoolName = config?.nom || 'Les Ecoles la Mame Plus';
  const logoUrl = config?.logo_url;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(222 60% 30%) 50%, hsl(240 40% 15%) 100%)' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        >
          {/* Animated background circles */}
          <motion.div
            className="absolute w-[600px] h-[600px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary-foreground)), transparent)' }}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.5, 1.2] }}
            transition={{ duration: 2, ease: 'easeOut' }}
          />
          <motion.div
            className="absolute w-[400px] h-[400px] rounded-full opacity-5"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary-foreground)), transparent)' }}
            initial={{ scale: 0 }}
            animate={{ scale: [0, 2, 1.8] }}
            transition={{ duration: 2.5, ease: 'easeOut', delay: 0.3 }}
          />

          {/* Content */}
          <div className="relative flex flex-col items-center text-center px-6 max-w-lg">
            {/* Logo / Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 12, stiffness: 100, delay: 0.2 }}
              className="mb-6"
            >
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-24 w-24 rounded-2xl shadow-2xl object-contain bg-white p-2" />
              ) : (
                <img src={schoolLogo} alt="Logo" className="h-24 w-24 rounded-2xl shadow-2xl object-contain bg-white p-2" />
              )}
            </motion.div>

            {/* School Name */}
            <motion.h1
              className="text-2xl sm:text-3xl font-bold text-white mb-2"
              style={{ fontFamily: 'Space Grotesk, sans-serif', textShadow: '0 2px 10px rgba(0,0,0,0.3)' }}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.6 }}
            >
              {schoolName}
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              className="text-sm sm:text-base text-white/70 mb-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
            >
              {subtitle || 'Application de Gestion Scolaire Tout-en-Un'}
            </motion.p>

            {/* Welcome message */}
            <motion.div
              className="bg-white/10 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/20"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 15, delay: 1.3 }}
            >
              <p className="text-white text-sm font-medium">
                🎓 Bienvenue dans votre espace de gestion scolaire
              </p>
            </motion.div>

            {/* Loading dots */}
            <motion.div
              className="flex gap-2 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2.5 h-2.5 rounded-full bg-white/50"
                  animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

