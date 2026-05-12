import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export function UpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [updateFn, setUpdateFn] = useState<(() => Promise<void>) | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const isInIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreviewHost =
      window.location.hostname.includes('id-preview--') ||
      window.location.hostname.includes('lovableproject.com');

    if (!import.meta.env.PROD || isPreviewHost || isInIframe || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;
    import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return;
      const updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
          setUpdateFn(() => () => updateSW(true));
          setNeedRefresh(true);
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          const check = () => void registration.update().catch(() => undefined);
          check();
          // Check periodically (every 60s) so banner appears without focus events
          const interval = setInterval(check, 60_000);
          window.addEventListener('focus', check);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
          });
          return () => clearInterval(interval);
        },
      });
    }).catch(() => undefined);

    return () => { cancelled = true; };
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      if (updateFn) await updateFn();
      else window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const visible = needRefresh && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="fixed top-3 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-1.5rem)] max-w-md"
        >
          <div className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/95 to-primary text-primary-foreground shadow-2xl backdrop-blur-xl px-4 py-3">
            <div className="shrink-0 w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">Nouvelle version disponible</p>
              <p className="text-[11px] opacity-80 leading-tight">Actualisez pour profiter des dernières améliorations.</p>
            </div>
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-8 gap-1.5 bg-white text-primary hover:bg-white/90 font-semibold shadow"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 w-7 h-7 rounded-full hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label="Ignorer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
