# LeptonPad

**Pay-per-piece publishing** — readers unlock individual articles, audio, and video with USDC on Arc. Creators keep **95%** of every sale (100% when verified).

**Live:** https://lepton-pad.vercel.app

## Stack

React + Vite · Express (Vercel serverless) · PostgreSQL · Clerk · Circle Gateway x402 · LeptonSplit on Arc testnet

## Security

- **Client-side wallets** (`WALLET_MODE=client`) — private keys encrypted in browser IndexedDB; server stores address only
- XSS sanitization (server + DOMPurify), rate limits, CORS allowlist, helmet
- SMTP personalized emails; admin via `INITIAL_ADMIN_EMAILS`

## Local dev

```bash
pnpm install
cp .env.example .env
pnpm --filter @workspace/db run push
pnpm --filter leptonpad dev
pnpm --filter api-server dev
```

## Deploy (Vercel)

```bash
node scripts/push-vercel-env.mjs --production-only
npx vercel deploy --prod
```

Required production env: `DATABASE_URL`, Clerk keys, Gateway/Split contract vars, `WALLET_MODE=client`, `VITE_WALLET_KDF_PEPPER`, `INITIAL_ADMIN_EMAILS`, `MOCK_PAYMENTS=false`.

See [`.env.example`](.env.example) and [`HACKATHON.md`](HACKATHON.md).

## License

MIT
