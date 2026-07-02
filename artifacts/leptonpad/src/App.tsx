import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthPageLayout } from "@/components/AuthPageLayout";
import { clerkAppearance, authRedirectUrl } from "@/lib/clerkAppearance";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/HomePage";
import FeedPage from "@/pages/FeedPage";
import ContentDetailPage from "@/pages/ContentDetailPage";
import ReadingModePage from "@/pages/ReadingModePage";
import CreatePage from "@/pages/CreatePage";
import EarningsPage from "@/pages/EarningsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SettingsPage from "@/pages/SettingsPage";
import DashboardOverviewPage from "@/pages/dashboard/DashboardOverviewPage";
import FollowingDashboardPage from "@/pages/dashboard/FollowingDashboardPage";
import CreatorDashboardPage from "@/pages/dashboard/CreatorDashboardPage";
import UserDashboardPage from "@/pages/dashboard/UserDashboardPage";
import CollectionsPage from "@/pages/CollectionsPage";
import CreatorProfilePage from "@/pages/CreatorProfilePage";
import EditContentPage from "@/pages/EditContentPage";
import IntelligencePage from "@/pages/dashboard/IntelligencePage";
import AdminDashboardPage from "@/pages/dashboard/AdminDashboardPage";
import WalletPage from "@/pages/WalletPage";
import RightsPage from "@/pages/RightsPage";
import { AuthGate } from "@/components/AuthGate";
import { ClerkApiAuthBridge } from "@/components/ClerkApiAuthBridge";
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
// Proxy is production-instance only (pk_live_). Dev keys (pk_test_) talk to Clerk FAPI directly.
const isLocalDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";
const clerkUsesProxy = String(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? "").startsWith(
  "pk_live_",
);
const clerkProxyUrl =
  isLocalDev || !clerkUsesProxy
    ? undefined
    : import.meta.env.VITE_CLERK_PROXY_URL ||
      `${window.location.origin}/api/__clerk`;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

function SignInPage() {
  return (
    <AuthPageLayout>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        forceRedirectUrl={authRedirectUrl}
        fallbackRedirectUrl={authRedirectUrl}
        appearance={clerkAppearance}
      />
    </AuthPageLayout>
  );
}

function SignUpPage() {
  return (
    <AuthPageLayout>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        forceRedirectUrl={authRedirectUrl}
        fallbackRedirectUrl={authRedirectUrl}
        appearance={clerkAppearance}
      />
    </AuthPageLayout>
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

function HomeRoute() {
  return <HomePage />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useGetMe();
  if (isLoading) return null;
  if (!user?.isAdmin) return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function ScrollToTop() {
  const [location] = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRoute} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/onboarding">
        <Show when="signed-in">
          <OnboardingPage />
        </Show>
        <Show when="signed-out">
          <Redirect to="/feed" />
        </Show>
      </Route>
      <Route path="/creator/:clerkId">
        {(params) => <CreatorProfilePage clerkId={params.clerkId} />}
      </Route>
      <Route path="/edit/:id">
        {(params) => (
          <ProtectedRoute>
            <EditContentPage id={parseInt(params.id, 10)} />
          </ProtectedRoute>
        )}
      </Route>
      <Route path="/collections">
        <ProtectedRoute>
          <CollectionsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/intelligence">
        <ProtectedRoute>
          <IntelligencePage />
        </ProtectedRoute>
      </Route>
      <Route path="/rights">
        <RightsPage />
      </Route>
      <Route path="/feed">
        <FeedPage />
      </Route>
      <Route path="/content/:id">
        {(params) => (
          <ContentDetailPage id={parseInt(params.id, 10)} />
        )}
      </Route>
      <Route path="/read/:id">
        {(params) => (
          <ReadingModePage id={parseInt(params.id, 10)} />
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
      <Route path="/wallet">
        <ProtectedRoute>
          <WalletPage />
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <SettingsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardOverviewPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/following">
        <ProtectedRoute>
          <FollowingDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/creator">
        <ProtectedRoute>
          <CreatorDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/user">
        <ProtectedRoute>
          <UserDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/library">
        <ProtectedRoute>
          <UserDashboardPage />
        </ProtectedRoute>
      </Route>
      <Route path="/dashboard/admin">
        <ProtectedRoute>
          <AdminGuard>
            <AdminDashboardPage />
          </AdminGuard>
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
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to))}
      appearance={clerkAppearance}
    >
      <ClerkApiAuthBridge />
      <ClerkQueryClientCacheInvalidator />
      <ScrollToTop />
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
