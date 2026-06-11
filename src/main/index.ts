// Electron Main Process Entry Point
import { app, BrowserWindow, Menu } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { createMainWindow } from './window'
import { registerIpcHandlers } from './ipc-handlers'
import { createTray } from './tray'
import { setLoggerWindow } from './utils/logger'
import { ensureDirs } from './utils/paths'
import { BotController } from './modules/bot-controller'

let mainWindow: BrowserWindow | null = null
const bot = new BotController()

app.whenReady().then(() => {
  Menu.setApplicationMenu(null)
  electronApp.setAppUserModelId('com.claude-code.wechat-gui')

  // Default open/close devtools in dev with F12
  if (is.dev) {
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })
  }

  ensureDirs()
  mainWindow = createMainWindow()
  setLoggerWindow(mainWindow)
  registerIpcHandlers(bot, mainWindow)
  createTray(mainWindow, bot)

  mainWindow.on('closed', () => {
    mainWindow = null
    setLoggerWindow(null)
  })
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('before-quit', () => {
  ;(app as any).isQuitting = true
  bot.stop().catch(() => {})
})
