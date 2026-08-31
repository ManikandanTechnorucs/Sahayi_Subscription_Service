import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../../../generated/prisma/client';
import { config } from '../../config/src/config';

const createMariaDbConfig = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const sslRequired =
    url.searchParams.has('sslaccept') ||
    url.searchParams.get('ssl') === 'true' ||
    url.hostname.endsWith('.mysql.database.azure.com');

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    ...(sslRequired ? { ssl: true } : {}),
  };
};

const adapter = new PrismaMariaDb(createMariaDbConfig(config.DATABASE_URL));

/**
 * Shared Prisma client instance.
 */
export const prisma = new PrismaClient({ adapter });