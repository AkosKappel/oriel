// Writes sample data as an Oriel JSON export: `npm run samples` (add `-- --big` for 2,000 more
// plain items). Load it in the app with Settings → Import a JSON export, signed in or not.
// Importing the same file twice adds nothing; a new file has new creation times, so it adds again.
import { writeFileSync } from 'node:fs'
import { buildSamples } from '../src/data/samples.ts'

const file = 'oriel-samples.json'
const extra = process.argv.includes('--big') ? 2000 : 0
const samples = buildSamples(new Date(), extra)
writeFileSync(file, JSON.stringify(samples, null, 2))
console.log(`Wrote ${samples.items.length} items to ${file}`)
