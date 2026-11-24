const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ytm", {
  setBrowserBounds: (bounds) => ipcRenderer.send("browser:set-bounds", bounds),
  openAccountBrowser: (profileId, url) => ipcRenderer.invoke("browser:open-account", { profileId, url }),
  navigateBrowser: (url) => ipcRenderer.invoke("browser:navigate", url),
  checkYoutubeLogin: (profileId) => ipcRenderer.invoke("browser:check-youtube-login", profileId),
  browserBack: () => ipcRenderer.send("browser:back"),
  browserForward: () => ipcRenderer.send("browser:forward"),
  browserReload: () => ipcRenderer.send("browser:reload"),
  hideBrowser: () => ipcRenderer.send("browser:hide"),
  onBrowserState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on("browser:state", listener);
    return () => ipcRenderer.removeListener("browser:state", listener);
  }
});
