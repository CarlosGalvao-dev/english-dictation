const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  chooseVideo: () => ipcRenderer.invoke('dialog:video'),
  prepareVideo: (filePath, videoInfo) => ipcRenderer.invoke('video:prepare', filePath, videoInfo),
  extractSubtitle: (filePath, streamIndex) => ipcRenderer.invoke('subtitle:extract', filePath, streamIndex),
  loadSessionPreferences: () => ipcRenderer.invoke('settings:load-session'),
  saveSessionPreferences: preferences => ipcRenderer.invoke('settings:save-session', preferences),
  loadFavorites: () => ipcRenderer.invoke('favorites:list'),
  toggleFavorite: favorite => ipcRenderer.invoke('favorites:toggle', favorite),
  copyText: text => ipcRenderer.invoke('clipboard:write-text', text),
});
