import type { EngineDocumentV3, EngineNode, TokenSet } from "./document.ts";

export type EngineV3Issue = { path: string; message: string };
export type EngineV3ValidationResult =
  | { ok: true; document: EngineDocumentV3 }
  | { ok: false; issues: EngineV3Issue[] };

const idPattern = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const mimePattern = /^[a-z][a-z0-9.+-]*\/[a-z0-9.+-]+$/;
const nodeTypes = new Set(["frame", "text", "metric", "chart", "graph", "image"]);
const safeString = (value: unknown, max = 240): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !/[<>`]/.test(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function validateEngineV3Document(input: unknown): EngineV3ValidationResult {
  const issues: EngineV3Issue[] = [];
  const ids = new Set<string>();
  const components = new Set<string>();
  const add = (path: string, message: string) => issues.push({ path, message });
  const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
  if (!record(input)) return { ok: false, issues: [{ path: "$", message: "Expected an object" }] };
  if (input.version !== 3 || input.engine !== "dom-css") add("$", "Expected Engine v3 dom-css document");
  if (!record(input.metadata)) add("metadata", "Expected metadata");
  else for (const key of ["id", "name", "createdAt", "updatedAt"]) if (!safeString(input.metadata[key])) add(`metadata.${key}`, "Expected a safe non-empty string");
  const tokenSets: (keyof TokenSet)[] = ["colors", "spacing", "radii", "typography", "shadows", "motion"];
  if (!record(input.tokens)) add("tokens", "Expected token sets");
  else for (const set of tokenSets) {
    const values = input.tokens[set];
    if (!record(values)) { add(`tokens.${set}`, "Expected an object"); continue; }
    for (const [name, token] of Object.entries(values)) {
      if (!idPattern.test(name) || !record(token)) { add(`tokens.${set}.${name}`, "Invalid token"); continue; }
      if (token.alias !== undefined && (!safeString(token.alias) || !Object.hasOwn(values, token.alias))) add(`tokens.${set}.${name}.alias`, "Alias must reference a token in the same set");
      if ((set === "spacing" || set === "radii") && !finite(token.value)) add(`tokens.${set}.${name}.value`, "Expected a finite number");
      if ((set === "colors" || set === "shadows") && !safeString(token.value, 160)) add(`tokens.${set}.${name}.value`, "Expected a safe string");
    }
    for (const name of Object.keys(values)) {
      const seen = new Set<string>([name]);
      let alias = record(values[name]) && typeof values[name].alias === "string" ? values[name].alias : undefined;
      while (alias) {
        if (seen.has(alias)) { add(`tokens.${set}.${name}.alias`, "Token alias cycle"); break; }
        seen.add(alias);
        const target = values[alias];
        alias = record(target) && typeof target.alias === "string" ? target.alias : undefined;
      }
    }
  }
  if (!record(input.assets)) add("assets", "Expected an object");
  else for (const [assetId, asset] of Object.entries(input.assets)) {
    if (!sha256Pattern.test(assetId) || !record(asset) || asset.sha256 !== assetId || !mimePattern.test(String(asset.mime)) || !safeString(asset.source, 2000)) add(`assets.${assetId}`, "Invalid asset reference");
    if (record(asset) && ((asset.width !== undefined && (!finite(asset.width) || asset.width <= 0)) || (asset.height !== undefined && (!finite(asset.height) || asset.height <= 0)))) add(`assets.${assetId}`, "Asset dimensions must be positive finite numbers");
  }
  if (!record(input.components)) add("components", "Expected an object");
  else for (const [key, component] of Object.entries(input.components)) {
    components.add(key);
    if (!record(component) || component.id !== key || !idPattern.test(key) || !safeString(component.name) || !component.root) add(`components.${key}`, "Invalid component definition");
  }
  if (!Array.isArray(input.pages) || input.pages.length === 0) add("pages", "Expected at least one page");
  const walk = (node: unknown, path: string, seenIds: Set<string>, dependencies?: Set<string>) => {
    if (!record(node) || !idPattern.test(String(node.id)) || !safeString(node.name) || !safeString(node.type) || !nodeTypes.has(String(node.type))) { add(path, "Invalid node identity"); return; }
    if (seenIds.has(String(node.id))) add(`${path}.id`, "Duplicate node id"); else seenIds.add(String(node.id));
    if (node.opacity !== undefined && (!finite(node.opacity) || node.opacity < 0 || node.opacity > 1)) add(`${path}.opacity`, "Opacity must be 0..1");
    if (node.transform !== undefined) {
      if (!record(node.transform)) add(`${path}.transform`, "Expected a transform object");
      else for (const key of ["x", "y", "rotation", "scaleX", "scaleY"]) if (node.transform[key] !== undefined && !finite(node.transform[key])) add(`${path}.transform.${key}`, "Expected a finite number");
    }
    for (const ref of ["styleRef", "assetRef", "componentRef"]) if (node[ref] !== undefined && !safeString(node[ref])) add(`${path}.${ref}`, "Invalid reference");
    if (node.assetRef !== undefined && (!record(input.assets) || !Object.hasOwn(input.assets, String(node.assetRef)))) add(`${path}.assetRef`, "Unknown asset");
    if (node.type === "image" && node.assetRef === undefined && !safeString(node.src, 2000)) add(`${path}.src`, "Image requires a safe source or asset reference");
    if (node.componentRef !== undefined) {
      const componentRef = String(node.componentRef);
      if (!components.has(componentRef)) add(`${path}.componentRef`, "Unknown component");
      else dependencies?.add(componentRef);
    }
    if (node.type === "frame") { if (!Array.isArray(node.children)) add(`${path}.children`, "Expected children array"); else node.children.forEach((child: unknown, i: number) => walk(child, `${path}.children[${i}]`, seenIds, dependencies)); }
  };
  const componentDependencies = new Map<string, Set<string>>();
  if (record(input.components)) for (const [key, component] of Object.entries(input.components)) {
    if (!record(component) || !component.root) continue;
    const dependencies = new Set<string>();
    walk(component.root, `components.${key}.root`, new Set(), dependencies);
    componentDependencies.set(key, dependencies);
  }
  const visitComponent = (id: string, path: string[], visited: Set<string>) => {
    if (path.includes(id)) { add(`components.${id}`, "Component cycle"); return; }
    if (visited.has(id)) return;
    for (const dependency of componentDependencies.get(id) ?? []) visitComponent(dependency, [...path, id], visited);
    visited.add(id);
  };
  const visitedComponents = new Set<string>();
  for (const id of componentDependencies.keys()) visitComponent(id, [], visitedComponents);
  if (Array.isArray(input.pages)) input.pages.forEach((page: unknown, i: number) => {
    if (!record(page) || !idPattern.test(String(page.id)) || !safeString(page.name) || (!finite(page.width) || page.width <= 0) || (page.height !== "auto" && (!finite(page.height) || page.height <= 0)) || !page.root) { add(`pages[${i}]`, "Invalid page"); return; }
    if (ids.has(String(page.id))) add(`pages[${i}].id`, "Duplicate id"); else ids.add(String(page.id));
    walk(page.root, `pages[${i}].root`, ids);
  });
  return issues.length ? { ok: false, issues } : { ok: true, document: input as unknown as EngineDocumentV3 };
}
