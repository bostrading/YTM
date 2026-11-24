import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Activity, ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown, CircleHelp,
  Clock3, Filter, Globe, Home, LogOut, Menu, Plus, RefreshCw, Search, Settings,
  ShieldCheck, Users, X
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ciwghxpgvkdsszqezmbr.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_8o52lNy0iHby8vSIq-i1EA_Ef1y_k43";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const isDesktop = typeof window !== "undefined" && Boolean(window.ytm);

function initials(name = "YT") {
  return name.trim().split(/\s+/).slice(0, 2).map((v) => v[0]?.toUpperCase()).join("") || "YT";
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState("Dashboard");
  const [browserState, setBrowserState] = useState({ url: "https://www.youtube.com", loading: false });
  const [loginChecking, setLoginChecking] = useState(false);
  const [loginResults, setLoginResults] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [address, setAddress] = useState("https://www.youtube.com");
  const browserPaneRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadAccounts = useCallback(async () => {
    if (!supabase || !session?.user) return;
    const { data, error } = await supabase.from("yt_accounts").select("*").order("created_at", { ascending: true });
    if (error) { console.error(error); return; }
    setAccounts(data || []);
    if (!selected && data?.length) setSelected(data[0]);
  }, [session, selected]);

  useEffect(() => { loadAccounts(); }, [loadAccounts]);

  useEffect(() => {
    if (page === "Dashboard" && selected && window.ytm) {
      window.ytm.openAccountBrowser(selected.browser_profile_id, "https://www.youtube.com").catch(console.error);
    } else if (page !== "Dashboard") {
      window.ytm?.hideBrowser();
    }
  }, [page, selected?.id]);

  useEffect(() => {
    if (page !== "Riwayat Aktivitas" || !supabase || !session?.user) return;
    supabase.from("yt_activity_logs").select("id,event_type,description,created_at,yt_accounts(display_name)")
      .order("created_at", { ascending: false }).limit(100)
      .then(({ data, error }) => { if (!error) setActivityLogs(data || []); });
  }, [page, session]);

  useEffect(() => {
    const updateBounds = () => {
      const el = browserPaneRef.current;
      if (!el || !window.ytm) return;
      if (page !== "Dashboard") { window.ytm.hideBrowser(); return; }
      const r = el.getBoundingClientRect();
      window.ytm.setBrowserBounds({ x: r.left, y: r.top, width: r.width, height: r.height });
    };
    const timer = setTimeout(updateBounds, 180);
    window.addEventListener("resize", updateBounds);
    const observer = new ResizeObserver(updateBounds);
    if (browserPaneRef.current) observer.observe(browserPaneRef.current);
    return () => { clearTimeout(timer); window.removeEventListener("resize", updateBounds); observer.disconnect(); };
  }, [page, selected]);

  useEffect(() => {
    if (!window.ytm) return;
    const off = window.ytm.onBrowserState((state) => {
      setBrowserState(state);
      if (state.url) setAddress(state.url);
    });
    return off;
  }, []);

  const filteredAccounts = useMemo(() => accounts.filter((a) =>
    (a.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (a.email || "").toLowerCase().includes(search.toLowerCase())
  ), [accounts, search]);

  async function authenticate(e) {
    e.preventDefault(); setAuthError("");
    if (!supabase) { setAuthError("Konfigurasi Supabase belum diisi di file .env."); return; }
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password: authPassword
    });
    if (error) setAuthError(error.message);
  }

  async function addAccount(e) {
    e.preventDefault();
    if (!supabase || !session?.user) return;
    const { data: existing, error: listError } = await supabase
      .from("yt_accounts").select("display_name").order("created_at", { ascending: true });
    if (listError) { alert(listError.message); return; }
    const highestNumber = (existing || []).reduce((highest, account) => {
      const match = String(account.display_name || "").match(/(\\d+)\\s*$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    const accountName = `Account ${String(Math.max(highestNumber, (existing || []).length) + 1).padStart(4, "0")}`;
    const { data, error } = await supabase.from("yt_accounts").insert({
      user_id: session.user.id, display_name: accountName,
      email: newEmail.trim() || null
    }).select().single();
    if (error) { alert(error.message); return; }
    setAccounts((prev) => [...prev, data]);
    setSelected(data);
    setShowAdd(false); setNewEmail("");
    await supabase.from("yt_activity_logs").insert({
      user_id: session.user.id, account_id: data.id,
      event_type: "account_created", description: `Akun ${data.display_name} ditambahkan`
    });
    openAccount(data);
  }

  async function testProfileLogin() {
    if (!selected || !isDesktop) return;
    setLoginChecking(true);
    try {
      const result = await window.ytm.checkYoutubeLogin(selected.browser_profile_id);
      const status = result.signedIn ? "logged_in" : "logged_out";
      setLoginResults((prev) => ({ ...prev, [selected.id]: { status, accountLabel: result.accountLabel || "", checkedAt: result.checkedAt } }));
      const { error } = await supabase.from("yt_accounts").update({ account_status: status }).eq("id", selected.id);
      if (error) throw error;
      setAccounts((prev) => prev.map((a) => a.id === selected.id ? { ...a, account_status: status } : a));
      await supabase.from("yt_activity_logs").insert({ user_id: session.user.id, account_id: selected.id, event_type: "login_test", description: result.signedIn ? `Login YouTube terverifikasi${result.accountLabel ? `: ${result.accountLabel}` : ""}` : "Belum login ke YouTube" });
    } catch (error) {
      alert(error.message || "Pemeriksaan login gagal.");
    } finally { setLoginChecking(false); }
  }

  async function openAccount(account) {
    if (!account) return;
    setSelected(account);
    setPage("Dashboard");
    // Browser profile is activated by the page/selection effect.
    if (supabase && session?.user) {
      await supabase.from("yt_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", account.id);
      await supabase.from("yt_activity_logs").insert({
        user_id: session.user.id, account_id: account.id,
        event_type: "browser_opened", description: `Browser dibuka: ${account.display_name}`
      });
    }
  }

  async function removeAccount(account) {
    if (!confirm(`Hapus data akun ${account.display_name}? Sesi browser lokal tidak otomatis dihapus.`)) return;
    const { error } = await supabase.from("yt_accounts").delete().eq("id", account.id);
    if (error) { alert(error.message); return; }
    setAccounts((prev) => prev.filter((a) => a.id !== account.id));
    if (selected?.id === account.id) { setSelected(null); window.ytm?.hideBrowser(); }
  }

  async function logout() { await supabase?.auth.signOut(); setAccounts([]); setSelected(null); window.ytm?.hideBrowser(); }

  function navigate() { window.ytm?.navigateBrowser(address).catch((e) => alert(e.message)); }

  if (!session) return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={authenticate}>
        <div className="brand-mark">▶</div><h1>YT Manager</h1>
        <p>Multi Account Dashboard</p>
        {!supabase && <div className="notice">Isi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY pada .env terlebih dahulu.</div>}
        <label>Email</label><input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
        <label>Password</label><input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} minLength={6} required />
        {authError && <div className="error">{authError}</div>}
        <button className="primary full" type="submit">Login</button>
      </form>
    </div>
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">▶</div><div><strong>YT Manager</strong><span>Multi Account Dashboard</span></div></div>
        <div className="system-status"><i />System Online</div>
        {isDesktop && <><button className="icon-button" title="Minimize">—</button><button className="icon-button" title="Maximize">□</button><button className="icon-button" title="Close">×</button></>}
      </header>
      <aside className="sidebar">
        <nav>
          {[["Dashboard", Home], ["Semua Akun", Users], ["Riwayat Aktivitas", Clock3], ["Pengaturan", Settings]].map(([label, Icon]) =>
            <button key={label} className={page === label ? "nav-item active" : "nav-item"} onClick={() => setPage(label)}><Icon size={19}/>{label}</button>
          )}
        </nav>
        <div className="side-stats"><div><Users size={18}/><span>Total Akun</span></div><b>{accounts.length}</b><div className="browser-stat"><CheckCircle2 size={18}/><span>Browser Aktif</span></div><b>{selected ? "1 / 1" : "0 / 1"}</b></div>
        <button className="logout-button" onClick={logout}><LogOut size={16}/>Keluar</button>
      </aside>
      <section className="account-panel">
        <div className="panel-heading"><h2>{page === "Semua Akun" ? "Semua Akun YouTube" : "Daftar Akun YouTube"}</h2><span className="count-pill">{accounts.length} Akun</span></div>
        <div className="search-row"><div className="search-box"><Search size={18}/><input placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)}/></div><button className="filter-button" title="Filter"><Filter size={18}/></button></div>
        <div className="account-list">
          {filteredAccounts.map((account) => <div key={account.id} className={selected?.id === account.id ? "account-item selected" : "account-item"} onClick={() => openAccount(account)}>
            <div className="avatar">{initials(account.display_name)}</div><div className="account-meta"><strong>{account.display_name}</strong><span>{account.email || "Email belum diisi"}</span></div>
            <span className={account.account_status === "logged_in" ? "login-status logged-in" : "login-status"}><i/>{!isDesktop && account.account_status ? `Status terakhir: ${account.account_status === "logged_in" ? "Login" : "Logout"}` : account.account_status === "logged_in" ? "Login terverifikasi" : account.account_status === "logged_out" ? "Logout" : "Belum diuji"}</span><button className="more-button" onClick={(e) => { e.stopPropagation(); removeAccount(account); }} title="Hapus">⋮</button>
          </div>)}
          {!filteredAccounts.length && <div className="empty-state">Belum ada akun. Tambahkan akun YouTube untuk memulai.</div>}
        </div>
        <button className="primary add-account" onClick={() => setShowAdd(true)}><Plus size={20}/>Tambah Akun</button>
        <div className="user-foot"><ShieldCheck size={16}/><span>{session.user.email}</span></div>
      </section>
      <main className="browser-panel">
        <div className="browser-toolbar">
          <div className="browser-title"><Globe size={18}/>{isDesktop ? "Browser" : "Web Dashboard"}</div>
          {isDesktop ? <><button className="browser-control" onClick={() => window.ytm.browserBack()}><ArrowLeft size={18}/></button><button className="browser-control" onClick={() => window.ytm.browserForward()}><ArrowRight size={18}/></button><button className="browser-control" onClick={() => window.ytm.browserReload()}><RefreshCw size={18}/></button><form className="address-bar" onSubmit={(e) => { e.preventDefault(); navigate(); }}><span>🔒</span><input value={address} onChange={(e) => setAddress(e.target.value)} /></form><div className="active-session"><i/>{selected ? `Sesi: ${selected.display_name}` : "Belum ada sesi"}</div><button className="browser-control login-test-button" disabled={!selected || loginChecking || browserState.loading} onClick={testProfileLogin} title="Uji status login YouTube">{loginChecking ? "Menguji..." : "Uji Login"}</button></> : <div className="active-session">Mode web · browser YouTube tersedia di aplikasi Windows</div>}
        </div>
        <div className="browser-viewport" ref={browserPaneRef}>
          {!isDesktop ? <div className="browser-empty"><Globe size={38}/><h2>Dashboard web aktif</h2><p>Kelola daftar akun dan riwayat melalui web. Browser YouTube, login, serta isolasi sesi tersedia di aplikasi Windows.</p></div> : <>{!selected && <div className="browser-empty"><Globe size={38}/><h2>Pilih akun YouTube</h2><p>Setiap akun memiliki sesi browser yang terpisah.</p></div>}{browserState.loading && <div className="loading-line"/>}</>}
        </div>
      </main>
      {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={addAccount} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={() => setShowAdd(false)}><X size={18}/></button><h2>Tambah Akun YouTube</h2><p>{isDesktop ? "Data ini memberi label pada profil browser baru. Login Google dilakukan langsung di browser YouTube." : "Data akun disimpan di dashboard. Sesi browser YouTube terpisah dibuat melalui aplikasi Windows."}</p>
        <label>Nama akun</label><div className="auto-name-preview">Account {String(Math.max(accounts.reduce((highest, account) => { const match = String(account.display_name || "").match(/(\\d+)\\s*$/); return match ? Math.max(highest, Number(match[1])) : highest; }, 0), accounts.length) + 1).padStart(4, "0")}</div><small>Nomor akun dibuat otomatis dan berurutan.</small>
        <label>Email (opsional)</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="akun@gmail.com"/>
        <button className="primary full" type="submit">Buat Profil Browser</button>
      </form></div>}
    </div>
  );
}