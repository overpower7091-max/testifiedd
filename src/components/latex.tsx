import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

/**
 * Render text that mixes plain content with LaTeX.
 * - Block math: $$ ... $$
 * - Inline math: $ ... $
 * Newlines are preserved.
 */
export function Latex({ children, className }: { children: string; className?: string }) {
  const html = useMemo(() => renderMixed(children ?? ""), [children]);
  return (
    <span
      className={className}
      style={{ whiteSpace: "pre-wrap" }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function renderMixed(src: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // First split on $$ ... $$ (block), then on $ ... $ (inline).
  const blockRe = /\$\$([\s\S]+?)\$\$/g;
  const inlineRe = /\$([^\n$]+?)\$/g;

  const renderKatex = (tex: string, display: boolean) => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: display });
    } catch {
      return escapeHtml(display ? `$$${tex}$$` : `$${tex}$`);
    }
  };

  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src))) {
    parts.push(inlineRender(src.slice(last, m.index), inlineRe, renderKatex, escapeHtml));
    parts.push(renderKatex(m[1].trim(), true));
    last = m.index + m[0].length;
  }
  parts.push(inlineRender(src.slice(last), inlineRe, renderKatex, escapeHtml));
  return parts.join("");
}

function inlineRender(
  src: string,
  re: RegExp,
  renderKatex: (t: string, d: boolean) => string,
  escapeHtml: (s: string) => string,
): string {
  const out: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(src))) {
    out.push(escapeHtml(src.slice(last, m.index)));
    out.push(renderKatex(m[1], false));
    last = m.index + m[0].length;
  }
  out.push(escapeHtml(src.slice(last)));
  return out.join("");
}
