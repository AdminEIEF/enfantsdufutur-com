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
 */
const AZERTY_TO_QWERTY: Record<string, string> = {
  // Number row
  '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5',
  '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
  ')': '-',
  // Shifted number row
  '°': ')', '+': '=',
  // Letter swaps
  'a': 'q', 'q': 'a', 'z': 'w', 'w': 'z',
  'm': ';', ',': 'm', ';': ',', ':': '.', '!': '/',
  'ù': "'", '%': '"', '¨': '{', '£': '}',
  'µ': '\\', '§': '!', '*': ']', '$': '[',
  // Uppercase
  'A': 'Q', 'Q': 'A', 'Z': 'W', 'W': 'Z', 'M': ':',
};

/**
 * Convert AZERTY-garbled string to QWERTY.
 */
function azertyToQwerty(text: string): string {
  let result = '';
  for (const char of text) {
    result += AZERTY_TO_QWERTY[char] ?? char;
  }
  return result;
}

/**
 * Detect if a string contains typical AZERTY-garbled characters.
 */
function containsAzertyArtifacts(text: string): boolean {
  // Characters that would NOT appear in a normal JSON/matricule string
  // but DO appear in AZERTY-garbled scanner output
  const artifacts = /[éèàçùµ¨£§°%]/.test(text);
  const hasAzertyPattern = text.includes('%M%') || text.includes('%;%') || 
    text.includes(')é') || text.includes('àé');
  return artifacts || hasAzertyPattern;
}

/**
 * Extract matricule from any scanner output (QWERTY, AZERTY, partial text).
 * Tries multiple strategies in order of reliability.
 */
/**
 * Try to extract a matricule from a single text variant (raw or converted).
 */
function tryExtractFromText(text: string): string | null {
  // Structured: matricule:XXX or matricule=XXX
  const mMatch = text.match(/matricule[=:;\s]\s*([A-Za-z0-9\-]+)/i);
  if (mMatch) return mMatch[1].toUpperCase();

  // Structured: id:XXX or id=XXX
  const idMatch = text.match(/\bid[=:;\s]\s*([A-Za-z0-9\-]+)/i);
  if (idMatch) return idMatch[1].toUpperCase();

  // JSON parse
  try {
    const parsed = JSON.parse(text);
    if (parsed.matricule) return String(parsed.matricule).toUpperCase();
    if (parsed.id) return String(parsed.id).toUpperCase();
    if (parsed.code) return String(parsed.code).toUpperCase();
  } catch { /* not JSON */ }

  // JSON with missing opening brace (dead key swallowed '{')
  if (!text.startsWith('{')) {
    const candidates = ['{' + text, '{' + text + '}'];
    for (const c of candidates) {
      try {
        const parsed = JSON.parse(c);
        if (parsed.matricule) return String(parsed.matricule).toUpperCase();
        if (parsed.id) return String(parsed.id).toUpperCase();
      } catch { /* skip */ }
    }
  }

  // Matricule regex pattern: EDU-2602-0001, ABC-12-123, etc.
  const matriculeMatch = text.match(/[A-Z]{2,5}-\d{2,4}-\d{3,6}/i);
  if (matriculeMatch) return matriculeMatch[0].toUpperCase();

  return null;
}

export function extractMatriculeFromScan(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  console.log('[Scanner] Raw input:', trimmed);

  // Always try on raw text first
  const fromRaw = tryExtractFromText(trimmed);
  if (fromRaw) {
    console.log('[Scanner] Extracted from raw:', fromRaw);
    return fromRaw;
  }

  // Always try AZERTY→QWERTY conversion (works on any keyboard layout)
  const converted = azertyToQwerty(trimmed);
  if (converted !== trimmed) {
    console.log('[Scanner] Converted AZERTY→QWERTY:', converted);
    const fromConverted = tryExtractFromText(converted);
    if (fromConverted) {
      console.log('[Scanner] Extracted from converted:', fromConverted);
      return fromConverted;
    }
  }

  // Direct matricule match (already uppercase alphanumeric-dash)
  if (/^[A-Z]{2,5}-\d{2,4}-\d{3,6}$/i.test(trimmed)) return trimmed.toUpperCase();

  // Plain ID fallback
  if (/^[A-Z0-9\-]{5,20}$/i.test(trimmed)) return trimmed.toUpperCase();

  // Last resort: try on converted text too
  if (converted !== trimmed && /^[A-Z0-9\-]{5,20}$/i.test(converted)) return converted.toUpperCase();

  return null;
}

/**
 * Global key listener that detects rapid keyboard input from physical barcode/QR scanners.
 * Works with both QWERTY and AZERTY keyboard layouts.
 * Characters arriving within `maxIntervalMs` of each other ending with Enter trigger `onScan`.
 * 
 * Handles AZERTY dead keys (¨, ^, ~) by capturing them via the 'Dead' key event
 * and resolving them on the next keystroke.
 */
export function useBarcodeScanner({
  onScan,
  maxIntervalMs = 100, // Slightly more generous for AZERTY dead key delays
  minLength = 3,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRapidInputRef = useRef(false);
  const deadKeyRef = useRef(false);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    isRapidInputRef.current = false;
    deadKeyRef.current = false;
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
        if (code.length >= minLength && isRapidInputRef.current) {
          e.preventDefault();
          e.stopPropagation();
          
          // Extract matricule using multi-strategy approach
          const matricule = extractMatriculeFromScan(code);
          if (matricule) {
            onScan(matricule);
          } else {
            // Pass raw text as fallback
            onScan(code);
          }
        }
        bufferRef.current = '';
        isRapidInputRef.current = false;
        deadKeyRef.current = false;
        return;
      }

      // Handle dead keys (AZERTY: ¨, ^, ~)
      if (e.key === 'Dead') {
        deadKeyRef.current = true;
        // On AZERTY, dead key ¨ corresponds to { in QWERTY (Shift+[)
        // We record a placeholder — the actual character appears in the next event
        // For our purposes, add ¨ directly as it will be converted later
        bufferRef.current += '¨';
        timerRef.current = setTimeout(resetBuffer, 500);
        return;
      }

      // If previous key was dead, the current key might be a composed character
      if (deadKeyRef.current) {
        deadKeyRef.current = false;
        // The e.key now contains the composed character (e.g., ë, ï)
        // or the dead key character followed by this character
        if (e.key.length === 1) {
          // Remove the ¨ we added and add the actual composed character
          if (bufferRef.current.endsWith('¨')) {
            bufferRef.current = bufferRef.current.slice(0, -1);
          }
          bufferRef.current += e.key;
        }
        timerRef.current = setTimeout(resetBuffer, 500);
        return;
      }

      // Only accumulate printable single characters
      if (e.key.length === 1) {
        bufferRef.current += e.key;
      }

      // Auto-reset buffer after a pause
      timerRef.current = setTimeout(resetBuffer, 500);
    };

    // Use capture phase to intercept before input fields
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [onScan, maxIntervalMs, minLength, resetBuffer]);
}
