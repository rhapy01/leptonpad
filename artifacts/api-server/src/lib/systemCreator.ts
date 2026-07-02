export const SYSTEM_CREATOR_ID = "system";

export function isSystemCreator(creatorId: string): boolean {
  return creatorId === SYSTEM_CREATOR_ID;
}

export const SYSTEM_CREATOR_PROFILE = {
  clerkId: SYSTEM_CREATOR_ID,
  name: "LeptonPad",
  imageUrl: null as string | null,
  bannerUrl: null as string | null,
  bio: "Official LeptonPad editorial — platform guides, featured writing, and sample works settled on Arc testnet.",
  website: process.env.PUBLIC_URL ?? "https://lepton-pad.vercel.app",
  twitterUrl: null as string | null,
  linkedinUrl: null as string | null,
  country: "Global",
  language: "en",
  verified: true,
};
