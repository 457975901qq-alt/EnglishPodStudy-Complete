import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Download ecdict.mini.csv from:
// https://github.com/skywind3000/ECDICT/blob/master/ecdict.mini.csv
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dictDir = path.join(rootDir, 'resource', 'dict')
const sourcePath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(dictDir, 'ecdict.mini.csv')
const outputDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : process.env.ENGLISHPOD_DICT_DIR
    ? path.resolve(process.env.ENGLISHPOD_DICT_DIR)
    : dictDir
const lookupPath = path.join(outputDir, 'lookup.json')
const lemmasPath = path.join(outputDir, 'lemmas.json')

const columns = [
  'word',
  'phonetic',
  'definition',
  'translation',
  'pos',
  'collins',
  'oxford',
  'tag',
  'bnc',
  'frq',
  'exchange',
  'detail',
  'audio',
]

function stripWord(word) {
  return Array.from(word)
    .filter((char) => /[a-z0-9]/i.test(char))
    .join('')
    .toLowerCase()
}

function parseCsv(content) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      row.push(field)
      field = ''
      continue
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') index += 1
      row.push(field)
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
      continue
    }

    field += char
  }

  row.push(field)
  if (row.some((value) => value !== '')) rows.push(row)

  return rows
}

function toRecord(row) {
  return Object.fromEntries(columns.map((name, index) => [name, row[index] ?? '']))
}

function addLemma(lemmas, form, lemma) {
  const normalizedForm = stripWord(form)
  const normalizedLemma = stripWord(lemma)
  if (normalizedForm && normalizedLemma && normalizedForm !== normalizedLemma) {
    lemmas[normalizedForm] ??= normalizedLemma
  }
}

function addExchangeLemmas(lemmas, word, exchange) {
  if (!exchange) return

  for (const item of exchange.split('/')) {
    const separator = item.indexOf(':')
    if (separator < 1) continue

    const type = item.slice(0, separator)
    const value = item.slice(separator + 1)
    if (!value) continue

    if (type === '0') {
      addLemma(lemmas, word, value)
    } else {
      addLemma(lemmas, value, word)
    }
  }
}

function lookupPriority(key, word) {
  const normalizedWord = word.toLowerCase()
  let priority = 0

  // ECDICT contains entries such as "at-tack", "b-e" and "ba-by".
  // Their stripped aliases collide with the normal words "attack", "be"
  // and "baby". Prefer the spelling that actually matches the query.
  if (normalizedWord === key) priority += 100
  if (stripWord(word) === key) priority += 10
  return priority
}

function addLookupAlias(lookup, priorities, key, entry) {
  if (!key) return

  const priority = lookupPriority(key, entry.word)
  if (!lookup[key] || priority > (priorities[key] ?? -Infinity)) {
    lookup[key] = entry
    priorities[key] = priority
  }
}

async function main() {
  const content = await readFile(sourcePath, 'utf8')
  const rows = parseCsv(content.replace(/^\uFEFF/, ''))
  const [, ...entries] =
    rows[0]?.[0]?.toLowerCase() === 'word' ? rows : [columns, ...rows]

  const lookup = {}
  const lookupPriorities = {}
  const lemmas = {}

  for (const row of entries) {
    const record = toRecord(row)
    const word = record.word.trim()
    const normalizedWord = word.toLowerCase()
    if (!word || !record.translation.trim()) continue

    const entry = {
      word,
      phonetic: record.phonetic.trim(),
      pos: record.pos.trim(),
      translation: record.translation.trim(),
    }

    addLookupAlias(lookup, lookupPriorities, normalizedWord, entry)
    addLookupAlias(lookup, lookupPriorities, stripWord(word), entry)
    addExchangeLemmas(lemmas, word, record.exchange)
  }

  await mkdir(outputDir, { recursive: true })
  await writeFile(lookupPath, `${JSON.stringify(lookup)}\n`)
  await writeFile(lemmasPath, `${JSON.stringify(lemmas)}\n`)

  console.log(
    `Built ${Object.keys(lookup).length} lookup keys and ${Object.keys(lemmas).length} lemma keys.`,
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
