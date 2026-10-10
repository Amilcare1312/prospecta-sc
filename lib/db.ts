import postgres from 'postgres';

type Sql = postgres.Sql<Record<string, unknown>>;
const g = globalThis as unknown as { __sql?: Sql };

/** Conexão única (reaproveitada entre invocações quentes na Vercel). */
export function db(): Sql {
  if (!g.__sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL não configurada');
    const local = /localhost|127\.0\.0\.1/.test(url);
    g.__sql = postgres(url, {
      max: local ? 5 : 3,
      idle_timeout: 20,
      prepare: false, // compatível com poolers (Neon/Supabase)
      ssl: local ? false : 'require',
      onnotice: () => {},
      transform: { undefined: null },
      // bigint (ids) como number no JSON
      types: { bigint: { to: 20, from: [20], parse: (x: string): unknown => Number(x), serialize: (x: unknown) => String(x) } },
    }) as unknown as Sql;
  }
  return g.__sql!;
}
