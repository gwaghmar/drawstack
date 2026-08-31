import type { AssetRef, ComponentDefinition, ComponentInstance, EngineDocumentV3, EngineNode } from "./document.ts";

export async function sha256Hex(value: string | ArrayBuffer): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function registerAsset(assets: Record<string, AssetRef>, content: string | ArrayBuffer, metadata: Omit<AssetRef, "sha256" | "source"> & { source?: string }): Promise<{ assets: Record<string, AssetRef>; asset: AssetRef; created: boolean }> {
  const sha256 = await sha256Hex(content);
  const existing = assets[sha256];
  if (existing) return { assets, asset: existing, created: false };
  const asset: AssetRef = { ...metadata, sha256, source: metadata.source ?? "asset:" + sha256 };
  return { assets: { ...assets, [sha256]: asset }, asset, created: true };
}

function walk(node: EngineNode, visit: (node: EngineNode) => void): void {
  visit(node);
  if (node.type === "frame") node.children.forEach((child) => walk(child, visit));
}
function clone<T>(value: T): T { return structuredClone(value); }

export function defineComponent(components: Record<string, ComponentDefinition>, id: string, name: string, root: EngineNode): { components: Record<string, ComponentDefinition>; component: ComponentDefinition } {
  if (!id || components[id]) throw new Error("Component " + id + " already exists");
  const component: ComponentDefinition = { id, name, root: clone(root), slots: [], variants: {} };
  const next = { ...components, [id]: component };
  validateComponents(next);
  return { components: next, component };
}

export function validateComponents(components: Record<string, ComponentDefinition>): void {
  for (const definition of Object.values(components)) walk(definition.root, (node) => {
    if (!node.componentRef) return;
    if (!components[node.componentRef]) throw new Error("Component " + definition.id + " references missing component " + node.componentRef);
    if (node.componentRef === definition.id) throw new Error("Component " + definition.id + " cannot reference itself");
  });
  const visit = (id: string, path: Set<string>): void => {
    if (path.has(id)) throw new Error("Component recursion detected at " + id);
    const next = new Set(path).add(id);
    walk(components[id].root, (node) => { if (node.componentRef) visit(node.componentRef, next); });
  };
  Object.keys(components).forEach((id) => visit(id, new Set()));
}

export function instantiateComponent(document: Pick<EngineDocumentV3, "components">, componentRef: string, id: string, overrides: Record<string, unknown> = {}): ComponentInstance {
  validateComponents(document.components);
  const definition = document.components[componentRef];
  if (!definition) throw new Error("Component " + componentRef + " does not exist");
  const instance = clone(definition.root) as ComponentInstance;
  instance.id = id;
  instance.componentRef = componentRef;
  instance.instanceOverrides = clone(overrides);
  for (const [path, value] of Object.entries(overrides)) {
    const parts = path.split(".");
    if (!parts.length || parts.some((part) => !part || part === "__proto__" || part === "prototype" || part === "constructor")) throw new Error("Invalid override path " + path);
    let target: Record<string, unknown> = instance as unknown as Record<string, unknown>;
    for (const part of parts.slice(0, -1)) {
      if (!target[part] || typeof target[part] !== "object") throw new Error("Invalid override path " + path);
      target = target[part] as Record<string, unknown>;
    }
    target[parts.at(-1)!] = clone(value);
  }
  return instance;
}

export function detachComponentInstance(instance: ComponentInstance): EngineNode {
  const detached = clone(instance) as Partial<ComponentInstance> & EngineNode;
  delete detached.componentRef;
  delete detached.instanceOverrides;
  return detached;
}
