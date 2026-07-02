import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link } from "wouter";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useGetMe,
  useUpdateMe,
  useListCategories,
  useGetMyPurchases,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/DashboardShell";
import { CreatorName } from "@/components/CreatorName";
import { useToast } from "@/hooks/use-toast";
import { updateProfileExtended, exportContent } from "@/lib/platformApi";
import { GamificationPanel } from "@/components/GamificationPanel";
import { FileUploadField } from "@/components/FileUploadField";
import { useAppWallet } from "@/hooks/useAppWallet";

const settingsSchema = z.object({
  walletAddress: z.string().optional(),
  selectedCategories: z.array(z.string()).min(1, "Select at least one category"),
  bio: z.string().optional(),
  website: z.string().optional(),
  twitterUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  country: z.string().optional(),
});
type SettingsForm = z.infer<typeof settingsSchema>;

const sectionClass = "rounded-sm border bg-white p-5 sm:p-6";
const sectionBorder = { borderColor: "rgba(28,25,23,0.12)" };
const inputClass =
  "w-full rounded-sm border bg-white px-3 py-2.5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted)] focus:outline-none focus:border-[var(--color-ink)]/40";
const inputStyle = { borderColor: "rgba(28,25,23,0.18)" };
const labelClass = "homepage-body mb-1.5 block text-xs font-semibold text-[var(--color-ink-secondary)]";

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className={sectionClass} style={sectionBorder}>
      <h2
        className="mb-1 text-sm font-semibold"
        style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
      >
        {title}
      </h2>
      {description && (
        <p className="homepage-body mb-4 text-xs leading-relaxed">
          {description}
        </p>
      )}
      {!description && <div className="mb-4" />}
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading } = useGetMe();
  const { data: categories } = useListCategories();
  const { data: purchases } = useGetMyPurchases();
  const updateMe = useUpdateMe();
  const { wallet } = useAppWallet();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { walletAddress: "", selectedCategories: [], bio: "", website: "", twitterUrl: "", linkedinUrl: "", country: "" },
  });

  useEffect(() => {
    if (me) {
      form.reset({
        walletAddress: me.walletAddress ?? "",
        selectedCategories: me.selectedCategories,
        bio: (me as { bio?: string }).bio ?? "",
        website: (me as { website?: string }).website ?? "",
        twitterUrl: (me as { twitterUrl?: string }).twitterUrl ?? "",
        linkedinUrl: (me as { linkedinUrl?: string }).linkedinUrl ?? "",
        country: (me as { country?: string }).country ?? "",
      });
      setAvatarUrl(me.imageUrl ?? null);
      setBannerUrl((me as { bannerUrl?: string }).bannerUrl ?? null);
    }
  }, [me, form]);

  const categories_ = form.watch("selectedCategories");

  const toggleCategory = (slug: string) => {
    const current = form.getValues("selectedCategories");
    form.setValue(
      "selectedCategories",
      current.includes(slug) ? current.filter(s => s !== slug) : [...current, slug],
    );
  };

  const onSubmit = async (data: SettingsForm) => {
    await updateMe.mutateAsync({
      data: { walletAddress: data.walletAddress, selectedCategories: data.selectedCategories, name: me?.name },
    });
    await updateProfileExtended({
      bio: data.bio,
      website: data.website,
      twitterUrl: data.twitterUrl,
      linkedinUrl: data.linkedinUrl,
      country: data.country,
      ...(avatarUrl != null ? { imageUrl: avatarUrl } : {}),
      ...(bannerUrl != null ? { bannerUrl } : {}),
    });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    toast({ title: "Settings saved", description: "Your profile has been updated." });
  };

  const handleExport = async () => {
    const data = await exportContent();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leptonpad-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export downloaded" });
  };

  if (isLoading) {
    return (
      <DashboardShell title="Settings" subtitle="Profile, payouts, and feed preferences" showPublish={false}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 rounded-sm bg-black/5 w-1/3" />
          <div className="h-40 rounded-sm bg-black/5" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Settings" subtitle="Profile, payouts, and feed preferences" showPublish={false}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-settings">
          <SettingsSection title="Profile" description="How readers see you on your public creator page.">
            <div className="settings-profile-header">
              <FileUploadField
                label=""
                accept="image/jpeg,image/png,image/webp,image/gif"
                value={avatarUrl ?? me?.imageUrl ?? ""}
                onChange={setAvatarUrl}
                preview="avatar"
                fallbackInitial={me?.name}
              />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold truncate" style={{ color: "var(--color-ink)" }}>
                  <CreatorName name={me?.name ?? ""} verified={me?.verified} size="md" />
                </p>
                <p className="homepage-body truncate text-sm">{me?.email}</p>
                {me?.clerkId && (
                  <Link href={`/creator/${me.clerkId}`} className="mt-2 inline-block text-xs font-medium hover:underline" style={{ color: "#92400E" }}>
                    View public profile →
                  </Link>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <FileUploadField
                label="Banner"
                hint="Wide image at the top of your creator profile."
                accept="image/jpeg,image/png,image/webp,image/gif"
                value={bannerUrl ?? ""}
                onChange={setBannerUrl}
                preview="banner"
              />
              <div>
                <label className={labelClass}>Bio</label>
                <textarea
                  {...form.register("bio")}
                  rows={4}
                  className={inputClass}
                  style={inputStyle}
                  placeholder="A short intro for your profile…"
                />
              </div>
              <div className="settings-field-grid settings-field-grid--2">
                <div>
                  <label className={labelClass}>Website</label>
                  <input {...form.register("website")} className={inputClass} style={inputStyle} placeholder="https://yoursite.com" />
                </div>
                <div>
                  <label className={labelClass}>Country / region</label>
                  <input {...form.register("country")} className={inputClass} style={inputStyle} placeholder="Nigeria, Kenya…" />
                </div>
                <div>
                  <label className={labelClass}>Twitter / X</label>
                  <input {...form.register("twitterUrl")} className={inputClass} style={inputStyle} placeholder="https://x.com/username" />
                </div>
                <div>
                  <label className={labelClass}>LinkedIn</label>
                  <input {...form.register("linkedinUrl")} className={inputClass} style={inputStyle} placeholder="https://linkedin.com/in/username" />
                </div>
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="In-app wallet"
            description="LeptonPad provisions an internal wallet for unlocking paid content. No MetaMask required."
          >
            {wallet?.address ? (
              <p className="homepage-body text-xs font-mono break-all">
                {wallet.address}
                {!wallet.mockMode && wallet.gatewayAvailable != null && (
                  <span className="block mt-2 font-sans font-semibold" style={{ color: "#C8960C" }}>
                    {wallet.gatewayAvailable} USDC available
                  </span>
                )}
              </p>
            ) : (
              <p className="homepage-body text-xs">Sign in to provision your wallet.</p>
            )}
            <Link href="/wallet" className="mt-3 inline-block text-xs font-medium hover:underline" style={{ color: "#92400E" }}>
              Open wallet page →
            </Link>
          </SettingsSection>

          <SettingsSection
            title="Become a creator"
            description="There is no separate application — publish your first story to start earning."
          >
            <p className="homepage-body text-xs mb-3">
              Verified creators keep 100% of sales. Admins can grant the verified badge from the admin dashboard.
            </p>
            <Link href="/create" className="inline-block text-xs font-semibold hover:underline" style={{ color: "#C8960C" }}>
              Start publishing →
            </Link>
          </SettingsSection>

          <SettingsSection title="Feed categories" description="Your feed highlights content from these topics.">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {categories?.map(cat => {
                const isSelected = categories_.includes(cat.slug);
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => toggleCategory(cat.slug)}
                    data-testid={`toggle-category-${cat.slug}`}
                    className="rounded-sm border px-3 py-2.5 text-left text-sm transition-colors"
                    style={{
                      background: isSelected ? "rgba(28,25,23,0.05)" : "#FFFFFF",
                      borderColor: isSelected ? "#1C1917" : "rgba(28,25,23,0.12)",
                      color: isSelected ? "var(--color-ink)" : "var(--color-ink-secondary)",
                      fontWeight: isSelected ? 600 : 400,
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.selectedCategories && (
              <p className="mt-2 text-xs text-red-600">{form.formState.errors.selectedCategories.message}</p>
            )}
          </SettingsSection>

          <GamificationPanel />

          <SettingsSection title="Data export" description="Download all your published content as JSON.">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="rounded-sm border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[0.03]"
              style={{ borderColor: "rgba(28,25,23,0.18)", color: "#1C1917" }}
            >
              Export my content
            </button>
          </SettingsSection>

          <div className="settings-save-bar">
            <button
              type="submit"
              disabled={updateMe.isPending}
              data-testid="button-save-settings"
              className="interactive-cta w-full rounded-sm py-3.5 text-sm font-semibold disabled:opacity-60"
              style={{ background: "#1C1917", color: "#FAF7F2" }}
            >
              {updateMe.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>

        <section className="mt-10">
          <h2
            className="mb-4 text-sm font-semibold"
            style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
          >
            Purchase history
          </h2>
          <div className="overflow-hidden rounded-sm border bg-white" style={sectionBorder}>
            {(purchases?.length ?? 0) === 0 ? (
              <div className="homepage-body p-6 text-center text-sm">
                No purchases yet.
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "rgba(28,25,23,0.08)" }}>
                {purchases?.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3" data-testid={`purchase-history-${p.id}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" style={{ color: "#1C1917" }}>{p.contentTitle}</p>
                      <p className="homepage-body flex items-center gap-1 text-xs">
                        <CreatorName
                          name={p.creatorName}
                          verified={"creatorVerified" in p ? Boolean(p.creatorVerified) : false}
                        />
                        <span>· {p.contentType}</span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold" style={{ color: "#C8960C" }}>
                        ${Number(p.amountPaid).toFixed(4)} USDC
                      </p>
                      <p className="homepage-body text-xs">
                        {new Date(p.paidAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
    </DashboardShell>
  );
}
