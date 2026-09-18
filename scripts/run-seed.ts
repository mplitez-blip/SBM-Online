import dotenv from 'dotenv';
dotenv.config();
import { seedDatabase } from '../src/db/seed.ts';

async function main() {
  try {
    await seedDatabase();
    console.log('Seeding finished successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

main();
