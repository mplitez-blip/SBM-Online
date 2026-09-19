import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlPort = Number(process.env.SQL_PORT || 5432);
const sqlDbName = process.env.SQL_DB_NAME;
const sqlUser = process.env.SQL_USER;
const sqlPassword = process.env.SQL_PASSWORD;

if (!sqlHost) {
  throw new Error('SQL_HOST must be set.');
}

if (!sqlDbName) {
  throw new Error('SQL_DB_NAME must be set.');
}

if (!sqlUser) {
  throw new Error('SQL_USER must be set.');
}

if (!sqlPassword) {
  throw new Error('SQL_PASSWORD must be set.');
}

if (!Number.isInteger(sqlPort) || sqlPort < 1 || sqlPort > 65535) {
  throw new Error('SQL_PORT must be a valid integer between 1 and 65535.');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  dbCredentials: {
    host: sqlHost,
    port: sqlPort,
    user: sqlUser,
    password: sqlPassword,
    database: sqlDbName,
    ssl: false,
  },
  verbose: true,
  strict: true,
});
