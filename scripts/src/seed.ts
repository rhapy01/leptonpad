import {
  db,
  categoriesTable,
  contentTable,
  adCampaignsTable,
  contentRightsTable,
  competitionsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

/** YouTube samples for featured video/audio — thumbnails + embed URLs for homepage testing. */
const YT_FEATURED = {
  video: "k8fWKfqJFFE", // Circle: USDC digital dollar overview
  audio: "5MgBikgcWnY", // Creator economy / micropayments talk
};

function youtubeThumb(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

function youtubeEmbed(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}

const FEATURED_BY_TYPE = {
  article: "The x402 Protocol: Paying for Content with a Single HTTP Header",
  video: "Micropayments in Practice: A 12-Minute Visual Essay",
  audio: "The Sound of Settlement: An Audio Essay",
};

const CATEGORIES = [
  { slug: "crypto-web3", name: "Crypto & Web3", description: "On-chain insights from inside the industry", icon: "₿" },
  { slug: "music-audio", name: "Music & Audio", description: "Original recordings, podcasts, and sound", icon: "♪" },
  { slug: "independent-writing", name: "Independent Writing", description: "Essays, fiction, journalism, criticism", icon: "✍" },
  { slug: "video-film", name: "Video & Film", description: "Short films, documentaries, visual essays", icon: "▶" },
  { slug: "tech-development", name: "Tech & Development", description: "Deep technical writing and code", icon: "</>" },
  { slug: "fiction-poetry", name: "Fiction & Poetry", description: "Stories, novels, poems, and literary works", icon: "📖" },
  { slug: "architecture-design", name: "Architecture & Design", description: "Built environment, urbanism, and visual design", icon: "🏛" },
  { slug: "business-finance", name: "Business & Finance", description: "Markets, entrepreneurship, and economics", icon: "📈" },
  { slug: "health-education", name: "Health & Education", description: "Wellness, learning, and personal growth", icon: "🎓" },
  { slug: "african-stories", name: "African Stories", description: "Storytelling from across the continent", icon: "🌍" },
];

const COVER_BY_CATEGORY: Record<string, string> = {
  "crypto-web3": "https://images.unsplash.com/photo-1639765487520-4c8e0e9f8b8a?w=800&h=450&fit=crop&q=80",
  "music-audio": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=450&fit=crop&q=80",
  "independent-writing": "https://images.unsplash.com/photo-1455390582260-044cdead277a?w=800&h=450&fit=crop&q=80",
  "video-film": "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=450&fit=crop&q=80",
  "tech-development": "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=450&fit=crop&q=80",
  "fiction-poetry": "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800&h=450&fit=crop&q=80",
  "architecture-design": "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800&h=450&fit=crop&q=80",
  "business-finance": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&h=450&fit=crop&q=80",
  "health-education": "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&h=450&fit=crop&q=80",
  "african-stories": "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800&h=450&fit=crop&q=80",
};

const DEMO_CONTENT = [
  {
    title: "The x402 Protocol: Paying for Content with a Single HTTP Header",
    type: "article",
    categorySlug: "crypto-web3",
    featured: true,
    tags: ["x402", "usdc", "micropayments", "web3"],
    country: "Global",
    language: "en",
    coverImageUrl: COVER_BY_CATEGORY["crypto-web3"],
    previewText: "The oldest unsolved problem in web monetization isn't fraud or chargeback rates. It's friction.",
    body: `The oldest unsolved problem in web monetization isn't fraud or chargeback rates. It's friction. Every payment system built in the last 30 years assumes the buyer already knows they want to pay before they start reading.

The x402 protocol flips this model. Instead of gating content behind a wall, x402 lets the server respond with HTTP 402 Payment Required.

LeptonPad is built on x402. Every time you unlock a piece, your wallet broadcasts a single USDC transfer to the creator's address on Arc.`,
    price: "0.08",
    creatorId: "system",
  },
  {
    title: "Why Arc Settlement Changes Everything for Independent Creators",
    type: "article",
    categorySlug: "independent-writing",
    tags: ["creators", "arc", "independent-writing"],
    coverImageUrl: COVER_BY_CATEGORY["independent-writing"],
    previewText: "I've been writing online for eight years. None of the monetization models solved the fundamental problem.",
    body: `I've been writing online for eight years. In that time I've tried every monetization model: ads, Patreon, Substack, Ko-fi, direct sponsorships.

The per-piece model on Arc changes the math entirely. A reader can pay $0.05 for one essay. If it's good, they'll pay for another.`,
    price: "0.05",
    creatorId: "system",
  },
  {
    title: "How AI is Changing African Architecture",
    type: "article",
    categorySlug: "african-stories",
    tags: ["ai", "africa", "architecture", "bim", "sustainable-design"],
    country: "Nigeria",
    language: "en",
    coverImageUrl: COVER_BY_CATEGORY["african-stories"],
    previewText: "From Lagos to Nairobi, architects are using AI to design climate-responsive buildings rooted in local materials and oral traditions of spatial storytelling.",
    body: `<h2>The New Vernacular</h2>
<p>Across West Africa, a generation of architects is refusing the copy-paste modernism of the 20th century. Instead, they're training models on indigenous building patterns — compound layouts, passive cooling, laterite walls — and generating designs that feel both futuristic and deeply local.</p>

<h2>BIM Meets Oral History</h2>
<p>In Kigali, one studio recorded elders describing how villages were arranged around sacred groves. That narrative data became training input for a generative design tool that proposes community centres honouring those spatial relationships.</p>

<h2>What Readers Are Searching For</h2>
<p>Platform data shows rising demand for stories connecting technology, heritage, and the built environment. Writers who bridge these themes are seeing conversion rates 2× the category median.</p>`,
    price: "0.06",
    creatorId: "system",
  },
  {
    title: "The River's Memory: A Short Story",
    type: "article",
    categorySlug: "fiction-poetry",
    tags: ["fiction", "africa", "folklore", "river"],
    country: "Ghana",
    language: "en",
    coverImageUrl: COVER_BY_CATEGORY["fiction-poetry"],
    previewText: "Grandmother said the river remembers every name spoken on its banks. On the night the dam was finished, the water spoke back.",
    body: `<p>Grandmother said the river remembers every name spoken on its banks. On the night the dam was finished, the water spoke back.</p>
<p>Amara stood at the new concrete wall and listened. The village below would flood by morning. She had one night to decide what to carry upstream — objects, or stories.</p>
<p>She chose stories. And that choice would cost her everything, and give her something no dam could hold back.</p>`,
    price: "0.04",
    creatorId: "system",
  },
  {
    title: "Building a Drizzle ORM Query Builder for Dynamic Filters",
    type: "article",
    categorySlug: "tech-development",
    tags: ["typescript", "drizzle", "postgres"],
    coverImageUrl: COVER_BY_CATEGORY["tech-development"],
    previewText: "Drizzle ORM is excellent at typed queries. Dynamic filters are less obvious.",
    body: `Drizzle ORM is excellent at typed queries. The key insight: build your condition array dynamically, then spread it into and().`,
    price: "0.04",
    creatorId: "system",
  },
  {
    title: "Free Content: Understanding LeptonPad's Architecture",
    type: "article",
    categorySlug: "tech-development",
    tags: ["architecture", "openapi", "platform"],
    coverImageUrl: COVER_BY_CATEGORY["tech-development"],
    previewText: "An overview of how LeptonPad is built: OpenAPI-first design, Arc USDC settlement, and three-world visual system.",
    body: `LeptonPad is built as a monorepo using pnpm workspaces. The API contract is defined first in OpenAPI YAML.`,
    price: "0",
    creatorId: "system",
  },
  {
    title: "USDC Settlement on Arc: A Deep Dive",
    type: "article",
    categorySlug: "crypto-web3",
    tags: ["usdc", "arc", "circle"],
    coverImageUrl: COVER_BY_CATEGORY["crypto-web3"],
    previewText: "Circle's Arc blockchain is purpose-built for commerce.",
    body: `Circle's Arc blockchain is purpose-built for commerce. Sub-second finality makes content micropayments viable.`,
    price: "0.07",
    creatorId: "system",
  },
  {
    title: "Micropayments in Practice: A 12-Minute Visual Essay",
    type: "video",
    categorySlug: "video-film",
    featured: true,
    tags: ["video", "x402", "usdc"],
    coverImageUrl: youtubeThumb(YT_FEATURED.video),
    previewText: "How x402 and USDC settlement change short-form video economics — a visual walkthrough.",
    body: "A visual walkthrough of per-view monetization on Arc, using real USDC settlement examples.",
    videoUrl: youtubeEmbed(YT_FEATURED.video),
    price: "0.12",
    creatorId: "system",
  },
  {
    title: "The Sound of Settlement: An Audio Essay",
    type: "audio",
    categorySlug: "music-audio",
    featured: true,
    tags: ["audio", "podcast", "creators", "usdc"],
    coverImageUrl: youtubeThumb(YT_FEATURED.audio),
    previewText: "Listen to how instant USDC payouts reshape independent podcasting and audio publishing.",
    body: "An audio essay on creator economics, nanopayments, and why settlement speed matters for indie podcasters.",
    audioUrl: youtubeEmbed(YT_FEATURED.audio),
    price: "0.06",
    creatorId: "system",
  },
];

const AD_CAMPAIGNS = [
  {
    title: "Learn African Languages Online",
    advertiser: "LinguaAfrika",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=400&h=200&fit=crop",
    targetUrl: "https://example.com/lingua",
    categorySlug: "african-stories",
    active: true,
  },
  {
    title: "Creator Tools for Independent Writers",
    advertiser: "WriteAfrica",
    imageUrl: "https://images.unsplash.com/photo-1455390582260-044cdead277a?w=400&h=200&fit=crop",
    targetUrl: "https://example.com/write",
    categorySlug: "independent-writing",
    active: true,
  },
];

async function main() {
  console.log("Removing invented demo competitions (if any)...");
  const removed = await db.delete(competitionsTable).where(
    inArray(competitionsTable.slug, ["awas-2026-voices", "folklore-retold-2026"]),
  ).returning({ slug: competitionsTable.slug });
  for (const r of removed) console.log(`  - ${r.slug}`);

  console.log("Seeding categories...");
  for (const cat of CATEGORIES) {
    const existing = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, cat.slug)).limit(1);
    if (!existing.length) {
      await db.insert(categoriesTable).values(cat);
      console.log(`  + ${cat.name}`);
    } else {
      await db.update(categoriesTable).set({ name: cat.name, description: cat.description, icon: cat.icon })
        .where(eq(categoriesTable.slug, cat.slug));
      console.log(`  ~ ${cat.name}`);
    }
  }

  console.log("Seeding content...");
  for (const piece of DEMO_CONTENT) {
    const existing = await db.select().from(contentTable).where(eq(contentTable.title, piece.title)).limit(1);
    const slug = piece.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80);
    if (!existing.length) {
      await db.insert(contentTable).values({
        ...piece,
        slug,
        status: "published",
        published: true,
        metaDescription: piece.previewText?.slice(0, 160) ?? null,
        viewCount: Math.floor(Math.random() * 150 + 20),
        purchaseCount: Math.floor(Math.random() * 30 + 2),
        bookmarkCount: Math.floor(Math.random() * 15),
        reactionCount: Math.floor(Math.random() * 40),
        commentCount: Math.floor(Math.random() * 8),
      });
      console.log(`  + ${piece.title.slice(0, 50)}`);
    } else {
      await db.update(contentTable).set({
        coverImageUrl: piece.coverImageUrl,
        tags: piece.tags ?? [],
        country: piece.country ?? null,
        language: piece.language ?? "en",
        previewText: piece.previewText ?? null,
        ...("videoUrl" in piece && piece.videoUrl ? { videoUrl: piece.videoUrl } : {}),
        ...("audioUrl" in piece && piece.audioUrl ? { audioUrl: piece.audioUrl } : {}),
        featured: Object.values(FEATURED_BY_TYPE).includes(piece.title),
      }).where(eq(contentTable.title, piece.title));
      console.log(`  ~ ${piece.title.slice(0, 50)}`);
    }
  }

  console.log("Setting featured picks (one per type)...");
  await db.update(contentTable).set({ featured: false });
  for (const title of Object.values(FEATURED_BY_TYPE)) {
    const updated = await db.update(contentTable).set({ featured: true }).where(eq(contentTable.title, title)).returning({ id: contentTable.id });
    if (updated.length) console.log(`  ★ ${title.slice(0, 50)}`);
  }

  console.log("Seeding ad campaigns...");
  for (const ad of AD_CAMPAIGNS) {
    const existing = await db.select().from(adCampaignsTable).where(eq(adCampaignsTable.title, ad.title)).limit(1);
    if (!existing.length) {
      await db.insert(adCampaignsTable).values(ad);
      console.log(`  + ${ad.title}`);
    }
  }

  // Seed rights for African architecture article if it exists
  const archArticle = await db.select().from(contentTable)
    .where(eq(contentTable.title, "How AI is Changing African Architecture")).limit(1);
  if (archArticle.length) {
    const existing = await db.select().from(contentRightsTable)
      .where(eq(contentRightsTable.contentId, archArticle[0].id)).limit(1);
    if (!existing.length) {
      await db.insert(contentRightsTable).values([
        {
          contentId: archArticle[0].id,
          ownerId: "system",
          rightsType: "film",
          territory: "Worldwide",
          status: "available",
          licenseTerms: "Option for documentary adaptation. 12-month exclusive negotiation window.",
        },
        {
          contentId: archArticle[0].id,
          ownerId: "system",
          rightsType: "translation",
          territory: "Francophone Africa",
          language: "fr",
          status: "available",
          licenseTerms: "Translation rights for French edition. 70% royalty to author.",
        },
      ]);
      console.log("  + Rights listings for African Architecture article");
    }
  }

  console.log("Done.");
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
