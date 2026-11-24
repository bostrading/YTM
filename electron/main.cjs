const { app, BrowserWindow, WebContentsView, ipcMain, session } = require("electron");
const path = require("node:path");

let mainWindow;
let browserView;
let activeProfileId = null;

function sendBrowserState(extra = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const contents = browserView?.webContents;
  mainWindow.webContents.send("browser:state", {
    url: contents?.getURL() || "",
    title: contents?.getTitle() || "",
    loading: contents?.isLoading() || false,
    canGoBack: contents?.navigationHistory?.canGoBack?.() || false,
    canGoForward: contents?.navigationHistory?.canGoForward?.() || false,
    ...extra
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 920,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: "#0b1220",
    title: "YT Manager",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  else mainWindow.loadURL("http://127.0.0.1:5173");

  mainWindow.on("resize", () => mainWindow.webContents.send("browser:request-bounds"));
  mainWindow.on("closed", () => { mainWindow = null; browserView = null; });
}

function ensureBrowserView(profileId) {
  if (browserView && !browserView.webContents.isDestroyed()) {
    mainWindow.contentView.removeChildView(browserView);
    browserView.webContents.close();
  }

  const partition = `persist:ytm-${profileId}`;
  const accountSession = session.fromPartition(partition);
  browserView = new WebContentsView({
    webPreferences: {
      session: accountSession,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  activeProfileId = profileId;
  mainWindow.contentView.addChildView(browserView);
  browserView.setBounds({ x: 550, y: 130, width: 1000, height: 700 });
  browserView.webContents.setWindowOpenHandler(({ url }) => {
    browserView.webContents.loadURL(url);
    return { action: "deny" };
  });
  browserView.webContents.on("did-navigate", () => sendBrowserState());
  browserView.webContents.on("did-navigate-in-page", () => sendBrowserState());
  browserView.webContents.on("did-start-loading", () => sendBrowserState({ loading: true }));
  browserView.webContents.on("did-stop-loading", () => sendBrowserState({ loading: false }));
  browserView.webContents.on("page-title-updated", () => sendBrowserState());
  return browserView;
}

ipcMain.on("browser:set-bounds", (_event, bounds) => {
  if (!browserView || !bounds) return;
  const safe = {
    x: Math.max(0, Math.round(bounds.x)),
    y: Math.max(0, Math.round(bounds.y)),
    width: Math.max(0, Math.round(bounds.width)),
    height: Math.max(0, Math.round(bounds.height))
  };
  browserView.setBounds(safe);
});

ipcMain.handle("browser:open-account", async (_event, { profileId, url }) => {
  if (!mainWindow || typeof profileId !== "string" || !/^[0-9a-f-]{36}$/i.test(profileId)) {
    throw new Error("Profil akun tidak valid.");
  }
  const view = ensureBrowserView(profileId);
  await view.webContents.loadURL(url || "https://www.youtube.com");
  sendBrowserState({ profileId: activeProfileId });
  return { ok: true, profileId: activeProfileId };
});

ipcMain.handle("browser:navigate", async (_event, rawUrl) => {
  if (!browserView || typeof rawUrl !== "string") throw new Error("Browser belum dibuka.");
  let url;
  try { url = new URL(rawUrl.includes("://") ? rawUrl : `https://${rawUrl}`); }
  catch { throw new Error("Alamat URL tidak valid."); }
  if (!["https:", "http:"].includes(url.protocol)) throw new Error("Protokol URL tidak diizinkan.");
  await browserView.webContents.loadURL(url.toString());
  return { ok: true };
});

ipcMain.on("browser:back", () => {
  if (browserView?.webContents.navigationHistory.canGoBack()) browserView.webContents.navigationHistory.goBack();
});
ipcMain.on("browser:forward", () => {
  if (browserView?.webContents.navigationHistory.canGoForward()) browserView.webContents.navigationHistory.goForward();
});
ipcMain.on("browser:reload", () => browserView?.webContents.reload());
ipcMain.on("browser:hide", () => {
  if (browserView) browserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });