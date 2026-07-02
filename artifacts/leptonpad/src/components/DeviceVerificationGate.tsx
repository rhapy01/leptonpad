import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/react";
import {
  fetchSecurityStatus,
  requestDeviceEmailOtp,
  verifyNewDevice,
  type SecurityStatus,
} from "@/lib/securityApi";
import { PlatformLayout } from "@/components/PlatformLayout";

type Props = { children: React.ReactNode };

export function DeviceVerificationGate({ children }: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailCode, setEmailCode] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setStatus(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const s = await fetchSecurityStatus();
      setStatus(s);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, refresh]);

  if (!isLoaded || !isSignedIn) return <>{children}</>;
  if (loading) return null;

  if (!status?.requiresDeviceVerification) return <>{children}</>;

  if (!status.canVerifyNewDevice) {
    return (
      <PlatformLayout>
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <p className="editorial-label mb-3" style={{ color: "#78716C" }}>New device blocked</p>
          <h1
            className="mb-4"
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "1.75rem",
              fontWeight: 700,
              color: "#1C1917",
            }}
          >
            Set up 2FA on your trusted device first
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#57534E" }}>
            For asset safety, LeptonPad only allows sign-in from new phones or browsers after
            Google Authenticator is enabled. Open LeptonPad on a device you have used before,
            go to <strong>Settings → Security</strong>, and turn on two-factor authentication.
          </p>
        </div>
      </PlatformLayout>
    );
  }

  const handleSendOtp = async () => {
    setError(null);
    try {
      await requestDeviceEmailOtp();
      setOtpSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send code");
    }
  };

  const handleVerify = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await verifyNewDevice(emailCode, totpCode);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PlatformLayout>
      <div className="mx-auto max-w-md px-4 py-16">
        <p className="editorial-label mb-2" style={{ color: "#78716C" }}>New device</p>
        <h1
          className="mb-3 text-xl font-semibold"
          style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
        >
          Verify it&apos;s you
        </h1>
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "#57534E" }}>
          Step 1: email code · Step 2: Google Authenticator. After this, use your wallet password
          to open balances (step 3).
        </p>

        <div className="space-y-4 rounded-sm border bg-white p-5" style={{ borderColor: "rgba(28,25,23,0.12)" }}>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#78716C]">Step 1 — Email code</label>
            {!otpSent ? (
              <button
                type="button"
                onClick={() => void handleSendOtp()}
                className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: "#1C1917" }}
              >
                Send code to my email
              </button>
            ) : (
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit email code"
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                className="w-full rounded-sm border px-3 py-2.5 text-sm"
                style={{ borderColor: "rgba(28,25,23,0.18)" }}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#78716C]">Step 2 — Authenticator</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit app code"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              className="w-full rounded-sm border px-3 py-2.5 text-sm"
              style={{ borderColor: "rgba(28,25,23,0.18)" }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={submitting || !emailCode || !totpCode}
            onClick={() => void handleVerify()}
            className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "#C8960C" }}
          >
            {submitting ? "Verifying…" : "Verify device"}
          </button>
        </div>
      </div>
    </PlatformLayout>
  );
}
