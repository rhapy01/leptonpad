import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  fetchAdRequirements,
  submitAdApplication,
  type AdBannerRequirements,
} from "@/lib/platformApi";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: string;
};

function RequirementsList({ req }: { req: AdBannerRequirements }) {
  return (
    <ul className="text-sm space-y-1.5 mb-4 list-disc pl-5" style={{ color: "#57534E" }}>
      <li>Business name and website link (HTTPS).</li>
      <li>
        Banner: {req.image.formatLabels}, max {req.image.maxBytesLabel},{" "}
        {req.image.recommendedWidth}×{req.image.recommendedHeight}px ({req.image.aspectRatio}).
      </li>
      <li>Choose how long the ad runs: {req.durations.map((d) => d.label).join(", ")}.</li>
      <li>{req.review}</li>
    </ul>
  );
}

export function AdvertiseHereDialog({ open, onOpenChange, category }: Props) {
  const { data: requirements } = useQuery({
    queryKey: ["ads", "requirements"],
    queryFn: fetchAdRequirements,
    enabled: open,
  });

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [headline, setHeadline] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [durationDays, setDurationDays] = useState(7);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const resetForm = () => {
    setContactName("");
    setContactEmail("");
    setBusinessName("");
    setHeadline("");
    setTargetUrl("");
    setDurationDays(7);
    setBannerFile(null);
    setBannerPreview(null);
    setError(null);
    setSuccess(null);
  };

  const handleFile = (file: File | null) => {
    setBannerFile(file);
    setError(null);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    setBannerPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requirements || !bannerFile) return;

    if (!requirements.image.formats.includes(bannerFile.type)) {
      setError(`Banner must be ${requirements.image.formatLabels}`);
      return;
    }
    if (bannerFile.size > requirements.image.maxBytes) {
      setError(`Banner must be ${requirements.image.maxBytesLabel} or smaller`);
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const comma = result.indexOf(",");
          resolve(comma >= 0 ? result.slice(comma + 1) : result);
        };
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
        reader.readAsDataURL(bannerFile);
      });

      const result = await submitAdApplication({
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim(),
        businessName: businessName.trim(),
        headline: headline.trim() || undefined,
        targetUrl: targetUrl.trim(),
        durationDays,
        categorySlug: category,
        imageData,
        imageFilename: bannerFile.name,
        imageMimeType: bannerFile.type,
      });

      setSuccess(result.message);
      setTimeout(() => {
        onOpenChange(false);
        resetForm();
      }, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetForm();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "#FAF7F2" }}>
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Advertise on Lepton Pad
          </DialogTitle>
          <DialogDescription style={{ color: "#78716C" }}>
            Submit your banner for the feed. We review every application before it goes live.
          </DialogDescription>
        </DialogHeader>

        {requirements ? (
          <RequirementsList req={requirements} />
        ) : (
          <p className="text-sm mb-4" style={{ color: "#78716C" }}>Loading requirements…</p>
        )}

        {success ? (
          <p className="text-sm p-3" style={{ background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>
            {success}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            />
            <input
              type="email"
              required
              placeholder="Contact email *"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            />
            <input
              type="text"
              required
              placeholder="Business / company name *"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            />
            <input
              type="text"
              placeholder="Headline (optional — defaults to business name)"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            />
            <input
              type="url"
              required
              placeholder="Website link (https://…) *"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="w-full px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            />
            <select
              required
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm"
              style={{ border: "1px solid rgba(28,25,23,0.15)", background: "#ffffff" }}
            >
              {(requirements?.durations ?? [{ days: 7, label: "1 week" }]).map((d) => (
                <option key={d.days} value={d.days}>{d.label}</option>
              ))}
            </select>
            <div>
              <label className="text-xs font-semibold editorial-label block mb-1" style={{ color: "#78716C" }}>
                Banner image or GIF *
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                required
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm"
              />
              {bannerPreview && (
                <img
                  src={bannerPreview}
                  alt="Banner preview"
                  className="mt-2 w-full max-h-28 object-cover rounded"
                  style={{ border: "1px solid rgba(28,25,23,0.1)" }}
                />
              )}
            </div>
            {error && (
              <p className="text-sm" style={{ color: "#B91C1C" }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={busy || !requirements}
              className="w-full text-sm px-4 py-2.5 font-semibold"
              style={{ background: "#1C1917", color: "#FAF7F2", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Submitting…" : "Submit for review"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
