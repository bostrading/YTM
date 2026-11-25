import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { registerPlugin } from "@capacitor/core";

const YtmBrowser = registerPlugin("YtmBrowser");
import {
  ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown, CircleHelp,
  Filter, Globe, Home, LogOut, Menu, Plus, RefreshCw, Search, Settings,
  ShieldCheck, Users, X, UserCog, Pencil, Ban, Trash2, Mail, RefreshCw as RefreshIcon
} from "lucide-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ciwghxpgvkdsszqezmbr.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_8o52lNy0iHby8vSIq-i1EA_Ef1y_k43";
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const isDesktop = typeof window !== "undefined" && Boolean(window.ytm);
const isAndroidApp = typeof window !== "undefined" && window.Capacitor?.getPlatform?.() === "android";

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
  const [address, setAddress] = useState("https://www.youtube.com");
  const [targetChannelUrl, setTargetChannelUrl] = useState("");
  const [targetVideoUrl, setTargetVideoUrl] = useState("");
  const [videoTaskStatus, setVideoTaskStatus] = useState("idle");
  const [videoProgress, setVideoProgress] = useState({ currentTime: 0, duration: 0, percent: null, paused: true, ended: false, available: false });
  const [videoTaskMessage, setVideoTaskMessage] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [randomQueue, setRandomQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [queueMessage, setQueueMessage] = useState("");
  const [videoRandomQueue, setVideoRandomQueue] = useState([]);
  const [videoQueueIndex, setVideoQueueIndex] = useState(-1);
  const isAdmin = session?.user?.email?.toLowerCase() === "admin@ytmsewu.com";
  const [appUsers, setAppUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModal, setUserModal] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [userSaving, setUserSaving] = useState(false);
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
  useEffect(() => { if (page === "Pengaturan" && isAdmin) loadAppUsers(); }, [page, isAdmin]);

  useEffect(() => {
    let active = true;
    async function loadUserSettings() {
      if (!session?.user?.id || !supabase) {
        setTargetChannelUrl("");
        return;
      }
      setSettingsLoading(true);
      const { data, error } = await supabase
        .from("yt_user_settings")
        .select("target_channel_url, target_video_url")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Gagal memuat pengaturan channel:", error);
        setSettingsMessage("Pengaturan channel gagal dimuat dari server.");
      } else if (data) {
        setTargetChannelUrl(data.target_channel_url || "");
        setTargetVideoUrl(data.target_video_url || "");
      } else {
        const legacyUrl = window.localStorage.getItem("ytm-target-channel-url") || "";
        setTargetChannelUrl(legacyUrl);
        if (legacyUrl) {
          const { error: migrationError } = await supabase.from("yt_user_settings").upsert({
            user_id: session.user.id,
            target_channel_url: legacyUrl,
            updated_at: new Date().toISOString()
          }, { onConflict: "user_id" });
          if (!active) return;
          if (migrationError) {
            console.error("Migrasi link channel gagal:", migrationError);
            setSettingsMessage("Link lama masih tersimpan di perangkat ini; simpan ulang untuk sinkronisasi.");
          } else {
            window.localStorage.removeItem("ytm-target-channel-url");
            setSettingsMessage("Link channel lama berhasil dipindahkan ke Supabase.");
          }
        }
      }
      setSettingsLoading(false);
    }
    loadUserSettings();
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (page === "Dashboard" && selected && window.ytm) {
      window.ytm.openAccountBrowser(selected.browser_profile_id, "https://www.youtube.com").catch(console.error);
    } else if (page !== "Dashboard") {
      window.ytm?.hideBrowser();
    }
  }, [page, selected?.id]);

  useEffect(() => {
    if (!session?.user?.id || !supabase) return;
    const channel = supabase
      .channel(`yt-user-settings-${session.user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "yt_user_settings",
        filter: `user_id=eq.${session.user.id}`
      }, (payload) => {
        if (payload.eventType === "DELETE") {
          setTargetChannelUrl("");
        } else {
          if (payload.new?.target_channel_url !== undefined) setTargetChannelUrl(payload.new.target_channel_url || "");
          if (payload.new?.target_video_url !== undefined) setTargetVideoUrl(payload.new.target_video_url || "");
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  useEffect(() => {
    const updateBounds = () => {
      const el = browserPaneRef.current;
      if (!el || !window.ytm) return;
      // Electron WebContentsView is a native view and is rendered above the
      // React DOM. Hide it while React dialogs are open so dialogs remain usable.
      if (page !== "Dashboard" || showAdd) {
        window.ytm.hideBrowser();
        return;
      }
      const r = el.getBoundingClientRect();
      window.ytm.setBrowserBounds({ x: r.left, y: r.top, width: r.width, height: r.height });
    };
    const timer = setTimeout(updateBounds, 180);
    window.addEventListener("resize", updateBounds);
    const observer = new ResizeObserver(updateBounds);
    if (browserPaneRef.current) observer.observe(browserPaneRef.current);
    return () => { clearTimeout(timer); window.removeEventListener("resize", updateBounds); observer.disconnect(); };
  }, [page, selected, showAdd]);

  useEffect(() => {
    if (!window.ytm?.onVideoProgress) return;
    return window.ytm.onVideoProgress((progress) => setVideoProgress(progress));
  }, []);

  useEffect(() => {
    if (!videoProgress.ended || videoTaskStatus !== "opened" || activeTask !== "watch") return;
    setVideoTaskStatus("completed");
    setVideoTaskMessage("Video mencapai akhir. Status akun ditandai selesai otomatis berdasarkan pemutar yang terdeteksi.");
    window.ytm?.stopVideoProgress?.();
    setActiveTask(null);
    if (session?.user?.id && selected?.id) {
      supabase.from("yt_activity_logs").insert({
        user_id: session.user.id,
        account_id: selected.id,
        event_type: "watch_video_auto_completed",
        description: "Pemutar YouTube terdeteksi mencapai akhir video; status ditandai selesai otomatis."
      });
    }
  }, [videoProgress.ended, videoTaskStatus, activeTask, session?.user?.id, selected?.id]);

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

  async function manageAppUsers(action, payload = {}) {
    if (!supabase || !isAdmin) return;
    const { data, error } = await supabase.functions.invoke("manage-app-users", {
      body: { action, ...payload }
    });
    if (error) throw new Error(error.message || "Permintaan pengelolaan pengguna gagal.");
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadAppUsers() {
    if (!isAdmin) return;
    setUsersLoading(true);
    setUserMessage("");
    try {
      const data = await manageAppUsers("list");
      setAppUsers(data.users || []);
    } catch (error) {
      setUserMessage(error.message || "Daftar pengguna gagal dimuat.");
    } finally { setUsersLoading(false); }
  }

  async function saveAppUser(e) {
    e.preventDefault();
    setUserSaving(true);
    setUserMessage("");
    try {
      if (userModal?.mode === "edit") {
        await manageAppUsers("update", { user_id: userModal.user.id, email: userEmail.trim(), display_name: userName.trim(), ...(userPassword ? { password: userPassword } : {}) });
        setUserMessage("Data pengguna berhasil diperbarui.");
      } else {
        await manageAppUsers("invite", { email: userEmail.trim(), display_name: userName.trim() });
        setUserMessage("Undangan berhasil dikirim ke " + userEmail.trim() + ".");
      }
      setUserModal(null); setUserEmail(""); setUserName(""); setUserPassword("");
      await loadAppUsers();
    } catch (error) {
      setUserMessage(error.message || "Perubahan pengguna gagal disimpan.");
    } finally { setUserSaving(false); }
  }

  async function toggleAppUserBlock(user) {
    const blocked = Boolean(user.banned_until && new Date(user.banned_until) > new Date());
    if (!confirm(blocked ? `Buka blokir akses ${user.email}?` : `Blokir akses ${user.email}?`)) return;
    try {
      await manageAppUsers(blocked ? "unblock" : "block", { user_id: user.id });
      await loadAppUsers();
    } catch (error) { setUserMessage(error.message || "Status pengguna gagal diubah."); }
  }

  async function deleteAppUser(user) {
    if (!confirm(`Hapus pengguna ${user.email} secara permanen? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await manageAppUsers("delete", { user_id: user.id });
      setUserMessage("Pengguna berhasil dihapus.");
      await loadAppUsers();
    } catch (error) { setUserMessage(error.message || "Pengguna gagal dihapus."); }
  }

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
      const match = String(account.display_name || "").match(/(\d+)\s*$/);
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
    const alreadyActiveOnDashboard = selected?.id === account.id && page === "Dashboard";
    setSelected(account);
    setPage("Dashboard");
    // Re-open explicitly when the selected row is clicked again. The selection
    // effect does not run when React receives the same selected account twice.
    if (alreadyActiveOnDashboard && isDesktop && account.browser_profile_id) {
      window.ytm.openAccountBrowser(account.browser_profile_id, "https://www.youtube.com")
        .catch((error) => alert(error.message || "Browser akun gagal dibuka."));
    }
    if (supabase && session?.user) {
      if (isDesktop) {
        await supabase.from("yt_accounts").update({ last_used_at: new Date().toISOString() }).eq("id", account.id);
      }
      await supabase.from("yt_activity_logs").insert({
        user_id: session.user.id, account_id: account.id,
        event_type: isDesktop ? "browser_opened" : "account_selected",
        description: isDesktop
          ? `Browser dibuka: ${account.display_name}`
          : `Akun dipilih di dashboard web: ${account.display_name}`
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

  async function openAndroidHome() {
    try { if (!selected) throw new Error("Pilih akun YouTube terlebih dahulu.");
      await YtmBrowser.open({ url: "https://www.youtube.com", profileId: selected.browser_profile_id || selected.id }); }
    catch (error) { alert(error.message || "Browser Android gagal dibuka."); }
  }

  async function saveTargetChannel() {
    const value = targetChannelUrl.trim();
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com"].includes(parsed.hostname)) {
        setSettingsMessage("Masukkan URL channel YouTube yang valid (https://www.youtube.com/...).");
        return;
      }
    } catch {
      setSettingsMessage("URL channel belum valid. Gunakan tautan lengkap yang diawali https://.");
      return;
    }
    if (!supabase || !session?.user?.id) {
      setSettingsMessage("Login diperlukan untuk menyimpan pengaturan ke database.");
      return;
    }
    setSettingsSaving(true);
    setSettingsMessage("");
    const { error } = await supabase.from("yt_user_settings").upsert({
      user_id: session.user.id,
      target_channel_url: value,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    setSettingsSaving(false);
    if (error) {
      console.error("Gagal menyimpan pengaturan channel:", error);
      setSettingsMessage("Gagal menyimpan ke Supabase. Periksa koneksi lalu coba lagi.");
      return;
    }
    setSettingsMessage("Link channel berhasil disimpan dan tersinkron melalui Supabase.");
  }

  function shuffleAccounts(items) {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  function startRandomRound() {
    if (!accounts.length) {
      setQueueMessage("Belum ada akun untuk memulai putaran.");
      return;
    }
    const queue = shuffleAccounts(accounts.map((account) => account.id));
    setRandomQueue(queue);
    setQueueIndex(0);
    const firstAccount = accounts.find((account) => account.id === queue[0]);
    setSelected(firstAccount);
    setQueueMessage(`Putaran dimulai: ${queue.length} akun diacak. Giliran 1 dari ${queue.length}: ${firstAccount.display_name}.`);
  }

  async function chooseNextRandomAccount() {
    if (!randomQueue.length || queueIndex < 0) {
      setQueueMessage("Mulai putaran acak terlebih dahulu.");
      return;
    }
    const nextIndex = queueIndex + 1;
    if (nextIndex >= randomQueue.length) {
      setQueueMessage("Putaran selesai. Semua akun sudah mendapat satu giliran. Mulai putaran baru untuk mengacak ulang.");
      setQueueIndex(randomQueue.length);
      return;
    }
    const account = accounts.find((item) => item.id === randomQueue[nextIndex]);
    if (!account) {
      setQueueMessage("Daftar akun berubah. Mulai putaran baru agar antrean diperbarui.");
      return;
    }
    setQueueIndex(nextIndex);
    setSelected(account);
    setQueueMessage(`Giliran ${nextIndex + 1} dari ${randomQueue.length}: ${account.display_name}. Buka channel tujuan secara manual jika siap.`);
    if (supabase && session?.user) {
      await supabase.from("yt_activity_logs").insert({
        user_id: session.user.id,
        account_id: account.id,
        event_type: "random_account_turn",
        description: `Giliran acak ${nextIndex + 1} dari ${randomQueue.length}`
      });
    }
  }

  async function openTargetChannel() {
    if (activeTask && activeTask !== "subscribe") { setSettingsMessage("Selesaikan tugas Jam Tayang terlebih dahulu."); return; }
    if (!targetChannelUrl.trim()) { setSettingsMessage("Simpan link channel tujuan terlebih dahulu."); return; }
    if (!selected) { setSettingsMessage("Pilih akun terlebih dahulu."); return; }
    if (!isDesktop && !isAndroidApp) { setSettingsMessage("Buka channel tujuan melalui aplikasi Kubang YT."); return; }
    try {
      if (isAndroidApp) await YtmBrowser.open({ url: targetChannelUrl.trim(), profileId: selected.browser_profile_id || selected.id });
      else await window.ytm.openAccountBrowser(selected.browser_profile_id, targetChannelUrl.trim());
      await supabase?.from("yt_activity_logs").insert({
        user_id: session.user.id, account_id: selected.id,
        event_type: "channel_research_opened",
        description: `Channel tujuan dibuka secara manual: ${targetChannelUrl.trim()}`
      });
      setAddress(targetChannelUrl.trim());
      setActiveTask("subscribe");
      setSettingsMessage(`Channel tujuan dibuka pada profil ${selected.display_name}. Aktivitas Subscribe dilakukan manual.`);
    } catch (error) {
      setSettingsMessage(error.message || "Channel tujuan gagal dibuka.");
    }
  }

  function startVideoRandomRound() {
    if (activeTask === "subscribe") {
      setVideoTaskMessage("Selesaikan sesi Subscribe terlebih dahulu.");
      return;
    }
    if (!accounts.length) {
      setVideoTaskMessage("Belum ada akun untuk memulai putaran acak.");
      return;
    }
    const queue = shuffleAccounts(accounts.map((account) => account.id));
    const first = accounts.find((account) => account.id === queue[0]);
    setVideoRandomQueue(queue);
    setVideoQueueIndex(0);
    setVideoTaskStatus("idle");
    setVideoProgress({ currentTime: 0, duration: 0, percent: null, paused: true, ended: false, available: false });
    setSelected(first);
    setVideoTaskMessage(`Putaran Jam Tayang dimulai: ${queue.length} akun diacak. Giliran 1 dari ${queue.length}: ${first.display_name}. Tekan Buka Video untuk membuka link secara manual.`);
  }

  async function chooseNextVideoRandomAccount() {
    if (activeTask === "subscribe") {
      setVideoTaskMessage("Selesaikan sesi Subscribe terlebih dahulu.");
      return;
    }
    if (activeTask === "watch") {
      setVideoTaskMessage("Selesaikan sesi video yang sedang aktif sebelum berpindah akun.");
      return;
    }
    if (!videoRandomQueue.length || videoQueueIndex < 0) {
      setVideoTaskMessage("Mulai Putar Acak terlebih dahulu.");
      return;
    }
    const nextIndex = videoQueueIndex + 1;
    if (nextIndex >= videoRandomQueue.length) {
      setVideoQueueIndex(videoRandomQueue.length);
      setVideoTaskMessage("Putaran Jam Tayang selesai. Semua akun sudah mendapat satu giliran. Mulai putaran baru untuk mengacak ulang.");
      return;
    }
    const account = accounts.find((item) => item.id === videoRandomQueue[nextIndex]);
    if (!account) {
      setVideoTaskMessage("Daftar akun berubah. Mulai putaran baru agar antrean diperbarui.");
      return;
    }
    setVideoQueueIndex(nextIndex);
    setSelected(account);
    setVideoTaskMessage(`Giliran ${nextIndex + 1} dari ${videoRandomQueue.length}: ${account.display_name}. Tekan Buka Video untuk membuka link secara manual.`);
    if (supabase && session?.user) {
      await supabase.from("yt_activity_logs").insert({
        user_id: session.user.id, account_id: account.id,
        event_type: "watch_random_account_turn",
        description: `Giliran acak Jam Tayang ${nextIndex + 1} dari ${videoRandomQueue.length}`
      });
    }
  }

  async function saveTargetVideo() {
    const value = targetVideoUrl.trim();
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" || !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(parsed.hostname)) {
        setVideoTaskMessage("Masukkan URL video YouTube yang valid.");
        return;
      }
    } catch {
      setVideoTaskMessage("URL video belum valid. Gunakan tautan lengkap https://.");
      return;
    }
    const { error } = await supabase.from("yt_user_settings").upsert({
      user_id: session.user.id,
      target_video_url: value,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id" });
    if (error) { setVideoTaskMessage("Gagal menyimpan link video: " + error.message); return; }
    setVideoTaskMessage("Link video berhasil disimpan dan tersinkron melalui Supabase.");
  }

  async function openTargetVideo() {
    if (activeTask && activeTask !== "watch") {
      setVideoTaskMessage("Selesaikan sesi Subscribe terlebih dahulu. Kedua tab tidak dapat berjalan bersama.");
      return;
    }
    if (!targetVideoUrl.trim()) { setVideoTaskMessage("Simpan link video terlebih dahulu."); return; }
    if (!selected) { setVideoTaskMessage("Pilih akun terlebih dahulu."); return; }
    if (!isDesktop && !isAndroidApp) { setVideoTaskMessage("Buka video melalui aplikasi Kubang YT."); return; }
    try {
      if (isAndroidApp) {
        await YtmBrowser.open({ url: targetVideoUrl.trim(), profileId: selected.browser_profile_id || selected.id });
        setActiveTask("watch");
        setVideoTaskStatus("opened");
        setVideoProgress({ currentTime: 0, duration: 0, percent: null, paused: true, ended: false, available: false });
        setVideoTaskMessage("Video dibuka di browser Android. Deteksi progres otomatis belum tersedia di APK; setelah selesai, kembali ke aplikasi dan tekan Selesaikan Sesi.");
        await supabase.from("yt_activity_logs").insert({
          user_id: session.user.id, account_id: selected.id,
          event_type: "watch_video_opened",
          description: "Video dibuka manual melalui browser WebView Android: " + targetVideoUrl.trim()
        });
        return;
      }
      await window.ytm.openAccountBrowser(selected.browser_profile_id, targetVideoUrl.trim());
      setAddress(targetVideoUrl.trim());
      setActiveTask("watch");
      setVideoTaskStatus("opened");
      setVideoProgress({ currentTime: 0, duration: 0, percent: null, paused: true, ended: false, available: false });
      window.ytm.startVideoProgress?.();
      setVideoTaskMessage("Video dibuka pada profil " + selected.display_name + ". Status akan selesai otomatis saat pemutar YouTube terdeteksi mencapai akhir video.");
      await supabase.from("yt_activity_logs").insert({
        user_id: session.user.id, account_id: selected.id,
        event_type: "watch_video_opened",
        description: "Video dibuka manual: " + targetVideoUrl.trim()
      });
    } catch (error) {
      setVideoTaskMessage(error.message || "Video gagal dibuka.");
    }
  }

  async function completeManualTask(task) {
    if (activeTask !== task) {
      setVideoTaskMessage("Tidak ada sesi yang sedang aktif.");
      return;
    }
    if (task === "watch") {
      window.ytm?.stopVideoProgress?.();
      setVideoTaskStatus("completed");
      setVideoTaskMessage("Status pemantauan ditandai selesai secara manual.");
      await supabase.from("yt_activity_logs").insert({
        user_id: session.user.id, account_id: selected?.id || null,
        event_type: "watch_video_marked_complete",
        description: "Pengguna menandai pemantauan video selesai secara manual."
      });
    } else {
      setSettingsMessage("Sesi Subscribe ditutup.");
    }
    setActiveTask(null);
  }

  if (!session) return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={authenticate}>
        <img className="brand-logo" src="/kubang-yt-icon.svg" alt="Kubang YT" /><h1>Kubang YT</h1>
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
        <div className="brand"><img className="brand-logo" src="/kubang-yt-icon.svg" alt="" /><div><strong>Kubang YT</strong><span>Multi Account Dashboard</span></div></div>
        <div className="system-status"><i />System Online</div>
        {isDesktop && <><button className="icon-button" title="Minimize">—</button><button className="icon-button" title="Maximize">□</button><button className="icon-button" title="Close">×</button></>}
      </header>
      <aside className="sidebar">
        <nav>
          {[["Dashboard", Home], ["Subscribe", Users], ["Jam Tayang", Globe], ["Pengaturan", Settings]].map(([label, Icon]) =>
            <button key={label} className={page === label ? "nav-item active" : "nav-item"} onClick={() => setPage(label)}><Icon size={19}/>{label}</button>
          )}
        </nav>
        <div className="side-stats"><div><Users size={18}/><span>Total Akun</span></div><b>{accounts.length}</b><div className="browser-stat"><CheckCircle2 size={18}/><span>{isDesktop ? "Browser Aktif" : "Akun Dipilih"}</span></div><b>{isDesktop ? (selected ? "1 / 1" : "0 / 1") : (selected ? "1" : "0")}</b></div>
        <button className="logout-button" onClick={logout}><LogOut size={16}/>Keluar</button>
      </aside>
      <section className="account-panel">
        <div className="panel-heading"><h2>Daftar Akun YouTube</h2><span className="count-pill">{accounts.length} Akun</span></div>
        <div className="search-row"><div className="search-box"><Search size={18}/><input placeholder="Cari nama atau email..." value={search} onChange={(e) => setSearch(e.target.value)}/></div><button className="filter-button" title="Filter"><Filter size={18}/></button></div>
        <div className="account-list">
          {filteredAccounts.map((account) => <div key={account.id} className={selected?.id === account.id ? "account-item selected" : "account-item"} onClick={() => openAccount(account)}>
            <div className="avatar">{initials(account.display_name)}</div><div className="account-meta"><strong>{account.display_name}</strong><span>{account.email || "Email belum diisi"}</span></div>
            <span className={account.account_status === "logged_in" ? "login-status logged-in" : "login-status"}><i/>{account.account_status ? `${account.account_status === "logged_in" ? "Aktif" : "Logout"}` : "Belum diuji"}</span><button className="more-button" onClick={(e) => { e.stopPropagation(); removeAccount(account); }} title="Hapus">⋮</button>
          </div>)}
          {!filteredAccounts.length && <div className="empty-state">Belum ada akun. Tambahkan akun YouTube untuk memulai.</div>}
        </div>
        <button className="primary add-account" onClick={() => setShowAdd(true)}><Plus size={20}/>Tambah Akun</button>
        <div className="user-foot"><ShieldCheck size={16}/><span>{session.user.email}</span></div>
      </section>
      <main className="browser-panel">
        {page === "Pengaturan" || page === "Subscribe" || page === "Jam Tayang" ? (
          <div className="settings-view">
            {page === "Subscribe" ? <>
              <h2>Subscribe</h2>
              <p className="settings-description">Masukkan link channel tujuan. Sesi Subscribe dilakukan manual dan terpisah dari Jam Tayang.</p>
              <section className="settings-card channel-target-card"><div className="settings-card-content">
                <strong>Link Channel Tujuan</strong>
                <input className="target-channel-input" type="url" value={targetChannelUrl} onChange={(e) => { setTargetChannelUrl(e.target.value); setSettingsMessage(""); }} placeholder="https://www.youtube.com/@nama-channel" />
                <div className="settings-actions">
                  <button className="primary settings-action-button" onClick={saveTargetChannel} disabled={settingsLoading || settingsSaving}>{settingsSaving ? "Menyimpan..." : "Simpan Link"}</button>
                  <button className="secondary-action settings-action-button" onClick={startRandomRound} disabled={!accounts.length || activeTask === "watch"}>Mulai Putaran Acak</button>
                  <button className="secondary-action settings-action-button" onClick={chooseNextRandomAccount} disabled={!randomQueue.length || queueIndex >= randomQueue.length || activeTask === "watch"}>Akun Berikutnya</button>
                  <button className="secondary-action settings-action-button" onClick={openTargetChannel} disabled={!selected || !targetChannelUrl.trim() || activeTask === "watch"}>Buka Channel Tujuan</button>
                  {activeTask === "subscribe" && <button className="secondary-action settings-action-button" onClick={() => completeManualTask("subscribe")}>Selesaikan Sesi</button>}
                </div>
                {settingsMessage && <div className="settings-feedback">{settingsMessage}</div>}
                {queueMessage && <div className="settings-feedback">{queueMessage}</div>}
                <div className="settings-current-account">Akun terpilih: <strong>{selected?.display_name || "Belum ada akun"}</strong></div>
                <div className="settings-current-account">Progres putaran akun: <strong>{queueIndex < 0 ? "Belum dimulai" : `${Math.min(queueIndex + 1, randomQueue.length)} / ${randomQueue.length}`}</strong></div>
                {activeTask === "watch" && <div className="settings-feedback">Jam Tayang sedang aktif. Selesaikan sesi tersebut sebelum memulai Subscribe.</div>}
              </div></section>
            </> : page === "Jam Tayang" ? <>
              <h2>Jam Tayang</h2>
              <p className="settings-description">Masukkan link video untuk pemantauan. Tab ini tidak memiliki fitur Subscribe dan tidak berjalan bersamaan dengan tab Subscribe.</p>
              <section className="settings-card channel-target-card"><div className="settings-card-content">
                <strong>Link Video YouTube</strong>
                <input className="target-channel-input" type="url" value={targetVideoUrl} onChange={(e) => { setTargetVideoUrl(e.target.value); setVideoTaskMessage(""); }} placeholder="https://www.youtube.com/watch?v=..." />
                <div className="settings-actions">
                  <button className="primary settings-action-button" onClick={startVideoRandomRound} disabled={!accounts.length || activeTask === "subscribe"}>Mulai Putar Acak</button>
                  <button className="secondary-action settings-action-button" onClick={chooseNextVideoRandomAccount} disabled={!videoRandomQueue.length || videoQueueIndex >= videoRandomQueue.length || activeTask === "subscribe" || activeTask === "watch"}>Akun Berikutnya</button>
                  <button className="secondary-action settings-action-button" onClick={saveTargetVideo}>Simpan Link Video</button>
                  <button className="secondary-action settings-action-button" onClick={openTargetVideo} disabled={!selected || !targetVideoUrl.trim() || activeTask === "subscribe"}>Buka Video</button>
                  {activeTask === "watch" && <button className="secondary-action settings-action-button" onClick={() => completeManualTask("watch")}>Selesaikan Sesi</button>}
                </div>
                {videoTaskMessage && <div className="settings-feedback">{videoTaskMessage}</div>}
                <div className="settings-current-account">Akun yang digunakan: <strong>{selected?.display_name || "Belum ada akun"}</strong></div>
                <div className="progress-section">
                  <div className="progress-heading"><span>Progres video</span><strong>{videoProgress.percent == null ? "Belum terdeteksi" : `${videoProgress.percent}%`}</strong></div>
                  <div className="progress-track"><div className="progress-fill video-progress-fill" style={{ width: `${videoProgress.percent ?? 0}%` }} /></div>
                  <div className="progress-caption">{videoProgress.available ? `${Math.floor(videoProgress.currentTime / 60)}:${String(Math.floor(videoProgress.currentTime % 60)).padStart(2, "0")} dari ${Math.floor(videoProgress.duration / 60)}:${String(Math.floor(videoProgress.duration % 60)).padStart(2, "0")} · ${videoProgress.ended ? "Pemutar mencapai akhir" : videoProgress.paused ? "Dijeda / belum diputar" : "Sedang diputar"}` : "Persentase muncul jika pemutar video YouTube terdeteksi."}</div>
                </div>
                <div className="progress-section">
                  <div className="progress-heading"><span>Progres putaran akun</span><strong>{videoRandomQueue.length ? `${Math.round((Math.min(videoQueueIndex + (videoTaskStatus === "completed" ? 1 : 0), videoRandomQueue.length) / videoRandomQueue.length) * 100)}%` : "0%"}</strong></div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${videoRandomQueue.length ? (Math.min(videoQueueIndex + (videoTaskStatus === "completed" ? 1 : 0), videoRandomQueue.length) / videoRandomQueue.length) * 100 : 0}%` }} /></div>
                  <div className="progress-caption">{videoQueueIndex < 0 ? "Belum dimulai" : `${Math.min(videoQueueIndex + (videoTaskStatus === "completed" ? 1 : 0), videoRandomQueue.length)} dari ${videoRandomQueue.length} akun selesai`}</div>
                </div>
                <div className="settings-current-account">Status pemantauan: <strong>{videoTaskStatus === "completed" ? "Selesai otomatis" : videoTaskStatus === "opened" ? "Video dibuka / diputar" : "Belum dimulai"}</strong></div>
                {activeTask === "subscribe" && <div className="settings-feedback">Sesi Subscribe sedang aktif. Selesaikan sesi tersebut sebelum membuka Jam Tayang.</div>}
              </div></section>
              <div className="settings-safety-note">Kubang YT tidak memutar video otomatis atau mengklaim durasi tontonan. Pengguna membuka dan memverifikasi video secara manual.</div>
            </> : <><h2>Pengaturan</h2><p className="settings-description">Pengaturan aplikasi dan akun.</p>
              {isAdmin ? <section className="settings-card channel-target-card app-users-card">
                <div className="app-users-heading"><div><strong><UserCog size={18}/> Pengguna Aplikasi</strong><p>Kelola akses login pengguna Kubang YT.</p></div><button className="primary settings-action-button" onClick={() => { setUserModal({ mode: "add" }); setUserEmail(""); setUserName(""); setUserPassword(""); }}><Plus size={16}/> Tambahkan</button></div>
                <div className="settings-actions"><button className="secondary-action settings-action-button" onClick={loadAppUsers} disabled={usersLoading}><RefreshIcon size={15}/> {usersLoading ? "Memuat..." : "Muat Ulang"}</button></div>
                {userMessage && <div className="settings-feedback">{userMessage}</div>}
                {usersLoading ? <div className="empty-state">Memuat daftar pengguna...</div> : <div className="app-users-list">
                  {appUsers.map((user) => { const blocked = Boolean(user.banned_until && new Date(user.banned_until) > new Date()); const pending = !user.email_confirmed_at; return <div className="app-user-row" key={user.id}>
                    <div className="app-user-avatar"><Users size={17}/></div><div className="app-user-info"><strong>{user.display_name || user.email}</strong><span>{user.email}</span><small>{blocked ? "Diblokir" : pending ? "Menunggu konfirmasi email" : "Aktif"}</small></div>
                    <div className="app-user-actions"><button className="secondary-action" title="Edit" onClick={() => { setUserModal({ mode: "edit", user }); setUserEmail(user.email || ""); setUserName(user.display_name || ""); setUserPassword(""); }}><Pencil size={15}/></button><button className="secondary-action" title={blocked ? "Buka blokir" : "Blokir"} disabled={user.email?.toLowerCase() === "admin@ytmsewu.com"} onClick={() => toggleAppUserBlock(user)}><Ban size={15}/></button><button className="danger-action" title="Hapus" disabled={user.email?.toLowerCase() === "admin@ytmsewu.com"} onClick={() => deleteAppUser(user)}><Trash2 size={15}/></button></div>
                  </div>; })}
                  {!appUsers.length && <div className="empty-state">Belum ada pengguna lain.</div>}
                </div>}
                <div className="settings-safety-note">Akun admin utama tidak dapat diblokir atau dihapus dari menu ini. Pengguna baru menerima undangan melalui email.</div>
              </section> : <div className="settings-safety-note">Pengelolaan pengguna hanya tersedia untuk admin.</div>}
            </>}
          </div>
        ) : (
        <>
        <div className="browser-toolbar">
          <div className="browser-title"><Globe size={18}/>{isDesktop ? "Browser" : "Web Dashboard"}</div>
          {isDesktop ? <><button className="browser-control" onClick={() => window.ytm.browserBack()}><ArrowLeft size={18}/></button><button className="browser-control" onClick={() => window.ytm.browserForward()}><ArrowRight size={18}/></button><button className="browser-control" onClick={() => window.ytm.browserReload()}><RefreshCw size={18}/></button><form className="address-bar" onSubmit={(e) => { e.preventDefault(); navigate(); }}><span>🔒</span><input value={address} onChange={(e) => setAddress(e.target.value)} /></form><div className="active-session"><i/>{selected ? `Sesi: ${selected.display_name}` : "Belum ada sesi"}</div><button className="browser-control login-test-button" disabled={!selected || loginChecking || browserState.loading} onClick={testProfileLogin} title="Uji status login YouTube">{loginChecking ? "Menguji..." : "Uji Login"}</button></> : <div className="active-session">{isAndroidApp ? "Mode Android · dashboard tersinkron" : "Mode web · login YouTube hanya di aplikasi Windows"}</div>}
        </div>
        <div className="browser-viewport" ref={browserPaneRef}>
          {!isDesktop ? (
            <div className="web-account-detail">
              {selected ? (
                <>
                  <div className="web-detail-heading">
                    <div className="avatar web-detail-avatar">{initials(selected.display_name)}</div>
                    <div><span className="web-detail-eyebrow">AKUN TERPILIH</span><h2>{selected.display_name}</h2><p>{selected.email || "Email belum diisi"}</p></div>
                  </div>
                  <div className="web-detail-grid">
                    <div><span>Status terakhir</span><strong>{selected.account_status === "logged_in" ? "Aktif" : selected.account_status === "logged_out" ? "Logout" : "Belum diuji"}</strong></div>
                    <div><span>Ditambahkan</span><strong>{selected.created_at ? new Date(selected.created_at).toLocaleString("id-ID") : "—"}</strong></div>
                  </div>
                  <div className="web-browser-notice">
                    <Globe size={20}/>
                    <div><strong>{isAndroidApp ? "Browser YouTube Android" : "Browser YouTube tidak tersedia di website"}</strong><p>{isAndroidApp ? "Browser internal Android menggunakan profil WebView terpisah untuk setiap akun. Login dan cookie tidak dibagikan antar akun. Perlu Android System WebView yang mendukung multi-profile." : "Pemilihan akun berhasil. Untuk membuka YouTube dan login menggunakan sesi profil ini, jalankan aplikasi Kubang YT di Windows lalu pilih akun yang sama."}</p>{isAndroidApp && <button className="primary settings-action-button" onClick={openAndroidHome}>Buka Browser YouTube</button>}</div>
                  </div>
                </>
              ) : (
                <div className="web-detail-empty"><Users size={34}/><h2>Pilih akun dari daftar</h2><p>Klik salah satu akun di panel kiri untuk melihat detail dan statusnya di sini.</p></div>
              )}
            </div>
          ) : <>{!selected && <div className="browser-empty"><Globe size={38}/><h2>Pilih akun YouTube</h2><p>Setiap akun memiliki sesi browser yang terpisah.</p></div>}{browserState.loading && <div className="loading-line"/>}</>}
        </div>
        </>
        )}
      </main>
      {userModal && <div className="modal-backdrop" onClick={() => !userSaving && setUserModal(null)}><form className="modal" onSubmit={saveAppUser} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={() => setUserModal(null)} disabled={userSaving}><X size={18}/></button>
        <h2>{userModal.mode === "edit" ? "Edit Pengguna" : "Tambahkan Pengguna"}</h2>
        <p>{userModal.mode === "edit" ? "Perbarui nama, email, atau password pengguna." : "Undangan login akan dikirim ke alamat email pengguna."}</p>
        <label>Nama pengguna</label><input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Nama pengguna" />
        <label>Email</label><input type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} placeholder="nama@email.com" required />
        {userModal.mode === "edit" && <>
          <label>Password baru (opsional)</label><input type="password" value={userPassword} onChange={(e) => setUserPassword(e.target.value)} placeholder="Kosongkan jika tidak diubah" autoComplete="new-password" minLength={8} />
          <small>Password minimal 8 karakter. Password lama tetap berlaku jika kolom ini dikosongkan.</small>
        </>}
        <button className="primary full" type="submit" disabled={userSaving || (userPassword.length > 0 && userPassword.length < 8)}>{userSaving ? "Menyimpan..." : userModal.mode === "edit" ? "Simpan Perubahan" : "Kirim Undangan"}</button>
      </form></div>}
      {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={addAccount} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" type="button" onClick={() => setShowAdd(false)}><X size={18}/></button><h2>Tambah Akun YouTube</h2><p>{isDesktop ? "Data ini memberi label pada profil browser baru. Login Google dilakukan langsung di browser YouTube." : "Data akun disimpan di dashboard. Sesi browser YouTube terpisah dibuat melalui aplikasi Windows."}</p>
        <label>Nama akun</label><div className="auto-name-preview">Account {String(Math.max(accounts.reduce((highest, account) => { const match = String(account.display_name || "").match(/(\d+)\s*$/); return match ? Math.max(highest, Number(match[1])) : highest; }, 0), accounts.length) + 1).padStart(4, "0")}</div><small>Nomor akun dibuat otomatis dan berurutan.</small>
        <label>Email (opsional)</label><input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="akun@gmail.com"/>
        <button className="primary full" type="submit">Buat Profil Browser</button>
      </form></div>}
    </div>
  );
}