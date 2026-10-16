const { app, BrowserWindow, dialog, ipcMain, clipboard } = require('electron');
const path = require('node:path');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs/promises');
const { createReadStream, watch: watchFs } = require('node:fs');
const { createServer } = require('node:http');
const { createHash, randomBytes } = require('node:crypto');
const ffprobePath = require('ffprobe-static').path;
const ffmpegPath = require('ffmpeg-static');

const execFileAsync = promisify(execFile);
let mediaServer;
let mediaServerUrl;
let userSettingsPath;
let processedVideoPath;
let cacheWatcher;
let lastVideoDirectory = '';
let userSettings = {};
let settingsWriteQueue = Promise.resolve();
let videoPreparationQueue = Promise.resolve();
const mediaFiles = new Map();

function persistUserSettings() {
  if (!userSettingsPath) return Promise.resolve();
  const serialized = JSON.stringify(userSettings, null, 2);
  settingsWriteQueue = settingsWriteQueue.catch(() => {}).then(() => fs.writeFile(userSettingsPath, serialized, 'utf8'));
  return settingsWriteQueue;
}

function preferenceInteger(value, fallback, minimum) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.round(parsed)) : fallback;
}

function savedFavorites() {
  return Array.isArray(userSettings.favorites) ? userSettings.favorites : [];
}

function clearSavedFavorites(sourceKey = null) {
  userSettings.favorites = [];
  userSettings.favoriteSourceKey = sourceKey;
}

async function clearFavoritesIfCacheWasDeleted() {
  const cacheKey = userSettings.processedVideoCacheKey;
  if (!cacheKey) return;
  let cacheExists = false;
  try {
    const stats = await fs.stat(processedVideoPath);
    cacheExists = stats.size > 0;
  } catch { /* The processed cache was deleted. */ }
  if (cacheExists) return;
  userSettings.processedVideoCacheKey = null;
  if (userSettings.favoriteSourceKey === cacheKey) {
    const hadFavorites = savedFavorites().length > 0;
    clearSavedFavorites(cacheKey);
    if (hadFavorites) {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.webContents.send('favorites:cleared');
      }
    }
  }
  await persistUserSettings();
}

async function saveLastDirectory(directory) {
  lastVideoDirectory = directory;
  userSettings.lastVideoDirectory = directory;
  try {
    await persistUserSettings();
  } catch (error) {
    console.error('Could not save the last video folder:', error);
  }
}

function registerMediaFile(filePath) {
  const token = randomBytes(24).toString('hex');
  mediaFiles.set(token, filePath);
  return `${mediaServerUrl}/video/${token}`;
}

function startMediaServer() {
  mediaServer = createServer(async (request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Range');
    response.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
    if (request.method === 'OPTIONS') {
      response.writeHead(204).end();
      return;
    }
    const token = new URL(request.url, 'http://127.0.0.1').pathname.split('/').pop();
    const filePath = mediaFiles.get(token);
    if (!filePath) {
      response.writeHead(404).end();
      return;
    }
    try {
      const info = await fs.stat(filePath);
      const rangeHeader = request.headers.range;
      const extension = path.extname(filePath).toLowerCase();
      const mime = extension === '.webm' ? 'video/webm' : 'video/mp4';
      response.setHeader('Content-Type', mime);
      response.setHeader('Accept-Ranges', 'bytes');
      if (request.method === 'HEAD') {
        response.writeHead(200, { 'Content-Length': info.size }).end();
        return;
      }
      if (rangeHeader) {
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (!match) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
          return;
        }
        const start = match[1] ? Number(match[1]) : 0;
        const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
        if (start > end || start >= info.size) {
          response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
          return;
        }
        response.writeHead(206, {
          'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${info.size}`,
        });
        const stream = createReadStream(filePath, { start, end });
        response.on('close', () => stream.destroy());
        stream.on('error', () => response.destroy());
        stream.pipe(response);
      } else {
        response.writeHead(200, { 'Content-Length': info.size });
        const stream = createReadStream(filePath);
        response.on('close', () => stream.destroy());
        stream.on('error', () => response.destroy());
        stream.pipe(response);
      }
    } catch {
      if (!response.headersSent) response.writeHead(404).end();
      else response.destroy();
    }
  });
  mediaServer.listen(0, '127.0.0.1');
  mediaServer.on('listening', () => {
    mediaServerUrl = `http://127.0.0.1:${mediaServer.address().port}`;
  });
}
const textSubtitleCodecs = new Set([
  'subrip', 'ass', 'ssa', 'mov_text', 'webvtt', 'text', 'microdvd',
  'sami', 'jacosub', 'mpl2', 'vplayer', 'realtext', 'srt', 'pjs',
  'eia_608', 'cea_608', 'cea_708', 'dvb_teletext', 'arib_caption', 'ttml',
]);

const isDev = !app.isPackaged;

function createWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: '#101512',
    title: 'English Dictation',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) window.loadURL('http://localhost:5173');
  else window.loadFile(path.join(__dirname, '../dist/index.html'));
}

ipcMain.handle('dialog:video', async () => {
  const options = {
    properties: ['openFile'],
    filters: [{ name: 'Videos', extensions: ['mkv', 'mp4', 'avi', 'mov', 'webm', 'm4v'] }],
  };
  if (lastVideoDirectory) options.defaultPath = lastVideoDirectory;
  const result = await dialog.showOpenDialog(options);
  if (result.canceled) return null;
  const filePath = result.filePaths[0];
  await saveLastDirectory(path.dirname(filePath));
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'error', '-show_entries', 'stream=index,codec_name,codec_type,pix_fmt:stream_tags=language,title:format=format_name',
    '-of', 'json', filePath,
  ], { maxBuffer: 8 * 1024 * 1024 });
  const probe = JSON.parse(stdout);
  const tracks = (probe.streams || [])
    .filter(stream => stream.codec_type === 'subtitle')
    .map((stream, index) => {
      const language = stream.tags?.language || 'Unknown language';
      const title = stream.tags?.title;
      const textSupported = textSubtitleCodecs.has(stream.codec_name);
      return {
        index: stream.index,
        codec: stream.codec_name,
        textSupported,
        label: `${title ? `${title} · ` : `Subtitle ${index + 1} · `}${language} · ${stream.codec_name}${textSupported ? '' : ' (image/not supported)'}`,
      };
    });
  const videoStream = (probe.streams || []).find(stream => stream.codec_type === 'video');
  return {
    path: filePath,
    tracks,
    videoCodec: videoStream?.codec_name || 'unknown',
    pixelFormat: videoStream?.pix_fmt || '',
    format: probe.format?.format_name || '',
  };
});

ipcMain.handle('video:prepare', (_event, filePath, videoInfo) => {
  const operation = videoPreparationQueue.then(async () => {
    const extension = path.extname(filePath).toLowerCase();
    const source = path.resolve(filePath);
    const sourceStats = await fs.stat(source);
    const cacheKey = createHash('sha256').update(JSON.stringify({
      source,
      size: sourceStats.size,
      modified: sourceStats.mtimeMs,
      changed: sourceStats.ctimeMs,
      videoCodec: videoInfo.videoCodec,
      pixelFormat: videoInfo.pixelFormat,
      format: videoInfo.format,
    })).digest('hex');
    if (userSettings.favoriteSourceKey !== cacheKey) {
      clearSavedFavorites(cacheKey);
      await persistUserSettings();
    }
    const safeMp4 = ['.mp4', '.m4v', '.mov'].includes(extension)
      && videoInfo.videoCodec === 'h264'
      && ['yuv420p', 'yuvj420p'].includes(videoInfo.pixelFormat);
    const safeWebm = extension === '.webm' && ['vp8', 'vp9', 'av1'].includes(videoInfo.videoCodec);
    if (safeMp4 || safeWebm) return { url: registerMediaFile(filePath), converted: false };

    try {
      const cachedStats = await fs.stat(processedVideoPath);
      if (userSettings.processedVideoCacheKey === cacheKey && cachedStats.size > 0) {
        return { url: registerMediaFile(processedVideoPath), converted: true };
      }
    } catch { /* Cache file does not exist yet. */ }

    // Replacing or regenerating the cached video also clears its favorite lines.
    clearSavedFavorites(cacheKey);
    userSettings.processedVideoCacheKey = null;
    await persistUserSettings();
    const outputPath = processedVideoPath;
    const h264 = videoInfo.videoCodec === 'h264' && ['yuv420p', 'yuvj420p'].includes(videoInfo.pixelFormat);
    const args = ['-y', '-v', 'error', '-i', filePath, '-map', '0:v:0', '-map', '0:a:0?'];
    if (h264) args.push('-c:v', 'copy');
    else args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '25', '-pix_fmt', 'yuv420p');
    args.push('-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', outputPath);

    await new Promise((resolve, reject) => {
      const process = spawn(ffmpegPath, args, { windowsHide: true });
      let errorText = '';
      process.stderr.setEncoding('utf8');
      process.stderr.on('data', chunk => { errorText += chunk; });
      process.once('error', reject);
      process.once('close', code => code === 0 ? resolve() : reject(new Error(errorText || `FFmpeg exited with code ${code}`)));
    });
    const outputStats = await fs.stat(outputPath);
    if (!outputStats.size) throw new Error('FFmpeg produced an empty playback cache file.');
    userSettings.processedVideoCacheKey = cacheKey;
    await persistUserSettings();
    return { url: registerMediaFile(outputPath), converted: true };
  });
  videoPreparationQueue = operation.catch(() => {});
  return operation;
});

ipcMain.handle('subtitle:extract', async (_event, filePath, streamIndex) => {
  const { stdout } = await execFileAsync(ffmpegPath, [
    '-v', 'error', '-i', filePath, '-map', `0:${Number(streamIndex)}`,
    '-f', 'srt', 'pipe:1',
  ], { maxBuffer: 32 * 1024 * 1024 });
  const blocks = stdout.replace(/^\uFEFF/, '').replace(/\r/g, '').trim().split(/\n\s*\n/);
  return blocks.flatMap(block => {
    const lines = block.split('\n');
    const timeLineIndex = lines.findIndex(line => line.includes('-->'));
    if (timeLineIndex < 0) return [];
    const match = lines[timeLineIndex].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!match) return [];
    const toSeconds = value => {
      const [hours, minutes, seconds] = value.replace(',', '.').split(':');
      return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
    };
    const text = lines.slice(timeLineIndex + 1).join(' ').replace(/<[^>]*>/g, '').trim();
    return text ? [{ start: toSeconds(match[1]), end: toSeconds(match[2]), text }] : [];
  });
});

ipcMain.handle('settings:load-session', () => userSettings.sessionPreferences || null);
ipcMain.handle('settings:save-session', async (_event, preferences) => {
  const values = preferences && typeof preferences === 'object' ? preferences : {};
  userSettings.sessionPreferences = {
    interval: preferenceInteger(values.interval, 30, 1),
    minimumWords: preferenceInteger(values.minimumWords, 5, 1),
    maxCharacters: preferenceInteger(values.maxCharacters, 100, 20),
    prefillFirstWord: values.prefillFirstWord === true,
    subtitleMode: values.subtitleMode === 'off' ? 'off' : 'outside',
  };
  try {
    await persistUserSettings();
    return true;
  } catch (error) {
    console.error('Could not save session preferences:', error);
    return false;
  }
});

ipcMain.handle('favorites:list', async () => {
  await clearFavoritesIfCacheWasDeleted();
  return savedFavorites();
});

ipcMain.handle('favorites:toggle', async (_event, favorite) => {
  await clearFavoritesIfCacheWasDeleted();
  if (!userSettings.favoriteSourceKey || typeof favorite?.text !== 'string') return savedFavorites();
  const item = { start: Number(favorite.start), text: favorite.text.trim() };
  if (!Number.isFinite(item.start) || !item.text) return savedFavorites();
  const favorites = savedFavorites();
  const existingIndex = favorites.findIndex(saved => saved.start === item.start && saved.text === item.text);
  if (existingIndex >= 0) favorites.splice(existingIndex, 1);
  else favorites.push(item);
  userSettings.favorites = favorites;
  await persistUserSettings();
  return savedFavorites();
});

ipcMain.handle('clipboard:write-text', (_event, text) => {
  clipboard.writeText(String(text || ''));
  return true;
});

app.whenReady().then(async () => {
  userSettingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    const settings = JSON.parse(await fs.readFile(userSettingsPath, 'utf8'));
    if (settings && typeof settings === 'object' && !Array.isArray(settings)) userSettings = settings;
    if (typeof userSettings.lastVideoDirectory === 'string') lastVideoDirectory = userSettings.lastVideoDirectory;
  } catch { /* First launch: no local preferences yet. */ }
  processedVideoPath = path.join(app.getAppPath(), '.video-cache', 'processed-video.mp4');
  await fs.mkdir(path.dirname(processedVideoPath), { recursive: true });
  await clearFavoritesIfCacheWasDeleted();
  try {
    cacheWatcher = watchFs(path.dirname(processedVideoPath), (_eventType, fileName) => {
      if (fileName && fileName.toString() !== path.basename(processedVideoPath)) return;
      void clearFavoritesIfCacheWasDeleted().catch(error => console.error('Could not clear favorites after cache deletion:', error));
    });
  } catch (error) {
    console.error('Could not watch the video cache folder:', error);
  }
  startMediaServer();
  await new Promise(resolve => mediaServer.once('listening', resolve));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  cacheWatcher?.close();
  mediaServer?.close();
});
