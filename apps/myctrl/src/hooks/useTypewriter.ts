import { useState, useEffect, useRef } from 'react';

interface TypewriterOptions {
  phrases: string[];
  typeSpeed?: { min: number; max: number };
  deleteSpeed?: number;
  pauseBeforeDelete?: number;
  pauseBeforeType?: number;
  enabled?: boolean;
}

interface TypewriterState {
  displayText: string;
  isTyping: boolean;
  currentPhrase: string;
}

/**
 * Custom hook for typewriter animation that cycles through multiple phrases
 * with realistic variable typing speed.
 */
export function useTypewriter({
  phrases,
  typeSpeed = { min: 50, max: 120 },
  deleteSpeed = 30,
  pauseBeforeDelete = 2000,
  pauseBeforeType = 500,
  enabled = true,
}: TypewriterOptions): TypewriterState {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [phraseIndex, setPhraseIndex] = useState(0);

  // Store mutable values in refs to avoid dependency issues
  const charIndexRef = useRef(0);
  const isDeletingRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Store timing config in refs so inline objects don't trigger effect re-runs
  const configRef = useRef({ typeSpeed, deleteSpeed, pauseBeforeDelete, pauseBeforeType });
  configRef.current = { typeSpeed, deleteSpeed, pauseBeforeDelete, pauseBeforeType };

  useEffect(() => {
    if (!enabled) return;

    const currentPhrase = phrases[phraseIndex];

    // Reduced motion: show the phrase statically instead of typing it out.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayText(currentPhrase);
      setIsTyping(false);
      return;
    }

    charIndexRef.current = 0;
    isDeletingRef.current = false;
    setDisplayText('');
    setIsTyping(true);

    const tick = () => {
      const { typeSpeed, deleteSpeed, pauseBeforeDelete } = configRef.current;
      const isDeleting = isDeletingRef.current;
      const charIndex = charIndexRef.current;

      if (isDeleting) {
        // Deleting characters
        if (charIndex > 0) {
          charIndexRef.current = charIndex - 1;
          setDisplayText(currentPhrase.slice(0, charIndex - 1));
          timeoutRef.current = setTimeout(tick, deleteSpeed);
        } else {
          // Done deleting, move to next phrase
          isDeletingRef.current = false;
          setPhraseIndex((i) => (i + 1) % phrases.length);
        }
      } else {
        // Typing characters
        if (charIndex < currentPhrase.length) {
          charIndexRef.current = charIndex + 1;
          setDisplayText(currentPhrase.slice(0, charIndex + 1));
          setIsTyping(true);
          const delay = Math.random() * (typeSpeed.max - typeSpeed.min) + typeSpeed.min;
          timeoutRef.current = setTimeout(tick, delay);
        } else {
          // Done typing, pause then start deleting
          setIsTyping(false);
          timeoutRef.current = setTimeout(() => {
            isDeletingRef.current = true;
            tick();
          }, pauseBeforeDelete);
        }
      }
    };

    timeoutRef.current = setTimeout(tick, configRef.current.pauseBeforeType);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [phraseIndex, phrases, enabled]); // No timing deps - they're in configRef

  return {
    displayText,
    isTyping,
    currentPhrase: phrases[phraseIndex],
  };
}
