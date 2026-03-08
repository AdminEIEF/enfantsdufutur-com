import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  maxIntervalMs?: number;
  minLength?: number;
}

/**
 * Global key listener that detects rapid keyboard input from physical barcode/QR scanners.
 * Works even when focus is on an input field (for flasheur/douchette compatibility).
 * Characters arriving within `maxIntervalMs` of each other ending with Enter trigger `onScan`.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 80,
  minLength = 3,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRapidInputRef = useRef(false);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    isRapidInputRef.current = false;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Detect rapid sequential input (scanner behavior)
      if (elapsed < maxIntervalMs) {
        isRapidInputRef.current = true;
      }

      // If too much time passed, reset buffer
      if (elapsed > maxIntervalMs && bufferRef.current.length > 0) {
        bufferRef.current = '';
        isRapidInputRef.current = false;
      }

      // Clear pending reset timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (e.key === 'Enter') {
        const code = bufferRef.current.trim();
        // Only trigger if rapid input detected (scanner) AND meets minimum length
        if (code.length >= minLength && isRapidInputRef.current) {
          e.preventDefault();
          e.stopPropagation();
          onScan(code);
        }
        bufferRef.current = '';
        isRapidInputRef.current = false;
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Auto-reset buffer after a pause
      timerRef.current = setTimeout(resetBuffer, 300);
    };

    // Use capture phase to intercept before input fields
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onScan, maxIntervalMs, minLength, resetBuffer]);
}
