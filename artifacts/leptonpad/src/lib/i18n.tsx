import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "en" | "fr" | "sw" | "ha";

const translations: Record<Locale, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.feed": "Feed",
    "nav.collections": "Collections",
    "nav.dashboard": "Dashboard",
    "nav.publish": "Publish",
    "nav.earnings": "Earnings",
    "nav.collection": "Collection",
    "nav.rights": "Rights",
    "feed.title": "The Feed",
    "feed.trending": "Trending",
    "feed.latest": "Latest",
    "create.title": "Publish Your Work",
    "create.draft": "Save draft",
    "create.publish": "Publish piece",
    "creator.follow": "Follow",
    "creator.following": "Following",
    "creator.subscribe": "Subscribe",
    "creator.subscribed": "Subscribed",
    "creator.tip": "Send tip",
    "competitions.title": "Writing Competitions",
    "rights.title": "Rights & Licensing",
    "gamification.streak": "day streak",
    "gamification.badges": "Badges",
    "ai.suggest": "AI Assist",
    "offline.ready": "Available offline",
  },
  fr: {
    "nav.home": "Accueil",
    "nav.feed": "Fil",
    "nav.collections": "Collections",
    "nav.dashboard": "Tableau de bord",
    "nav.publish": "Publier",
    "nav.earnings": "Revenus",
    "nav.collection": "Collection",
    "nav.rights": "Droits",
    "feed.title": "Le Fil",
    "feed.trending": "Tendances",
    "feed.latest": "Récent",
    "create.title": "Publiez votre travail",
    "create.draft": "Brouillon",
    "create.publish": "Publier",
    "creator.follow": "Suivre",
    "creator.following": "Abonné",
    "creator.subscribe": "S'abonner",
    "creator.subscribed": "Abonné",
    "creator.tip": "Pourboire",
    "competitions.title": "Concours d'écriture",
    "rights.title": "Droits et licences",
    "gamification.streak": "jours de suite",
    "gamification.badges": "Badges",
    "ai.suggest": "Assistance IA",
    "offline.ready": "Disponible hors ligne",
  },
  sw: {
    "nav.home": "Nyumbani",
    "nav.feed": "Mlisho",
    "nav.collections": "Makusanyo",
    "nav.dashboard": "Dashibodi",
    "nav.publish": "Chapisha",
    "nav.earnings": "Mapato",
    "nav.collection": "Hifadhi",
    "nav.rights": "Haki",
    "feed.title": "Mlisho",
    "feed.trending": "Maarufu",
    "feed.latest": "Hivi karibuni",
    "create.title": "Chapisha kazi yako",
    "create.draft": "Hifadhi rasimu",
    "create.publish": "Chapisha",
    "creator.follow": "Fuata",
    "creator.following": "Unafuata",
    "creator.subscribe": "Jiandikishe",
    "creator.subscribed": "Umejiandikisha",
    "creator.tip": "Toa bakshishi",
    "competitions.title": "Mashindano ya uandishi",
    "rights.title": "Haki na leseni",
    "gamification.streak": "siku mfululizo",
    "gamification.badges": "Beji",
    "ai.suggest": "Msaidizi wa AI",
    "offline.ready": "Inapatikana nje ya mtandao",
  },
  ha: {
    "nav.home": "Gida",
    "nav.feed": "Ciyarwa",
    "nav.collections": "Tari",
    "nav.dashboard": "Dashboard",
    "nav.publish": "Buga",
    "nav.earnings": "Kudaden shiga",
    "nav.collection": "Tari",
    "nav.rights": "Hakkoki",
    "feed.title": "Ciyarwa",
    "feed.trending": "Shahararre",
    "feed.latest": "Sabbin",
    "create.title": "Buga aikinka",
    "create.draft": "Ajiye daftari",
    "create.publish": "Buga",
    "creator.follow": "Bi",
    "creator.following": "Kana bi",
    "creator.subscribe": "Yi rajista",
    "creator.subscribed": "An yi rajista",
    "creator.tip": "Ba da gudummawa",
    "competitions.title": "Gasar rubutu",
    "rights.title": "Hakkoki da lasisi",
    "gamification.streak": "ranaku a jere",
    "gamification.badges": "Lambobi",
    "ai.suggest": "Taimakon AI",
    "offline.ready": "Akwai offline",
  },
};

type I18nContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    return (localStorage.getItem("locale") as Locale) ?? "en";
  });

  const setLocale = useCallback((l: Locale) => {
    localStorage.setItem("locale", l);
    setLocaleState(l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((key: string) => translations[locale][key] ?? translations.en[key] ?? key, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <select
      value={locale}
      onChange={e => setLocale(e.target.value as Locale)}
      className="text-xs px-2 py-1 rounded border"
      style={{ borderColor: "rgba(28,25,23,0.15)", color: "#78716C", background: "transparent" }}
      aria-label="Language"
    >
      <option value="en">EN</option>
      <option value="fr">FR</option>
      <option value="sw">SW</option>
      <option value="ha">HA</option>
    </select>
  );
}
