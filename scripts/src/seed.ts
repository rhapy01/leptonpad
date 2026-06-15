import { db, categoriesTable, contentTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const CATEGORIES = [
  { slug: "crypto-web3", name: "Crypto & Web3", description: "On-chain insights from inside the industry", icon: "₿" },
  { slug: "music-audio", name: "Music & Audio", description: "Original recordings, podcasts, and sound", icon: "♪" },
  { slug: "independent-writing", name: "Independent Writing", description: "Essays, fiction, journalism, criticism", icon: "✍" },
  { slug: "video-film", name: "Video & Film", description: "Short films, documentaries, visual essays", icon: "▶" },
  { slug: "tech-development", name: "Tech & Development", description: "Deep technical writing and code", icon: "</>" },
];

const DEMO_CONTENT = [
  {
    title: "The x402 Protocol: Paying for Content with a Single HTTP Header",
    type: "article",
    categorySlug: "crypto-web3",
    previewText: "The oldest unsolved problem in web monetization isn't fraud or chargeback rates. It's friction. Every payment system built in the last 30 years assumes the buyer already knows they want to pay before they start reading.",
    body: `The oldest unsolved problem in web monetization isn't fraud or chargeback rates. It's friction. Every payment system built in the last 30 years assumes the buyer already knows they want to pay before they start reading.

The x402 protocol flips this model. Instead of gating content behind a wall, x402 lets the server respond with HTTP 402 Payment Required — the first time this status code has actually worked as intended since it was defined in 1999.

Here's the basic flow: you request a resource. The server returns 402 with a payment payload. Your wallet signs and broadcasts a USDC transfer. You retry the request with the payment receipt in a header. The server verifies and serves the content. Total time: under 500 milliseconds on Arc.

What makes x402 interesting for content publishing isn't just the speed. It's the granularity. A podcast platform can charge $0.000008 per second of audio. A news site can charge $0.0003 per article. A data API can charge $0.000001 per request. None of this was economically viable at traditional payment rails' 30-cent minimum transaction costs.

LeptonPad is built on x402. Every time you unlock a piece, your wallet broadcasts a single USDC transfer to the creator's address on Arc. The split — 95% to creator, 5% to infrastructure — happens at the smart contract level. There's no intermediary holding funds. The creator's wallet balance updates before you finish reading the first sentence.

The implications for content economics are significant. Creators who previously needed thousands of subscribers to earn minimum wage can now earn meaningfully from hundreds of engaged readers paying micropayments. The long tail of content creation becomes viable.`,
    price: "0.08",
    creatorId: "system",
  },
  {
    title: "Why Arc Settlement Changes Everything for Independent Creators",
    type: "article",
    categorySlug: "independent-writing",
    previewText: "I've been writing online for eight years. In that time I've tried every monetization model: ads, Patreon, Substack, Ko-fi, direct sponsorships. None of them solved the fundamental problem of the internet economy.",
    body: `I've been writing online for eight years. In that time I've tried every monetization model: ads, Patreon, Substack, Ko-fi, direct sponsorships. None of them solved the fundamental problem of the internet economy: the cost of payment processing makes small transactions uneconomical.

Think about what that means for a writer. If I charge $5/month for a newsletter, I get maybe $4.55 after fees. But I'm also betting that readers will commit to a month's subscription before they've seen a single piece of my best work. That's a bad bet. Most people won't make it.

The per-piece model on Arc changes the math entirely. A reader can pay $0.05 for one essay. If it's good, they'll pay for another. If it's not, they've lost a nickel and I've been honest about the transaction. No subscriptions that guilt you into staying even when the content has gotten worse. No algorithms deciding who sees what based on engagement metrics designed to maximize platform revenue.

What I didn't expect when I started publishing on Arc was how it would change how I write. When every piece is sold individually, you stop publishing content to "keep up a posting cadence." You publish when you have something worth paying for. The quality standard changes. The relationship with readers changes.

My last three essays sold to more than 200 readers each at $0.05 USDC. That's $10 per essay before I've built any audience to speak of. The platform median conversion rate is around 8%. Mine is 14%. I think it's because when readers pay per piece, they're signaling genuine interest — not just scrolling past because the algorithm served it.

The settlement time also matters psychologically. Traditional platforms hold your earnings for 30-60 days. On Arc, I see the USDC in my wallet before the reader has finished reading. That immediacy changes your relationship to the work.`,
    price: "0.05",
    creatorId: "system",
  },
  {
    title: "Building a Drizzle ORM Query Builder for Dynamic Filters",
    type: "article",
    categorySlug: "tech-development",
    previewText: "Drizzle ORM is excellent at typed queries. It's less obvious how to compose dynamic, user-driven filters without losing the type safety that makes Drizzle worth using in the first place.",
    body: `Drizzle ORM is excellent at typed queries. It's less obvious how to compose dynamic, user-driven filters without losing the type safety that makes Drizzle worth using in the first place.

The key insight: Drizzle's \`and()\`, \`or()\`, and \`inArray()\` utilities accept arrays of SQL conditions. Build your condition array dynamically, then spread it into \`and()\`.

\`\`\`typescript
const conditions: SQL[] = [eq(table.published, true)];

if (typeFilter) conditions.push(eq(table.type, typeFilter));
if (categoryFilter) {
  const slugs = categoryFilter.split(",");
  conditions.push(inArray(table.categorySlug, slugs));
}

const results = await db.select()
  .from(table)
  .where(and(...conditions));
\`\`\`

This pattern composes cleanly with pagination:

\`\`\`typescript
const [items, countResult] = await Promise.all([
  db.select().from(table).where(and(...conditions)).limit(limit).offset(offset),
  db.select({ count: sql\`count(*)\` }).from(table).where(and(...conditions)),
]);
\`\`\`

The \`Promise.all\` runs both queries in parallel, which matters at scale. The count query uses a subquery rather than a separate round trip, so the plan shares the same filtered view of the table.

One gotcha: \`and()\` with a single-element array works fine, but \`and()\` with no arguments returns \`undefined\`, which would fail. Guard against the empty-conditions case by always including at least one condition (in this case, the \`published = true\` filter serves as the anchor).

For full-text search, Drizzle's \`sql\` template literal lets you drop into raw Postgres when you need it. This is the right escape hatch — don't reach for it for simple filters, but don't avoid it when native Postgres operators are the right tool.`,
    price: "0.04",
    creatorId: "system",
  },
  {
    title: "Free Content: Understanding LeptonPad's Architecture",
    type: "article",
    categorySlug: "tech-development",
    previewText: "An overview of how LeptonPad is built: the OpenAPI-first design, Arc USDC settlement, and three-world visual system. Free to read — no payment required.",
    body: `LeptonPad is built as a monorepo using pnpm workspaces. The architecture has three main parts: a React frontend, an Express API server, and a PostgreSQL database.

The API contract is defined first in OpenAPI YAML. Orval generates TypeScript hooks from the spec — React Query hooks for data fetching, Zod schemas for runtime validation. The server uses the same Zod schemas to validate inputs. This means the contract is the single source of truth.

Authentication uses Clerk with a proxy middleware. The proxy lets the same API server handle Clerk's auth endpoints, so the frontend never needs to talk to Clerk's CDN directly. This is important for the Arc payment flow, where the server needs to trust the Clerk JWT to authorize purchases.

Payments use the x402 protocol. When a reader unlocks content, the frontend sends a payment intent to the API. The server records the payment with the tx hash from Arc, verifies the USDC transfer, and returns an access token. The split — 95% creator, 5% platform — happens at settlement time.

The visual system has three distinct worlds: the homepage uses a classical editorial style with Playfair Display and a paper background; the platform uses dark midnight colors with gold and teal accents; reading mode uses cream background and Lora serif for long-form reading. Each world is a distinct set of CSS variables and component patterns.

The AI pricing agent uses rule-based logic calibrated against platform median metrics. For creators with 10+ views, it analyzes conversion rates and suggests price adjustments. Suggestions can be applied or dismissed directly from the earnings dashboard.`,
    price: "0",
    creatorId: "system",
  },
  {
    title: "USDC Settlement on Arc: A Deep Dive into Circle's Blockchain",
    type: "article",
    categorySlug: "crypto-web3",
    previewText: "Circle's Arc blockchain is purpose-built for commerce. Unlike general-purpose chains, Arc optimizes for settlement latency and USDC finality. Here's what that means for content micropayments.",
    body: `Circle's Arc blockchain is purpose-built for commerce. Unlike general-purpose chains that optimize for generality, Arc makes a specific set of tradeoffs: fast finality, USDC-native, low fees.

The core property is sub-second finality. On Ethereum mainnet, you wait 12-15 seconds for a block, then another 64 blocks for economic finality. On Arc, transfers are finalized in under 500ms. For content micropayments, this matters because the payment flow needs to complete before the reader grows impatient.

USDC is the native unit of account on Arc. This is different from chains like Ethereum where ETH is the native currency and USDC is an ERC-20 token. On Arc, USDC is the base layer. Gas is paid in USDC fractions. There's no need to hold ETH to pay gas before you can send USDC — a common friction point in traditional crypto UX.

The fee structure makes micropayments viable. A $0.01 USDC transfer on Ethereum costs $0.30-2.00 in gas, making it uneconomical. On Arc, the same transfer costs less than $0.000001. This is what enables LeptonPad's minimum price of $0.000001 USDC per piece.

Circle's x402 protocol sits on top of Arc. It defines a standard HTTP-native payment flow: the server responds 402 with payment requirements, the client broadcasts the transfer, the server verifies the receipt. No wallet popup. No separate payment step. The entire flow is HTTP.

For creators, Arc settlement means their earnings are final and withdrawable immediately. No holding periods. No payment processor risk. The 95% creator share arrives in their wallet before the reader scrolls to the second paragraph.`,
    price: "0.07",
    creatorId: "system",
  },
];

async function main() {
  console.log("Seeding categories...");
  for (const cat of CATEGORIES) {
    const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, cat.slug)).limit(1);
    if (!existing.length) {
      await db.insert(categoriesTable).values(cat);
      console.log(`  Inserted: ${cat.name}`);
    } else {
      console.log(`  Skipped (exists): ${cat.name}`);
    }
  }

  console.log("Seeding demo content...");
  for (const piece of DEMO_CONTENT) {
    const existing = await db.select().from(contentTable).where(eq(contentTable.title, piece.title)).limit(1);
    if (!existing.length) {
      await db.insert(contentTable).values({
        ...piece,
        viewCount: Math.floor(Math.random() * 150 + 20),
        purchaseCount: Math.floor(Math.random() * 30 + 2),
      });
      console.log(`  Inserted: ${piece.title.slice(0, 60)}...`);
    } else {
      console.log(`  Skipped (exists): ${piece.title.slice(0, 60)}...`);
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
