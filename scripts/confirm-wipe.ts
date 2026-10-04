// Guard for commands that wipe the REMOTE database (`npm run db:seed`,
// `npm run db:clear`). Requires typing the database name to continue.
// Pass a description of what happens next as the first argument.

import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const what = process.argv[2] ?? 'and replaces it with the fictional sample data.';
console.log('\n⚠️  This WIPES data in the live database');
console.log(`   ${what}`);
const answer = await rl.question('   Type "jamaat_directory" to continue: ');
rl.close();
if (answer.trim() !== 'jamaat_directory') {
  console.log('Cancelled.');
  process.exit(1);
}
