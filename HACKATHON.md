# LeptonPad — Lepton Agents Hackathon (RFB 06)

**RFB:** [06 — Creator & Publisher Monetization](https://lepton.thecanteenapp.com)  
**Live:** https://lepton-pad.vercel.app  
**Deadline:** July 6, 2026, 11:59 PM ET  

We are building **one thing**: pay-per-piece publishing where creators keep 95% and readers pay only for what they unlock — settled in test USDC on Arc via Circle Gateway x402. We are **not** claiming other RFBs.

---

## The problem (RFB 06)

Subscriptions and bundles price out single articles, songs, and videos. Creators need **per-piece** revenue without forcing readers into monthly fees.

## What we built

| RFB 06 ask | LeptonPad |
|------------|-----------|
| Pay-per-article reading | Unlock one piece in USDC; no subscription |
| Per-piece creator support | 95% to creator, 5% platform — on-chain via LeptonSplit |
| Instant settlement | Circle Gateway x402 → Arc testnet USDC |
| Multi-format | Article, audio, video — same unlock flow |
| Reader wallet UX | In-app wallet: fund → deposit to Gateway → unlock → Collection (permanent access) |
| Creator earnings | Dashboard: sales, per-piece revenue, on-chain split tx |

**Out of scope for this submission:** autonomous paying agents (RFB 01), per-second streaming (RFB 04), agent-to-agent networks (RFB 03). AI pricing suggestions are a **creator tool**, not the core thesis.

---

## Circle stack (in service of RFB 06)

**Core product = execution & settlement on Arc:**

1. Reader pays → **Circle Gateway x402**
2. USDC batches to **LeptonSplit** (seller contract on Arc testnet)
3. **`splitPayment`** → 95% creator wallet / 5% platform (100% if verified at publish)
4. **`SplitPayment` event** on Arcscan — demo this tx

- **Gateway + x402** — `GET /api/payments/gateway/:contentId`
- **LeptonSplit** — `splitPayment` per sale (creator route registered at first settlement, not at publish)
- **Auto-retry** — pending splits complete on unlock check, earnings load, background
- **UI** — Wallet / Earnings / Collection show settlement rail + Arcscan links

Access (read again) stays in the app DB; **money** is what’s on-chain.

---

## Traction to report (RFB 06 metrics)

Judges care about **creator payouts** and **reader conversion**, not generic “users”:

- Creators published (count)
- Paid unlocks (count)
- Total test USDC paid to creators
- Average price per piece
- Reader-to-payer conversion (unlocks / views on paid content)

Fill these from production DB / dashboard before submitting.

---

## 3-minute demo script

1. **Reader** — open paid article → preview → unlock → success toast → read full piece  
2. **Collection** — show unlock persisted; read again without paying  
3. **Wallet** — Gateway balance, deposit from on-chain, withdraw  
4. **Creator** — publish priced content → earnings → Arc explorer link for split tx  
5. **One line** — “Subscriptions bundle; we sell the single piece.”

---

## Submission checklist

- [ ] Public GitHub repo (this repo)
- [ ] Video demo (<3 min) following script above
- [ ] Live URL: https://lepton-pad.vercel.app
- [ ] Form: state **RFB 06** explicitly; traction numbers from section above
- [ ] Do **not** lead with “AI agents” — lead with per-piece monetization on Arc

---

## One-liner for the form

> **LeptonPad** — publish articles, audio, and video; readers unlock one piece at a time in test USDC on Arc (95% to creator). No subscriptions. Built for RFB 06.
