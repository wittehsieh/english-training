import { useCallback, useEffect, useRef, useState } from 'react';

interface TypewriterOptions {
  /** ms per character */
  speed?: number;
  /** skip the animation entirely (reduced motion) */
  instant?: boolean;
}

interface TypewriterResult {
  text: string;
  done: boolean;
  /** Reveal the whole string immediately (tap-to-complete). */
  skip: () => void;
}

/**
 * Lightweight typewriter. No animation library — one interval, cleared on
 * unmount / text change. Tap anywhere calls `skip()`.
 */
export function useTypewriter(
  full: string,
  { speed = 18, instant = false }: TypewriterOptions = {},
): TypewriterResult {
  const [count, setCount] = useState(instant ? full.length : 0);
  const fullRef = useRef(full);
  fullRef.current = full;

  useEffect(() => {
    if (instant) {
      setCount(full.length);
      return;
    }
    setCount(0);
    if (!full) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setCount(i);
      if (i >= fullRef.current.length) window.clearInterval(id);
    }, speed);
    return () => window.clearInterval(id);
  }, [full, speed, instant]);

  const skip = useCallback(() => setCount(fullRef.current.length), []);

  return {
    text: full.slice(0, count),
    done: count >= full.length,
    skip,
  };
}
