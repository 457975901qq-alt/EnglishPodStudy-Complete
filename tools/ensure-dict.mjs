import { stat } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const sourcePath = process.env.ENGLISHPOD_DICT_SOURCE
  ? path.resolve(process.env.ENGLISHPOD_DICT_SOURCE)
  : path.join(rootDir, 'resource', 'dict', 'ecdict.mini.csv')
const outputDir = process.env.ENGLISHPOD_DICT_DIR
  ? path.resolve(process.env.ENGLISHPOD_DICT_DIR)
  : path.join(rootDir, 'resource', 'dict')
const outputPaths = [
  path.join(outputDir, 'lookup.json'),
  path.join(outputDir, 'lemmas.json'),
]

async function fileStat(filePath) {
  try {
    return await stat(filePath)
  } catch {
    return null
  }
}

async function main() {
  const sourceStat = await fileStat(sourcePath)
  if (!sourceStat) {
    console.warn(`Dictionary source not found: ${sourcePath}`)
    return
  }

  const outputStats = await Promise.all(outputPaths.map(fileStat))
  if (outputStats.every((item) => item && item.mtimeMs >= sourceStat.mtimeMs)) return

  await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [path.join(__dirname, 'build-dict.mjs'), sourcePath, outputDir],
      { stdio: 'inherit' },
    )
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`Dictionary build failed${signal ? ` via ${signal}` : ` with code ${code}`}`))
    })
  })
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
