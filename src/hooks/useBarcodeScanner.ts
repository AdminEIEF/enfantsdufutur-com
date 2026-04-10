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
export function extractMatriculeFromScan(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  console.log('[Scanner] Raw input:', trimmed);

  // Strategy 0: Extract from semicolon/comma-separated structured text
  // e.g. type:transport;matricule:EDU-2602-0001;id:EDU-2602-0001
  const structuredMatch = trimmed.match(/matricule[=:]\s*([A-Za-z0-9\-]+)/i);
  if (structuredMatch) {
    console.log('[Scanner] Structured match:', structuredMatch[1]);
    return structuredMatch[1].toUpperCase();
  }
  // Also try 'id' field from structured text
  const structuredIdMatch = trimmed.match(/\bid[=:]\s*([A-Za-z0-9\-]+)/i);
  if (structuredIdMatch) {
    console.log('[Scanner] Structured id match:', structuredIdMatch[1]);
    return structuredIdMatch[1].toUpperCase();
  }

  // Strategy 1: Direct JSON parse (QWERTY scanner, clean data)
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.matricule) return parsed.matricule;
    if (parsed.id) return String(parsed.id).toUpperCase();
    if (parsed.code) return String(parsed.code).toUpperCase();
  } catch {
    // Not valid JSON
  }

  // Strategy 2: AZERTY conversion then try all strategies again
  const isAzerty = containsAzertyArtifacts(trimmed);
  const converted = azertyToQwerty(trimmed);
  console.log('[Scanner] Converted:', converted);

  if (isAzerty) {
    // Try structured text on converted
    const convStructMatch = converted.match(/matricule[=:]\s*([A-Za-z0-9\-]+)/i);
    if (convStructMatch) return convStructMatch[1].toUpperCase();
    const convIdMatch = converted.match(/\bid[=:]\s*([A-Za-z0-9\-]+)/i);
    if (convIdMatch) return convIdMatch[1].toUpperCase();

    // Try JSON parse on converted text
    try {
      const parsed = JSON.parse(converted);
      if (parsed.matricule) return parsed.matricule;
      if (parsed.id) return String(parsed.id).toUpperCase();
    } catch {
      // Might be missing opening brace (dead key ¨ swallowed)
    }

    // Try adding missing opening brace (dead key issue on AZERTY)
    if (!converted.startsWith('{')) {
      try {
        const parsed = JSON.parse('{' + converted);
        if (parsed.matricule) return parsed.matricule;
        if (parsed.id) return String(parsed.id).toUpperCase();
      } catch {
        // Still not valid
      }
      const wrapped = '{' + converted + (converted.endsWith('}') ? '' : '}');
      try {
        const parsed = JSON.parse(wrapped);
        if (parsed.matricule) return parsed.matricule;
        if (parsed.id) return String(parsed.id).toUpperCase();
      } catch {
        // fallback to regex
      }
    }
  }

  // Strategy 3: Extract matricule pattern from converted text
  const matriculeMatch = converted.match(/[A-Z]{2,5}-\d{2,4}-\d{3,6}/i);
  if (matriculeMatch) return matriculeMatch[0].toUpperCase();

  // Strategy 4: Also try on raw text
  const rawMatriculeMatch = trimmed.match(/[A-Z]{2,5}-\d{2,4}-\d{3,6}/i);
  if (rawMatriculeMatch) return rawMatriculeMatch[0].toUpperCase();

  // Strategy 5: If it already looks like a matricule (no conversion needed)
  const directMatch = trimmed.match(/^[A-Z]{2,5}-\d{2,4}-\d{3,6}$/i);
  if (directMatch) return directMatch[0].toUpperCase();

  // Strategy 6: Raw text might just be a plain matricule or ID
  if (/^[A-Z0-9\-]{5,20}$/i.test(trimmed)) return trimmed.toUpperCase();

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
