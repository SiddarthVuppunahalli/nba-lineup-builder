import { migrateDatabase } from './migrate-database.js';

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error('DATABASE_URL is required to run database migrations.');

await migrateDatabase(databaseUrl);
console.log('Lineup Engine database migrations are current.');
