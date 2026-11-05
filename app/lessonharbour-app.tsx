"use client";
/* eslint-disable @next/next/no-img-element -- tutor URLs are dynamic and use a local fallback */

import { FormEvent, KeyboardEvent, useCallback, useEffect, useState } from "react";
import { zonedDateTimeToUtc } from "@/lib/rules";

type Role = "student" | "tutor";
type Account = { id: string; email: string; displayName: string; role: Role };
type Profile = { userId: string; subject: string; bio: string; hourlyPrice: number; lessonFormat: "online" | "in_person" | "both"; generalLocation: string | null; profilePhotoUrl: string | null; languages: string[]; isPublished: boolean };
type Tutor = { id: string; displayName: string; subject: string; bio: string; hourlyPrice: number; lessonFormat: string; generalLocation: string | null; profilePhotoUrl: string | null; languages: string[] };
type Slot = { id: string; startsAt: string; endsAt: string; bookingId?: string | null; bookingStatus?: string | null };
type Booking = { id: string; status: string; subject?: string; tutorName?: string; studentName?: string; startsAt: string; endsAt: string };
type MeResponse = { authenticated: boolean; identity?: { displayName: string; email: string }; account: Account | null; profile?: Profile | null };

const subjects = ["Mathematics", "English", "French", "Chemistry", "Biology", "Physics", "Computer Science", "Music"];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { ...(typeof options?.body === "string" ? { "Content-Type": "application/json" } : {}), ...options?.headers } });
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function initials(name: string) { return name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase(); }
function lessonFormat(value: string) { return value === "in_person" ? "In person" : value === "both" ? "Online & in person" : "Online"; }
function formatDate(value: string, timeZone?: string) { return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(new Date(value)); }

const timeZoneOptions = [
  ["Pacific/Pago_Pago", "UTC−11 · Samoa"], ["Pacific/Honolulu", "UTC−10 · Honolulu"],
  ["America/Anchorage", "UTC−09 · Anchorage"], ["America/Los_Angeles", "UTC−08 · Los Angeles"],
  ["America/Denver", "UTC−07 · Denver"], ["America/Chicago", "UTC−06 · Chicago"],
  ["America/New_York", "UTC−05 · New York"], ["America/Halifax", "UTC−04 · Halifax"],
  ["America/Sao_Paulo", "UTC−03 · São Paulo"], ["Atlantic/South_Georgia", "UTC−02 · South Georgia"],
  ["Atlantic/Azores", "UTC−01 · Azores"], ["Europe/London", "UTC±00 · London"],
  ["Europe/Paris", "UTC+01 · Paris"], ["Europe/Athens", "UTC+02 · Athens"],
  ["Europe/Istanbul", "UTC+03 · Istanbul"], ["Asia/Dubai", "UTC+04 · Dubai"],
  ["Asia/Karachi", "UTC+05 · Karachi"], ["Asia/Dhaka", "UTC+06 · Dhaka"],
  ["Asia/Bangkok", "UTC+07 · Bangkok"], ["Asia/Shanghai", "UTC+08 · Shanghai"],
  ["Asia/Tokyo", "UTC+09 · Tokyo"], ["Australia/Brisbane", "UTC+10 · Brisbane"],
  ["Pacific/Noumea", "UTC+11 · Nouméa"], ["Pacific/Fiji", "UTC+12 · Fiji"],
] as const;

function timeZoneOffset(timeZone: string, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value);
  return Math.round((Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute")) - date.getTime()) / 60_000);
}

function nearestTimeZone(timeZone: string) {
  const exact = timeZoneOptions.find(([value]) => value === timeZone);
  if (exact) return exact[0];
  try {
    const offset = timeZoneOffset(timeZone);
    return timeZoneOptions.find(([value]) => timeZoneOffset(value) === offset)?.[0] ?? "Europe/London";
  } catch { return "Europe/London"; }
}

function todayInTimeZone(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "";
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
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const matches = languageOptions.filter(language => !value.includes(language) && language.toLowerCase().startsWith(query.trim().toLowerCase())).slice(0, 6);
  function add(language: string) { if (value.length < 8 && !value.includes(language)) onChange([...value, language]); setQuery(""); setOpen(false); }
  function keyDown(event: KeyboardEvent<HTMLInputElement>) { if (event.key === "Enter" && matches[0]) { event.preventDefault(); add(matches[0]); } }
  return <div className="lh-field sm:col-span-2"><span>Languages spoken</span><div className="flex flex-wrap gap-2">{value.map(language => <button type="button" className="rounded-full bg-[var(--teal-soft)] px-3 py-1 text-xs font-bold text-[var(--teal)]" key={language} onClick={() => onChange(value.filter(item => item !== language))}>{language} ×</button>)}</div><div className="relative"><input value={query} disabled={value.length >= 8} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={keyDown} placeholder={value.length >= 8 ? "Maximum 8 languages" : "Start typing a language…"} autoComplete="off"/>{open && query.trim() && <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-xl">{matches.map(language => <button type="button" className="block w-full border-0 bg-white px-3 py-2 text-left text-sm hover:bg-[var(--cream)]" key={language} onMouseDown={event => { event.preventDefault(); add(language); }}>{language}</button>)}{matches.length === 0 && <span className="block px-3 py-2 text-xs text-[var(--muted)]">No matching language</span>}</div>}</div><span className="text-[11px] font-normal text-[var(--muted)]">Type a few letters, then select a suggestion. Click a tag to remove it.</span></div>;
}

function TutorPhoto({ tutor, className }: { tutor: Pick<Tutor, "displayName" | "profilePhotoUrl">; className: string }) {
  const [failed, setFailed] = useState(false);
  if (!tutor.profilePhotoUrl || failed) return <div className={`${className} grid place-items-center bg-gradient-to-br from-[#66857e] to-[#173d39] text-white lh-serif`}>{initials(tutor.displayName)}</div>;
  return <img className={`${className} object-cover`} src={tutor.profilePhotoUrl} alt={`${tutor.displayName}'s profile`} referrerPolicy="no-referrer" onError={() => setFailed(true)}/>;
}

function LanguageList({ languages }: { languages: string[] }) {
  if (languages.length === 0) return null;
  return <div className="mt-3 flex flex-wrap gap-2" aria-label="Languages spoken">{languages.map(language => <span className="rounded-full bg-[var(--teal-soft)] px-3 py-1 text-[11px] font-bold text-[var(--teal)]" key={language}>{language}</span>)}</div>;
}

export default function LessonHarbourApp({ initialIdentity, signInPath, signOutPath }: { initialIdentity: { displayName: string; email: string } | null; signInPath: string; signOutPath: string }) {
  const [view, setView] = useState<"home" | "find" | "profile" | "dashboard">("home");
  const [me, setMe] = useState<MeResponse>({ authenticated: Boolean(initialIdentity), identity: initialIdentity ?? undefined, account: null });
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [subject, setSubject] = useState("");
  const [selectedTutor, setSelectedTutor] = useState<Tutor | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshMe = useCallback(async () => {
    try { setMe(await api<MeResponse>("/api/me")); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load account"); }
  }, []);

  const loadTutors = useCallback(async (filter = subject) => {
    try {
      const data = await api<{ tutors: Tutor[] }>(`/api/tutors${filter ? `?subject=${encodeURIComponent(filter)}` : ""}`);
      setTutors(data.tutors);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tutors"); }
  }, [subject]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api<MeResponse>("/api/me"), api<{ tutors: Tutor[] }>("/api/tutors")])
      .then(([accountData, tutorData]) => {
        if (!cancelled) { setMe(accountData); setTutors(tutorData.tutors); }
      })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load LessonHarbour"); });
    return () => { cancelled = true; };
  }, []);

  function navigate(next: typeof view) {
    setView(next); setError(null); setNotice(null);
    if (next === "find") void loadTutors();
    if (next === "dashboard") void refreshMe();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function openTutor(tutor: Tutor) {
    setBusy(true); setError(null);
    try {
      const data = await api<{ tutor: Tutor; slots: Slot[] }>(`/api/tutors/${encodeURIComponent(tutor.id)}`);
      setSelectedTutor(data.tutor); setSelectedSlots(data.slots); navigate("profile");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load tutor"); }
    finally { setBusy(false); }
  }

  async function createAccount(role: Role, displayName: string) {
    setBusy(true); setError(null);
    try {
      await api("/api/account", { method: "POST", body: JSON.stringify({ role, displayName }) });
      await refreshMe(); setNotice("Your LessonHarbour account is ready.");
    } catch (e) { setError(e instanceof Error ? e.message : "Account setup failed"); }
    finally { setBusy(false); }
  }

  async function book(slotId: string) {
    if (!me.authenticated) { window.location.href = signInPath; return; }
    if (!me.account) { navigate("dashboard"); return; }
    if (me.account.role !== "student") { setError("Only student accounts can request lessons."); return; }
    setBusy(true); setError(null);
    try {
      await api("/api/bookings", { method: "POST", body: JSON.stringify({ slotId }) });
      setNotice("Booking request sent. Your tutor can now accept or reject it."); navigate("dashboard");
    } catch (e) { setError(e instanceof Error ? e.message : "Booking failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <div className="bg-[var(--ink)] py-2 text-center text-[11px] font-bold tracking-[.08em] text-white">LIVE MVP · REAL ACCOUNTS · PERSISTENT DATA</div>
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[rgb(255_253_248/.94)] backdrop-blur-lg">
        <div className="lh-shell flex h-[72px] items-center justify-between gap-6">
          <button className="flex items-center gap-3 border-0 bg-transparent p-0 font-bold" onClick={() => navigate("home")}><span className="grid size-9 place-items-center rounded-full bg-[var(--teal-soft)] text-[var(--teal)]">⌁</span><span>LessonHarbour</span></button>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            <button className="border-0 bg-transparent text-sm font-semibold" onClick={() => navigate("home")}>Home</button>
            <button className="border-0 bg-transparent text-sm font-semibold" onClick={() => navigate("find")}>Find tutors</button>
            <button className="border-0 bg-transparent text-sm font-semibold" onClick={() => navigate("dashboard")}>Dashboard</button>
          </nav>
          <div className="flex items-center gap-2">
            {me.authenticated ? <><button className="hidden border-0 bg-transparent text-xs font-bold sm:block" onClick={() => navigate("dashboard")}>{me.account?.displayName ?? me.identity?.displayName}</button><a className="lh-button ghost" href={signOutPath} target="_top">Sign out</a></> : <a className="lh-button" href={signInPath} target="_top">Sign in</a>}
          </div>
        </div>
      </header>

      {(error || notice) && <div className="lh-shell mt-5">{error && <div className="lh-error">{error}</div>}{notice && <div className="lh-success">{notice}</div>}</div>}

      {view === "home" && <HomeView onFind={(value) => { setSubject(value); void loadTutors(value); navigate("find"); }} onDashboard={() => navigate("dashboard")} />}
      {view === "find" && <FindView tutors={tutors} subject={subject} setSubject={setSubject} search={() => void loadTutors()} openTutor={openTutor} busy={busy} />}
      {view === "profile" && selectedTutor && <ProfileView tutor={selectedTutor} slots={selectedSlots} onBack={() => navigate("find")} onBook={book} busy={busy} />}
      {view === "dashboard" && <Dashboard me={me} signInPath={signInPath} createAccount={createAccount} refreshMe={refreshMe} busy={busy} setError={setError} setNotice={setNotice} />}

      <footer className="mt-20 bg-[var(--ink)] py-12 text-white"><div className="lh-shell grid gap-8 sm:grid-cols-3"><div><strong>LessonHarbour</strong><p className="mt-3 max-w-sm text-sm text-white/60">An open tutor discovery and booking MVP. No booking commission and no paid ranking in this release.</p></div><div><strong className="text-xs uppercase tracking-wider">Built safely</strong><p className="mt-3 text-sm text-white/60">Managed identity · Server-side permissions · D1 database</p></div><div><strong className="text-xs uppercase tracking-wider">Current scope</strong><p className="mt-3 text-sm text-white/60">Profiles · Availability · Booking requests</p></div></div></footer>
    </div>
  );
}

function HomeView({ onFind, onDashboard }: { onFind: (subject: string) => void; onDashboard: () => void }) {
  const [query, setQuery] = useState("");
  return <>
    <main className="lh-shell grid min-h-[620px] items-center gap-14 py-16 lg:grid-cols-[1.05fr_.95fr]">
      <section><span className="lh-kicker">Free, simple, human</span><h1 className="lh-serif mt-5 max-w-3xl text-[clamp(3.4rem,7vw,5.7rem)] leading-[.92] tracking-[-.055em]">Find a tutor who <em className="text-[var(--coral)]">gets</em> how you learn.</h1><p className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">Independent tutors, clear availability and direct booking requests. Start with the essentials; add complexity only when the service is stable.</p>
        <form className="mt-9 flex max-w-xl gap-2 rounded-2xl border border-[var(--line)] bg-white p-2 shadow-xl shadow-black/5" onSubmit={(e) => { e.preventDefault(); onFind(query); }}><input className="min-w-0 flex-1 border-0 bg-transparent px-4 outline-none" value={query} onChange={e => setQuery(e.target.value)} placeholder="Try Mathematics or French" aria-label="Subject"/><button className="lh-button coral" type="submit">Search tutors →</button></form>
      </section>
      <section className="relative mx-auto grid min-h-[430px] w-full max-w-[480px] place-items-center" aria-label="Tutor profile example"><div className="absolute size-[360px] rounded-[44%_56%_61%_39%] bg-[var(--yellow)]"></div><div className="lh-card relative w-[310px] rotate-[-2deg] overflow-hidden shadow-2xl"><div className="grid h-56 place-items-center bg-gradient-to-br from-[#6b8881] to-[#173d39] text-7xl text-white lh-serif">AM</div><div className="p-6"><span className="lh-kicker">Available this week</span><h2 className="lh-serif mt-2 text-2xl">Amara Mensah</h2><p className="text-sm text-[var(--muted)]">GCSE Mathematics · London</p><div className="mt-4 flex justify-between text-sm font-bold"><span>Online & in person</span><span>£28/h</span></div></div></div></section>
    </main>
    <section className="border-y border-[var(--line)] bg-white"><div className="lh-shell grid py-7 sm:grid-cols-3"><Feature title="Clear profiles" copy="Compare subject, format and price."/><Feature title="Persistent booking" copy="Requests survive across sessions."/><Feature title="Role-based access" copy="Student and tutor actions stay separate."/></div></section>
    <section className="lh-shell py-24"><div className="flex flex-wrap items-end justify-between gap-4"><div><span className="lh-kicker">The focused MVP</span><h2 className="lh-serif mt-3 text-5xl tracking-tight">One journey, built properly.</h2></div><button className="lh-button ghost" onClick={onDashboard}>Open dashboard</button></div><div className="mt-12 grid gap-4 md:grid-cols-3"><Step n="01" title="Publish" copy="A tutor creates a profile and available lesson times."/><Step n="02" title="Request" copy="A student finds a tutor and requests one open slot."/><Step n="03" title="Respond" copy="The tutor accepts or rejects the request securely."/></div></section>
  </>;
}

function Feature({ title, copy }: { title: string; copy: string }) { return <div className="border-[var(--line)] px-6 py-3 first:pl-0 sm:border-r"><strong className="text-sm">{title}</strong><p className="mt-1 text-xs text-[var(--muted)]">{copy}</p></div>; }
function Step({ n, title, copy }: { n: string; title: string; copy: string }) { return <article className="lh-card p-7"><span className="lh-kicker">{n}</span><h3 className="lh-serif mt-8 text-3xl">{title}</h3><p className="mt-3 text-sm leading-6 text-[var(--muted)]">{copy}</p></article>; }

function FindView({ tutors, subject, setSubject, search, openTutor, busy }: { tutors: Tutor[]; subject: string; setSubject: (v: string) => void; search: () => void; openTutor: (t: Tutor) => void; busy: boolean }) {
  return <main><section className="border-b border-[var(--line)] bg-[var(--cream)] py-16"><div className="lh-shell"><span className="lh-kicker">Tutor directory</span><h1 className="lh-serif mt-3 text-6xl tracking-tight">Find the right tutor.</h1><p className="mt-3 text-[var(--muted)]">Only published profiles appear here.</p></div></section><section className="lh-shell grid gap-8 py-12 md:grid-cols-[240px_1fr]"><aside className="lh-card h-fit p-5"><label className="lh-field">Subject<select value={subject} onChange={e => setSubject(e.target.value)}><option value="">All subjects</option>{subjects.map(s => <option key={s}>{s}</option>)}</select></label><button className="lh-button mt-4 w-full" onClick={search}>Apply filter</button></aside><div><p className="mb-4 text-sm text-[var(--muted)]"><strong className="text-[var(--ink)]">{tutors.length}</strong> published tutors</p><div className="grid gap-4">{tutors.map(tutor => <article className="lh-card grid gap-5 p-5 sm:grid-cols-[110px_1fr_auto] sm:items-center" key={tutor.id}><TutorPhoto tutor={tutor} className="h-[110px] w-[110px] rounded-xl text-4xl"/><div><span className="lh-kicker">{tutor.subject}</span><h2 className="lh-serif mt-1 text-3xl">{tutor.displayName}</h2><p className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">{tutor.bio}</p><p className="mt-3 text-xs font-bold text-[var(--teal)]">{lessonFormat(tutor.lessonFormat)}{tutor.generalLocation ? ` · ${tutor.generalLocation}` : ""}</p><LanguageList languages={tutor.languages}/></div><div className="sm:text-right"><strong className="text-xl">£{tutor.hourlyPrice}</strong><span className="block text-xs text-[var(--muted)]">per hour</span><button disabled={busy} className="lh-button mt-4" onClick={() => void openTutor(tutor)}>View profile</button></div></article>)}{tutors.length === 0 && <div className="lh-card py-20 text-center"><span className="text-4xl">⌕</span><h2 className="lh-serif mt-4 text-3xl">No published tutors yet</h2><p className="mt-2 text-sm text-[var(--muted)]">Become the first tutor, or try a different subject.</p></div>}</div></div></section></main>;
}

function ProfileView({ tutor, slots, onBack, onBook, busy }: { tutor: Tutor; slots: Slot[]; onBack: () => void; onBook: (id: string) => void; busy: boolean }) {
  return <main className="lh-shell py-12"><button className="border-0 bg-transparent p-0 text-sm font-bold text-[var(--teal)]" onClick={onBack}>← Back to results</button><div className="mt-8 grid gap-9 lg:grid-cols-[260px_1fr_320px]"><TutorPhoto tutor={tutor} className="h-[300px] w-full rounded-2xl text-7xl"/><section><span className="lh-kicker">{tutor.subject} tutor</span><h1 className="lh-serif mt-2 text-6xl tracking-tight">{tutor.displayName}</h1><LanguageList languages={tutor.languages}/><p className="mt-5 text-lg leading-8 text-[var(--muted)]">{tutor.bio}</p><div className="mt-8 grid grid-cols-2 gap-4 border-t border-[var(--line)] pt-5"><div><span className="lh-kicker">Format</span><strong className="mt-2 block text-sm">{lessonFormat(tutor.lessonFormat)}</strong></div><div><span className="lh-kicker">Price</span><strong className="mt-2 block text-sm">£{tutor.hourlyPrice} per hour</strong></div></div></section><aside className="lh-card h-fit p-5 shadow-xl shadow-black/5"><h2 className="lh-serif text-3xl">Available lessons</h2><p className="mt-1 text-xs text-[var(--muted)]">Booking requests require a student account.</p><div className="mt-5 grid gap-2">{slots.map(slot => <div className="rounded-xl border border-[var(--line)] p-3" key={slot.id}><strong className="block text-sm">{formatDate(slot.startsAt)}</strong><span className="text-xs text-[var(--muted)]">Until {formatDate(slot.endsAt).split(", ").pop()}</span><button disabled={busy} className="lh-button coral mt-3 w-full" onClick={() => void onBook(slot.id)}>Request lesson</button></div>)}{slots.length === 0 && <p className="rounded-xl bg-[var(--cream)] p-4 text-sm text-[var(--muted)]">No open lesson times currently.</p>}</div></aside></div></main>;
}

function Dashboard({ me, signInPath, createAccount, refreshMe, busy, setError, setNotice }: { me: MeResponse; signInPath: string; createAccount: (role: Role, name: string) => void; refreshMe: () => Promise<void>; busy: boolean; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  if (!me.authenticated) return <main className="lh-shell py-24 text-center"><span className="lh-kicker">Protected dashboard</span><h1 className="lh-serif mt-4 text-6xl">Sign in to continue.</h1><p className="mx-auto mt-4 max-w-lg text-[var(--muted)]">Authentication is handled securely by Sign in with ChatGPT. LessonHarbour never receives or stores your password.</p><a className="lh-button mt-8" href={signInPath} target="_top">Sign in with ChatGPT</a></main>;
  if (!me.account) return <Onboarding identityName={me.identity?.displayName ?? ""} onCreate={createAccount} busy={busy}/>;
  return me.account.role === "tutor" ? <TutorDashboard me={me} refreshMe={refreshMe} setError={setError} setNotice={setNotice}/> : <StudentDashboard setError={setError}/>;
}

function Onboarding({ identityName, onCreate, busy }: { identityName: string; onCreate: (role: Role, name: string) => void; busy: boolean }) {
  const [name, setName] = useState(identityName.includes("@") ? "" : identityName);
  const [role, setRole] = useState<Role>("student");
  return <main className="lh-shell py-20"><section className="lh-card mx-auto max-w-xl p-8"><span className="lh-kicker">Create your account</span><h1 className="lh-serif mt-3 text-5xl">How will you use LessonHarbour?</h1><p className="mt-3 text-sm leading-6 text-[var(--muted)]">This role controls which records and actions your account can access. It cannot be changed in the MVP.</p><div className="mt-7 grid gap-4"><label className="lh-field">Display name<input value={name} maxLength={60} onChange={e => setName(e.target.value)} placeholder="Your name"/></label><fieldset className="grid grid-cols-2 gap-3 border-0 p-0"><legend className="mb-2 text-xs font-bold">Account role</legend>{(["student", "tutor"] as Role[]).map(value => <label key={value} className={`cursor-pointer rounded-xl border p-4 ${role === value ? "border-[var(--teal)] bg-[var(--teal-soft)]" : "border-[var(--line)]"}`}><input className="mr-2" type="radio" value={value} checked={role === value} onChange={() => setRole(value)}/><strong className="capitalize">{value}</strong></label>)}</fieldset><button disabled={busy || name.trim().length < 2} className="lh-button coral" onClick={() => onCreate(role, name)}>{busy ? "Creating…" : "Create account"}</button></div></section></main>;
}

function TutorDashboard({ me, refreshMe, setError, setNotice }: { me: MeResponse; refreshMe: () => Promise<void>; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const [tab, setTab] = useState<"profile" | "availability" | "bookings">("profile");
  const [profile, setProfile] = useState<Profile>(me.profile ?? { userId: me.account!.id, subject: "Mathematics", bio: "", hourlyPrice: 25, lessonFormat: "online", generalLocation: "", profilePhotoUrl: null, languages: ["English"], isPublished: false });
  return <main><section className="border-b border-[var(--line)] bg-[var(--cream)] py-12"><div className="lh-shell"><span className="lh-kicker">Tutor dashboard</span><h1 className="lh-serif mt-2 text-5xl">Welcome, {me.account!.displayName}.</h1></div></section><div className="lh-shell py-10"><div className="mb-7 flex flex-wrap gap-2">{(["profile", "availability", "bookings"] as const).map(t => <button key={t} className={`lh-button ${tab === t ? "" : "ghost"}`} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>{tab === "profile" && <TutorProfileForm profile={profile} setProfile={setProfile} refreshMe={refreshMe} setError={setError} setNotice={setNotice}/>} {tab === "availability" && <AvailabilityManager setError={setError} setNotice={setNotice}/>} {tab === "bookings" && <BookingManager role="tutor" setError={setError} setNotice={setNotice}/>}</div></main>;
}

function TutorProfileForm({ profile, setProfile, refreshMe, setError, setNotice }: { profile: Profile; setProfile: (p: Profile) => void; refreshMe: () => Promise<void>; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setError(null); try { const data = await api<{ profile: Profile }>("/api/tutor-profile", { method: "POST", body: JSON.stringify(profile) }); setProfile(data.profile); await refreshMe(); setNotice("Tutor profile saved."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to save profile"); } }
  async function uploadPhoto(file: File) { setUploading(true); setError(null); try { const form = new FormData(); form.append("photo", file); const data = await api<{ profilePhotoUrl: string }>("/api/profile-photo", { method: "POST", body: form }); setProfile({ ...profile, profilePhotoUrl: data.profilePhotoUrl }); setNotice("Profile photo uploaded. Save your profile to keep all changes."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to upload photo"); } finally { setUploading(false); } }
  return <form className="lh-card grid max-w-3xl gap-5 p-6" onSubmit={submit}>
    <div><span className="lh-kicker">Public profile</span><h2 className="lh-serif mt-2 text-4xl">Tell students what you teach.</h2></div>
    <div className="grid gap-5 sm:grid-cols-2">
      <label className="lh-field">Subject<select value={profile.subject} onChange={e => setProfile({ ...profile, subject: e.target.value })}>{subjects.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="lh-field">Hourly price in pounds<input type="number" min="5" max="200" value={profile.hourlyPrice} onChange={e => setProfile({ ...profile, hourlyPrice: Number(e.target.value) })}/></label>
      <label className="lh-field">Lesson format<select value={profile.lessonFormat} onChange={e => setProfile({ ...profile, lessonFormat: e.target.value as Profile["lessonFormat"] })}><option value="online">Online</option><option value="in_person">In person</option><option value="both">Both</option></select></label>
      <label className="lh-field">General location<input value={profile.generalLocation ?? ""} onChange={e => setProfile({ ...profile, generalLocation: e.target.value })} placeholder="e.g. South London"/></label>
      <div className="lh-field sm:col-span-2"><span>Profile photo</span><div className="flex items-center gap-4">{profile.profilePhotoUrl ? <img className="size-20 rounded-xl object-cover" src={profile.profilePhotoUrl} alt="Profile preview" referrerPolicy="no-referrer"/> : <div className="grid size-20 place-items-center rounded-xl bg-[var(--cream)] text-2xl">◎</div>}<label className="lh-button ghost cursor-pointer"><span>{uploading ? "Uploading…" : "Choose photo"}</span><input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={e => { const file = e.target.files?.[0]; if (file) void uploadPhoto(file); }}/></label></div><span className="text-[11px] font-normal text-[var(--muted)]">JPEG, PNG or WebP, maximum 3 MB.</span></div>
      <LanguagePicker value={profile.languages} onChange={languages => setProfile({ ...profile, languages })}/>
    </div>
    <label className="lh-field">Biography<textarea minLength={30} maxLength={800} value={profile.bio} onChange={e => setProfile({ ...profile, bio: e.target.value })} placeholder="Describe your teaching experience and approach…"/></label>
    <label className="flex items-center gap-3 text-sm font-bold"><input type="checkbox" checked={profile.isPublished} onChange={e => setProfile({ ...profile, isPublished: e.target.checked })}/> Publish profile in tutor search</label>
    <button disabled={uploading} className="lh-button coral w-fit" type="submit">Save profile</button>
  </form>;
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
  const load = useCallback(async () => { try { setSlots((await api<{ slots: Slot[] }>("/api/availability")).slots); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load availability"); } }, [setError]);
  useEffect(() => {
    let cancelled = false;
    Promise.all([api<{ slots: Slot[] }>("/api/availability"), api<{ timeZone: string | null }>("/api/timezone")]).then(([slotData, zoneData]) => { if (!cancelled) { setSlots(slotData.slots); if (zoneData.timeZone) { const zone = nearestTimeZone(zoneData.timeZone); setTimeZone(zone); setDate(current => current === todayInTimeZone(detectedTimeZone) ? todayInTimeZone(zone) : current); } } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load availability"); });
    return () => { cancelled = true; };
  }, [detectedTimeZone, setError]);
  async function add(e: FormEvent) { e.preventDefault(); setError(null); try { const [year, month, day] = date.split("-").map(Number); const startsAt = zonedDateTimeToUtc({ year, month, day, hour: Number(hour), minute: Number(minute) }, timeZone); const data = await api<{ slots: Slot[] }>("/api/availability", { method: "POST", body: JSON.stringify({ startsAt: startsAt.toISOString(), durationMinutes, recurrence, timeZone }) }); await load(); setNotice(`${data.slots.length} lesson ${data.slots.length === 1 ? "slot" : "slots"} published in ${timeZone}.`); } catch (err) { setError(err instanceof Error ? err.message : "Unable to add slot"); } }
  async function remove(id: string) { try { await api(`/api/availability/${id}`, { method: "DELETE" }); await load(); setNotice("Availability removed."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to remove slot"); } }
  async function enableCalendarSync() { try { const data = await api<{ feedUrl: string }>("/api/calendar-feed", { method: "POST" }); setFeedUrl(`${window.location.origin}${data.feedUrl}`); setNotice("Private calendar link created. Subscribe to it once in your calendar app."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to enable calendar sync"); } }
  async function copyCalendarLink() { if (!feedUrl) return; try { await navigator.clipboard.writeText(feedUrl); setNotice("Private calendar link copied."); } catch { setError("Copy failed. Select and copy the link manually."); } }
  async function disableCalendarSync() { try { await api("/api/calendar-feed", { method: "DELETE" }); setFeedUrl(null); setNotice("Calendar sync disabled. Remove the old subscription from your calendar app too."); } catch (err) { setError(err instanceof Error ? err.message : "Unable to disable calendar sync"); } }
  const repeating = recurrence !== "once";
  const slotsByDay = slots.reduce<Record<string, Slot[]>>((grouped, slot) => { const key = dateKeyInTimeZone(slot.startsAt, timeZone); (grouped[key] ??= []).push(slot); return grouped; }, {});
  const selectedSlots = slotsByDay[selectedDay] ?? [];
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${calendarMonth}-01T00:00:00Z`));
  return <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
    <form className="lh-card h-fit grid gap-4 p-6" onSubmit={add}><h2 className="lh-serif text-3xl">Add availability</h2><label className="lh-field">Date<input required type="date" value={date} onChange={e => setDate(e.target.value)}/></label><fieldset className="grid grid-cols-2 gap-3 border-0 p-0"><legend className="mb-2 text-xs font-bold">First lesson starts</legend><label className="lh-field">Hour<select aria-label="Hour" value={hour} onChange={e => setHour(e.target.value)}>{Array.from({length: 24}, (_, value) => String(value).padStart(2, "0")).map(value => <option key={value}>{value}</option>)}</select></label><label className="lh-field">Minute<select aria-label="Minute" value={minute} onChange={e => setMinute(e.target.value)}>{["00", "15", "30", "45"].map(value => <option key={value}>{value}</option>)}</select></label></fieldset><label className="lh-field">Time zone<select value={timeZone} onChange={e => setTimeZone(e.target.value)}>{timeZoneOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="lh-field">Lesson length<select value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))}>{[30,45,60,75,90,105,120,135,150,165,180].map(value => <option value={value} key={value}>{value < 60 ? `${value} minutes` : `${Math.floor(value / 60)}h${value % 60 ? ` ${value % 60}m` : ""}`}</option>)}</select></label><label className="lh-field">Repeat<select value={recurrence} onChange={e => setRecurrence(e.target.value as Recurrence)}><option value="once">One time only</option><option value="weekly_4">Weekly for 4 weeks</option><option value="weekly_8">Weekly for 8 weeks</option><option value="weekly_12">Weekly for 12 weeks</option><option value="weekdays_month">Daily on weekdays for 1 month</option><option value="weekends_month">Daily on weekends for 1 month</option></select></label>{repeating && <p className="rounded-lg bg-[var(--teal-soft)] p-3 text-xs font-bold text-[var(--teal)]">All matching slots will be added at the same local time. Existing overlaps will be rejected.</p>}<button className="lh-button coral" type="submit">{repeating ? "Add repeated slots" : "Add one slot"}</button></form>
    <section className="grid gap-5"><div><h2 className="lh-serif text-3xl">Your lesson times</h2><p className="mt-1 text-xs text-[var(--muted)]">Shown in {timeZone}</p></div>
      <div className="lh-card p-5"><div className="flex items-center justify-between gap-3"><button type="button" className="lh-button ghost" aria-label="Previous month" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))}>←</button><h3 className="lh-serif text-2xl">{monthLabel}</h3><button type="button" className="lh-button ghost" aria-label="Next month" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))}>→</button></div><div className="mt-5 grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(dayName => <span key={dayName}>{dayName}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{calendarDays(calendarMonth).map(dayKey => { const count = slotsByDay[dayKey]?.length ?? 0; const inMonth = dayKey.startsWith(calendarMonth); return <button type="button" key={dayKey} onClick={() => setSelectedDay(dayKey)} className={`lh-calendar-day ${selectedDay === dayKey ? "selected" : ""} ${inMonth ? "" : "outside"}`}><span>{Number(dayKey.slice(-2))}</span>{count > 0 && <small>{count}</small>}</button>; })}</div><div className="mt-4 border-t border-[var(--line)] pt-4"><strong className="text-sm">{new Intl.DateTimeFormat("en-GB", { dateStyle: "full", timeZone: "UTC" }).format(new Date(`${selectedDay}T00:00:00Z`))}</strong><div className="mt-3 grid gap-2">{selectedSlots.map(slot => <article className="flex items-center justify-between gap-3 rounded-xl bg-[var(--cream)] p-3" key={slot.id}><div><strong className="text-sm">{new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(slot.startsAt))}</strong><p className="text-xs text-[var(--muted)]">{slot.bookingStatus ? `Booking: ${slot.bookingStatus}` : "Available"}</p></div>{!slot.bookingId && <button type="button" className="lh-button ghost" onClick={() => void remove(slot.id)}>Remove</button>}</article>)}{selectedSlots.length === 0 && <p className="text-sm text-[var(--muted)]">No lesson times on this date.</p>}</div></div></div>
      <details className="lh-card overflow-hidden"><summary className="cursor-pointer list-none p-5 font-bold">All lesson times ({slots.length}) <span className="float-right text-[var(--teal)]">⌄</span></summary><div className="grid max-h-80 gap-2 overflow-y-auto border-t border-[var(--line)] p-4">{slots.map(slot => <article className="flex items-center justify-between gap-4 rounded-xl bg-[var(--cream)] p-3" key={slot.id}><div><strong className="text-sm">{formatDate(slot.startsAt, timeZone)}</strong><p className="text-xs text-[var(--muted)]">{slot.bookingStatus ? `Booking: ${slot.bookingStatus}` : "Available"}</p></div>{!slot.bookingId && <button type="button" className="lh-button ghost" onClick={() => void remove(slot.id)}>Remove</button>}</article>)}{slots.length === 0 && <p className="p-3 text-sm text-[var(--muted)]">No lesson times yet.</p>}</div></details>
      <div className="lh-card p-5"><span className="lh-kicker">Automatic calendar sync</span><h3 className="lh-serif mt-2 text-2xl">Keep confirmed lessons in your calendar</h3><p className="mt-2 text-sm leading-6 text-[var(--muted)]">Create a private subscription link, then add it once to Google Calendar, Apple Calendar or Outlook. Accepted bookings will update automatically; your calendar provider controls refresh timing.</p>{feedUrl ? <div className="mt-4 grid gap-3"><input className="w-full rounded-lg border border-[var(--line)] bg-[var(--cream)] p-3 text-xs" value={feedUrl} readOnly aria-label="Private calendar subscription link"/><div className="flex flex-wrap gap-2"><button type="button" className="lh-button" onClick={() => void copyCalendarLink()}>Copy private link</button><button type="button" className="lh-button ghost" onClick={() => void disableCalendarSync()}>Disable sync</button></div><p className="text-xs font-bold text-[#9b3328]">Keep this link private. Anyone with it can view your confirmed lesson times.</p></div> : <button type="button" className="lh-button mt-4" onClick={() => void enableCalendarSync()}>Enable calendar sync</button>}</div>
    </section>
  </div>;
}

function StudentDashboard({ setError }: { setError: (v: string | null) => void }) { return <main><section className="border-b border-[var(--line)] bg-[var(--cream)] py-12"><div className="lh-shell"><span className="lh-kicker">Student dashboard</span><h1 className="lh-serif mt-2 text-5xl">Your lesson requests.</h1></div></section><div className="lh-shell py-10"><BookingManager role="student" setError={setError} setNotice={() => {}}/></div></main>; }

function BookingManager({ role, setError, setNotice }: { role: Role; setError: (v: string | null) => void; setNotice: (v: string | null) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const load = useCallback(async () => { try { setBookings((await api<{ bookings: Booking[] }>("/api/bookings")).bookings); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load bookings"); } }, [setError]);
  useEffect(() => {
    let cancelled = false;
    api<{ bookings: Booking[] }>("/api/bookings").then(data => { if (!cancelled) setBookings(data.bookings); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load bookings"); });
    return () => { cancelled = true; };
  }, [setError]);
  async function respond(id: string, status: "accepted" | "rejected") { try { await api(`/api/bookings/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }); await load(); setNotice(`Booking ${status}.`); } catch (e) { setError(e instanceof Error ? e.message : "Unable to update booking"); } }
  return <section><h2 className="lh-serif text-4xl">{role === "student" ? "My bookings" : "Incoming requests"}</h2><div className="mt-5 grid gap-3">{bookings.map(booking => <article className="lh-card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center" key={booking.id}><div><span className="lh-kicker">{booking.subject ?? "Lesson request"}</span><strong className="mt-2 block">{role === "student" ? booking.tutorName : booking.studentName}</strong></div><div><strong className="block text-sm">{formatDate(booking.startsAt)}</strong><span className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${booking.status === "accepted" ? "bg-[var(--teal-soft)] text-[var(--teal)]" : booking.status === "rejected" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{booking.status}</span></div>{role === "tutor" && booking.status === "pending" && <div className="flex gap-2"><button className="lh-button" onClick={() => void respond(booking.id, "accepted")}>Accept</button><button className="lh-button ghost" onClick={() => void respond(booking.id, "rejected")}>Reject</button></div>}</article>)}{bookings.length === 0 && <p className="lh-card p-10 text-center text-sm text-[var(--muted)]">No booking requests yet.</p>}</div></section>;
}
