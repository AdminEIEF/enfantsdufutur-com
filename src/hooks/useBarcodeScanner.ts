import { useEffect, useRef, useCallback } from 'react';

interface UseBarcodeScannerOptions {
  onScan: (code: string) => void;
  maxIntervalMs?: number;
  minLength?: number;
}

/**
 * AZERTY → QWERTY character mapping.
 * Physical barcode scanners send USB HID keycodes (QWERTY-based),
 * but on AZERTY systems the OS remaps them, garbling the output.
 * This table reverses that remapping.
 */
const AZERTY_TO_QWERTY: Record<string, string> = {
  // Number row (unshifted on AZERTY → QWERTY digits)
  '&': '1',
  'é': '2',
  '"': '3',
  "'": '4',
  '(': '5',
  '-': '6',
  'è': '7',
  '_': '8',
  'ç': '9',
  'à': '0',
  ')': '-',
  // Number row shifted on AZERTY → QWERTY shifted digits
  '°': ')',
  '+': '=',
  // Letter swaps (AZERTY ↔ QWERTY differences)
  'a': 'q',
  'q': 'a',
  'z': 'w',
  'w': 'z',
  'm': ';',
  ',': 'm',
  ';': ',',
  ':': '.',
  '!': '/',
  'ù': "'",
  '%': '"',
  '¨': '{',  // dead diaeresis → {
  '£': '}',  // pound sign → }
  'µ': '\\',
  '§': '!',
  '*': ']',
  '$': '[',
  // Uppercase letter swaps
  'A': 'Q',
  'Q': 'A',
  'Z': 'W',
  'W': 'Z',
  'M': ':',
};

/**
 * Detect if a string looks like garbled AZERTY output
 * by checking for characters that commonly appear in AZERTY-garbled JSON.
 */
function looksLikeAzerty(text: string): boolean {
  // If the text contains typical AZERTY artifacts from a QR code JSON
  const azertyIndicators = ['¨%', '%M%', '£', 'é', 'è', 'à', ')'];
  let score = 0;
  for (const indicator of azertyIndicators) {
    if (text.includes(indicator)) score++;
  }
  // If 3+ indicators found, very likely AZERTY-garbled
  return score >= 3;
}

/**
 * Convert an AZERTY-garbled string back to its QWERTY original.
 */
function azertyToQwerty(text: string): string {
  let result = '';
  for (const char of text) {
    result += AZERTY_TO_QWERTY[char] ?? char;
  }
  return result;
}

/**
 * Try to fix and parse scanner output, handling AZERTY keyboard layouts.
 */
function normalizeScannedCode(raw: string): string {
  // First, try direct JSON parse (QWERTY system or camera scan)
  try {
    const parsed = JSON.parse(raw);
    if (parsed.matricule) return parsed.matricule;
    return raw;
  } catch {
    // Not valid JSON as-is
  }

  // Check if it looks like AZERTY-garbled text
  if (looksLikeAzerty(raw)) {
    const converted = azertyToQwerty(raw);
    try {
      const parsed = JSON.parse(converted);
      if (parsed.matricule) return parsed.matricule;
      return converted;
    } catch {
      // Conversion didn't produce valid JSON either, return converted anyway
      return converted;
    }
  }

  // Return raw text as-is (plain matricule)
  return raw;
}

/**
 * Global key listener that detects rapid keyboard input from physical barcode/QR scanners.
 * Works even when focus is on an input field (for flasheur/douchette compatibility).
 * Characters arriving within `maxIntervalMs` of each other ending with Enter trigger `onScan`.
 * 
 * Automatically handles AZERTY keyboard layouts by detecting and converting garbled output.
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
          // Normalize: handle AZERTY conversion + JSON extraction
          const normalized = normalizeScannedCode(code);
          onScan(normalized);
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
