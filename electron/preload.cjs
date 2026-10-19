const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  chooseVideo: () => ipcRenderer.invoke('dialog:video'),
  restoreLastVideo: () => ipcRenderer.invoke('video:restore-last'),
  prepareVideo: (filePath, videoInfo) => ipcRenderer.invoke('video:prepare', filePath, videoInfo),
  savePlaybackPosition: (playbackKey, position) => ipcRenderer.send('video:save-position', playbackKey, position),
  extractSubtitle: (filePath, streamIndex) => ipcRenderer.invoke('subtitle:extract', filePath, streamIndex),
  chooseExternalSubtitle: () => ipcRenderer.invoke('dialog:external-subtitle'),
  loadExternalSubtitle: filePath => ipcRenderer.invoke('subtitle:load-external', filePath),
  saveSubtitleChoice: (playbackKey, choice) => ipcRenderer.invoke('settings:save-subtitle', playbackKey, choice),
  loadSessionPreferences: () => ipcRenderer.invoke('settings:load-session'),
  saveSessionPreferences: preferences => ipcRenderer.invoke('settings:save-session', preferences),
  loadKeyboardShortcuts: () => ipcRenderer.invoke('settings:load-shortcuts'),
  saveKeyboardShortcuts: shortcuts => ipcRenderer.invoke('settings:save-shortcuts', shortcuts),
  onVideoProgress: callback => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('video:progress', listener);
    return () => ipcRenderer.removeListener('video:progress', listener);
  },
  loadFavorites: () => ipcRenderer.invoke('favorites:list'),
  toggleFavorite: favorite => ipcRenderer.invoke('favorites:toggle', favorite),
  copyText: text => ipcRenderer.invoke('clipboard:write-text', text),
  onFavoritesCleared: callback => {
    const listener = () => callback();
    ipcRenderer.on('favorites:cleared', listener);
    return () => ipcRenderer.removeListener('favorites:cleared', listener);
  },
});
