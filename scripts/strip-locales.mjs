import fs from 'fs'
import path from 'path'

// 只保留英文和中文 locale
const KEEP_LOCALES = new Set(['en-US.pak', 'en-GB.pak', 'zh-CN.pak', 'zh-TW.pak'])

export default async function afterPack(context) {
  const localesDir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(localesDir)) return

  const files = fs.readdirSync(localesDir)
  let removed = 0
  for (const file of files) {
    if (!KEEP_LOCALES.has(file)) {
      fs.unlinkSync(path.join(localesDir, file))
      removed++
    }
  }
  console.log(`Removed ${removed} locale files, kept ${KEEP_LOCALES.size}`)
}
