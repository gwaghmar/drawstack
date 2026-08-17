export type RichTextRun = { text: string; bold?: boolean; italic?: boolean; highlight?: boolean };

export type RichTextLine = { runs: RichTextRun[] };

export const RICH_TEXT_HIGHLIGHT_FILL = "#fef08a";
export const RICH_TEXT_HIGHLIGHT_OPACITY = 0.6;

const MARKER_RE = /\*\*(.+?)\*\*|\*(.+?)\*|==(.+?)==/;

export function hasRichTextMarkers(content: string): boolean {
  return MARKER_RE.test(content);
}

function tokenizeLine(line: string): RichTextRun[] {
  const runs: RichTextRun[] = [];
  let rest = line;
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|==(.+?)==/;
  while (rest.length > 0) {
    const match = re.exec(rest);
    if (!match) {
      runs.push({ text: rest });
      break;
    }
    if (match.index > 0) {
      runs.push({ text: rest.slice(0, match.index) });
    }
    if (match[1] !== undefined) {
      runs.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      runs.push({ text: match[2], italic: true });
    } else if (match[3] !== undefined) {
      runs.push({ text: match[3], highlight: true });
    }
    rest = rest.slice(match.index + match[0].length);
  }
  return runs.filter((r) => r.text.length > 0);
}

export function measureRunWidth(run: RichTextRun, fontSize: number, blockBold?: boolean): number {
  const bold = blockBold || run.bold;
  const approxCharW = fontSize * (bold ? 0.58 : 0.55);
  return run.text.length * approxCharW;
}

type CharToken = { ch: string; bold?: boolean; italic?: boolean; highlight?: boolean };

function flattenToChars(runs: RichTextRun[]): CharToken[] {
  const chars: CharToken[] = [];
  for (const run of runs) {
    for (const ch of run.text) {
      chars.push({ ch, bold: run.bold, italic: run.italic, highlight: run.highlight });
    }
  }
  return chars;
}

type Word = { runs: RichTextRun[]; length: number; leadingSpaceRun?: RichTextRun };

function buildWords(chars: CharToken[]): Word[] {
  const words: Word[] = [];
  let i = 0;
  const n = chars.length;
  while (i < n) {
    let spaceRun: RichTextRun | undefined;
    while (i < n && chars[i].ch === " ") {
      spaceRun = { text: " ", bold: chars[i].bold, italic: chars[i].italic, highlight: chars[i].highlight };
      i++;
    }
    if (i >= n) break;
    const start = i;
    while (i < n && chars[i].ch !== " ") i++;
    const wordChars = chars.slice(start, i);
    const runs = mergeAdjacent(
      wordChars.map((c) => ({ text: c.ch, bold: c.bold, italic: c.italic, highlight: c.highlight }))
    );
    words.push({ runs, length: wordChars.length, leadingSpaceRun: words.length > 0 ? spaceRun : undefined });
  }
  return words;
}

export function layoutRichTextLines(
  content: string,
  opts: { maxWidth: number; fontSize: number; bold?: boolean }
): RichTextLine[] {
  const { maxWidth, fontSize, bold } = opts;
  const approxCharW = fontSize * (bold ? 0.58 : 0.55);
  const maxChars = Math.max(4, Math.floor(maxWidth / approxCharW));

  const result: RichTextLine[] = [];

  for (const rawLine of content.split("\n")) {
    const runs = tokenizeLine(rawLine);
    const words = buildWords(flattenToChars(runs));

    if (words.length === 0) {
      result.push({ runs: [] });
      continue;
    }

    let curRuns: RichTextRun[] = [];
    let curLen = 0;

    const pushLine = () => {
      result.push({ runs: mergeAdjacent(curRuns) });
      curRuns = [];
      curLen = 0;
    };

    for (const word of words) {
      const hasSpace = curLen > 0 && !!word.leadingSpaceRun;
      const wordLen = word.length + (hasSpace ? 1 : 0);
      if (curLen > 0 && curLen + wordLen > maxChars) {
        pushLine();
      }
      const needsSpace = curLen > 0 && !!word.leadingSpaceRun;
      if (needsSpace && word.leadingSpaceRun) {
        curRuns.push(word.leadingSpaceRun);
        curLen += 1;
      }
      for (const run of word.runs) {
        curRuns.push(run);
        curLen += run.text.length;
      }
    }
    if (curRuns.length > 0) pushLine();
  }

  return result;
}

function mergeAdjacent(runs: RichTextRun[]): RichTextRun[] {
  const out: RichTextRun[] = [];
  for (const run of runs) {
    const prev = out[out.length - 1];
    if (
      prev &&
      !!prev.bold === !!run.bold &&
      !!prev.italic === !!run.italic &&
      !!prev.highlight === !!run.highlight
    ) {
      prev.text += run.text;
    } else {
      out.push({ ...run });
    }
  }
  return out;
}

export function measureLineWidth(line: RichTextLine, fontSize: number, blockBold?: boolean): number {
  return line.runs.reduce((sum, run) => sum + measureRunWidth(run, fontSize, blockBold), 0);
}
