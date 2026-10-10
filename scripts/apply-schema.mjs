// Aplica db/schema.sql no banco apontado por DATABASE_URL:  npm run db:schema
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
const url = process.env.DATABASE_URL;
if (!url) { console.error('Defina DATABASE_URL'); process.exit(1); }
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'));
console.log('Schema aplicado.');
await sql.end();
