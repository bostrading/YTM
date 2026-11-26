const { app, BrowserWindow, WebContentsView, ipcMain, session } = require("electron");
const path = require("node:path");

let mainWindow;
let browserView;
let activeProfileId = null;
let videoProgressTimer = null;

function stopVideoProgressMonitor() {
  if (videoProgressTimer) clearInterval(videoProgressTimer);
  videoProgressTimer = null;
}

async function sendVideoProgress() {
  if (!mainWindow || mainWindow.isDestroyed() || !browserView || browserView.webContents.isDestroyed()) return;
  const wc = browserView.webContents;
  try {
    const state = await wc.executeJavaScript(`(() => {
      const video = document.querySelector("video.html5-main-video") || document.querySelector("video");
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return { available: false };
      const currentTime = Math.max(0, Math.min(video.currentTime || 0, video.duration));
      return { available: true, currentTime, duration: video.duration, paused: video.paused, ended: video.ended,
        percent: Math.max(0, Math.min(100, Math.floor((currentTime / video.duration) * 100))) };
    })()`, true);
    mainWindow.webContents.send("browser:video-progress", state);
  } catch {
    mainWindow.webContents.send("browser:video-progress", { available: false });
  }
}

function startVideoProgressMonitor() {
  stopVideoProgressMonitor();
  sendVideoProgress();
  videoProgressTimer = setInterval(sendVideoProgress, 1000);
}

function sendBrowserState(extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const contents = browserView && !browserView.webContents.isDestroyed() ? browserView.webContents : null;
  mainWindow.webContents.send("browser:state", {
    profileId: activeProfileId,
    url: contents?.getURL() || "",
    title: contents?.getTitle() || "",
    loading: contents?.isLoading() || false,
    canGoBack: contents?.navigationHistory?.canGoBack?.() || false,
    canGoForward: contents?.navigationHistory?.canGoForward?.() || false,
    ...extra
  });
}

function attachBrowserEvents(view, profileId) {
  const wc = view.webContents;
  const update = () => { if (browserView === view) sendBrowserState({ profileId }); };
  wc.on("did-navigate", update);
  wc.on("did-navigate-in-page", update);
  wc.on("did-start-loading", () => update());
  wc.on("did-stop-loading", () => update());
  wc.on("page-title-updated", update);
  wc.on("did-fail-load", (_event, code, description, validatedURL, isMainFrame) => {
    if (isMainFrame && browserView === view) sendBrowserState({ profileId, error: description || `Navigation gagal (${code})`, failedUrl: validatedURL });
  });
  wc.setWindowOpenHandler(({ url }) => {
    if (browserView === view) wc.loadURL(url).catch(() => {});
    return { action: "deny" };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600, height: 920, minWidth: 1100, minHeight: 680,
    backgroundColor: "#0b1220", title: "Kubang YT", icon: path.join(__dirname, "../build/brand/kubang-yt.png"), autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  else mainWindow.loadURL("http://127.0.0.1:5173");
  mainWindow.on("resize", () => mainWindow?.webContents.send("browser:request-bounds"));
  mainWindow.on("closed", () => { mainWindow = null; browserView = null; activeProfileId = null; });
}

function ensureBrowserView(profileId) {
  if (browserView && activeProfileId === profileId && !browserView.webContents.isDestroyed()) return browserView;
  if (browserView) {
    mainWindow.contentView.removeChildView(browserView);
    browserView.webContents.close();
    browserView = null;
  }
  const accountSession = session.fromPartition(`persist:ytm-${profileId}`);
  const view = new WebContentsView({
    webPreferences: {
      session: accountSession, contextIsolation: true,
      nodeIntegration: false, sandbox: true
    }
  });
  browserView = view;
  activeProfileId = profileId;
  mainWindow.contentView.addChildView(view);
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  attachBrowserEvents(view, profileId);
  return view;
}

function validateProfileId(profileId) {
  if (typeof profileId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    throw new Error("Profil akun tidak valid.");
  }
}

function normalizeUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) throw new Error("Alamat URL kosong.");
  let url;
  try { url = new URL(rawUrl.includes("://") ? rawUrl.trim() : `https://${rawUrl.trim()}`); }
  catch { throw new Error("Alamat URL tidak valid."); }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Protokol URL tidak diizinkan.");
  return url.toString();
}

ipcMain.on("browser:set-bounds", (_event, bounds) => {
  if (!browserView || !bounds || !mainWindow) return;
  const values = [bounds.x, bounds.y, bounds.width, bounds.height].map(Number);
  if (!values.every(Number.isFinite)) return;
  const [x, y, width, height] = values;
  browserView.setBounds({
    x: Math.max(0, Math.round(x)), y: Math.max(0, Math.round(y)),
    width: Math.max(0, Math.round(width)), height: Math.max(0, Math.round(height))
  });
});

ipcMain.handle("browser:open-account", async (_event, { profileId, url }) => {
  if (!mainWindow) throw new Error("Jendela aplikasi belum siap.");
  validateProfileId(profileId);
  const view = ensureBrowserView(profileId);
  const target = normalizeUrl(url || "https://www.youtube.com");
  if (view.webContents.getURL() !== target) await view.webContents.loadURL(target);
  sendBrowserState({ profileId });
  return { ok: true, profileId };
});

ipcMain.handle("browser:delete-profile", async (_event, profileId) => {
  validateProfileId(profileId);
  if (browserView && activeProfileId === profileId) {
    stopVideoProgressMonitor();
    mainWindow?.contentView.removeChildView(browserView);
    if (!browserView.webContents.isDestroyed()) browserView.webContents.close();
    browserView = null;
    activeProfileId = null;
  }
  const accountSession = session.fromPartition(`persist:ytm-${profileId}`);
  await accountSession.clearStorageData();
  await accountSession.clearCache();
  await accountSession.clearAuthCache();
  return { ok: true, profileId };
});

ipcMain.handle("browser:navigate", async (_event, rawUrl) => {
  if (!browserView || browserView.webContents.isDestroyed()) throw new Error("Browser belum dibuka.");
  await browserView.webContents.loadURL(normalizeUrl(rawUrl));
  return { ok: true };
});

ipcMain.handle("browser:check-youtube-login", async (_event, profileId) => {
  validateProfileId(profileId);
  if (!browserView || activeProfileId !== profileId || browserView.webContents.isDestroyed()) {
    throw new Error("Aktifkan profil ini di browser sebelum menguji login.");
  }
  const wc = browserView.webContents;
  const currentUrl = wc.getURL();
  if (!/^https?:\/\/(www\.)?youtube\.com\//i.test(currentUrl)) {
    throw new Error("Buka youtube.com pada profil ini sebelum menguji login.");
  }
  const result = await wc.executeJavaScript(`(() => {
    const avatar = document.querySelector('#avatar-btn, ytd-masthead #avatar, button[aria-label*="Account"], button[aria-label*="akun" i]');
    const signIn = document.querySelector('a[href*="ServiceLogin"], ytd-button-renderer a[href*="accounts.google.com/ServiceLogin"], a[aria-label*="Sign in" i]');
    const accountLabel = avatar?.getAttribute("aria-label") || avatar?.getAttribute("title") || "";
    return { signedIn: Boolean(avatar && !signIn), accountLabel, title: document.title, url: location.href };
  })()`);
  return { ...result, profileId, checkedAt: new Date().toISOString() };
});

ipcMain.on("browser:start-video-progress", () => startVideoProgressMonitor());
ipcMain.on("browser:stop-video-progress", () => stopVideoProgressMonitor());

ipcMain.on("browser:back", () => {
  if (browserView?.webContents.navigationHistory.canGoBack()) browserView.webContents.navigationHistory.goBack();
});
ipcMain.on("browser:forward", () => {
  if (browserView?.webContents.navigationHistory.canGoForward()) browserView.webContents.navigationHistory.goForward();
});
ipcMain.on("browser:reload", () => browserView?.webContents.reload());
ipcMain.on("browser:hide", () => { if (browserView) browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 }); });

app.setName("Kubang YT");

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("before-quit", stopVideoProgressMonitor);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
