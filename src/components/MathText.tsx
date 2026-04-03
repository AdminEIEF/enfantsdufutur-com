import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Renders text with LaTeX math formulas.
 * - Display math: $$...$$ 
 * - Inline math: $...$
 * - Supports all LaTeX: \frac{a}{b}, \sqrt{x}, \pi, \alpha, \sum, \int, etc.
 */
export function MathText({ text, className }: MathTextProps) {
  const html = useMemo(() => {
    if (!text) return '';
    
    let result = text;

    // Handle display math $$...$$
    result = result.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false, trust: true });
      } catch {
        return `$$${tex}$$`;
      }
    });
    
    // Handle inline math $...$
    // Use negative lookbehind to avoid matching escaped \$
    result = result.replace(/(?<![\\])\$([^\$]+?)\$/g, (_, tex) => {
      try {
        return katex.renderToString(tex.trim(), { displayMode: false, throwOnError: false, trust: true });
      } catch {
        return `$${tex}$`;
      }
    });

    // Handle standalone LaTeX commands outside $ delimiters
    // Match \command{...} patterns like \frac{a}{b}, \sqrt{x}, \vec{v}
    result = result.replace(/\\(frac|sqrt|vec|overline|underline|hat|bar|dot|ddot|tilde|widetilde|widehat)\{([^}]*)\}(?:\{([^}]*)\})?/g, (match) => {
      try {
        return katex.renderToString(match, { displayMode: false, throwOnError: false, trust: true });
      } catch {
        return match;
      }
    });

    // Handle standalone Greek letters and math symbols outside $ delimiters
    result = result.replace(/\\(alpha|beta|gamma|delta|epsilon|zeta|eta|theta|iota|kappa|lambda|mu|nu|xi|pi|rho|sigma|tau|upsilon|phi|chi|psi|omega|Alpha|Beta|Gamma|Delta|Epsilon|Zeta|Eta|Theta|Iota|Kappa|Lambda|Mu|Nu|Xi|Pi|Rho|Sigma|Tau|Upsilon|Phi|Chi|Psi|Omega|infty|sum|int|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|pm|mp|times|div|cdot|leq|geq|neq|approx|equiv|subset|supset|cup|cap|in|notin|forall|exists|nabla|partial|to|rightarrow|leftarrow|Rightarrow|Leftarrow|implies|iff)\b/g, (match) => {
      try {
        return katex.renderToString(match, { displayMode: false, throwOnError: false, trust: true });
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
