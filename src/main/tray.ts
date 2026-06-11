// System Tray — minimize to tray, context menu
import { Tray, Menu, nativeImage, type BrowserWindow, app } from 'electron'
import { join } from 'node:path'
import { BotController } from './modules/bot-controller'

export function createTray(mainWindow: BrowserWindow, bot: BotController): Tray {
  // Create a simple icon (16x16 green circle as placeholder)
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA0ElEQVQ4T6WTsQ3CQBBE3wgHOHQBLoGERAlOKIAKnEAJ1OCECqjBOIASHHIJkG7ByNixjn+4y5Z2Znb33smAHzPxA3qY9QG4ALgAOOksmFuwBrABcAZwBLDTWTC34ArgCGBvySdL3gKYW/AJ4ARgZ8mTJY8BjC35A+BqwR9LPgGYWvJkyVcAI0u+WPIJwMiSJ0seAxha8mTJYwBDS54seQxgaMmTJY8BDC15suQxgKElT5Y8BjC05MmSxwCGlry05N2/D3kM4OvBkn8AvFn6/j86HJ8AAAAASUVORK5CYII='
  )

  const tray = new Tray(icon)
  tray.setToolTip('Claude Code WeChat')

  function updateMenu(): void {
    const status = bot.getStatus()
    const isRunning = status.state === 'running'
    const contextMenu = Menu.buildFromTemplate([
      { label: '显示窗口', click: () => { mainWindow.show(); mainWindow.focus() } },
      { type: 'separator' },
      {
        label: isRunning ? '停止 Bot' : '启动 Bot',
        enabled: status.state !== 'starting' && status.state !== 'stopping',
        click: async () => {
          if (isRunning) await bot.stop()
          else mainWindow.show()
        },
      },
      {
        label: '重启 Bot',
        enabled: isRunning,
        click: async () => { await bot.restart() },
      },
      { type: 'separator' },
      { label: '退出', click: () => { (app as any).isQuitting = true; app.quit() } },
    ])
    tray.setContextMenu(contextMenu)
  }

  updateMenu()
  // Update menu on status changes (poll every 2s)
  const interval = setInterval(updateMenu, 2000)

  tray.on('double-click', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  app.on('before-quit', () => clearInterval(interval))

  return tray
}
