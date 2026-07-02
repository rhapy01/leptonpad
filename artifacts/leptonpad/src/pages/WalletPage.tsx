import { DashboardShell } from "@/components/DashboardShell";
import { WalletFundsPanel } from "@/components/WalletFundsPanel";
import { SettlementRailPanel } from "@/components/SettlementRailPanel";

export default function WalletPage() {
  return (
    <DashboardShell
      title="Your wallet"
      subtitle="USDC on Arc — add funds, spend via Gateway, or hold on-chain"
      showPublish={false}
    >
      <div className="max-w-xl">
        <SettlementRailPanel variant="public" />
        <WalletFundsPanel variant="full" />
      </div>
    </DashboardShell>
  );
}
