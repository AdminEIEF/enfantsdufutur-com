import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with inline LaTeX math between $ delimiters
 * and display math between $$ delimiters.
 */
export function MathText({ text, className }: MathTextProps) {
  const html = useMemo(() => {
    if (!text) return '';
    
    // First handle display math $$...$$
    let result = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false });
      } catch {
        return `$$${tex}$$`;
      }
    });
    
    // Then handle inline math $...$
    result = result.replace(/\$([^\$]+?)\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false });
      } catch {
        return `$${tex}$`;
      }
    });

    // Handle \frac, \sqrt etc. outside of $ delimiters (fallback)
    result = result.replace(/\\(frac|sqrt|sum|int|pi|infty|alpha|beta|theta|delta|Delta|leq|geq|neq|pm|times|div|cdot)\b/g, (match) => {
      try {
        return katex.renderToString(match, { displayMode: false, throwOnError: false });
      } catch {
        return match;
      }
    });
    
    return result;
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
