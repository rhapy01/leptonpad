import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { PlatformLayout } from "@/components/PlatformLayout";
import { useToast } from "@/hooks/use-toast";

const settingsSchema = z.object({
  walletAddress: z.string().optional(),
  selectedCategories: z.array(z.string()).min(1, "Select at least one category"),
});
type SettingsForm = z.infer<typeof settingsSchema>;

export default function SettingsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: me, isLoading } = useGetMe();
  const { data: categories } = useListCategories();
  const { data: purchases } = useGetMyPurchases();
  const updateMe = useUpdateMe();

  const form = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: { walletAddress: "", selectedCategories: [] },
  });

  useEffect(() => {
    if (me) {
      form.reset({ walletAddress: me.walletAddress ?? "", selectedCategories: me.selectedCategories });
    }
  }, [me]);

  const categories_ = form.watch("selectedCategories");

  const toggleCategory = (slug: string) => {
    const current = form.getValues("selectedCategories");
    form.setValue(
      "selectedCategories",
      current.includes(slug) ? current.filter(s => s !== slug) : [...current, slug]
    );
  };

  const onSubmit = async (data: SettingsForm) => {
    await updateMe.mutateAsync({ data });
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    toast({ title: "Settings saved", description: "Your profile has been updated." });
  };

  if (isLoading) {
    return (
      <PlatformLayout>
        <div className="max-w-2xl mx-auto px-4 py-16">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-white/8 rounded w-1/3" />
            <div className="h-12 bg-white/5 rounded-xl" />
          </div>
        </div>
      </PlatformLayout>
    );
  }

  return (
    <PlatformLayout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-semibold text-[#E8EAF0] mb-8">Settings</h1>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8" data-testid="form-settings">
          {/* Profile */}
          <div className="rounded-xl p-6 border border-white/6" style={{ background: "#161820" }}>
            <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Profile</h2>
            <div className="flex items-center gap-4 mb-4">
              {me?.imageUrl ? (
                <img src={me.imageUrl} alt={me.name} className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-lg text-[#6B7280]">
                  {me?.name?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <p className="text-base font-medium text-[#E8EAF0]">{me?.name}</p>
                <p className="text-sm text-[#6B7280]">{me?.email}</p>
              </div>
            </div>
          </div>

          {/* USDC Wallet */}
          <div className="rounded-xl p-6 border border-white/6" style={{ background: "#161820" }}>
            <h2 className="text-sm font-semibold text-[#E8EAF0] mb-1">USDC Wallet</h2>
            <p className="text-xs text-[#6B7280] mb-4">Your wallet address on Arc for receiving payments.</p>
            <input
              {...form.register("walletAddress")}
              placeholder="0x..."
              data-testid="input-wallet-address"
              className="w-full px-4 py-3 rounded-lg bg-[#0D0F14] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F5C842]/50 transition-colors font-mono text-sm"
            />
            {me?.walletAddress && (
              <p className="text-xs text-[#6B7280]/60 mt-2">
                Connected: <span className="font-mono">{me.walletAddress.slice(0, 8)}...{me.walletAddress.slice(-6)}</span>
              </p>
            )}
          </div>

          {/* Categories */}
          <div className="rounded-xl p-6 border border-white/6" style={{ background: "#161820" }}>
            <h2 className="text-sm font-semibold text-[#E8EAF0] mb-1">Interest Categories</h2>
            <p className="text-xs text-[#6B7280] mb-4">Your feed shows content from these categories.</p>
            <div className="grid grid-cols-2 gap-2">
              {categories?.map(cat => {
                const isSelected = categories_.includes(cat.slug);
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => toggleCategory(cat.slug)}
                    data-testid={`toggle-category-${cat.slug}`}
                    className="px-3 py-2.5 rounded-lg border text-sm text-left transition-all"
                    style={{
                      background: isSelected ? "rgba(245,200,66,0.06)" : "transparent",
                      borderColor: isSelected ? "#F5C842" : "rgba(255,255,255,0.08)",
                      color: isSelected ? "#F5C842" : "#6B7280",
                    }}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>
            {form.formState.errors.selectedCategories && (
              <p className="text-red-400 text-xs mt-2">{form.formState.errors.selectedCategories.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={updateMe.isPending}
            data-testid="button-save-settings"
            className="w-full py-3.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-60"
            style={{ background: "#F5C842", color: "#0D0F14" }}
          >
            {updateMe.isPending ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Purchase History */}
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-[#E8EAF0] mb-4">Purchase History</h2>
          <div className="rounded-xl border border-white/6 overflow-hidden" style={{ background: "#161820" }}>
            {(purchases?.length ?? 0) === 0 ? (
              <div className="p-6 text-center text-[#6B7280] text-sm">No purchases yet.</div>
            ) : (
              <div className="divide-y divide-white/4">
                {purchases?.map(p => (
                  <div key={p.id} className="px-4 py-3 flex items-center justify-between" data-testid={`purchase-history-${p.id}`}>
                    <div>
                      <p className="text-sm text-[#E8EAF0]">{p.contentTitle}</p>
                      <p className="text-xs text-[#6B7280]">{p.creatorName} · {p.contentType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium" style={{ color: "#F5C842" }}>${Number(p.amountPaid).toFixed(4)} USDC</p>
                      <p className="text-xs text-[#6B7280]/60">{new Date(p.paidAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PlatformLayout>
  );
}
