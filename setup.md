# Docker + WSL2 + Windows で Web / API / DB を他PCから使う設定まとめ

## 構成
他PC（192.168.3.x）
↓
Windows（192.168.3.212）
├─ portproxy (3000 / 5001 / 5432)
↓
WSL2（172.24.7.104）
↓
Docker containers
├─ React UI :3000
├─ Flask API:5001
└─ Postgres :5432

yaml
コードをコピーする

- Docker は **WSL2 上で起動**
- 他PCと同じ Wi-Fi（192.168.3.x）
- WSL の IP（172.24.x.x）は LAN から直接アクセス不可

---

## なぜ設定が必要だったか
- WSL2 は **独立した仮想ネットワーク**
- LAN（192.168.3.x）→ WSL（172.24.x.x）は直接通信できない
- **Windows 側でポート転送（portproxy）が必要**

---

## Docker 側の前提条件（必須）
### ポート公開
```bash
docker ps
# 例
0.0.0.0:3000->3000
0.0.0.0:5001->5001
0.0.0.0:5432->5432
アプリの listen
React / Flask / Postgres は 0.0.0.0 で待ち受け

Flask 例：

python
コードをコピーする
app.run(host="0.0.0.0", port=5001)
Windows 側の設定（管理者 PowerShell）
portproxy 設定
powershell
コードをコピーする
netsh interface portproxy add v4tov4 `
  listenaddress=0.0.0.0 listenport=3000 `
  connectaddress=172.24.7.104 connectport=3000

netsh interface portproxy add v4tov4 `
  listenaddress=0.0.0.0 listenport=5001 `
  connectaddress=172.24.7.104 connectport=5001

netsh interface portproxy add v4tov4 `
  listenaddress=0.0.0.0 listenport=5432 `
  connectaddress=172.24.7.104 connectport=5432
確認：

powershell
コードをコピーする
netsh interface portproxy show v4tov4
Windows Defender Firewall 許可
powershell
コードをコピーする
New-NetFirewallRule -DisplayName "WSL 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
New-NetFirewallRule -DisplayName "WSL 5001" -Direction Inbound -Protocol TCP -LocalPort 5001 -Action Allow
New-NetFirewallRule -DisplayName "WSL 5432" -Direction Inbound -Protocol TCP -LocalPort 5432 -Action Allow
アクセス方法（確定）
Windows 自身
http://localhost:3000

http://localhost:5001

localhost:5432

他PC（同じ Wi-Fi）
http://192.168.3.212:3000

http://192.168.3.212:5001

DB: 192.168.3.212:5432

動作確認
Web / API
bash
コードをコピーする
curl http://192.168.3.212:3000
curl http://192.168.3.212:5001
Flask ログ例：

arduino
コードをコピーする
172.24.0.1 "GET / HTTP/1.1" 404
※ 404 はルート未定義なだけで、通信は成功している

DB 接続確認（おすすめ）
Flask にヘルスチェックを追加
python
コードをコピーする
@app.get("/health/db")
def db_health():
    db.session.execute("SELECT 1")
    return {"db": "ok"}
bash
コードをコピーする
curl http://192.168.3.212:5001/health/db
DB 接続時の注意点（重要）
Docker Compose の場合：

DBホストはサービス名

text
コードをコピーする
POSTGRES_HOST=catanatron-db-1
❌ localhost
❌ 127.0.0.1

再起動時の挙動
操作	再設定
Docker up/down	不要
Windows 再起動	不要
WSL 再起動	IPが変わったら必要

WSL IP 確認
powershell
コードをコピーする
wsl hostname -I
トラブルシュート指針
症状	原因候補
localhost OK / 他PC NG	Wi-Fi 隔離 / FW
404 が返る	API パス違い
無反応	portproxy / FW
DB だけ NG	DB 接続先ホスト名

セキュリティ注意
開発用途限定

LAN 内のみ公開

使わない時は削除

powershell
コードをコピーする
netsh interface portproxy delete v4tov4 listenport=5001
まとめ
問題の本質：WSL2 は LAN から直接見えない

解決策：Windows portproxy

UI / API / DB すべて LAN 公開可能

この手順をそのまま再利用すればOK

yaml
コードをコピーする

---

必要なら次は  
- 🔁 **portproxy 自動更新スクリプト（WSL IP 変動対策）**  
- 🔐 **HTTPS 化（mkcert / nginx）**  
- 🐳 **Docker Desktop 側に寄せる構成**  

も Markdown でまとめます。