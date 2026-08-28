"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pollEngineV2Collaboration, submitEngineV2Transaction, updatePresence } from "@/app/actions/collaboration";
import {
  findEngineTransactionConflict,
  type EngineEditCursor,
  type EngineTransactionConflict,
  type EngineTransactionEnvelope,
  type EngineTransactionRecord,
} from "@/lib/engine-v2/collaboration";
import type { EngineDocumentTransaction } from "@/lib/engine-v2/transactions";

const INITIAL_CURSOR: EngineEditCursor = { createdAt: "1970-01-01T00:00:00.000Z", id: "" };

export type EngineCollaborationPresence = {
  userId: string;
  sessionId: string;
  selectionId: string | null;
  color: string;
  lastHeartbeat: string;
};

export type EngineCollaborationStatus = "off" | "connecting" | "synced" | "offline";

export function useEngineV2Collaboration({
  projectId,
  selectionId,
  onRecords,
}: {
  projectId: string | null;
  selectionId: string;
  onRecords: (records: EngineTransactionRecord[], pending: EngineDocumentTransaction[]) => void;
}) {
  const [status, setStatus] = useState<EngineCollaborationStatus>(projectId ? "connecting" : "off");
  const [presence, setPresence] = useState<EngineCollaborationPresence[]>([]);
  const [conflicts, setConflicts] = useState<EngineTransactionConflict[]>([]);
  const clientIdRef = useRef(`engine-${crypto.randomUUID()}`);
  const cursorRef = useRef<EngineEditCursor>(INITIAL_CURSOR);
  const recordsRef = useRef<EngineTransactionRecord[]>([]);
  const outboxRef = useRef(new Map<string, EngineTransactionEnvelope>());
  const pollingRef = useRef(false);
  const mountedRef = useRef(true);
  const selectionRef = useRef(selectionId);
  const onRecordsRef = useRef(onRecords);

  useEffect(() => {
    selectionRef.current = selectionId;
    onRecordsRef.current = onRecords;
  }, [onRecords, selectionId]);

  const flushOutbox = useCallback(async () => {
    if (!projectId) return;
    for (const envelope of [...outboxRef.current.values()]) {
      const result = await submitEngineV2Transaction(projectId, envelope);
      if (!result.success) throw new Error(result.error);
    }
  }, [projectId]);

  const poll = useCallback(async () => {
    if (!projectId || pollingRef.current) return;
    pollingRef.current = true;
    try {
      await flushOutbox();
      let hasMore = true;
      while (hasMore) {
        const result = await pollEngineV2Collaboration(projectId, cursorRef.current);
        if (!result.success) throw new Error(result.error);
        if (!mountedRef.current) return;
        setPresence(result.presence.filter((entry) => entry.sessionId !== clientIdRef.current));

        if (result.records.length) {
          const known = recordsRef.current;
          const nextConflicts: EngineTransactionConflict[] = [];
          const batch: EngineTransactionRecord[] = [];
          for (const record of result.records) {
            if (known.some((existing) => existing.cursor.id === record.cursor.id) || batch.some((existing) => existing.cursor.id === record.cursor.id)) continue;
            for (const other of [...known, ...batch]) {
              const conflict = findEngineTransactionConflict(other, record);
              if (conflict && (other.clientId === clientIdRef.current || record.clientId === clientIdRef.current)) nextConflicts.push(conflict);
            }
            batch.push(record);
            if (record.clientId === clientIdRef.current) outboxRef.current.delete(record.transaction.id);
          }
          if (batch.length) {
            recordsRef.current = [...known, ...batch].slice(-500);
            if (nextConflicts.length) {
              setConflicts((current) => {
                const ids = new Set(current.map((conflict) => `${conflict.leftTransactionId}:${conflict.rightTransactionId}`));
                return [...current, ...nextConflicts.filter((conflict) => !ids.has(`${conflict.leftTransactionId}:${conflict.rightTransactionId}`))].slice(-20);
              });
            }
            onRecordsRef.current(batch, [...outboxRef.current.values()].map((entry) => entry.transaction));
          }
        }
        cursorRef.current = result.nextCursor;
        hasMore = result.hasMore;
      }
      setStatus(outboxRef.current.size ? "connecting" : "synced");
    } catch {
      if (mountedRef.current) setStatus("offline");
    } finally {
      pollingRef.current = false;
    }
  }, [flushOutbox, projectId]);

  useEffect(() => {
    mountedRef.current = true;
    cursorRef.current = INITIAL_CURSOR;
    recordsRef.current = [];
    outboxRef.current.clear();
    const resetTimer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setConflicts([]);
      setPresence([]);
      setStatus(projectId ? "connecting" : "off");
    }, 0);
    if (!projectId) {
      return () => {
        mountedRef.current = false;
        window.clearTimeout(resetTimer);
      };
    }

    void updatePresence(projectId, clientIdRef.current, undefined, undefined, selectionRef.current);
    void poll();
    const pollTimer = window.setInterval(() => void poll(), 1500);
    const presenceTimer = window.setInterval(() => {
      void updatePresence(projectId, clientIdRef.current, undefined, undefined, selectionRef.current);
    }, 10_000);
    return () => {
      mountedRef.current = false;
      window.clearTimeout(resetTimer);
      window.clearInterval(pollTimer);
      window.clearInterval(presenceTimer);
    };
  }, [poll, projectId]);

  const publish = useCallback((transaction: EngineDocumentTransaction) => {
    if (!projectId || !transaction.operations.length) return;
    const envelope: EngineTransactionEnvelope = {
      transaction,
      clientId: clientIdRef.current,
      baseCursor: cursorRef.current,
    };
    outboxRef.current.set(transaction.id, envelope);
    setStatus("connecting");
    void poll();
  }, [poll, projectId]);

  return {
    status,
    presence,
    conflicts,
    publish,
    retry: poll,
    dismissConflicts: () => setConflicts([]),
  };
}
