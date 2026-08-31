import postgres from "postgres";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { isConnectionRefusedError, isMockDbEnabled } from "./mode";

type DB = PostgresJsDatabase<typeof schema>;
type PromiseThen = Parameters<Promise<unknown[]>["then"]>[0];
type DbCallable = (...args: unknown[]) => unknown;

const g = globalThis as unknown as {
  __flowchartPostgres?: ReturnType<typeof postgres>;
  __flowchartDb?: DB;
};

// Simple Mock DB to allow UI prototyping without a real Postgres instance.
// It supports basic chainable Drizzle patterns used in the app.
const mockTables = new Map<object, Record<string, unknown>[]>();

function mockTableRows(table: object) {
  const rows = mockTables.get(table);
  if (rows) return rows;
  const created: Record<string, unknown>[] = [];
  mockTables.set(table, created);
  return created;
}

function mockConditionMatches(condition: unknown, row: Record<string, unknown>): boolean {
  if (!condition || typeof condition !== "object") return true;
  const chunks = (condition as { queryChunks?: unknown[] }).queryChunks;
  if (!chunks) return true;
  if (chunks.length === 1 && chunks[0] && typeof chunks[0] === "object") return mockConditionMatches(chunks[0], row);
  if (chunks.length === 3 && chunks[1] && typeof chunks[1] === "object") {
    const nested = (chunks[1] as { queryChunks?: unknown[] }).queryChunks;
    if (nested?.length === 3) {
      const left = nested[0] as { queryChunks?: unknown[] };
      const right = nested[2] as { queryChunks?: unknown[] };
      const leftMatch = mockConditionMatches(left, row);
      const rightMatch = mockConditionMatches(right, row);
      const operator = (chunks[1] as { queryChunks?: unknown[] }).queryChunks?.[1];
      const text = operator && typeof operator === "object" && "value" in operator ? String((operator as { value: string[] }).value[0]) : "and";
      return text.includes("or") ? leftMatch || rightMatch : leftMatch && rightMatch;
    }
  }
  const column = chunks.find((chunk) => chunk && typeof chunk === "object" && "name" in chunk) as { name?: string } | undefined;
  const param = chunks.find((chunk) => chunk && typeof chunk === "object" && "value" in chunk && "encoder" in chunk) as { value?: unknown } | undefined;
  if (!column || !param) return true;
  const table = (column as { table?: object }).table as object | undefined;
  const columnsSymbol = table && Object.getOwnPropertySymbols(table).find((symbol) => String(symbol) === "Symbol(drizzle:Columns)");
  const columns = columnsSymbol ? (table as Record<symbol, Record<string, unknown>>)[columnsSymbol] : undefined;
  const key = columns && Object.entries(columns).find(([, value]) => value === column)?.[0];
  return row[key ?? column.name!] === param.value;
}

function mockRowsQuery(rows: unknown[] = []) {
  const query = Promise.resolve(rows);
  return Object.assign(query, {
    orderBy: () => Promise.resolve(rows),
    limit: () => Promise.resolve(rows),
    returning: () => Promise.resolve(rows),
  });
}

function mockChain(rows: unknown[] = []) {
  const p = Promise.resolve(rows) as Promise<unknown[]> & Record<string, unknown>;
  const chain: Record<string, unknown> = {
    orderBy: () => mockChain(rows),
    limit: () => mockChain(rows),
    where: () => mockChain(rows),
    then: (cb: PromiseThen) => Promise.resolve(rows).then(cb),
    catch: (cb: (e: unknown) => unknown) => Promise.resolve(rows).catch(cb),
    finally: (cb: () => void) => Promise.resolve(rows).finally(cb),
  };
  return Object.assign(p, chain);
}

const mockDb = {
  select: (fields?: Record<string, unknown>) => ({
    from: (table: object) => {
      let rows = [...mockTableRows(table)];
      const query: Record<string, unknown> = {
        where: (condition: unknown) => { rows = rows.filter((row) => mockConditionMatches(condition, row)); return query; },
        orderBy: () => query,
        limit: (count: number) => { rows = rows.slice(0, count); return query; },
        then: (cb: PromiseThen) => Promise.resolve(fields ? rows.map((row) => Object.fromEntries(Object.entries(fields).map(([key, column]) => {
          const table = (column as { table?: object }).table as object | undefined;
          const columnsSymbol = table && Object.getOwnPropertySymbols(table).find((symbol) => String(symbol) === "Symbol(drizzle:Columns)");
          const columns = columnsSymbol ? (table as Record<symbol, Record<string, unknown>>)[columnsSymbol] : undefined;
          const rowKey = columns && Object.entries(columns).find(([, value]) => value === column)?.[0];
          return [key, row[rowKey ?? (column as { name: string }).name]];
        }))) : rows).then(cb),
        catch: (cb: (e: unknown) => unknown) => Promise.resolve(rows).catch(cb),
        finally: (cb: () => void) => Promise.resolve(rows).finally(cb),
      };
      return query;
    },
  }),
  insert: (table: object) => ({
    values: (values: Record<string, unknown> | Record<string, unknown>[]) => ({
      returning: () => { const rows = Array.isArray(values) ? values : [values]; mockTableRows(table).push(...rows); return mockRowsQuery(rows); },
      then: (cb: PromiseThen) => { const rows = Array.isArray(values) ? values : [values]; mockTableRows(table).push(...rows); return Promise.resolve(rows).then(cb); },
    }),
  }),
  update: (table: object) => ({
    set: (changes: Record<string, unknown>) => ({
      where: (condition: unknown) => { const rows = mockTableRows(table).filter((row) => mockConditionMatches(condition, row)); rows.forEach((row) => Object.assign(row, changes)); return mockRowsQuery(rows); },
    }),
  }),
  delete: (table: object) => ({
    where: (condition: unknown) => { const rows = mockTableRows(table); for (let i = rows.length - 1; i >= 0; i -= 1) if (mockConditionMatches(condition, rows[i])) rows.splice(i, 1); return Promise.resolve(); },
  }),
} as unknown as DB;

function createSql() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    if (isMockDbEnabled()) {
      console.warn("DATABASE_URL is missing. Falling back to MOCK_DB mode.");
      return null;
    }
    throw new Error("DATABASE_URL is required unless MOCK_DB is enabled.");
  }
  
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  // In dev/test, we want to fail fast if the DB isn't there to trigger the mock fallback.
  // In production, raise pool size to handle concurrent requests efficiently.
  return postgres(url, {
    max: isLocal ? 1 : 10,
    prepare: false,
    ssl: isLocal ? false : "require",
    connect_timeout: isLocal ? 2 : 10,
  });
}

function ensureDb(): DB {
  if (isMockDbEnabled()) {
    return mockDb;
  }
  if (!g.__flowchartDb) {
    const sql = createSql();
    if (!sql) {
      g.__flowchartDb = mockDb;
    } else {
      g.__flowchartPostgres = sql;
      g.__flowchartDb = drizzle(sql, { schema });
    }
  }
  return g.__flowchartDb!;
}

/** 
 * Lazy Postgres client so `next build` can run before DATABASE_URL exists.
 * In development, if the connection fails, it will throw an error on the first query.
 * The Proxy handles catching those errors and falling back to a mock implementation.
 */
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const real = ensureDb();
    const value = Reflect.get(real as object, prop, receiver);
    
    if (typeof value === "function") {
      const fn = value as DbCallable;
      return (...args: unknown[]) => {
        try {
          const result = fn.apply(real, args);
          
          // If the result is a query object with a 'then' method, it might fail later.
          if (result instanceof Promise) {
            return result.catch((err: unknown) => {
              if (isMockDbEnabled() && isConnectionRefusedError(err)) {
                console.warn(`DB connection refused for ${String(prop)}. Falling back to mock data.`);
                // Fallback: call the same method on the mockDb
                const mockFunc = (mockDb as unknown as Record<PropertyKey, unknown>)[prop];
                if (typeof mockFunc === "function") {
                  return (mockFunc as DbCallable).apply(mockDb, args);
                }
              }
              throw err;
            });
          }
          return result;
        } catch (err: unknown) {
          if (isMockDbEnabled() && isConnectionRefusedError(err)) {
            console.warn(`DB operation ${String(prop)} failed immediately. Falling back to mock.`);
            const mockFunc = (mockDb as unknown as Record<PropertyKey, unknown>)[prop];
            if (typeof mockFunc === "function") {
              return (mockFunc as DbCallable).apply(mockDb, args);
            }
          }
          throw err;
        }
      };
    }
    return value;
  },
});
