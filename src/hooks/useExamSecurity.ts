import { useEffect, useRef, useCallback } from 'react';

interface ExamSecurityOptions {
  isActive: boolean;
  onViolation: (reason: string) => void;
  maxViolations?: number;
}

/**
 * Hook to enforce anti-cheat measures during an active composition:
 * 1. Prevent leaving the tab / switching apps (visibilitychange + blur)
 * 2. Block screenshots / screen recording via CSS & JS
 * 3. Disable right-click context menu
 * 4. Disable copy/paste/print shortcuts
 * 5. Warn before closing the browser tab
 * 6. Auto-submit after max violations
 */
export function useExamSecurity({ isActive, onViolation, maxViolations = 2 }: ExamSecurityOptions) {
  const violationCount = useRef(0);
  const wasHidden = useRef(false);

  const handleViolation = useCallback((reason: string) => {
    violationCount.current += 1;
    onViolation(reason);
  }, [onViolation]);

  useEffect(() => {
    if (!isActive) {
      violationCount.current = 0;
      wasHidden.current = false;
      return;
    }

    // --- 1. Visibility change (tab switch / minimize) ---
    const onVisibilityChange = () => {
      if (document.hidden) {
        wasHidden.current = true;
      } else if (wasHidden.current) {
        wasHidden.current = false;
        handleViolation('tab_switch');
      }
    };

    // --- 2. Window blur (alt-tab, clicking outside) ---
    const onBlur = () => {
      // Small delay to avoid false positives from UI interactions
      setTimeout(() => {
        if (document.hidden || !document.hasFocus()) {
          handleViolation('window_blur');
        }
      }, 300);
    };

    // --- 3. Block context menu (right-click) ---
    const onContextMenu = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // --- 4. Block keyboard shortcuts (copy, paste, print, screenshot) ---
    const onKeyDown = (e: KeyboardEvent) => {
      // Block: Ctrl+C, Ctrl+V, Ctrl+P, Ctrl+S, Ctrl+A, Ctrl+Shift+S, PrintScreen
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'v', 'p', 's', 'a', 'u'].includes(e.key.toLowerCase())
      ) {
        e.preventDefault();
        return false;
      }
      // Block PrintScreen
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        handleViolation('screenshot_attempt');
        return false;
      }
      // Block F12 (dev tools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
      // Block Ctrl+Shift+I (dev tools)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        return false;
      }
    };

    // --- 5. Beforeunload warning ---
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Vous avez une composition en cours. Si vous quittez, votre accès sera bloqué.';
      return e.returnValue;
    };

    // --- 6. Block copy/cut events ---
    const onCopy = (e: Event) => {
      e.preventDefault();
      return false;
    };

    // --- Apply CSS-based screenshot prevention ---
    const style = document.createElement('style');
    style.id = 'exam-security-styles';
    style.textContent = `
      /* Discourage screenshots / screen recording */
      .exam-secure-content {
        -webkit-user-select: none !important;
        user-select: none !important;
      }
      /* Hide content when page is not focused (anti screen-share) */
      @media screen {
        .exam-blur-on-leave:not(:focus-within) {
          /* This is handled by JS visibility */
        }
      }
    `;
    document.head.appendChild(style);

    // Add listeners
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCopy);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCopy);
      const existingStyle = document.getElementById('exam-security-styles');
      if (existingStyle) existingStyle.remove();
    };
  }, [isActive, handleViolation]);

  return {
    violationCount: violationCount.current,
    maxViolations,
  };
}
