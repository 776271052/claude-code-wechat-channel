import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { Loader2, RefreshCw, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useQRLogin } from '../hooks/useQRLogin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription } from '../components/ui/alert'

export default function LoginPage() {
  const navigate = useNavigate()
  const onSuccess = useCallback(() => navigate('/dashboard'), [navigate])
  const { qrData, status, fetchQR, refresh } = useQRLogin(onSuccess)

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50 p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-8">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="h-12 w-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto shadow-lg shadow-blue-600/20">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Claude Code WeChat</h1>
          <p className="text-sm text-gray-400">微信 ClawBot 连接助手</p>
        </div>

        {/* Steps */}
        <div className="flex w-full max-w-xs items-center justify-between text-[11px]">
          {['扫码', '确认', '连接'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-gray-200" />}
              <div className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-blue-600 text-[10px] font-bold">{i + 1}</span>
              </div>
              <span className="text-gray-500">{step}</span>
            </div>
          ))}
        </div>

        <Card className="w-full border-gray-200">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg flex items-center justify-center gap-2 text-gray-800">
              {status === 'idle' && <><LogIn className="h-5 w-5 text-blue-600" />准备登录</>}
              {status === 'loading' && <><Loader2 className="h-5 w-5 text-blue-600 animate-spin" />获取二维码中</>}
              {status === 'error' && <><AlertCircle className="h-5 w-5 text-red-500" />连接失败</>}
              {status === 'wait' && <><Loader2 className="h-5 w-5 text-blue-600 animate-spin" />等待扫码</>}
              {status === 'scanned' && <><CheckCircle2 className="h-5 w-5 text-amber-500" />已扫码</>}
              {status === 'expired' && <><AlertCircle className="h-5 w-5 text-gray-400" />二维码已过期</>}
              {status === 'confirmed' && <><CheckCircle2 className="h-5 w-5 text-emerald-500" />登录成功</>}
            </CardTitle>
            <CardDescription className="text-sm text-gray-400">
              {status === 'idle' && '点击下方按钮开始扫码登录'}
              {status === 'loading' && '正在向微信服务器请求二维码...'}
              {status === 'wait' && '请使用微信扫描下方二维码'}
              {status === 'scanned' && '请在手机上确认登录'}
              {status === 'expired' && '二维码已失效，请刷新重试'}
              {status === 'confirmed' && '正在跳转到控制台...'}
              {status === 'error' && '无法获取二维码，请检查网络后重试'}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-6">
            {status === 'idle' && (
              <Button size="lg" onClick={fetchQR} className="w-full gap-2 h-11">
                <LogIn className="h-4 w-4" />扫码登录
              </Button>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                <span className="text-sm text-gray-400">请稍候...</span>
              </div>
            )}

            {status === 'error' && (
              <>
                <Alert variant="destructive" className="w-full"><AlertCircle className="h-4 w-4" /><AlertDescription>获取二维码失败，请检查网络连接后重试</AlertDescription></Alert>
                <Button size="lg" onClick={fetchQR} className="w-full gap-2 h-11"><RefreshCw className="h-4 w-4" />重试</Button>
              </>
            )}

            {(status === 'wait' || status === 'scanned' || status === 'expired') && qrData && (
              <div className="flex flex-col items-center gap-5">
                <div className={`rounded-xl bg-white p-4 shadow-lg border border-gray-100 transition-opacity ${status === 'expired' ? 'opacity-30' : ''}`}>
                  <QRCodeSVG value={qrData.qrcode_img_content} size={200} bgColor="#ffffff" fgColor="#000000" level="H" />
                </div>
                {status === 'wait' && <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="h-4 w-4 animate-spin" />等待扫码中...</div>}
                {status === 'scanned' && <div className="flex items-center gap-2 text-sm text-amber-600"><CheckCircle2 className="h-4 w-4" />已扫码，请在微信中确认</div>}
                {status === 'expired' && <Button variant="outline" onClick={refresh} className="gap-2"><RefreshCw className="h-4 w-4" />刷新二维码</Button>}
              </div>
            )}

            {status === 'confirmed' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle2 className="h-14 w-14 text-emerald-500" />
                <span className="text-base font-medium text-emerald-600">微信登录成功</span>
                <span className="text-sm text-gray-400">正在跳转到控制台...</span>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-gray-400">请确保已安装 Claude CLI 并在设置中配置路径</p>
      </div>
    </div>
  )
}
