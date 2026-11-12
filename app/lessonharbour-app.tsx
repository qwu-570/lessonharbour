"use client";
/* eslint-disable @next/next/no-img-element -- tutor URLs are dynamic and use a local fallback */

import { createContext, FormEvent, KeyboardEvent, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { zonedDateTimeToUtc } from "@/lib/rules";

type Role = "student" | "tutor";
type Account = { id: string; email: string; displayName: string; role: Role };
type Profile = {
  userId: string;
  subject: string;
  subjects: string[];
  bio: string;
  bioEn: string | null;
  bioZh: string | null;
  hourlyPrice: number;
  lessonFormat: "online" | "in_person" | "both";
  generalLocation: string | null;
  postcode: string | null;
  profilePhotoUrl: string | null;
  languages: string[];
  isPublished: boolean;
};
type StudentProfile = {
  userId: string;
  studentName: string;
  postcode: string;
  subjects: string[];
};
type Tutor = {
  id: string;
  displayName: string;
  subject: string;
  subjects: string[];
  bio: string;
  bioEn: string | null;
  bioZh: string | null;
  hourlyPrice: number;
  lessonFormat: string;
  generalLocation: string | null;
  profilePhotoUrl: string | null;
  languages: string[];
};
type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  bookingId?: string | null;
  bookingStatus?: string | null;
};
type Booking = {
  id: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  subject?: string;
  tutorName?: string;
  studentName?: string;
  startsAt: string;
  endsAt: string;
  cancellationReason?: string | null;
  cancelledBy?: string | null;
};
type Message = {
  id: string;
  studentId: string;
  tutorId: string;
  senderId: string;
  body: string;
  createdAt: string;
  otherId: string;
  otherName: string;
};
type MeResponse = {
  authenticated: boolean;
  identity?: { displayName: string; email: string; provider: "chatgpt" | "email" };
  account: Account | null;
  profile?: Profile | null;
  studentProfile?: StudentProfile | null;
};

const subjectGroups = [
  {
    en: "Mathematics",
    zh: "数学",
    options: ["7+", "11+", "13+", "GCSE", "A-Level", "Further Mathematics", "Olympiad & competitions"],
  },
  {
    en: "English",
    zh: "英语",
    options: ["7+", "11+", "13+", "GCSE Language", "GCSE Literature", "A-Level", "EAL / ESL"],
  },
  {
    en: "Sciences",
    zh: "科学",
    options: ["Primary science", "GCSE Biology", "GCSE Chemistry", "GCSE Physics", "GCSE Combined Science", "A-Level Biology", "A-Level Chemistry", "A-Level Physics"],
  },
  {
    en: "Computing & Coding",
    zh: "计算机与编程",
    options: ["Scratch", "Python", "JavaScript & web", "Robotics", "GCSE Computer Science", "A-Level Computer Science", "Coding competitions"],
  },
  {
    en: "Music",
    zh: "音乐",
    options: ["Piano", "Violin", "Viola", "Cello", "Flute", "Clarinet", "Saxophone", "Trumpet", "Guitar", "Drums & percussion", "Voice / singing", "Music theory", "GCSE Music", "A-Level Music"],
  },
  {
    en: "Creative & Performing Arts",
    zh: "创意与表演艺术",
    options: ["Art & portfolio", "Drawing & painting", "Drama", "LAMDA", "Creative writing", "Photography"],
  },
  {
    en: "Languages",
    zh: "语言",
    options: ["Mandarin Chinese", "French", "Spanish", "German", "Latin"],
  },
  {
    en: "Wellbeing & Overseas Life",
    zh: "心理支持与海外生活",
    options: ["School transition", "Study skills", "University applications", "Overseas study wellbeing", "UK life orientation"],
  },
] as const;
const subjects = subjectGroups.flatMap((group) => group.options.map((option) => `${group.en} · ${option}`));
const locationOptions = ["London", "Brighton & Hove", "Surrey", "Kent", "Sussex", "Hampshire", "Oxford", "Cambridge", "Birmingham", "Manchester", "Edinburgh", "Online"] as const;

type Locale = "en" | "zh";
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "en", setLocale: () => {} });
function useI18n() {
  const context = useContext(LocaleContext);
  return {
    ...context,
    zh: context.locale === "zh",
    text: (english: string, chinese: string) => (context.locale === "zh" ? chinese : english),
  };
}
function subjectLabel(value: string, zh: boolean) {
  const group = subjectGroups.find((item) => value.startsWith(`${item.en} · `));
  if (!group) return value;
  const option = value.slice(group.en.length + 3);
  return `${zh ? group.zh : group.en} · ${option}`;
}
function SubjectPicker({ value, onChange }: { value: string[]; onChange: (subjects: string[]) => void }) {
  const { text, zh } = useI18n();
  function toggle(subject: string) {
    onChange(value.includes(subject) ? value.filter((item) => item !== subject) : [...value, subject].slice(0, 20));
  }
  return (
    <fieldset className="border-0 p-0 sm:col-span-2">
      <legend className="mb-2 text-xs font-bold">{text("Subjects and levels taught (choose all that apply)", "教授科目与级别（可多选）")}</legend>
      <p className="mb-3 text-xs text-[var(--muted)]">{text("You can select across categories, for example GCSE Mathematics and A-Level Computer Science.", "可以跨类别选择，例如 GCSE 数学和 A-Level 计算机科学。")}</p>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        {subjectGroups.map((group) => (
          <details key={group.en} className="self-start rounded-xl border border-[var(--line)] bg-white p-3">
            <summary className="cursor-pointer font-bold">
              {zh ? group.zh : group.en}
              <span className="ml-2 text-xs font-normal text-[var(--muted)]">({value.filter((item) => item.startsWith(`${group.en} · `)).length})</span>
            </summary>
            <div className="mt-3 grid gap-2">
              {group.options.map((option) => {
                const subject = `${group.en} · ${option}`;
                return (
                  <label key={subject} className={`cursor-pointer rounded-lg border p-2 text-sm ${value.includes(subject) ? "border-[var(--teal)] bg-[var(--teal-soft)]" : "border-[var(--line)]"}`}>
                    <input className="mr-2" type="checkbox" checked={value.includes(subject)} onChange={() => toggle(subject)} />
                    {option}
                  </label>
                );
              })}
            </div>
          </details>
        ))}
      </div>
      <p className="mt-3 text-xs font-bold text-[var(--teal)]">
        {text(`${value.length} selected`, `已选择 ${value.length} 项`)} · {text("maximum 20", "最多 20 项")}
      </p>
    </fieldset>
  );
}
const languagePreferenceEvent = "lessonharbour-language-change";
function subscribeLanguagePreference(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(languagePreferenceEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(languagePreferenceEvent, callback);
  };
}
function languagePreferenceSnapshot(): Locale {
  const saved = window.localStorage.getItem("lessonharbour-language");
  return saved === "zh" || (!saved && window.navigator.language.toLowerCase().startsWith("zh")) ? "zh" : "en";
}
function languagePreferenceServerSnapshot(): Locale {
  return "en";
}

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  let response = await fetch(url, {
    ...options,
    headers: {
      ...(typeof options?.body === "string" ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });
  if (response.status === 401 && url !== "/api/auth") {
    const refreshed = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refresh" }) });
    if (refreshed.ok) response = await fetch(url, { ...options, headers: { ...(typeof options?.body === "string" ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  }
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
function lessonFormat(value: string) {
  return value === "in_person" ? "In person" : value === "both" ? "Online & in person" : "Online";
}
function formatDate(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value));
}

const timeZoneOptions = [
  ["Pacific/Pago_Pago", "UTC−11 · Samoa"],
  ["Pacific/Honolulu", "UTC−10 · Honolulu"],
  ["America/Anchorage", "UTC−09 · Anchorage"],
  ["America/Los_Angeles", "UTC−08 · Los Angeles"],
  ["America/Denver", "UTC−07 · Denver"],
  ["America/Chicago", "UTC−06 · Chicago"],
  ["America/New_York", "UTC−05 · New York"],
  ["America/Halifax", "UTC−04 · Halifax"],
  ["America/Sao_Paulo", "UTC−03 · São Paulo"],
  ["Atlantic/South_Georgia", "UTC−02 · South Georgia"],
  ["Atlantic/Azores", "UTC−01 · Azores"],
  ["Europe/London", "UTC±00 · London"],
  ["Europe/Paris", "UTC+01 · Paris"],
  ["Europe/Athens", "UTC+02 · Athens"],
  ["Europe/Istanbul", "UTC+03 · Istanbul"],
  ["Asia/Dubai", "UTC+04 · Dubai"],
  ["Asia/Karachi", "UTC+05 · Karachi"],
  ["Asia/Dhaka", "UTC+06 · Dhaka"],
  ["Asia/Bangkok", "UTC+07 · Bangkok"],
  ["Asia/Shanghai", "UTC+08 · Shanghai"],
  ["Asia/Tokyo", "UTC+09 · Tokyo"],
  ["Australia/Brisbane", "UTC+10 · Brisbane"],
  ["Pacific/Noumea", "UTC+11 · Nouméa"],
  ["Pacific/Fiji", "UTC+12 · Fiji"],
] as const;

function timeZoneOffset(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return Math.round((Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute")) - date.getTime()) / 60_000);
}

function nearestTimeZone(timeZone: string) {
  const exact = timeZoneOptions.find(([value]) => value === timeZone);
  if (exact) return exact[0];
  try {
    const offset = timeZoneOffset(timeZone);
    return timeZoneOptions.find(([value]) => timeZoneOffset(value) === offset)?.[0] ?? "Europe/London";
  } catch {
    return "Europe/London";
  }
}

function todayInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function calendarDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, monthNumber - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(Date.UTC(year, monthNumber - 1, 1 - startOffset + index));
    return day.toISOString().slice(0, 10);
  });
}

function shiftMonth(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 1 + amount, 1)).toISOString().slice(0, 7);
}

const languageOptions = ["Arabic", "Bengali", "Cantonese", "Dutch", "English", "French", "German", "Greek", "Gujarati", "Hindi", "Italian", "Japanese", "Korean", "Mandarin", "Polish", "Portuguese", "Punjabi", "Romanian", "Russian", "Spanish", "Swedish", "Tamil", "Turkish", "Ukrainian", "Urdu", "Vietnamese", "Welsh"];

function LanguagePicker({ value, onChange }: { value: string[]; onChange: (languages: string[]) => void }) {
  const { text } = useI18n();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = languageOptions.filter((language) => !value.includes(language) && language.toLowerCase().startsWith(query.trim().toLowerCase())).slice(0, 6);
  function add(language: string) {
    if (value.length < 8 && !value.includes(language)) onChange([...value, language]);
    setQuery("");
    setOpen(false);
  }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && matches[0]) {
      event.preventDefault();
      add(matches[0]);
    }
  }
  return (
    <div className="lh-field sm:col-span-2">
      <span>{text("Languages spoken", "授课语言")}</span>
      <div className="flex flex-wrap gap-2">
        {value.map((language) => (
          <button type="button" className="rounded-full bg-[var(--teal-soft)] px-3 py-1 text-xs font-bold text-[var(--teal)]" key={language} onClick={() => onChange(value.filter((item) => item !== language))}>
            {language} ×
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          value={query}
          disabled={value.length >= 8}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={keyDown}
          placeholder={value.length >= 8 ? text("Maximum 8 languages", "最多选择 8 种语言") : text("Start typing a language…", "输入语言名称…")}
          autoComplete="off"
        />
        {open && query.trim() && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-xl">
            {matches.map((language) => (
              <button
                type="button"
                className="block w-full border-0 bg-white px-3 py-2 text-left text-sm hover:bg-[var(--cream)]"
                key={language}
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(language);
                }}
              >
                {language}
              </button>
            ))}
            {matches.length === 0 && <span className="block px-3 py-2 text-xs text-[var(--muted)]">{text("No matching language", "没有匹配的语言")}</span>}
          </div>
        )}
      </div>
      <span className="text-[11px] font-normal text-[var(--muted)]">{text("Type a few letters, then select a suggestion. Click a tag to remove it.", "输入前几个字母并选择建议；点击标签可以删除。")}</span>
    </div>
  );
}

function TutorPhoto({ tutor, className }: { tutor: Pick<Tutor, "displayName" | "profilePhotoUrl">; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!tutor.profilePhotoUrl || failed) return <div className={`${className} grid place-items-center bg-gradient-to-br from-[#66857e] to-[#173d39] text-white lh-serif`}>{initials(tutor.displayName)}</div>;
  return <img className={`${className} object-cover`} src={tutor.profilePhotoUrl} alt={`${tutor.displayName}'s profile`} referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function LanguageList({ languages }: { languages: string[] }) {
  if (languages.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Languages spoken">
      {languages.map((language) => (
        <span className="rounded-full bg-[var(--teal-soft)] px-3 py-1 text-[11px] font-bold text-[var(--teal)]" key={language}>
          {language}
        </span>
      ))}
    </div>
  );
}

export default function LessonHarbourApp({ initialIdentity, signInPath, signOutPath }: { initialIdentity: { displayName: string; email: string; provider: "chatgpt" | "email" } | null; signInPath: string; signOutPath: string }) {
  const locale = useSyncExternalStore(subscribeLanguagePreference, languagePreferenceSnapshot, languagePreferenceServerSnapshot);
  const setLocale = useCallback((next: Locale) => {
    window.localStorage.setItem("lessonharbour-language", next);
    window.dispatchEvent(new Event(languagePreferenceEvent));
  }, []);
  const [view, setView] = useState<"home" | "find" | "profile" | "dashboard" | "auth">("home");
  const [me, setMe] = useState<MeResponse>({
    authenticated: Boolean(initialIdentity),
    identity: initialIdentity ?? undefined,
    account: null,
  });
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("London");
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<MeResponse>("/api/me"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load account");
    }
  }, []);

  const loadTutors = useCallback(
    async (filter = subject, place = location) => {
      try {
        const params = new URLSearchParams();
        if (filter) params.set("subject", filter);
        if (place) params.set("location", place);
        const data = await api<{ tutors: Tutor[] }>(`/api/tutors?${params.toString()}`);
        setTutors(data.tutors);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load tutors");
      }
    },
    [subject, location],
  );

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<MeResponse>("/api/me"), api<{ tutors: Tutor[] }>("/api/tutors")])
      .then(([accountData, tutorData]) => {
        if (!cancelled) {
          setMe(accountData);
          setTutors(tutorData.tutors);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load LessonHarbour");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en-GB";
  }, [locale]);
  const text = (english: string, chinese: string) => (locale === "zh" ? chinese : english);

  function navigate(next: typeof view) {
    setView(next);
    setError(null);
    setNotice(null);
    if (next === "find") void loadTutors();
    if (next === "dashboard") void refreshMe();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openTutor(tutor: Tutor) {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ tutor: Tutor; slots: Slot[] }>(`/api/tutors/${encodeURIComponent(tutor.id)}`);
      setSelectedTutor(data.tutor);
      setSelectedSlots(data.slots);
      navigate("profile");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load tutor");
    } finally {
      setBusy(false);
    }
  }

  async function createAccount(role: Role, displayName: string) {
    setBusy(true);
    setError(null);
    try {
      await api("/api/account", {
        method: "POST",
        body: JSON.stringify({ role, displayName }),
      });
      await refreshMe();
      setNotice("Your LessonHarbour account is ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Account setup failed");
    } finally {
      setBusy(false);
    }
  }

  async function book(slotId: string) {
    if (!me.authenticated) {
      navigate("auth");
      return;
    }
    if (!me.account) {
      navigate("dashboard");
      return;
    }
    if (me.account.role !== "student") {
      setError("Only student accounts can request lessons.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({ slotId }),
      });
      setNotice("Booking request sent. Your tutor can now accept or reject it.");
      navigate("dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Booking failed");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (me.identity?.provider === "chatgpt") {
      window.location.href = signOutPath;
      return;
    }
    await api("/api/auth", { method: "DELETE" });
    setMe({ authenticated: false, account: null });
    navigate("home");
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
        <div className="bg-[var(--ink)] py-2 text-center text-[11px] font-bold tracking-[.08em] text-white">{text("BOOK TUTORS FOR FREE · NO SUBSCRIPTION · NO HIDDEN FEES", "免费预约老师 · 无需订阅 · 无隐藏费用")}</div>
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgb(255_253_248/.94)] backdrop-blur-lg">
          <div className="lh-shell flex h-[72px] items-center justify-between gap-6">
            <button className="flex items-center gap-3 border-0 bg-transparent p-0 font-bold" onClick={() => navigate("home")}>
              <span className="grid size-9 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]">⌁</span>
              <span>LessonHarbour</span>
            </button>
            <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
              <button className="border-0 bg-transparent text-sm font-semibold" onClick={() => navigate("home")}>
                {text("Home", "首页")}
              </button>
              <button className="border-0 bg-transparent text-sm font-semibold" onClick={() => navigate("find")}>
                {text("Find tutors", "寻找老师")}
              </button>
              <button className="border-0 bg-transparent text-sm font-semibold" onClick={() => navigate("dashboard")}>
                {text("Dashboard", "个人中心")}
              </button>
            </nav>
            <div className="flex items-center gap-2">
              <button type="button" className="lh-language-toggle" onClick={() => setLocale(locale === "en" ? "zh" : "en")} aria-label={text("Switch to Chinese", "切换到英文")}>
                {locale === "en" ? "中文" : "EN"}
              </button>
              {me.authenticated ? (
                <>
                  <button className="hidden border-0 bg-transparent text-xs font-bold sm:block" onClick={() => navigate("dashboard")}>
                    {me.account?.displayName ?? me.identity?.displayName}
                  </button>
                  <button className="lh-button ghost" onClick={() => void signOut()}>
                    {text("Sign out", "退出")}
                  </button>
                </>
              ) : (
                <button className="lh-button" onClick={() => navigate("auth")}>
                  {text("Sign in", "登录")}
                </button>
              )}
            </div>
          </div>
        </header>

        {(error || notice) && (
          <div className="lh-shell mt-5">
            {error && <div className="lh-error">{error}</div>}
            {notice && <div className="lh-success">{notice}</div>}
          </div>
        )}

        {view === "home" && (
          <HomeView
            tutors={tutors}
            location={location}
            setLocation={setLocation}
            onFind={(value, place) => {
              setSubject(value);
              setLocation(place);
              void loadTutors(value, place);
              setView("find");
              setError(null);
              setNotice(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDashboard={() => navigate("dashboard")}
          />
        )}
        {view === "find" && <FindView tutors={tutors} subject={subject} setSubject={setSubject} location={location} setLocation={setLocation} search={() => void loadTutors()} openTutor={openTutor} busy={busy} />}
        {view === "auth" && <AuthView chatGPTSignInPath={signInPath} refreshMe={refreshMe} onSuccess={() => navigate("dashboard")} setError={setError} setNotice={setNotice} />}
        {view === "profile" && selectedTutor && <ProfileView tutor={selectedTutor} slots={selectedSlots} me={me} onSignIn={() => navigate("auth")} onDashboard={() => navigate("dashboard")} onBack={() => navigate("find")} onBook={book} busy={busy} setError={setError} setNotice={setNotice} />}
        {view === "dashboard" && <Dashboard me={me} onSignIn={() => navigate("auth")} createAccount={createAccount} refreshMe={refreshMe} busy={busy} setError={setError} setNotice={setNotice} />}

        <footer className="mt-20 bg-[var(--ink)] py-12 text-white">
          <div className="lh-shell grid gap-8 sm:grid-cols-3">
            <div>
              <strong>LessonHarbour</strong>
              <p className="mt-3 max-w-sm text-sm text-white/60">{text("Bilingual tutors for Chinese-speaking families in Southern England.", "为英国南部华人家庭连接值得信赖的双语老师。")}</p>
            </div>
            <div>
              <strong className="text-xs uppercase tracking-wider">{text("Clear and flexible", "透明灵活")}</strong>
              <p className="mt-3 text-sm text-white/60">{text("No contact fee · No forced lesson subscription", "无联系费 · 不强制购买课程订阅")}</p>
            </div>
            <div>
              <strong className="text-xs uppercase tracking-wider">{text("Learning areas", "课程方向")}</strong>
              <p className="mt-3 text-sm text-white/60">{text("11+ · GCSE · A-Level · Music · Art · Coding", "11+ · GCSE · A-Level · 音乐 · 艺术 · 编程")}</p>
            </div>
          </div>
        </footer>
      </div>
    </LocaleContext.Provider>
  );
}

function AuthView({ chatGPTSignInPath, refreshMe, onSuccess, setError, setNotice }: { chatGPTSignInPath: string; refreshMe: () => Promise<void>; onSuccess: () => void; setError: (value: string | null) => void; setNotice: (value: string | null) => void }) {
  const { text } = useI18n();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true); setError(null); setNotice(null);
    try {
      const result = await api<{ authenticated: boolean; verificationRequired?: boolean; message?: string }>("/api/auth", { method: "POST", body: JSON.stringify({ action: mode, email, password, displayName }) });
      if (result.verificationRequired) {
        setNotice(text("Registration received. Check your email, verify the address, then return to sign in.", "注册成功。请查收验证邮件，验证邮箱后返回登录。"));
        setMode("login"); setPassword("");
      } else {
        await refreshMe(); onSuccess();
      }
    } catch (error) { setError(error instanceof Error ? error.message : text("Unable to authenticate", "无法完成登录")); }
    finally { setSubmitting(false); }
  }

  return <main className="lh-shell py-20"><section className="lh-card mx-auto max-w-lg p-8 shadow-xl shadow-black/5"><span className="lh-kicker">{text("Secure account access", "安全账号登录")}</span><h1 className="lh-serif mt-3 text-5xl">{mode === "login" ? text("Sign in with email", "使用邮箱登录") : text("Create an account", "创建账号")}</h1><div className="mt-6 grid grid-cols-2 rounded-xl bg-[var(--cream)] p-1"><button type="button" className={`rounded-lg border-0 px-4 py-2 text-sm font-bold ${mode === "login" ? "bg-white shadow" : "bg-transparent"}`} onClick={() => setMode("login")}>{text("Sign in", "登录")}</button><button type="button" className={`rounded-lg border-0 px-4 py-2 text-sm font-bold ${mode === "signup" ? "bg-white shadow" : "bg-transparent"}`} onClick={() => setMode("signup")}>{text("Register", "注册")}</button></div><form className="mt-6 grid gap-4" onSubmit={submit}>{mode === "signup" && <label className="lh-field">{text("Display name", "显示名称")}<input required minLength={2} maxLength={60} autoComplete="name" value={displayName} onChange={event => setDisplayName(event.target.value)}/></label>}<label className="lh-field">{text("Email address", "邮箱地址")}<input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)}/></label><label className="lh-field">{text("Password", "密码")}<input required minLength={8} maxLength={128} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)}/><span className="text-[11px] font-normal text-[var(--muted)]">{text("At least 8 characters. Your password is handled by Supabase Auth and is never stored by LessonHarbour.", "至少8个字符。密码由 Supabase Auth 安全处理，LessonHarbour 不会保存。")}</span></label><button disabled={submitting} className="lh-button coral" type="submit">{submitting ? text("Please wait…", "请稍候…") : mode === "login" ? text("Sign in", "登录") : text("Create account", "创建账号")}</button></form><div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]"><span className="h-px flex-1 bg-[var(--line)]"/><span>{text("or", "或者")}</span><span className="h-px flex-1 bg-[var(--line)]"/></div><a className="lh-button ghost block w-full text-center" href={chatGPTSignInPath} target="_top">{text("Continue with ChatGPT", "使用 ChatGPT 登录")}</a></section></main>;
}

function HomeView({ tutors, location, setLocation, onFind, onDashboard }: { tutors: Tutor[]; location: string; setLocation: (value: string) => void; onFind: (subject: string, location: string) => void; onDashboard: () => void }) {
  const [query, setQuery] = useState("English");
  const { text, zh } = useI18n();
  const featured = [
    { subject: "Mathematics", label: text("Mathematics", "数学") },
    { subject: "English", label: text("English", "英语") },
    {
      subject: "Computing & Coding",
      label: text("Computing & Coding", "计算机与编程"),
    },
    { subject: "Music", label: text("Music", "音乐") },
  ];
  return (
    <>
      <main className="lh-shell grid min-h-[620px] items-center gap-14 py-16 lg:grid-cols-[1.05fr_.95fr]">
        <section>
          <span className="lh-kicker">{text("For Chinese-speaking families in Southern England", "服务英国南部华人家庭")}</span>
          <h1 className="lh-serif mt-5 max-w-3xl text-[clamp(3.4rem,7vw,5.7rem)] leading-[.92] tracking-[-.055em]">{text("Find a tutor who understands your child and the UK education system.", "找到既懂孩子，也懂英国教育体系的老师。")}</h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">{text("Bilingual support for 11+, 13+, GCSE, A-Level, music, LAMDA, art and coding—online or locally.", "提供 11+、13+、GCSE、A-Level、音乐、LAMDA、艺术和编程等双语课程，支持线上及本地授课。")}</p>
          <form
            className="mt-9 grid max-w-2xl gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-xl shadow-black/5 sm:grid-cols-[1fr_180px_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              onFind(query, location);
            }}
          >
            <select className="min-w-0 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm font-semibold" value={query} onChange={(e) => setQuery(e.target.value)} aria-label={text("Subject", "科目")}>
              <option value="">{text("All subjects", "全部科目")}</option>
              {subjectGroups.map((group) => (
                <option key={group.en} value={group.en}>
                  {zh ? group.zh : group.en}
                </option>
              ))}
            </select>
            <select className="rounded-xl border border-[var(--line)] bg-[var(--cream)] px-3 text-sm font-semibold" value={location} onChange={(e) => setLocation(e.target.value)} aria-label={text("Location", "地点")}>
              {locationOptions.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>
            <button className="lh-button coral" type="submit">
              {text("Search tutors →", "寻找老师 →")}
            </button>
          </form>
        </section>
        <section className="grid w-full grid-cols-2 gap-3" aria-label={text("Browse popular subjects", "浏览热门科目")}>
          {featured.map((item, index) => {
            const tutor = tutors.find((person) => person.subjects.some((subject) => subject.startsWith(`${item.subject} · `)));
            return (
              <button type="button" key={item.subject} onClick={() => onFind(item.subject, location)} className="group relative min-h-[205px] overflow-hidden rounded-3xl border border-white/70 bg-[var(--teal)] p-0 text-left shadow-xl shadow-black/10">
                <div
                  className="absolute inset-0 scale-105 bg-[url('/tutor-subjects-placeholder.png')] bg-[length:400%_100%] bg-no-repeat opacity-80 blur-[2px] transition duration-300 group-hover:scale-110"
                  style={
                    tutor?.profilePhotoUrl
                      ? {
                          backgroundImage: `url(${tutor.profilePhotoUrl})`,
                          backgroundPosition: "center",
                          backgroundSize: "cover",
                        }
                      : { backgroundPosition: `${index * 33.333}% center` }
                  }
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                <div className="relative flex h-full min-h-[205px] flex-col justify-end p-5 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-[.16em] text-white/75">{text("Browse tutors", "浏览老师")}</span>
                  <strong className="lh-serif mt-1 text-2xl">{item.label}</strong>
                  <span className="mt-2 text-xs font-semibold">{tutor ? text(`Tutor near ${location}`, `${location} 附近老师`) : text("View all available tutors", "查看所有可用老师")} →</span>
                </div>
              </button>
            );
          })}
        </section>
      </main>
      <section className="border-y border-[var(--line)] bg-white">
        <div className="lh-shell grid py-7 sm:grid-cols-3">
          <Feature title={text("Clear profiles", "清晰的老师档案")} copy={text("Compare subjects, format and price.", "比较科目、授课方式和价格。")} />
          <Feature title={text("Real availability", "真实可预约时间")} copy={text("See lesson times before sending a request.", "发送申请前即可查看上课时间。")} />
          <Feature title={text("Parent-friendly", "家长友好")} copy={text("Clear booking records and lesson management.", "清晰管理预约和课程记录。")} />
        </div>
      </section>
      <section className="lh-shell py-24">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="lh-kicker">{text("Simple and transparent", "简单透明")}</span>
            <h2 className="lh-serif mt-3 text-5xl tracking-tight">{text("From finding a tutor to a confirmed lesson.", "从寻找老师到确认课程，一步步完成。")}</h2>
          </div>
          <button className="lh-button ghost" onClick={onDashboard}>
            {text("Open dashboard", "进入个人中心")}
          </button>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Step n="01" title={text("Publish", "发布")} copy={text("A tutor creates a profile and lesson times.", "老师创建档案并发布可预约时间。")} />
          <Step n="02" title={text("Request", "申请")} copy={text("A family chooses a suitable open slot.", "家长选择合适的开放时段。")} />
          <Step n="03" title={text("Confirm", "确认")} copy={text("The tutor securely accepts or declines.", "老师安全地接受或拒绝申请。")} />
        </div>
      </section>
    </>
  );
}

function Feature({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="border-[var(--line)] px-6 py-3 first:pl-0 sm:border-r">
      <strong className="text-sm">{title}</strong>
      <p className="mt-1 text-xs text-[var(--muted)]">{copy}</p>
    </div>
  );
}
function Step({ n, title, copy }: { n: string; title: string; copy: string }) {
  return (
    <article className="lh-card p-7">
      <span className="lh-kicker">{n}</span>
      <h3 className="lh-serif mt-8 text-3xl">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p>
    </article>
  );
}

function FindView({ tutors, subject, setSubject, location, setLocation, search, openTutor, busy }: { tutors: Tutor[]; subject: string; setSubject: (v: string) => void; location: string; setLocation: (v: string) => void; search: () => void; openTutor: (t: Tutor) => void; busy: boolean }) {
  const { text, zh } = useI18n();
  return (
    <main>
      <section className="border-b border-[var(--line)] bg-[var(--cream)] py-16">
        <div className="lh-shell">
          <span className="lh-kicker">{text("Tutor directory", "老师目录")}</span>
          <h1 className="lh-serif mt-3 text-6xl tracking-tight">{text("Find the right tutor.", "寻找合适的老师。")}</h1>
          <p className="mt-3 text-[var(--muted)]">{text(`Tutors closest to ${location} appear first.`, `优先显示最接近 ${location} 的老师。`)}</p>
        </div>
      </section>
      <section className="lh-shell grid gap-8 py-12 md:grid-cols-[240px_1fr]">
        <aside className="lh-card h-fit p-5">
          <label className="lh-field">
            {text("Subject & level", "科目与级别")}
            <select value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">{text("All subjects", "全部科目")}</option>
              {subjectGroups.flatMap((group) => [
                <option key={group.en} value={group.en} style={{ fontWeight: 700 }}>
                  {zh ? group.zh : group.en}
                </option>,
                ...group.options.map((option) => {
                  const value = `${group.en} · ${option}`;
                  return (
                    <option key={value} value={value}>
                      {`　${option}`}
                    </option>
                  );
                }),
              ])}
            </select>
          </label>
          <label className="lh-field mt-4">
            {text("Location", "地点")}
            <select value={location} onChange={(e) => setLocation(e.target.value)}>
              {locationOptions.map((place) => (
                <option key={place} value={place}>
                  {place}
                </option>
              ))}
            </select>
          </label>
          <button className="lh-button mt-4 w-full" onClick={search}>
            {text("Apply filter", "应用筛选")}
          </button>
        </aside>
        <div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            <strong className="text-[var(--ink)]">{tutors.length}</strong> {text("published tutors", "位已发布老师")}
          </p>
          <div className="grid gap-4">
            {tutors.map((tutor) => (
              <article className="lh-card grid gap-5 p-5 sm:grid-cols-[110px_1fr_auto] sm:items-center" key={tutor.id}>
                <TutorPhoto tutor={tutor} className="h-[110px] w-[110px] rounded-xl text-4xl" />
                <div>
                  <div className="flex flex-wrap gap-1">
                    {(tutor.subjects.length ? tutor.subjects : [tutor.subject]).slice(0, 4).map((item) => (
                      <span className="rounded-full bg-[var(--teal-soft)] px-2 py-1 text-[10px] font-bold text-[var(--teal)]" key={item}>
                        {subjectLabel(item, zh)}
                      </span>
                    ))}
                  </div>
                  <h2 className="lh-serif mt-2 text-3xl">{tutor.displayName}</h2>
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{tutor.bio}</p>
                  <p className="mt-3 text-xs font-bold text-[var(--teal)]">
                    {zh ? (tutor.lessonFormat === "in_person" ? "线下授课" : tutor.lessonFormat === "both" ? "线上及线下" : "线上授课") : lessonFormat(tutor.lessonFormat)}
                    {tutor.generalLocation ? ` · ${tutor.generalLocation}` : ""}
                  </p>
                  <LanguageList languages={tutor.languages} />
                </div>
                <div className="sm:text-right">
                  <strong className="text-xl">£{tutor.hourlyPrice}</strong>
                  <span className="block text-xs text-[var(--muted)]">{text("per hour", "每小时")}</span>
                  <button disabled={busy} className="lh-button mt-4" onClick={() => void openTutor(tutor)}>
                    {text("View profile", "查看档案")}
                  </button>
                </div>
              </article>
            ))}
            {tutors.length === 0 && (
              <div className="lh-card py-20 text-center">
                <span className="text-4xl">⌕</span>
                <h2 className="lh-serif mt-4 text-3xl">{text("No published tutors yet", "暂时没有已发布的老师")}</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">{text("Become the first tutor, or try a different subject.", "成为第一位老师，或者尝试其他科目。")}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function ProfileView({ tutor, slots, me, onSignIn, onDashboard, onBack, onBook, busy, setError, setNotice }: { tutor: Tutor; slots: Slot[]; me: MeResponse; onSignIn: () => void; onDashboard: () => void; onBack: () => void; onBook: (id: string) => void; busy: boolean; setError: (value: string | null) => void; setNotice: (value: string | null) => void }) {
  const { text, zh } = useI18n();
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const format = zh ? (tutor.lessonFormat === "in_person" ? "线下授课" : tutor.lessonFormat === "both" ? "线上及线下" : "线上授课") : lessonFormat(tutor.lessonFormat);
  const biography = zh ? (tutor.bioZh ?? tutor.bio) : (tutor.bioEn ?? tutor.bio);
  async function sendMessage() {
    if (!me.authenticated) {
      onSignIn();
      return;
    }
    if (!me.account || me.account.role !== "student" || !me.studentProfile) {
      onDashboard();
      setError(text("Complete your required student profile before messaging.", "请先在个人中心完成必填的学生资料。"));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId: tutor.id, body: messageBody }),
      });
      setMessageBody("");
      setNotice(text("Message sent. Continue the conversation in your dashboard.", "消息已发送，请在个人中心继续对话。"));
    } catch (error) {
      setError(error instanceof Error ? error.message : text("Unable to send message", "无法发送消息"));
    } finally {
      setSending(false);
    }
  }
  return (
    <main className="lh-shell py-12">
      <button className="border-0 bg-transparent p-0 text-sm font-bold text-[var(--teal)]" onClick={onBack}>
        ← {text("Back to results", "返回搜索结果")}
      </button>
      <div className="mt-8 grid gap-9 lg:grid-cols-[260px_1fr_320px]">
        <TutorPhoto tutor={tutor} className="h-[300px] w-full rounded-2xl text-7xl" />
        <section>
          <span className="lh-kicker">
            {tutor.subject} {text("tutor", "老师")}
          </span>
          <h1 className="lh-serif mt-2 text-6xl tracking-tight">{tutor.displayName}</h1>
          <LanguageList languages={tutor.languages} />
          <p className="mt-5 whitespace-pre-wrap text-lg leading-8 text-[var(--muted)]">{biography}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-5">
            <div>
              <span className="lh-kicker">{text("Format", "授课方式")}</span>
              <strong className="mt-2 block text-sm">{format}</strong>
            </div>
            <div>
              <span className="lh-kicker">{text("Price", "价格")}</span>
              <strong className="mt-2 block text-sm">
                £{tutor.hourlyPrice} {text("per hour", "每小时")}
              </strong>
            </div>
          </div>
          <div className="lh-card mt-6 p-5">
            <h2 className="lh-serif text-2xl">{text("Message this tutor for free", "免费联系这位老师")}</h2>
            <p className="mt-1 text-xs text-[var(--muted)]">{text("Sign in and complete the required student details before sending your first message.", "登录并完成必填学生资料后即可发送第一条消息。")}</p>
            <textarea className="mt-3 min-h-28 w-full rounded-lg border border-[var(--line)] p-3 text-sm" maxLength={1000} value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder={text("Introduce the student, goals and preferred lesson times…", "请介绍学生情况、学习目标和希望的上课时间…")} />
            <button type="button" disabled={sending || messageBody.trim().length === 0} className="lh-button mt-3" onClick={() => void sendMessage()}>
              {sending ? text("Sending…", "正在发送…") : text("Send free message", "免费发送消息")}
            </button>
          </div>
        </section>
        <aside className="lh-card h-fit p-5 shadow-xl shadow-black/5">
          <h2 className="lh-serif text-3xl">{text("Available lessons", "可预约课程")}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">{text("Booking requests require a student account.", "需要学生账号才能申请课程。")}</p>
          <div className="mt-5 grid gap-2">
            {slots.map((slot) => (
              <div className="rounded-xl border border-[var(--line)] p-3" key={slot.id}>
                <strong className="block text-sm">{formatDate(slot.startsAt)}</strong>
                <span className="text-xs text-[var(--muted)]">
                  {text("Until", "结束时间")} {formatDate(slot.endsAt).split(", ").pop()}
                </span>
                <button disabled={busy} className="lh-button coral mt-3 w-full" onClick={() => void onBook(slot.id)}>
                  {text("Request lesson", "申请课程")}
                </button>
              </div>
            ))}
            {slots.length === 0 && <p className="rounded-xl bg-[var(--cream)] p-4 text-sm text-[var(--muted)]">{text("No open lesson times currently.", "目前没有开放的课程时间。")}</p>}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Dashboard({ me, onSignIn, createAccount, refreshMe, busy, setError, setNotice }: { me: MeResponse; onSignIn: () => void; createAccount: (role: Role, name: string) => void; refreshMe: () => Promise<void>; busy: boolean; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const { text } = useI18n();
  if (!me.authenticated)
    return (
      <main className="lh-shell py-24 text-center">
        <span className="lh-kicker">{text("Protected dashboard", "受保护的个人中心")}</span>
        <h1 className="lh-serif mt-4 text-6xl">{text("Sign in to continue.", "请登录后继续。")}</h1>
        <p className="mx-auto mt-4 max-w-lg text-[var(--muted)]">{text("Authentication is handled securely. LessonHarbour never receives or stores your password.", "登录由安全的身份验证服务处理，LessonHarbour 不会接收或保存您的密码。")}</p>
        <button className="lh-button mt-8" onClick={onSignIn}>
          {text("Sign in", "登录")}
        </button>
      </main>
    );
  if (!me.account) return <Onboarding identityName={me.identity?.displayName ?? ""} onCreate={createAccount} busy={busy} />;
  return me.account.role === "tutor" ? <TutorDashboard me={me} refreshMe={refreshMe} setError={setError} setNotice={setNotice} /> : <StudentDashboard me={me} refreshMe={refreshMe} setError={setError} setNotice={setNotice} />;
}

function Onboarding({ identityName, onCreate, busy }: { identityName: string; onCreate: (role: Role, name: string) => void; busy: boolean }) {
  const [name, setName] = useState(identityName.includes("@") ? "" : identityName);
  const [role, setRole] = useState<Role>("student");
  const { text } = useI18n();
  return (
    <main className="lh-shell py-20">
      <section className="lh-card mx-auto max-w-xl p-8">
        <span className="lh-kicker">{text("Create your account", "创建账号")}</span>
        <h1 className="lh-serif mt-3 text-5xl">{text("How will you use LessonHarbour?", "您将如何使用 LessonHarbour？")}</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{text("Choose whether you are booking lessons or offering them. This role cannot be changed in the MVP.", "请选择您是预约课程还是提供课程。当前 MVP 中账号角色创建后无法更改。")}</p>
        <div className="mt-7 grid gap-4">
          <label className="lh-field">
            {text("Display name", "显示名称")}
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder={text("Your name", "您的姓名")} />
          </label>
          <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
            <legend className="mb-2 text-xs font-bold">{text("Account role", "账号角色")}</legend>
            {(["student", "tutor"] as Role[]).map((value) => (
              <label key={value} className={`cursor-pointer rounded-xl border p-4 ${role === value ? "border-[var(--teal)] bg-[var(--teal-soft)]" : "border-[var(--line)]"}`}>
                <input className="mr-2" type="radio" value={value} checked={role === value} onChange={() => setRole(value)} />
                <strong>{value === "student" ? text("Student / Parent", "学生／家长") : text("Tutor", "老师")}</strong>
              </label>
            ))}
          </fieldset>
          <button disabled={busy || name.trim().length < 2} className="lh-button coral" onClick={() => onCreate(role, name)}>
            {busy ? text("Creating…", "正在创建…") : text("Create account", "创建账号")}
          </button>
        </div>
      </section>
    </main>
  );
}

function TutorDashboard({ me, refreshMe, setError, setNotice }: { me: MeResponse; refreshMe: () => Promise<void>; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const [tab, setTab] = useState<"profile" | "availability" | "bookings" | "messages">("profile");
  const [profile, setProfile] = useState<Profile>(
    me.profile ?? {
      userId: me.account!.id,
      subject: "Mathematics · GCSE",
      subjects: ["Mathematics · GCSE"],
      bio: "",
      bioEn: null,
      bioZh: null,
      hourlyPrice: 25,
      lessonFormat: "online",
      generalLocation: "",
      postcode: "",
      profilePhotoUrl: null,
      languages: ["English"],
      isPublished: false,
    },
  );
  const { text } = useI18n();
  const tabs = {
    profile: text("Profile", "老师档案"),
    availability: text("Availability", "可预约时间"),
    bookings: text("Bookings", "预约申请"),
    messages: text("Messages", "消息"),
  };
  return (
    <main>
      <section className="border-b border-[var(--line)] bg-[var(--cream)] py-12">
        <div className="lh-shell">
          <span className="lh-kicker">{text("Tutor dashboard", "老师个人中心")}</span>
          <h1 className="lh-serif mt-2 text-5xl">
            {text("Welcome", "欢迎")}, {me.account!.displayName}.
          </h1>
        </div>
      </section>
      <div className="lh-shell py-10">
        <div className="mb-7 flex flex-wrap gap-2">
          {(["profile", "availability", "bookings", "messages"] as const).map((t) => (
            <button key={t} className={`lh-button ${tab === t ? "" : "ghost"}`} onClick={() => setTab(t)}>
              {tabs[t]}
            </button>
          ))}
        </div>
        {tab === "profile" && <TutorProfileForm profile={profile} setProfile={setProfile} refreshMe={refreshMe} setError={setError} setNotice={setNotice} />} {tab === "availability" && <AvailabilityManager setError={setError} setNotice={setNotice} />} {tab === "bookings" && <BookingManager role="tutor" setError={setError} setNotice={setNotice} />}{" "}
        {tab === "messages" && (
          <div className="grid gap-6">
            <BookingAlertPanel setError={setError} setNotice={setNotice} />
            <MessageCenter account={me.account!} setError={setError} setNotice={setNotice} />
          </div>
        )}
      </div>
    </main>
  );
}

function TutorProfileForm({ profile, setProfile, refreshMe, setError, setNotice }: { profile: Profile; setProfile: (p: Profile) => void; refreshMe: () => Promise<void>; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const [translating, setTranslating] = useState<"EN" | "ZH" | null>(null);
  const { text } = useI18n();
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const data = await api<{ profile: Profile }>("/api/tutor-profile", {
        method: "POST",
        body: JSON.stringify(profile),
      });
      setProfile(data.profile);
      await refreshMe();
      setNotice("Tutor profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save profile");
    }
  }
  async function uploadPhoto(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const data = await api<{ profilePhotoUrl: string }>("/api/profile-photo", { method: "POST", body: form });
      setProfile({ ...profile, profilePhotoUrl: data.profilePhotoUrl });
      setNotice("Profile photo uploaded. Save your profile to keep all changes.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload photo");
    } finally {
      setUploading(false);
    }
  }
  async function translateBiography(target: "EN" | "ZH") {
    setTranslating(target);
    setError(null);
    try {
      const data = await api<{ translation: string; provider?: string }>("/api/translate", {
        method: "POST",
        body: JSON.stringify({ text: profile.bio, target }),
      });
      setProfile({
        ...profile,
        ...(target === "ZH" ? { bioZh: data.translation } : { bioEn: data.translation }),
      });
      setNotice(text(`Translation created${data.provider ? ` with ${data.provider}` : ""}. Review it, then save your profile.`, `翻译已生成${data.provider ? `（${data.provider}）` : ""}，请检查后保存档案。`));
    } catch (err) {
      setError(err instanceof Error ? err.message : text("Unable to translate biography", "无法翻译个人介绍"));
    } finally {
      setTranslating(null);
    }
  }
  return (
    <form className="lh-card grid max-w-3xl gap-5 p-6" onSubmit={submit}>
      <div>
        <span className="lh-kicker">{text("Public profile", "公开档案")}</span>
        <h2 className="lh-serif mt-2 text-4xl">{text("Tell families what you teach.", "向家长介绍您教授的课程。")}</h2>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SubjectPicker
          value={profile.subjects}
          onChange={(selected) =>
            setProfile({
              ...profile,
              subjects: selected,
              subject: selected[0] ?? profile.subject,
            })
          }
        />
        <label className="lh-field">
          {text("Hourly price in pounds", "每小时价格（英镑）")}
          <input type="number" min="5" max="200" value={profile.hourlyPrice} onChange={(e) => setProfile({ ...profile, hourlyPrice: Number(e.target.value) })} />
        </label>
        <label className="lh-field">
          {text("Lesson format", "授课方式")}
          <select
            value={profile.lessonFormat}
            onChange={(e) =>
              setProfile({
                ...profile,
                lessonFormat: e.target.value as Profile["lessonFormat"],
              })
            }
          >
            <option value="online">{text("Online", "线上")}</option>
            <option value="in_person">{text("In person", "线下")}</option>
            <option value="both">{text("Both", "线上及线下")}</option>
          </select>
        </label>
        <label className="lh-field">
          {text("General location", "大致地点")}
          <input value={profile.generalLocation ?? ""} onChange={(e) => setProfile({ ...profile, generalLocation: e.target.value })} placeholder={text("e.g. South London", "例如：伦敦南部")} />
        </label>
        <label className="lh-field">
          {text("UK postcode", "英国邮编")}
          <input maxLength={10} value={profile.postcode ?? ""} onChange={(e) => setProfile({ ...profile, postcode: e.target.value.toUpperCase() })} placeholder="e.g. CR0 1EA" autoComplete="postal-code" />
          <span className="text-[11px] font-normal leading-4 text-[var(--muted)]">{text("Private: other users cannot see this. It is only used for background distance matching with families.", "隐私信息：其他用户看不到，仅用于后台计算您与学生家庭的距离并进行匹配。")}</span>
        </label>
        <div className="lh-field sm:col-span-2">
          <span>{text("Profile photo", "头像")}</span>
          <div className="flex items-center gap-4">
            {profile.profilePhotoUrl ? <img className="size-20 rounded-xl object-cover" src={profile.profilePhotoUrl} alt={text("Profile preview", "头像预览")} referrerPolicy="no-referrer" /> : <div className="grid size-20 place-items-center rounded-xl bg-[var(--cream)] text-2xl">◎</div>}
            <label className="lh-button ghost cursor-pointer">
              <span>{uploading ? text("Uploading…", "正在上传…") : text("Choose photo", "选择照片")}</span>
              <input
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadPhoto(file);
                }}
              />
            </label>
          </div>
          <span className="text-[11px] font-normal text-[var(--muted)]">{text("JPEG, PNG or WebP, maximum 3 MB.", "支持 JPEG、PNG 或 WebP，最大 3MB。")}</span>
        </div>
        <LanguagePicker value={profile.languages} onChange={(languages) => setProfile({ ...profile, languages })} />
      </div>
      <label className="lh-field">
        {text("Original biography", "原始个人介绍")}
        <textarea minLength={30} maxLength={2000} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })} placeholder={text("Describe your teaching experience and approach…", "介绍您的教学经验和教学方式…")} />
        <span className="text-right text-xs text-[var(--muted)]">{profile.bio.length}/2000</span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="lh-field">
          {text("English version", "英文版本")}
          <textarea minLength={30} maxLength={2000} value={profile.bioEn ?? ""} onChange={(e) => setProfile({ ...profile, bioEn: e.target.value || null })} placeholder={text("English translation", "英文翻译")} />
          <span className="text-right text-xs text-[var(--muted)]">{profile.bioEn?.length ?? 0}/2000</span>
          <button type="button" disabled={translating !== null || profile.bio.length < 30} className="lh-button ghost" onClick={() => void translateBiography("EN")}>
            {translating === "EN" ? text("Translating…", "正在翻译…") : text("Auto-translate to English", "自动翻译成英文")}
          </button>
        </label>
        <label className="lh-field">
          {text("Chinese version", "中文版本")}
          <textarea minLength={15} maxLength={2000} value={profile.bioZh ?? ""} onChange={(e) => setProfile({ ...profile, bioZh: e.target.value || null })} placeholder={text("Chinese translation", "中文翻译")} />
          <span className="text-right text-xs text-[var(--muted)]">{profile.bioZh?.length ?? 0}/2000</span>
          <button type="button" disabled={translating !== null || profile.bio.length < 30} className="lh-button ghost" onClick={() => void translateBiography("ZH")}>
            {translating === "ZH" ? text("Translating…", "正在翻译…") : text("Auto-translate to Chinese", "自动翻译成中文")}
          </button>
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm font-bold">
        <input type="checkbox" checked={profile.isPublished} onChange={(e) => setProfile({ ...profile, isPublished: e.target.checked })} /> {text("Publish profile in tutor search", "在老师搜索中公开此档案")}
      </label>
      <button disabled={uploading} className="lh-button coral w-fit" type="submit">
        {text("Save profile", "保存档案")}
      </button>
    </form>
  );
}

function AvailabilityManager({ setError, setNotice }: { setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  type Recurrence = "once" | "weekly_4" | "weekly_8" | "weekly_12" | "weekdays_month" | "weekends_month";
  const detectedTimeZone = nearestTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [date, setDate] = useState(() => todayInTimeZone(detectedTimeZone));
  const [hour, setHour] = useState("17");
  const [minute, setMinute] = useState("00");
  const [timeZone, setTimeZone] = useState(detectedTimeZone);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [recurrence, setRecurrence] = useState<Recurrence>("once");
  const [calendarMonth, setCalendarMonth] = useState(() => date.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(date);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const { text, zh } = useI18n();
  const load = useCallback(async () => {
    try {
      setSlots((await api<{ slots: Slot[] }>("/api/availability")).slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load availability");
    }
  }, [setError]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api<{ slots: Slot[] }>("/api/availability"), api<{ timeZone: string | null }>("/api/timezone")])
      .then(([slotData, zoneData]) => {
        if (!cancelled) {
          setSlots(slotData.slots);
          if (zoneData.timeZone) {
            const zone = nearestTimeZone(zoneData.timeZone);
            setTimeZone(zone);
            setDate((current) => (current === todayInTimeZone(detectedTimeZone) ? todayInTimeZone(zone) : current));
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load availability");
      });
    return () => {
      cancelled = true;
    };
  }, [detectedTimeZone, setError]);
  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const [year, month, day] = date.split("-").map(Number);
      const startsAt = zonedDateTimeToUtc({ year, month, day, hour: Number(hour), minute: Number(minute) }, timeZone);
      const data = await api<{ slots: Slot[] }>("/api/availability", {
        method: "POST",
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          durationMinutes,
          recurrence,
          timeZone,
        }),
      });
      await load();
      setNotice(`${data.slots.length} lesson ${data.slots.length === 1 ? "slot" : "slots"} published in ${timeZone}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add slot");
    }
  }
  async function remove(id: string) {
    try {
      await api(`/api/availability/${id}`, { method: "DELETE" });
      await load();
      setNotice("Availability removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove slot");
    }
  }
  async function enableCalendarSync() {
    try {
      const data = await api<{ feedUrl: string }>("/api/calendar-feed", {
        method: "POST",
      });
      setFeedUrl(`${window.location.origin}${data.feedUrl}`);
      setNotice("Private calendar link created. Subscribe to it once in your calendar app.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to enable calendar sync");
    }
  }
  async function copyCalendarLink() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setNotice("Private calendar link copied.");
    } catch {
      setError("Copy failed. Select and copy the link manually.");
    }
  }
  async function disableCalendarSync() {
    try {
      await api("/api/calendar-feed", { method: "DELETE" });
      setFeedUrl(null);
      setNotice("Calendar sync disabled. Remove the old subscription from your calendar app too.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to disable calendar sync");
    }
  }
  const repeating = recurrence !== "once";
  const slotsByDay = slots.reduce<Record<string, Slot[]>>((grouped, slot) => {
    const key = dateKeyInTimeZone(slot.startsAt, timeZone);
    (grouped[key] ??= []).push(slot);
    return grouped;
  }, {});
  const selectedSlots = slotsByDay[selectedDay] ?? [];
  const monthLabel = new Intl.DateTimeFormat(zh ? "zh-CN" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${calendarMonth}-01T00:00:00Z`));
  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form className="lh-card h-fit grid gap-4 p-6" onSubmit={add}>
        <h2 className="lh-serif text-3xl">{text("Add availability", "添加可预约时间")}</h2>
        <label className="lh-field">
          {text("Date", "日期")}
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <fieldset className="grid grid-cols-2 gap-3 border-0 p-0">
          <legend className="mb-2 text-xs font-bold">{text("First lesson starts", "第一节课开始时间")}</legend>
          <label className="lh-field">
            {text("Hour", "小时")}
            <select aria-label={text("Hour", "小时")} value={hour} onChange={(e) => setHour(e.target.value)}>
              {Array.from({ length: 24 }, (_, value) => String(value).padStart(2, "0")).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="lh-field">
            {text("Minute", "分钟")}
            <select aria-label={text("Minute", "分钟")} value={minute} onChange={(e) => setMinute(e.target.value)}>
              {["00", "15", "30", "45"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </fieldset>
        <label className="lh-field">
          {text("Time zone", "时区")}
          <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {timeZoneOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="lh-field">
          {text("Lesson length", "课程时长")}
          <select value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value))}>
            {[30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180].map((value) => (
              <option value={value} key={value}>
                {value < 60 ? `${value} ${text("minutes", "分钟")}` : `${Math.floor(value / 60)}${text("h", "小时")}${value % 60 ? ` ${value % 60}${text("m", "分钟")}` : ""}`}
              </option>
            ))}
          </select>
        </label>
        <label className="lh-field">
          {text("Repeat", "重复")}
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="once">{text("One time only", "仅一次")}</option>
            <option value="weekly_4">{text("Weekly for 4 weeks", "每周一次，共4周")}</option>
            <option value="weekly_8">{text("Weekly for 8 weeks", "每周一次，共8周")}</option>
            <option value="weekly_12">{text("Weekly for 12 weeks", "每周一次，共12周")}</option>
            <option value="weekdays_month">{text("Daily on weekdays for 1 month", "工作日每天，持续1个月")}</option>
            <option value="weekends_month">{text("Daily on weekends for 1 month", "周末每天，持续1个月")}</option>
          </select>
        </label>
        {repeating && <p className="rounded-lg bg-[var(--teal-soft)] p-3 text-xs font-bold text-[var(--teal)]">{text("All matching slots will be added at the same local time. Existing overlaps will be rejected.", "系统会按相同当地时间添加所有符合条件的时段；与现有时段冲突的设置将被拒绝。")}</p>}
        <button className="lh-button coral" type="submit">
          {repeating ? text("Add repeated slots", "添加重复时段") : text("Add one slot", "添加一个时段")}
        </button>
      </form>
      <section className="grid gap-5">
        <div>
          <h2 className="lh-serif text-3xl">{text("Your lesson times", "您的课程时间")}</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {text("Shown in", "显示时区：")} {timeZone}
          </p>
        </div>
        <div className="lh-card p-5">
          <div className="flex items-center justify-between gap-3">
            <button type="button" className="lh-button ghost" aria-label="Previous month" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}>
              ←
            </button>
            <h3 className="lh-serif text-2xl">{monthLabel}</h3>
            <button type="button" className="lh-button ghost" aria-label="Next month" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}>
              →
            </button>
          </div>
          <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dayName) => (
              <span key={dayName}>{dayName}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays(calendarMonth).map((dayKey) => {
              const count = slotsByDay[dayKey]?.length ?? 0;
              const inMonth = dayKey.startsWith(calendarMonth);
              return (
                <button type="button" key={dayKey} onClick={() => setSelectedDay(dayKey)} className={`lh-calendar-day ${selectedDay === dayKey ? "selected" : ""} ${inMonth ? "" : "outside"}`}>
                  <span>{Number(dayKey.slice(-2))}</span>
                  {count > 0 && <small>{count}</small>}
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-[var(--line)] pt-4">
            <strong className="text-sm">
              {new Intl.DateTimeFormat("en-GB", {
                dateStyle: "full",
                timeZone: "UTC",
              }).format(new Date(`${selectedDay}T00:00:00Z`))}
            </strong>
            <div className="mt-3 grid gap-2">
              {selectedSlots.map((slot) => (
                <article className="flex items-center justify-between gap-3 rounded-xl bg-[var(--cream)] p-3" key={slot.id}>
                  <div>
                    <strong className="text-sm">
                      {new Intl.DateTimeFormat("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone,
                      }).format(new Date(slot.startsAt))}
                    </strong>
                    <p className="text-xs text-[var(--muted)]">{slot.bookingStatus ? `Booking: ${slot.bookingStatus}` : "Available"}</p>
                  </div>
                  {!slot.bookingId && (
                    <button type="button" className="lh-button ghost" onClick={() => void remove(slot.id)}>
                      Remove
                    </button>
                  )}
                </article>
              ))}
              {selectedSlots.length === 0 && <p className="text-sm text-[var(--muted)]">No lesson times on this date.</p>}
            </div>
          </div>
        </div>
        <details className="lh-card overflow-hidden">
          <summary className="cursor-pointer list-none p-5 font-bold">
            {text("All lesson times", "全部课程时间")} ({slots.length}) <span className="float-right text-[var(--teal)]">⌄</span>
          </summary>
          <div className="grid max-h-80 gap-2 overflow-y-auto border-t border-[var(--line)] p-4">
            {slots.map((slot) => (
              <article className="flex items-center justify-between gap-4 rounded-xl bg-[var(--cream)] p-3" key={slot.id}>
                <div>
                  <strong className="text-sm">{formatDate(slot.startsAt, timeZone)}</strong>
                  <p className="text-xs text-[var(--muted)]">{slot.bookingStatus ? `${text("Booking", "预约")}: ${slot.bookingStatus}` : text("Available", "可预约")}</p>
                </div>
                {!slot.bookingId && (
                  <button type="button" className="lh-button ghost" onClick={() => void remove(slot.id)}>
                    {text("Remove", "删除")}
                  </button>
                )}
              </article>
            ))}
            {slots.length === 0 && <p className="p-3 text-sm text-[var(--muted)]">{text("No lesson times yet.", "尚未添加课程时间。")}</p>}
          </div>
        </details>
        <div className="lh-card p-5">
          <span className="lh-kicker">{text("Automatic calendar sync", "自动同步日历")}</span>
          <h3 className="lh-serif mt-2 text-2xl">{text("Keep confirmed lessons in your calendar", "将已确认课程同步到您的日历")}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{text("Create a private subscription link, then add it once to your calendar. Accepted bookings will update automatically; your calendar provider controls refresh timing.", "创建私人订阅链接并添加到您的日历一次；已接受的预约之后会自动更新，具体刷新时间由日历服务决定。")}</p>
          {feedUrl ? (
            <div className="mt-4 grid gap-3">
              <input className="w-full rounded-lg border border-[var(--line)] bg-[var(--cream)] p-3 text-xs" value={feedUrl} readOnly aria-label={text("Private calendar subscription link", "私人日历订阅链接")} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="lh-button" onClick={() => void copyCalendarLink()}>
                  {text("Copy private link", "复制私人链接")}
                </button>
                <button type="button" className="lh-button ghost" onClick={() => void disableCalendarSync()}>
                  {text("Disable sync", "关闭同步")}
                </button>
              </div>
              <p className="text-xs font-bold text-[#9b3328]">{text("Keep this link private. Anyone with it can view your confirmed lesson times.", "请妥善保管此链接；任何获得链接的人都能查看您已确认的课程时间。")}</p>
            </div>
          ) : (
            <button type="button" className="lh-button mt-4" onClick={() => void enableCalendarSync()}>
              {text("Enable calendar sync", "开启日历同步")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function StudentDashboard({ me, refreshMe, setError, setNotice }: { me: MeResponse; refreshMe: () => Promise<void>; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const { text } = useI18n();
  const [tab, setTab] = useState<"details" | "bookings" | "messages">(me.studentProfile ? "bookings" : "details");
  return (
    <main>
      <section className="border-b border-[var(--line)] bg-[var(--cream)] py-12">
        <div className="lh-shell">
          <span className="lh-kicker">{text("Student / parent dashboard", "学生／家长个人中心")}</span>
          <h1 className="lh-serif mt-2 text-5xl">{text("Manage learning and tutor conversations.", "管理学习资料、预约和老师消息。")}</h1>
        </div>
      </section>
      <div className="lh-shell py-10">
        {!me.studentProfile && <div className="lh-error mb-6">{text("Complete the required student details before messaging or booking a tutor.", "请先完成必填学生资料，然后才能联系或预约老师。")}</div>}
        <div className="mb-7 flex flex-wrap gap-2">
          {(["details", "bookings", "messages"] as const).map((item) => (
            <button key={item} className={`lh-button ${tab === item ? "" : "ghost"}`} onClick={() => setTab(item)}>
              {item === "details" ? text("Student details", "学生资料") : item === "bookings" ? text("Bookings", "课程预约") : text("Messages", "消息")}
            </button>
          ))}
        </div>
        {tab === "details" && <StudentProfileForm profile={me.studentProfile ?? null} refreshMe={refreshMe} setError={setError} setNotice={setNotice} />} {tab === "bookings" && <BookingManager role="student" setError={setError} setNotice={setNotice} />} {tab === "messages" && <MessageCenter account={me.account!} setError={setError} setNotice={setNotice} />}
      </div>
    </main>
  );
}

function StudentProfileForm({ profile, refreshMe, setError, setNotice }: { profile: StudentProfile | null; refreshMe: () => Promise<void>; setError: (value: string | null) => void; setNotice: (value: string | null) => void }) {
  const { text } = useI18n();
  const [studentName, setStudentName] = useState(profile?.studentName ?? "");
  const [postcode, setPostcode] = useState(profile?.postcode ?? "");
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(profile?.subjects ?? []);
  const [saving, setSaving] = useState(false);
  function toggleSubject(subject: string) {
    setSelectedSubjects((current) => (current.includes(subject) ? current.filter((item) => item !== subject) : [...current, subject]));
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api("/api/student-profile", {
        method: "POST",
        body: JSON.stringify({
          studentName,
          postcode,
          subjects: selectedSubjects,
        }),
      });
      await refreshMe();
      setNotice(text("Student details saved.", "学生资料已保存。"));
    } catch (error) {
      setError(error instanceof Error ? error.message : text("Unable to save student details", "无法保存学生资料"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="lh-card grid max-w-3xl gap-5 p-6" onSubmit={save}>
      <div>
        <span className="lh-kicker">{text("Required details", "必填资料")}</span>
        <h2 className="lh-serif mt-2 text-4xl">{text("Help us find suitable tutors.", "帮助我们寻找合适的老师。")}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{text("Your postcode is used for distance matching and is not shown publicly.", "邮编仅用于计算与线下老师的距离，不会公开显示。")}</p>
      </div>
      <label className="lh-field">
        {text("Student name", "学生姓名")}
        <input required minLength={2} maxLength={80} value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder={text("Student's preferred name", "学生常用姓名")} />
      </label>
      <label className="lh-field">
        {text("UK postcode", "英国邮编")}
        <input required maxLength={10} value={postcode} onChange={(event) => setPostcode(event.target.value.toUpperCase())} placeholder="e.g. CR0 1EA" autoComplete="postal-code" />
      </label>
      <fieldset className="border-0 p-0">
        <legend className="mb-3 text-xs font-bold">{text("Subjects that need tutoring", "需要辅导的科目（可多选）")}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {subjects.map((subject) => (
            <label key={subject} className={`cursor-pointer rounded-xl border p-3 text-sm ${selectedSubjects.includes(subject) ? "border-[var(--teal)] bg-[var(--teal-soft)]" : "border-[var(--line)]"}`}>
              <input className="mr-2" type="checkbox" checked={selectedSubjects.includes(subject)} onChange={() => toggleSubject(subject)} />
              {subject}
            </label>
          ))}
        </div>
      </fieldset>
      <button className="lh-button coral w-fit" disabled={saving || selectedSubjects.length === 0} type="submit">
        {saving ? text("Saving…", "正在保存…") : text("Save student details", "保存学生资料")}
      </button>
    </form>
  );
}

function BookingAlertPanel({ setError, setNotice }: { setError: (value: string | null) => void; setNotice: (value: string | null) => void }) {
  const { text, locale } = useI18n();
  const [requests, setRequests] = useState<Booking[]>([]);
  const load = useCallback(async () => {
    try {
      const data = await api<{ bookings: Booking[] }>("/api/bookings");
      setRequests(data.bookings.filter((booking) => booking.status === "pending"));
    } catch (error) {
      setError(error instanceof Error ? error.message : locale === "zh" ? "无法载入预约申请" : "Unable to load booking requests");
    }
  }, [setError, locale]);
  useEffect(() => {
    let cancelled = false;
    api<{ bookings: Booking[] }>("/api/bookings")
      .then((data) => {
        if (!cancelled) setRequests(data.bookings.filter((booking) => booking.status === "pending"));
      })
      .catch((error) => {
        if (!cancelled) setError(error instanceof Error ? error.message : "Unable to load booking requests");
      });
    return () => {
      cancelled = true;
    };
  }, [setError]);
  async function respond(id: string, status: "accepted" | "rejected") {
    try {
      await api(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      setNotice(status === "accepted" ? text("Booking accepted.", "预约已接受。") : text("Booking rejected.", "预约已拒绝。"));
    } catch (error) {
      setError(error instanceof Error ? error.message : text("Unable to update booking", "无法更新预约"));
    }
  }
  if (requests.length === 0) return null;
  return (
    <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5">
      <span className="lh-kicker">{text("Booking alert", "预约提醒")}</span>
      <h2 className="lh-serif mt-2 text-3xl">{text(`${requests.length} booking request${requests.length === 1 ? "" : "s"} need a response`, `${requests.length} 个预约申请等待处理`)}</h2>
      <div className="mt-4 grid gap-3">
        {requests.map((booking) => (
          <article className="rounded-xl bg-white p-4" key={booking.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <strong>{booking.studentName}</strong>
                <p className="text-sm text-[var(--muted)]">
                  {booking.subject} · {formatDate(booking.startsAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="lh-button" onClick={() => void respond(booking.id, "accepted")}>
                  {text("Accept", "接受")}
                </button>
                <button type="button" className="lh-button ghost" onClick={() => void respond(booking.id, "rejected")}>
                  {text("Reject", "拒绝")}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MessageCenter({ account, setError, setNotice }: { account: Account; setError: (value: string | null) => void; setNotice: (value: string | null) => void }) {
  const { text, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    try {
      const data = await api<{ messages: Message[] }>("/api/messages");
      setMessages(data.messages);
      setSelectedId((current) => current ?? data.messages[0]?.otherId ?? null);
    } catch (error) {
      setError(error instanceof Error ? error.message : locale === "zh" ? "无法载入消息" : "Unable to load messages");
    }
  }, [setError, locale]);
  useEffect(() => {
    let cancelled = false;
    api<{ messages: Message[] }>("/api/messages")
      .then((data) => {
        if (!cancelled) {
          setMessages(data.messages);
          setSelectedId(data.messages[0]?.otherId ?? null);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(error instanceof Error ? error.message : locale === "zh" ? "无法载入消息" : "Unable to load messages");
      });
    return () => {
      cancelled = true;
    };
  }, [setError, locale]);
  const threads = [...new Map(messages.map((message) => [message.otherId, message.otherName])).entries()];
  const conversation = messages.filter((message) => message.otherId === selectedId);
  async function send() {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ recipientId: selectedId, body: reply }),
      });
      setReply("");
      await load();
      setNotice(text("Message sent.", "消息已发送。"));
    } catch (error) {
      setError(error instanceof Error ? error.message : text("Unable to send message", "无法发送消息"));
    } finally {
      setSending(false);
    }
  }
  return (
    <section>
      <h2 className="lh-serif text-4xl">{text("Messages", "消息")}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{text("Messaging tutors is free. Keep conversations respectful and do not share a child's private information.", "联系老师完全免费。请保持礼貌，并避免发送儿童的敏感私人信息。")}</p>
      <div className="lh-card mt-5 grid min-h-[420px] overflow-hidden md:grid-cols-[220px_1fr]">
        <aside className="border-b border-[var(--line)] p-3 md:border-b-0 md:border-r">
          {threads.map(([id, name]) => (
            <button type="button" key={id} className={`mb-2 block w-full rounded-xl border-0 p-3 text-left text-sm font-bold ${selectedId === id ? "bg-[var(--teal-soft)] text-[var(--teal)]" : "bg-[var(--cream)]"}`} onClick={() => setSelectedId(id)}>
              {name}
            </button>
          ))}
          {threads.length === 0 && <p className="p-3 text-sm text-[var(--muted)]">{text("No conversations yet.", "暂时没有对话。")}</p>}
        </aside>
        <div className="flex min-h-[420px] flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {conversation.map((message) => (
              <div key={message.id} className={`max-w-[80%] rounded-2xl p-3 text-sm ${message.senderId === account.id ? "ml-auto bg-[var(--teal)] text-white" : "bg-[var(--cream)]"}`}>
                <p className="whitespace-pre-wrap">{message.body}</p>
                <span className={`mt-2 block text-[10px] ${message.senderId === account.id ? "text-white/70" : "text-[var(--muted)]"}`}>{formatDate(message.createdAt)}</span>
              </div>
            ))}
            {selectedId && conversation.length === 0 && <p className="text-sm text-[var(--muted)]">{text("Start the conversation.", "开始对话吧。")}</p>}
          </div>
          {selectedId && (
            <div className="flex gap-2 border-t border-[var(--line)] p-4">
              <textarea className="min-h-20 flex-1 rounded-lg border border-[var(--line)] p-3 text-sm" maxLength={1000} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={text("Write a reply…", "输入回复…")} />
              <button type="button" className="lh-button self-end" disabled={sending || !reply.trim()} onClick={() => void send()}>
                {text("Send", "发送")}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function BookingManager({ role, setError, setNotice }: { role: Role; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const { text, locale } = useI18n();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/London";
  const today = todayInTimeZone(timeZone);
  const [calendarMonth, setCalendarMonth] = useState(today.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(today);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    try {
      setBookings((await api<{ bookings: Booking[] }>("/api/bookings")).bookings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load bookings");
    }
  }, [setError]);
  useEffect(() => {
    let cancelled = false;
    api<{ bookings: Booking[] }>("/api/bookings")
      .then((data) => {
        if (!cancelled) setBookings(data.bookings);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load bookings");
      });
    return () => {
      cancelled = true;
    };
  }, [setError]);
  async function respond(id: string, status: "accepted" | "rejected") {
    try {
      await api(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
      setNotice(text(`Booking ${status}.`, status === "accepted" ? "预约已接受。" : "预约已拒绝。"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update booking");
    }
  }
  async function cancel(id: string) {
    try {
      await api(`/api/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled", reason }),
      });
      await load();
      setCancellingId(null);
      setReason("");
      setNotice(text("Lesson cancelled and the other person has been notified.", "课程已取消，并已通知对方。"));
    } catch (e) {
      setError(e instanceof Error ? e.message : text("Unable to cancel lesson", "无法取消课程"));
    }
  }
  const byDay = bookings.reduce<Record<string, Booking[]>>((grouped, booking) => {
    const key = dateKeyInTimeZone(booking.startsAt, timeZone);
    (grouped[key] ??= []).push(booking);
    return grouped;
  }, {});
  const selectedBookings = byDay[selectedDay] ?? [];
  const monthLabel = new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${calendarMonth}-01T00:00:00Z`));
  const statusLabel = (status: Booking["status"]) => (status === "accepted" ? text("Accepted", "已接受") : status === "rejected" ? text("Rejected", "已拒绝") : status === "cancelled" ? text("Cancelled", "已取消") : text("Pending", "待处理"));
  return (
    <section>
      <h2 className="lh-serif text-4xl">{role === "student" ? text("My booking calendar", "我的预约日历") : text("Booking calendar", "预约日历")}</h2>
      <div className="lh-card mt-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <button type="button" className="lh-button ghost" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}>
            ←
          </button>
          <h3 className="lh-serif text-2xl">{monthLabel}</h3>
          <button type="button" className="lh-button ghost" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}>
            →
          </button>
        </div>
        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-[var(--muted)]">
          {[text("Mon", "一"), text("Tue", "二"), text("Wed", "三"), text("Thu", "四"), text("Fri", "五"), text("Sat", "六"), text("Sun", "日")].map((dayName, index) => (
            <span key={`${dayName}-${index}`}>{dayName}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays(calendarMonth).map((dayKey) => {
            const events = byDay[dayKey] ?? [];
            return (
              <button type="button" key={dayKey} onClick={() => setSelectedDay(dayKey)} className={`lh-calendar-day ${selectedDay === dayKey ? "selected" : ""} ${dayKey.startsWith(calendarMonth) ? "" : "outside"}`}>
                <span>{Number(dayKey.slice(-2))}</span>
                {events.length > 0 && <small>{events.length}</small>}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {selectedBookings.map((booking) => (
          <article className="lh-card p-5" key={booking.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="lh-kicker">{booking.subject ?? text("Lesson", "课程")}</span>
                <strong className="mt-2 block">{role === "student" ? booking.tutorName : booking.studentName}</strong>
                <p className="mt-1 text-sm text-[var(--muted)]">{formatDate(booking.startsAt, timeZone)}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${booking.status === "accepted" ? "bg-[var(--teal-soft)] text-[var(--teal)]" : booking.status === "rejected" || booking.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{statusLabel(booking.status)}</span>
            </div>
            {booking.cancellationReason && (
              <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900">
                <strong>{text("Cancellation reason", "取消原因")}:</strong> {booking.cancellationReason}
              </p>
            )}
            {role === "tutor" && booking.status === "pending" && (
              <div className="mt-4 flex gap-2">
                <button className="lh-button" onClick={() => void respond(booking.id, "accepted")}>
                  {text("Accept", "接受")}
                </button>
                <button className="lh-button ghost" onClick={() => void respond(booking.id, "rejected")}>
                  {text("Reject", "拒绝")}
                </button>
              </div>
            )}
            {booking.status === "accepted" && cancellingId !== booking.id && (
              <button
                type="button"
                className="lh-button ghost mt-4"
                onClick={() => {
                  setCancellingId(booking.id);
                  setReason("");
                }}
              >
                {text("Cancel lesson", "取消课程")}
              </button>
            )}
            {booking.status === "accepted" && cancellingId === booking.id && (
              <div className="mt-4 rounded-xl bg-[var(--cream)] p-4">
                <label className="lh-field">
                  {text("Tell the other person why you need to cancel", "请向对方说明取消原因")}
                  <textarea minLength={5} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder={text("Cancellation reason…", "请输入取消原因…")} />
                </label>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={reason.trim().length < 5} className="lh-button" onClick={() => void cancel(booking.id)}>
                    {text("Confirm cancellation", "确认取消")}
                  </button>
                  <button type="button" className="lh-button ghost" onClick={() => setCancellingId(null)}>
                    {text("Keep lesson", "保留课程")}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
        {selectedBookings.length === 0 && <p className="lh-card p-8 text-center text-sm text-[var(--muted)]">{text("No bookings on this date.", "这一天没有预约。")}</p>}
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">{text("Cancellation notifications are sent to the other account. Email delivery activates after a sender domain is configured.", "取消后会向对方账号发送通知；配置发件域名后还会同步发送邮件。")}</p>
    </section>
  );
}
