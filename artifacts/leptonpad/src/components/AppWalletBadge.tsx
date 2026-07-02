import { Link } from "wouter";
import { Show } from "@clerk/react";
import { useAppWallet } from "@/hooks/useAppWallet";

export function AppWalletBadge({ compact }: { compact?: boolean }) {
  const { wallet, loading } = useAppWallet();

  return (
    <Show when="signed-in">
      <Link
        href="/wallet"
        className={`${compact ? "flex" : "hidden sm:flex"} items-center gap-2 px-2.5 py-1 text-xs hover:opacity-90`}
        style={{
          border: "1px solid rgba(28,25,23,0.15)",
          color: "#57534E",
          fontFamily: "Inter, sans-serif",
        }}
        title="Your in-app LeptonPad wallet on Arc"
      >
        <span style={{ color: "#C8960C", fontWeight: 600 }}>Wallet</span>
        {loading ? (
          <span>…</span>
        ) : wallet?.address ? (
          <>
            <span style={{ fontFamily: "monospace", fontSize: "10px" }}>
              {wallet.address.slice(0, 6)}…{wallet.address.slice(-4)}
            </span>
            {!wallet.mockMode && wallet.gatewayAvailable != null && (
              <span style={{ color: "#78716C" }}>
                · {wallet.gatewayAvailable} USDC
              </span>
            )}
          </>
        ) : (
          <span>—</span>
        )}
      </Link>
    </Show>
  );
}
