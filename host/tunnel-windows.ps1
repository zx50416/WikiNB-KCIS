# Cloudflare Quick Tunnel（Windows）→ http://127.0.0.1:8788
$ErrorActionPreference = "Stop"
$Port = if ($env:PORT) { $env:PORT } else { "8788" }

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
  Write-Host "尚未安裝 cloudflared。"
  Write-Host "請安裝後再執行：https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
  exit 1
}

Write-Host "=== Cloudflare Quick Tunnel → http://127.0.0.1:$Port ==="
Write-Host "請先另開視窗執行：.\host\start-windows.ps1"
Write-Host ""
Write-Host "把顯示的 https://xxxx.trycloudflare.com 寫入："
Write-Host "  - config/sites.json → auth.productionUrl"
Write-Host "  - auth/.env → AUTH_BASE_URL"
Write-Host "然後重啟 Auth 並 git push 更新 Pages。"
Write-Host ""

cloudflared tunnel --url "http://127.0.0.1:$Port"
