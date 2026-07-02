import { useCallback, useEffect, useState } from "react";
import {
  enableTotp,
  fetchSecurityStatus,
  setWalletPin,
  setupTotp,
  type SecurityStatus,
} from "@/lib/securityApi";

export function SecuritySettingsPanel() {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [totpConfirm, setTotpConfirm] = useState("");
  const [walletPin, setWalletPinInput] = useState("");
  const [walletPinTotp, setWalletPinTotp] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await fetchSecurityStatus());
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleTotpSetup = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await setupTotp();
      setTotpSecret(data.secret);
      setTotpUri(data.uri);
      setMessage("Add LeptonPad in Google Authenticator, then enter a code below.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Setup failed");
    } finally {
      setBusy(false);
    }
  };

  const handleTotpEnable = async () => {
    setBusy(true);
    setError(null);
    try {
      await enableTotp(totpConfirm);
      setTotpSecret(null);
      setTotpUri(null);
      setTotpConfirm("");
      setMessage("Google Authenticator enabled. New devices will need email + app codes.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid code");
    } finally {
      setBusy(false);
    }
  };

  const handleSetWalletPin = async () => {
    setBusy(true);
    setError(null);
    try {
      await setWalletPin(walletPin, status?.totpEnabled ? walletPinTotp : undefined);
      setWalletPinInput("");
      setWalletPinTotp("");
      setMessage("Wallet password set. You will need it to open Wallet.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not set password");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-[var(--color-ink-muted)]">Loading security…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-sm border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm" style={{ color: "#57534E" }}>
        <strong style={{ color: "#92400E" }}>Protect your assets.</strong> Enable Google Authenticator
        before using LeptonPad on another phone. Wallet keys are{" "}
        <strong>AES-256 encrypted</strong> on our servers — never plaintext. Your wallet also has its
        own password, separate from sign-in.
      </div>

      {status && (
        <ul className="text-xs space-y-1" style={{ color: "#78716C" }}>
          <li>Trusted devices: {status.trustedDeviceCount}</li>
          <li>2FA: {status.totpEnabled ? "On" : "Off"}</li>
          <li>Wallet password: {status.walletPinSet ? "Set" : "Not set"}</li>
        </ul>
      )}

      {message && <p className="text-sm text-green-800">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        <h3 className="text-sm font-semibold" style={{ color: "#1C1917" }}>
          Google Authenticator (required for new devices)
        </h3>
        {!status?.totpEnabled ? (
          <>
            {!totpSecret ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleTotpSetup()}
                className="rounded-sm px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "#1C1917" }}
              >
                Set up authenticator
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-xs break-all font-mono bg-stone-100 p-2 rounded">{totpSecret}</p>
                {totpUri && (
                  <p className="text-xs break-all text-[#78716C]">
                    Or paste this in your app: <span className="font-mono">{totpUri}</span>
                  </p>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit code from app"
                  value={totpConfirm}
                  onChange={(e) => setTotpConfirm(e.target.value)}
                  className="w-full rounded-sm border px-3 py-2 text-sm"
                  style={{ borderColor: "rgba(28,25,23,0.18)" }}
                />
                <button
                  type="button"
                  disabled={busy || totpConfirm.length < 6}
                  onClick={() => void handleTotpEnable()}
                  className="rounded-sm px-4 py-2 text-sm font-semibold text-white"
                  style={{ background: "#C8960C" }}
                >
                  Confirm 2FA
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm" style={{ color: "#57534E" }}>
            Authenticator is active. Signing in on a new device requires your email code and app code.
          </p>
        )}
      </div>

      <div className="space-y-3 border-t pt-5" style={{ borderColor: "rgba(28,25,23,0.1)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "#1C1917" }}>
          Wallet password (fintech-style lock)
        </h3>
        <p className="text-xs" style={{ color: "#78716C" }}>
          Separate from your Clerk sign-in. Required to open Wallet and move USDC.
        </p>
        <input
          type="password"
          autoComplete="new-password"
          placeholder={status?.walletPinSet ? "New wallet password" : "Create wallet password (6+ chars)"}
          value={walletPin}
          onChange={(e) => setWalletPinInput(e.target.value)}
          className="w-full rounded-sm border px-3 py-2 text-sm"
          style={{ borderColor: "rgba(28,25,23,0.18)" }}
        />
        {status?.totpEnabled && (
          <input
            type="text"
            inputMode="numeric"
            placeholder="Authenticator code"
            value={walletPinTotp}
            onChange={(e) => setWalletPinTotp(e.target.value)}
            className="w-full rounded-sm border px-3 py-2 text-sm"
            style={{ borderColor: "rgba(28,25,23,0.18)" }}
          />
        )}
        <button
          type="button"
          disabled={busy || walletPin.length < 6}
          onClick={() => void handleSetWalletPin()}
          className="rounded-sm px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "#1C1917" }}
        >
          {status?.walletPinSet ? "Update wallet password" : "Set wallet password"}
        </button>
      </div>
    </div>
  );
}
