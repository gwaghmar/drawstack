"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pollEngineV3Collaboration, submitEngineV3Command, type EngineV3CommandRecord } from "@/app/actions/collaboration";
import type { EngineEditCursor } from "@/lib/engine-v2/collaboration";
import type { EngineV3CommandEnvelope } from "@/lib/engine-v3/commands";

const START: EngineEditCursor = { createdAt: "1970-01-01T00:00:00.000Z", id: "" };
export type EngineV3CollaborationStatus = "off" | "connecting" | "synced" | "offline";

export function useEngineV3Collaboration(projectId: string | null, actor: string, onRecords: (records: EngineV3CommandRecord[], pending: EngineV3CommandEnvelope[]) => void) {
  const cursorRef = useRef(START);
  const outboxRef = useRef(new Map<string, EngineV3CommandEnvelope>());
  const pollingRef = useRef(false);
  const mountedRef = useRef(true);
  const onRecordsRef = useRef(onRecords);
  const [status, setStatus] = useState<EngineV3CollaborationStatus>(projectId ? "connecting" : "off");
  useEffect(() => { onRecordsRef.current = onRecords; }, [onRecords]);

  const poll = useCallback(async () => {
    if (!projectId || pollingRef.current) return;
    pollingRef.current = true;
    try {
      for (const envelope of outboxRef.current.values()) {
        const sent = await submitEngineV3Command(projectId, envelope);
        if (!sent.success) throw new Error(sent.error);
      }
      let hasMore = true;
      while (hasMore) {
        const result = await pollEngineV3Collaboration(projectId, cursorRef.current);
        if (!result.success) throw new Error(result.error);
        if (!mountedRef.current) return;
        for (const record of result.records) if (record.envelope.actor === actor) outboxRef.current.delete(record.envelope.id);
        if (result.records.length) onRecordsRef.current(result.records, [...outboxRef.current.values()]);
        cursorRef.current = result.nextCursor; hasMore = result.hasMore;
      }
      setStatus(outboxRef.current.size ? "connecting" : "synced");
    } catch { if (mountedRef.current) setStatus("offline"); }
    finally { pollingRef.current = false; }
  }, [actor, projectId]);

  useEffect(() => {
    mountedRef.current = true; cursorRef.current = START; outboxRef.current.clear(); setStatus(projectId ? "connecting" : "off");
    if (!projectId) return () => { mountedRef.current = false; };
    void poll(); const timer = window.setInterval(() => void poll(), 1500);
    return () => { mountedRef.current = false; window.clearInterval(timer); };
  }, [poll, projectId]);

  const publish = useCallback((envelope: EngineV3CommandEnvelope) => { if (!projectId) return; outboxRef.current.set(envelope.id, envelope); setStatus("connecting"); void poll(); }, [poll, projectId]);
  return { status, publish, retry: poll };
}
