import { TARGET_SOURCES } from './sources';
import { scrapeAll } from './orchestrator';
import { formatResults } from './formatter';

async function main(): Promise<void> {
  const { entries, errors } = await scrapeAll(TARGET_SOURCES);
  const output = formatResults(entries, errors);
  console.log(output);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
