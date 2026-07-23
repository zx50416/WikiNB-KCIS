# WikiNB KCIS Auth

預核名單 + 驗證碼設密碼 + 帳密登入。詳見 [`../docs/AUTH_ROSTER_PASSWORD.md`](../docs/AUTH_ROSTER_PASSWORD.md)。

驗證碼寄信：個人 Gmail `chaos60649@gmail.com`（康橋 Google 帳號無法使用應用程式密碼）。

```bash
cp .env.example .env   # 填入 SMTP 應用程式密碼、SESSION_SECRET
npm install
npm start
```

預設：http://127.0.0.1:8788
