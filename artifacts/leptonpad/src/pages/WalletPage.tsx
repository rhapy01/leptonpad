import { DashboardShell } from "@/components/DashboardShell";
import { WalletFundsPanel } from "@/components/WalletFundsPanel";
import { WalletUnlockGate } from "@/components/WalletUnlockGate";

export default function WalletPage() {
  return (
    <DashboardShell
      title="Your wallet"
      subtitle="Add USDC, unlock paid content, and move earnings in and out"
      showPublish={false}
    >
      <div className="max-w-xl">
        <WalletUnlockGate>
          <WalletFundsPanel variant="full" />
        </WalletUnlockGate>
      </div>
    </DashboardShell>
  );
}
