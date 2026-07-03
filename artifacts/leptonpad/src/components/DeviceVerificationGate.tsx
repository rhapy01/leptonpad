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

  const totpRequired = status.totpRequiredForDeviceVerify ?? status.totpEnabled;

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
      await verifyNewDevice(emailCode, totpRequired ? totpCode : undefined);
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
        <p className="editorial-label mb-2 theme-text-muted">Verify this device</p>
        <h1 className="mb-3 text-xl font-semibold homepage-display theme-text">
          Confirm it&apos;s you
        </h1>
        <p className="mb-6 text-sm leading-relaxed theme-text-secondary">
          {totpRequired
            ? "Enter the code from your email and your authenticator app."
            : "We sent a code to your email. Enter it below to continue on this device."}
        </p>

        <div className="space-y-4 rounded-sm border p-5 theme-surface">
          <div>
            <label className="mb-1 block text-xs font-semibold theme-text-muted">Email code</label>
            {!otpSent ? (
              <button
                type="button"
                onClick={() => void handleSendOtp()}
                className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold theme-btn-primary"
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
                className="w-full rounded-sm px-3 py-2.5 text-sm theme-input"
              />
            )}
          </div>

          {totpRequired && (
            <div>
              <label className="mb-1 block text-xs font-semibold theme-text-muted">
                Authenticator
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit app code"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full rounded-sm px-3 py-2.5 text-sm theme-input"
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="button"
            disabled={submitting || !emailCode || (totpRequired && !totpCode)}
            onClick={() => void handleVerify()}
            className="w-full rounded-sm px-4 py-2.5 text-sm font-semibold disabled:opacity-50 theme-btn-accent"
          >
            {submitting ? "Verifying…" : "Continue"}
          </button>
        </div>
      </div>
    </PlatformLayout>
  );
}
