import { toast } from "@/hooks/use-toast";

const SUCCESS_DURATION = 7000;
const ERROR_DURATION = 9000;

type ToastOpts = {
  title: string;
  description?: string;
};

function success({ title, description }: ToastOpts) {
  toast({
    variant: "success",
    title,
    description,
    duration: SUCCESS_DURATION,
  });
}

function error({ title, description }: ToastOpts) {
  toast({
    variant: "destructive",
    title,
    description,
    duration: ERROR_DURATION,
  });
}

export function notifyPaymentSuccess(input: {
  contentTitle: string;
  amountPaid: number;
  alreadyOwned?: boolean;
  splitPending?: boolean;
  splitTxHash?: string | null;
}) {
  const amount = Number(input.amountPaid).toFixed(
    input.amountPaid < 0.01 ? 4 : 2,
  );
  if (input.alreadyOwned) {
    success({
      title: "Already unlocked",
      description: `"${input.contentTitle}" is in your collection — read anytime.`,
    });
    return;
  }
  if (input.splitPending && !input.splitTxHash) {
    success({
      title: "Payment successful",
      description: `$${amount} USDC paid. Creator split landing on Arc — you'll see it on Earnings shortly.`,
    });
    return;
  }
  success({
    title: "Payment successful",
    description: `$${amount} USDC paid. Creator settled on Arc — "${input.contentTitle}" is in your collection.`,
  });
}

export function notifyPaymentPending() {
  toast({
    title: "Payment received",
    description:
      "Settling on-chain — tap unlock again in a moment. You won't be charged twice.",
    duration: 10000,
  });
}

export function notifyPaymentFailed(message: string) {
  error({
    title: "Payment failed",
    description: message,
  });
}

export function notifyDepositSuccess(amount: string | number) {
  success({
    title: "Deposit successful",
    description: `${amount} USDC moved into Gateway — ready to unlock paid content.`,
  });
}

export function notifyWithdrawSuccess(amount: string | number) {
  success({
    title: "Withdrawal successful",
    description: `${amount} USDC is now in your on-chain Arc wallet.`,
  });
}

export function notifyTopUpSuccess(amount: string | number) {
  success({
    title: "USDC added",
    description: `${amount} USDC sent to your on-chain wallet.`,
  });
}

export function notifyWalletActivated(gatewayAvailable?: string | null) {
  success({
    title: "Wallet ready",
    description: gatewayAvailable
      ? `Connected to Circle Gateway · ${gatewayAvailable} USDC available to spend.`
      : "Your LeptonPad wallet is funded and connected to Circle Gateway.",
  });
}

export function notifyWalletActionFailed(
  action: "deposit" | "withdraw" | "top-up" | "activation" | "payment",
  message: string,
) {
  const labels: Record<typeof action, string> = {
    deposit: "Deposit failed",
    withdraw: "Withdrawal failed",
    "top-up": "Top-up failed",
    activation: "Wallet activation failed",
    payment: "Payment failed",
  };
  error({ title: labels[action], description: message });
}

export function notifyGiftSuccess(input: {
  creatorName: string;
  amount: number;
  creatorShare: string;
}) {
  const amount = Number(input.amount).toFixed(input.amount < 0.01 ? 4 : 2);
  success({
    title: "Gift sent",
    description: `$${amount} USDC gifted to ${input.creatorName} (${input.creatorShare} to creator).`,
  });
}
