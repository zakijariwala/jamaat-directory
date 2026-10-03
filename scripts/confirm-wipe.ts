// Guard for `npm run db:seed`: loading the sample seed into the REMOTE database
// first DELETES every city, contact, facility and flag — including real data.
// Requires typing the database name to continue.

import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log('\n⚠️  This WIPES the live database (all cities, contacts, listings, reports)');
console.log('   and replaces it with the fictional sample data.');
const answer = await rl.question('   Type "jamaat_directory" to continue: ');
rl.close();
if (answer.trim() !== 'jamaat_directory') {
  console.log('Cancelled.');
  process.exit(1);
}
