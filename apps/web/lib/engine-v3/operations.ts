import type { EngineDocumentV3, EngineNode, Page, TokenSet, TokenValue } from "./document.ts";

export type TokenCategory = keyof TokenSet;
export type PageDocument = { document: EngineDocumentV3; activePageId: string };

function withPages(document: EngineDocumentV3, pages: Page[], activePageId = pages[0]?.id): PageDocument {
  if (!activePageId || !pages.some((page) => page.id === activePageId)) throw new Error("A document must contain an active page");
  return { document: { ...document, pages }, activePageId };
}

export function addPage(document: EngineDocumentV3, page: Page, index = document.pages.length, activePageId = document.pages[0]?.id): PageDocument {
  if (document.pages.some((item) => item.id === page.id)) throw new Error(`Page id already exists: ${page.id}`);
  const pages = [...document.pages];
  pages.splice(Math.max(0, Math.min(index, pages.length)), 0, page);
  return withPages(document, pages, activePageId ?? page.id);
}

export function renamePage(document: EngineDocumentV3, pageId: string, name: string): EngineDocumentV3 {
  if (!document.pages.some((page) => page.id === pageId)) throw new Error(`Page not found: ${pageId}`);
  return { ...document, pages: document.pages.map((page) => page.id === pageId ? { ...page, name } : page) };
}

export function removePage(document: EngineDocumentV3, pageId: string, activePageId = pageId): PageDocument {
  const index = document.pages.findIndex((page) => page.id === pageId);
  if (index < 0) throw new Error(`Page not found: ${pageId}`);
  if (document.pages.length === 1) throw new Error("A document must contain at least one page");
  const pages = document.pages.filter((page) => page.id !== pageId);
  const fallback = pages[Math.min(index, pages.length - 1)].id;
  return withPages(document, pages, activePageId === pageId ? fallback : activePageId);
}

export function reorderPage(document: EngineDocumentV3, pageId: string, toIndex: number): EngineDocumentV3 {
  const from = document.pages.findIndex((page) => page.id === pageId);
  if (from < 0) throw new Error(`Page not found: ${pageId}`);
  const pages = [...document.pages];
  const [page] = pages.splice(from, 1);
  pages.splice(Math.max(0, Math.min(Math.trunc(toIndex), pages.length)), 0, page);
  return { ...document, pages };
}

function cloneNode(node: EngineNode, used: Set<string>): EngineNode {
  let id = `${node.id}-copy`;
  let suffix = 2;
  while (used.has(id)) id = `${node.id}-copy-${suffix++}`;
  used.add(id);
  return node.type === "frame" ? { ...node, id, children: node.children.map((child) => cloneNode(child, used)) } : { ...node, id };
}

export function duplicatePage(document: EngineDocumentV3, pageId: string, newPageId: string, index = document.pages.length): EngineDocumentV3 {
  const source = document.pages.find((page) => page.id === pageId);
  if (!source) throw new Error(`Page not found: ${pageId}`);
  if (document.pages.some((page) => page.id === newPageId)) throw new Error(`Page id already exists: ${newPageId}`);
  const used = new Set(document.pages.flatMap((page) => collectNodeIds(page.root)));
  const page: Page = { ...source, id: newPageId, name: `${source.name} copy`, root: cloneNode(source.root, used) as Page["root"] };
  const pages = [...document.pages];
  pages.splice(Math.max(0, Math.min(index, pages.length)), 0, page);
  return { ...document, pages };
}

function collectNodeIds(node: EngineNode, ids: string[] = []): string[] {
  ids.push(node.id);
  if (node.type === "frame") node.children.forEach((child) => collectNodeIds(child, ids));
  return ids;
}

function tokenMap(document: EngineDocumentV3, category: TokenCategory): Record<string, TokenValue<unknown>> {
  return document.tokens[category] as Record<string, TokenValue<unknown>>;
}

function hasAliasCycle(tokens: Record<string, TokenValue<unknown>>, name: string, alias?: string): boolean {
  const seen = new Set<string>([name]);
  let current = alias;
  while (current) {
    if (seen.has(current)) return true;
    seen.add(current);
    current = tokens[current]?.alias;
  }
  return false;
}

export function setToken<C extends TokenCategory>(document: EngineDocumentV3, category: C, name: string, token: TokenSet[C][string]): EngineDocumentV3 {
  const tokens = tokenMap(document, category);
  const next = { ...tokens, [name]: token };
  if (token.alias && !next[token.alias]) throw new Error(`Token alias target not found: ${token.alias}`);
  if (hasAliasCycle(next, name, token.alias)) throw new Error(`Token alias cycle: ${name}`);
  return { ...document, tokens: { ...document.tokens, [category]: next } };
}

export function removeToken(document: EngineDocumentV3, category: TokenCategory, name: string): EngineDocumentV3 {
  const tokens = tokenMap(document, category);
  if (!tokens[name]) throw new Error(`Token not found: ${category}.${name}`);
  if (Object.values(tokens).some((token) => token.alias === name)) throw new Error(`Token is referenced: ${category}.${name}`);
  const next = { ...tokens };
  delete next[name];
  return { ...document, tokens: { ...document.tokens, [category]: next } };
}
