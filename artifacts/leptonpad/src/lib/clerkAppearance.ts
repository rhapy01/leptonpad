import { shadcn } from "@clerk/themes";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Editorial theme for full-page /sign-in and /sign-up only. */
export const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  layout: {
    socialButtonsPlacement: "top" as const,
    socialButtonsVariant: "blockButton" as const,
  },
  variables: {
    colorPrimary: "#1C1917",
    colorPrimaryForeground: "#FAF7F2",
    colorForeground: "#1C1917",
    colorMutedForeground: "#57534E",
    colorDanger: "#B91C1C",
    colorBackground: "#FFFFFF",
    colorInput: "#FFFFFF",
    colorInputForeground: "#1C1917",
    colorNeutral: "#E7E3DC",
    colorMuted: "#ffffff",
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    fontFamilyButtons: "'Inter', system-ui, -apple-system, sans-serif",
    fontSize: "1rem",
    borderRadius: "2px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-0 bg-transparent",
    card: "shadow-none border-0 bg-transparent px-0 py-0 gap-5",
    footer: "shadow-none border-0 bg-transparent pt-2",
    header: "gap-2 items-center",
    headerTitle:
      "text-[#1C1917] font-bold homepage-display text-[1.375rem] sm:text-2xl leading-tight text-center",
    headerSubtitle:
      "text-[#57534E] homepage-body text-[0.9375rem] leading-relaxed text-center",
    socialButtons: "grid grid-cols-1 gap-2 w-full",
    socialButtonsBlockButton:
      "w-full h-11 border border-[rgba(28,25,23,0.15)] bg-white hover:bg-white rounded-sm shadow-none",
    socialButtonsBlockButtonText: "text-[#1C1917] text-sm font-medium",
    formFieldLabel: "text-[#44403C] text-[0.8125rem] font-semibold homepage-body",
    formFieldInput:
      "bg-white border border-[rgba(28,25,23,0.18)] text-[#1C1917] text-base h-11 placeholder:text-[#A8A29E] rounded-sm shadow-none",
    formButtonPrimary:
      "bg-[#1C1917] hover:bg-[#292524] text-[#FAF7F2] text-[0.9375rem] font-semibold h-11 rounded-sm shadow-none",
    footerActionLink: "text-[#92400E] hover:text-[#78350F] font-semibold",
    footerActionText: "text-[#57534E] text-sm",
    dividerText: "text-[#78716C] text-[0.6875rem] uppercase tracking-wider",
    dividerLine: "bg-[rgba(28,25,23,0.12)]",
    logoBox: "hidden",
    footerAction: "justify-center py-2",
    form: "gap-4",
    main: "gap-5",
    modalBackdrop: "bg-[rgba(28,25,23,0.45)]",
    modalContent: "max-h-[92dvh] overflow-y-auto rounded-sm",
    userButtonPopoverCard: "bg-white border border-[rgba(28,25,23,0.12)] rounded-sm shadow-lg",
  },
};

export const authRedirectUrl = `${basePath || ""}/feed`;
