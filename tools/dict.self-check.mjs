import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const tempDir = await mkdtemp(path.join('/tmp', 'englishpod-dict-check-'))
const sourcePath = path.join(tempDir, 'source.csv')
const outputDir = path.join(tempDir, 'output')

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

function csvField(value) {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function row(word, translation) {
  return [word, '', '', translation, '', '', '', '', '', '', '', '', ''].map(csvField).join(',')
}

try {
  await writeFile(
    sourcePath,
    [
      columns.join(','),
      row('at-tack', 'n. 攻击；人名阿塔克'),
      row('attack', 'n. 攻击；抨击'),
      row('b-e', 'n. 人名贝；v. 是'),
      row('be', 'v. 是；存在'),
      row('ba-by', 'n. 人名巴比；n. 婴儿'),
      row('baby', 'n. 婴儿'),
    ].join('\n'),
  )

  await execFileAsync(process.execPath, [path.join(rootDir, 'tools', 'build-dict.mjs'), sourcePath, outputDir])
  const lookup = JSON.parse(await readFile(path.join(outputDir, 'lookup.json'), 'utf8'))

  assert.equal(lookup.attack.word, 'attack')
  assert.equal(lookup.attack.translation, 'n. 攻击；抨击')
  assert.equal(lookup.be.word, 'be')
  assert.equal(lookup.baby.word, 'baby')
  console.log('dictionary build checks passed')
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
