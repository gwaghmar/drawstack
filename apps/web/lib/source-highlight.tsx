import type { DiagramType } from "@flowchart/core";

/**
 * Tiny syntax highlighter for the editor's Source panel.
 *
 * Returns HTML where tokens are wrapped in <span class="hl-…">…</span>.
 * The textarea sits transparently on top of a <pre> rendering this HTML;
 * keystrokes feel native, colors apply visually. No dependencies.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightJson(source: string): string {
  // Use a single tokenizer pass on the escaped string for keys/strings/numbers/literals.
  const escaped = escapeHtml(source);
  return escaped.replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|(\b-?\d+\.?\d*(?:[eE][+-]?\d+)?\b)|\b(true|false|null)\b/g,
    (m, str, colon, num, lit) => {
      if (str) {
        const cls = colon ? "hl-key" : "hl-string";
        return `<span class="${cls}">${str}</span>${colon ?? ""}`;
      }
      if (num) return `<span class="hl-number">${num}</span>`;
      if (lit) return `<span class="hl-literal">${lit}</span>`;
      return m;
    },
  );
}

export function highlightSource(source: string, _diagramType: DiagramType): string {
  return highlightJson(source);
}
