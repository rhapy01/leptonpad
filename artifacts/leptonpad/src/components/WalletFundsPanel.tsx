import { useState } from "react";
import { Link } from "wouter";
import { useAppWallet } from "@/hooks/useAppWallet";
import {
  depositGatewayUsdc,
  fundWalletUsdc,
  withdrawGatewayUsdc,
} from "@/lib/appWallet";
import {
  notifyDepositSuccess,
  notifyTopUpSuccess,
  notifyWalletActivated,
  notifyWalletActionFailed,
  notifyWithdrawSuccess,
} from "@/lib/notify";
import { arcTxExplorerUrl } from "@/lib/arcExplorer";

const MAX_TOPUP = 25;

type Props = {
  /** Full page shows address + explorer; embedded is for Earnings dashboard */
  variant?: "full" | "embedded";
};

export function WalletFundsPanel({ variant = "full" }: Props) {
  const { wallet, loading, activating, refresh, ensureReady } = useAppWallet();
  const [topUpAmount, setTopUpAmount] = useState("10");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const gatewayBal = Number.parseFloat(wallet?.gatewayAvailable ?? "0");
  const onChainBal = Number.parseFloat(
    wallet?.onChainBalance ?? wallet?.walletBalance ?? "0",
  );

  const handleActivate = async () => {
    try {
      const result = await ensureReady();
      await refresh();
      notifyWalletActivated(result?.gatewayAvailable);
    } catch (e) {
      notifyWalletActionFailed(
        "activation",
        e instanceof Error ? e.message : "Try again in a few seconds",
      );
    }
  };

  const handleTopUp = async () => {
    setToppingUp(true);
    try {
      const result = await fundWalletUsdc(topUpAmount);
      await refresh();
      notifyTopUpSuccess(result.amount);
    } catch (e) {
      notifyWalletActionFailed(
        "top-up",
        e instanceof Error ? e.message : "Try again",
      );
    } finally {
      setToppingUp(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const result = await withdrawGatewayUsdc(withdrawAmount);
      await refresh();
      setWithdrawAmount("");
      notifyWithdrawSuccess(result.amount);
    } catch (e) {
      notifyWalletActionFailed(
        "withdraw",
        e instanceof Error ? e.message : "Try again",
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const handleDeposit = async () => {
    setDepositing(true);
    try {
      const result = await depositGatewayUsdc(depositAmount);
      await refresh();
      setDepositAmount("");
      notifyDepositSuccess(result.amount);
    } catch (e) {
      notifyWalletActionFailed(
        "deposit",
        e instanceof Error ? e.message : "Try again",
      );
    } finally {
      setDepositing(false);
    }
  };

  if (loading && !wallet) {
    return (
      <p className="text-sm" style={{ color: "#78716C" }}>
        Loading wallet…
      </p>
    );
  }

  if (wallet?.mockMode) {
    return (
      <p className="text-sm" style={{ color: "#78716C" }}>
        Payments are temporarily unavailable.
      </p>
    );
  }

  if (!wallet?.address) {
    return (
      <p className="text-sm" style={{ color: "#78716C" }}>
        Sign in to use your wallet.
      </p>
    );
  }

  const sectionClass = "rounded-sm border bg-white p-5 sm:p-6 space-y-3";
  const borderStyle = { borderColor: "rgba(28,25,23,0.12)" };

  return (
    <div className="space-y-4">
      <section className={sectionClass} style={borderStyle}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", color: "#1C1917" }}
            >
              {variant === "embedded" ? "Spend your earnings" : "Balances"}
            </h2>
            <p className="text-xs mt-1 max-w-lg" style={{ color: "#78716C" }}>
              {variant === "embedded"
                ? "Creator earnings land on-chain. Deposit to Gateway to unlock more paid content."
                : "Gateway is for spending inside LeptonPad. On-chain is your Arc wallet (where earnings arrive)."}
            </p>
          </div>
          {variant === "embedded" && (
            <Link
              href="/wallet"
              className="text-xs font-medium hover:underline shrink-0"
              style={{ color: "#92400E" }}
            >
              Full wallet →
            </Link>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#78716C" }}>
              Gateway (spend)
            </dt>
            <dd className="mt-1 text-lg font-semibold" style={{ color: "#C8960C" }}>
              {wallet.gatewayAvailable ?? "—"} USDC
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#78716C" }}>
              On-chain
            </dt>
            <dd className="mt-1 text-lg font-semibold" style={{ color: "#1C1917" }}>
              {onChainBal.toFixed(4)} USDC
            </dd>
          </div>
        </dl>

        {variant === "full" && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#78716C" }}>
              Address
            </dt>
            <dd className="font-mono text-xs mt-1 break-all" style={{ color: "#1C1917" }}>
              {wallet.address}
            </dd>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {!wallet.gatewayReady && (
            <button
              type="button"
              onClick={() => void handleActivate()}
              disabled={activating}
              className="px-4 py-2 text-xs font-semibold rounded-sm"
              style={{ background: "#C8960C", color: "#1C1917" }}
            >
              {activating ? "Activating…" : "Activate wallet"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="px-4 py-2 text-xs font-medium rounded-sm border"
            style={{ borderColor: "rgba(28,25,23,0.2)", color: "#57534E" }}
          >
            Refresh
          </button>
          {variant === "full" && wallet.address && (
            <a
              href={arcTxExplorerUrl(wallet.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs font-medium rounded-sm border"
              style={{ borderColor: "rgba(28,25,23,0.2)", color: "#57534E" }}
            >
              Arc explorer
            </a>
          )}
        </div>
      </section>

      <section className={sectionClass} style={borderStyle}>
        <h3 className="text-sm font-semibold" style={{ color: "#1C1917" }}>
          Add USDC
        </h3>
        <p className="text-xs" style={{ color: "#78716C" }}>
          Request USDC from the platform treasury to your on-chain wallet (max {MAX_TOPUP} per request).
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="number"
            min="0.01"
            max={MAX_TOPUP}
            step="0.01"
            value={topUpAmount}
            onChange={(e) => setTopUpAmount(e.target.value)}
            placeholder="Amount USDC"
            className="w-32 px-3 py-2 text-sm border rounded-sm"
            style={{ borderColor: "rgba(28,25,23,0.2)" }}
          />
          <button
            type="button"
            disabled={toppingUp || !topUpAmount}
            onClick={() => void handleTopUp()}
            className="px-4 py-2 text-xs font-semibold rounded-sm"
            style={{ background: "#C8960C", color: "#1C1917" }}
          >
            {toppingUp ? "Sending…" : "Add USDC"}
          </button>
          {[5, 10, 25].map((n) => (
            <button
              key={n}
              type="button"
              className="text-xs underline"
              style={{ color: "#92400E" }}
              onClick={() => setTopUpAmount(String(n))}
            >
              {n}
            </button>
          ))}
        </div>
      </section>

      <section className={sectionClass} style={borderStyle}>
        <h3 className="text-sm font-semibold" style={{ color: "#1C1917" }}>
          Deposit to Gateway
        </h3>
        <p className="text-xs" style={{ color: "#78716C" }}>
          Move on-chain USDC into Gateway to unlock paid content.
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Amount USDC"
            className="w-32 px-3 py-2 text-sm border rounded-sm"
            style={{ borderColor: "rgba(28,25,23,0.2)" }}
          />
          <button
            type="button"
            disabled={depositing || !depositAmount}
            onClick={() => void handleDeposit()}
            className="px-4 py-2 text-xs font-semibold rounded-sm"
            style={{ background: "#1C1917", color: "#FAF7F2" }}
          >
            {depositing ? "Depositing…" : "Deposit"}
          </button>
          {onChainBal > 0 && (
            <button
              type="button"
              className="text-xs underline"
              style={{ color: "#92400E" }}
              onClick={() => setDepositAmount(String(onChainBal))}
            >
              Max ({onChainBal.toFixed(4)})
            </button>
          )}
        </div>
      </section>

      <section className={sectionClass} style={borderStyle}>
        <h3 className="text-sm font-semibold" style={{ color: "#1C1917" }}>
          Withdraw from Gateway
        </h3>
        <p className="text-xs" style={{ color: "#78716C" }}>
          Move USDC out of Gateway into your on-chain Arc wallet (crypto withdrawal, not bank).
        </p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="number"
            min="0"
            step="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount USDC"
            className="w-32 px-3 py-2 text-sm border rounded-sm"
            style={{ borderColor: "rgba(28,25,23,0.2)" }}
          />
          <button
            type="button"
            disabled={withdrawing || !withdrawAmount}
            onClick={() => void handleWithdraw()}
            className="px-4 py-2 text-xs font-semibold rounded-sm border"
            style={{ borderColor: "rgba(28,25,23,0.25)", color: "#1C1917" }}
          >
            {withdrawing ? "Withdrawing…" : "Withdraw"}
          </button>
          {gatewayBal > 0 && (
            <button
              type="button"
              className="text-xs underline"
              style={{ color: "#92400E" }}
              onClick={() => setWithdrawAmount(String(gatewayBal))}
            >
              Max ({gatewayBal})
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
