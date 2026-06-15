import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import FeedPage from "@/pages/FeedPage";
import ContentDetailPage from "@/pages/ContentDetailPage";
import ReadingModePage from "@/pages/ReadingModePage";
import CreatePage from "@/pages/CreatePage";
import EarningsPage from "@/pages/EarningsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SettingsPage from "@/pages/SettingsPage";
import { useGetMe } from "@workspace/api-client-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#F5C842",
    colorForeground: "#E8EAF0",
    colorMutedForeground: "#6B7280",
    colorDanger: "#ef4444",
    colorBackground: "#0D0F14",
    colorInput: "#161820",
    colorInputForeground: "#E8EAF0",
    colorNeutral: "#2D3140",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.375rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#161820] rounded-xl w-[440px] max-w-full overflow-hidden border border-white/10",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#E8EAF0] font-semibold",
    headerSubtitle: "text-[#6B7280]",
    socialButtonsBlockButtonText: "text-[#E8EAF0]",
    formFieldLabel: "text-[#E8EAF0] text-sm",
    footerActionLink: "text-[#F5C842] hover:text-[#F5C842]/80",
    footerActionText: "text-[#6B7280]",
    dividerText: "text-[#6B7280]",
    identityPreviewEditButton: "text-[#F5C842]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#E8EAF0]",
    logoBox: "flex justify-center",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border border-white/10 bg-white/5 hover:bg-white/10 text-[#E8EAF0]",
    formButtonPrimary: "bg-[#F5C842] hover:bg-[#F5C842]/90 text-[#0D0F14] font-semibold",
    formFieldInput: "bg-[#0D0F14] border border-white/10 text-[#E8EAF0] placeholder:text-[#6B7280]",
    footerAction: "bg-[#161820]",
    dividerLine: "bg-white/10",
    alert: "bg-[#0D0F14] border border-white/10",
    otpCodeFieldInput: "bg-[#0D0F14] border border-white/10 text-[#E8EAF0]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "#0D0F14" }}>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} appearance={clerkAppearance} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-4" style={{ background: "#0D0F14" }}>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} appearance={clerkAppearance} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <OnboardingGuard>
          <Redirect to="/feed" />
        </OnboardingGuard>
      </Show>
      <Show when="signed-out">
        <HomePage />
      </Show>
    </>
  );
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  if (isLoading) return null;
  if (user && !user.onboardingComplete) return <Redirect to="/onboarding" />;
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <OnboardingGuard>{children}</OnboardingGuard>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding">
        <Show when="signed-in">
          <OnboardingPage />
        </Show>
        <Show when="signed-out">
          <Redirect to="/sign-in" />
        </Show>
      </Route>
      <Route path="/feed">
        <ProtectedRoute>
          <FeedPage />
        </ProtectedRoute>
      </Route>
      <Route path="/content/:id">
        {(params) => (
          <ProtectedRoute>
            <ContentDetailPage id={parseInt(params.id, 10)} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/read/:id">
        {(params) => (
          <ProtectedRoute>
            <ReadingModePage id={parseInt(params.id, 10)} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/create">
        <ProtectedRoute>
          <CreatePage />
        </ProtectedRoute>
      </Route>
      <Route path="/earnings">
        <ProtectedRoute>
          <EarningsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppInner() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to))}
      appearance={clerkAppearance}
    >
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={basePath}>
        <AppInner />
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
