import { spawn } from 'node:child_process'

const files = [
  'tools/course-list.self-check.mjs',
  'tools/course-0030-subtitle.self-check.mjs',
  'apps/web/src/components/lesson/courseFilter.self-check.mjs',
  'apps/web/src/components/lesson/playbackMode.self-check.mjs',
  'apps/web/src/components/lesson/playerVisibility.self-check.mjs',
  'apps/web/src/components/lesson/seekBehavior.self-check.mjs',
  'apps/web/src/components/lesson/subtitleLine.self-check.mjs',
  'apps/web/src/components/lesson/subtitleScroll.self-check.mjs',
  'apps/web/src/data/progressStore.self-check.mjs',
  'apps/web/src/data/reviewStore.self-check.mjs',
]

for (const file of files) {
  await run(file)
}

function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { stdio: 'inherit' })
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${file} failed${signal ? ` via ${signal}` : ` with code ${code}`}`))
    })
  })
}
