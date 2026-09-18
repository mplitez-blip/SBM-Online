import { PrismaClient } from '@prisma/client';

// Construct the PostgreSQL connection string dynamically from environment variables
// Supports both standard host:port and Cloud SQL Unix Domain Sockets
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.SQL_USER || 'postgres';
  const password = process.env.SQL_PASSWORD || '';
  const database = process.env.SQL_DB_NAME || 'postgres';
  const host = process.env.SQL_HOST || 'localhost';

  // If host is a Unix socket path (e.g. /app/cloudsql/...)
  if (host.startsWith('/')) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${encodeURIComponent(database)}?host=${encodeURIComponent(host)}`;
  }

  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${encodeURIComponent(database)}`;
}

declare global {
  var _prisma: PrismaClient | undefined;
}

export const prisma =
  global._prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global._prisma = prisma;
}

export default prisma;
