import { Fragment, useEffect, useRef, useState } from 'react';

type ShortcutAction = 'restart' | 'skip' | 'next' | 'reveal' | 'favorite';
type KeyboardShortcuts = Record<ShortcutAction, string>;
const defaultShortcuts: KeyboardShortcuts = {
  restart: 'Mouse Back',
  skip: 'Shift+Enter',
  next: '',
  reveal: 'Mouse Forward',
  favorite: '',
};

declare global {
  interface Window {
    desktop?: {
      chooseVideo: () => Promise<SelectedVideo | string | null>;
      restoreLastVideo: () => Promise<SelectedVideo | null>;
      prepareVideo: (filePath: string, videoInfo: VideoInfo) => Promise<{ url: string; converted: boolean; playbackKey: string; resumePosition: number; savedSubtitleChoice: SubtitleChoice | null }>;
      savePlaybackPosition: (playbackKey: string, position: number) => void;
      extractSubtitle: (filePath: string, streamIndex: number) => Promise<SubtitleCue[]>;
      chooseExternalSubtitle: () => Promise<{ path: string; cues: SubtitleCue[] } | null>;
      loadExternalSubtitle: (filePath: string) => Promise<{ path: string; cues: SubtitleCue[] }>;
      saveSubtitleChoice: (playbackKey: string, choice: SubtitleChoice | null) => Promise<boolean>;
      loadSessionPreferences: () => Promise<SessionPreferences | null>;
      saveSessionPreferences: (preferences: SessionPreferences) => Promise<boolean>;
      loadKeyboardShortcuts: () => Promise<KeyboardShortcuts | null>;
      saveKeyboardShortcuts: (shortcuts: KeyboardShortcuts) => Promise<boolean>;
      onVideoProgress: (callback: (progress: { percent: number | null }) => void) => () => void;
      loadFavorites: () => Promise<FavoriteLine[]>;
      toggleFavorite: (favorite: FavoriteLine) => Promise<FavoriteLine[]>;
      copyText: (text: string) => Promise<boolean>;
      onFavoritesCleared: (callback: () => void) => () => void;
    };
  }
}

type SubtitleTrack = { index: number; codec: string; label: string; textSupported: boolean };
type SubtitleCue = { start: number; end: number; text: string };
type VideoInfo = { videoCodec: string; pixelFormat: string; format: string; duration?: number };
type SelectedVideo = VideoInfo & { path: string; tracks: SubtitleTrack[] };
type SubtitleChoice = { kind: 'internal'; streamIndex: number } | { kind: 'external'; path: string };
type SessionPreferences = {
  interval: number;
  minimumWords: number;
  maxCharacters: number;
  prefillFirstWord: boolean;
  subtitleMode: 'outside' | 'off';
};
type FavoriteLine = { start: number; text: string };

function normalizeAnswer(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]/gu, '');
}

function wordCount(text: string) {
  return (text.match(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*/gu) || []).length;
}

export default function App() {
  const [video, setVideo] = useState<{ path: string; url: string } | null>(null);
  const [videoError, setVideoError] = useState('');
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoProgress, setVideoProgress] = useState<number | null>(0);
  const [playbackKey, setPlaybackKey] = useState('');
  const [resumePosition, setResumePosition] = useState(0);
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState('');
  const [externalSubtitleName, setExternalSubtitleName] = useState('');
  const [subtitleStatus, setSubtitleStatus] = useState('Internal subtitle tracks will appear here');
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleMode, setSubtitleMode] = useState<'outside' | 'off'>('outside');
  const [minimumWords, setMinimumWords] = useState(5);
  const [interval, setInterval] = useState(30);
  const [maxCharacters, setMaxCharacters] = useState(100);
  const [prefillFirstWord, setPrefillFirstWord] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [keyboardShortcuts, setKeyboardShortcuts] = useState<KeyboardShortcuts>(defaultShortcuts);
  const [shortcutsLoaded, setShortcutsLoaded] = useState(false);
  const [showShortcutSettings, setShowShortcutSettings] = useState(false);
  const [capturingShortcut, setCapturingShortcut] = useState<ShortcutAction | null>(null);
  const [shortcutError, setShortcutError] = useState('');
  const [favorites, setFavorites] = useState<FavoriteLine[]>([]);
  const [favoritesStatus, setFavoritesStatus] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [inGame, setInGame] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(0);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [nextCue, setNextCue] = useState<SubtitleCue | null>(null);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [answerWords, setAnswerWords] = useState<string[]>([]);
  const [answerStatus, setAnswerStatus] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);
  const previewRef = useRef<HTMLVideoElement>(null);
  const gameVideoRef = useRef<HTMLVideoElement>(null);
  const gameVideoWrapRef = useRef<HTMLDivElement>(null);
  const wordInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const replayingPhaseRef = useRef(false);
  const lastFocusedWordRef = useRef(0);
  const manualSeekPositionRef = useRef<number | null>(null);
  const programmaticSeekTargetRef = useRef<number | null>(null);
  const lastPositionSaveRef = useRef({ at: 0, position: -1, playbackKey: '' });

  function savePlaybackPosition(position: number, force = false) {
    if (!playbackKey || !window.desktop?.savePlaybackPosition || !Number.isFinite(position)) return;
    const now = Date.now();
    const last = lastPositionSaveRef.current;
    if (!force && last.playbackKey === playbackKey && (now - last.at < 2500 || Math.abs(position - last.position) < 1)) return;
    lastPositionSaveRef.current = { at: now, position, playbackKey };
    setResumePosition(position);
    window.desktop.savePlaybackPosition(playbackKey, position);
  }

  function formatVideoTime(seconds: number) {
    const wholeSeconds = Math.floor(Math.max(0, seconds));
    const hours = Math.floor(wholeSeconds / 3600);
    const minutes = Math.floor((wholeSeconds % 3600) / 60);
    const remainingSeconds = wholeSeconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
      : `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  useEffect(() => {
    let mounted = true;
    const loadPreferences = window.desktop?.loadSessionPreferences;
    if (!loadPreferences) {
      setPreferencesLoaded(true);
      return () => { mounted = false; };
    }
    void loadPreferences().then(preferences => {
      if (!mounted) return;
      if (preferences) {
        setInterval(preferences.interval);
        setMinimumWords(preferences.minimumWords);
        setMaxCharacters(preferences.maxCharacters);
        setPrefillFirstWord(preferences.prefillFirstWord);
        setSubtitleMode(preferences.subtitleMode);
      }
      setPreferencesLoaded(true);
    }).catch(error => {
      console.error('Could not load local session preferences:', error);
      if (mounted) setPreferencesLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const restore = window.desktop?.restoreLastVideo;
    if (!restore) { setVideoLoading(false); return; }
    let cancelled = false;
    void (async () => {
      try {
        const selected = await restore();
        if (selected && !cancelled) await loadSelectedVideo(selected);
      } catch (error) {
        if (!cancelled) setVideoError(error instanceof Error ? error.message : 'Could not restore the previous video.');
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const load = window.desktop?.loadKeyboardShortcuts;
    if (!load) { setShortcutsLoaded(true); return; }
    void load().then(saved => {
      if (saved) setKeyboardShortcuts({ ...defaultShortcuts, ...saved });
    }).catch(error => console.error('Could not load keyboard shortcuts:', error))
      .finally(() => setShortcutsLoaded(true));
  }, []);

  useEffect(() => {
    if (!shortcutsLoaded || !window.desktop?.saveKeyboardShortcuts) return;
    void window.desktop.saveKeyboardShortcuts(keyboardShortcuts);
  }, [shortcutsLoaded, keyboardShortcuts]);

  useEffect(() => window.desktop?.onVideoProgress(progress => setVideoProgress(progress.percent)), []);

  useEffect(() => {
    if (!preferencesLoaded || !window.desktop?.saveSessionPreferences) return;
    void window.desktop.saveSessionPreferences({ interval, minimumWords, maxCharacters, prefillFirstWord, subtitleMode });
  }, [preferencesLoaded, interval, minimumWords, maxCharacters, prefillFirstWord, subtitleMode]);

  useEffect(() => window.desktop?.onFavoritesCleared(() => {
    setFavorites([]);
    setFavoritesStatus('Favorites cleared because the video cache was deleted.');
  }), []);

  useEffect(() => {
    function updateFullscreenState() {
      setIsVideoFullscreen(document.fullscreenElement === gameVideoWrapRef.current);
    }
    document.addEventListener('fullscreenchange', updateFullscreenState);
    return () => document.removeEventListener('fullscreenchange', updateFullscreenState);
  }, []);

  useEffect(() => {
    function handleKeyboardShortcut(event: KeyboardEvent) {
      if (!activeCue || showShortcutSettings) return;
      const shortcut = shortcutForEvent(event);
      const action = (Object.keys(keyboardShortcuts) as ShortcutAction[])
        .find(key => keyboardShortcuts[key] && keyboardShortcuts[key] === shortcut);
      if (!action) return;
      event.preventDefault();
      if (action === 'restart') restartPhase();
      else if (action === 'skip') skipPhase();
      else if (action === 'next') goToNextPhase();
      else if (action === 'reveal') revealAnswer();
      else if (action === 'favorite') void toggleCurrentFavorite();
    }
    function handleMouseSideButton(event: MouseEvent) {
      if (event.button !== 3 && event.button !== 4) return;
      const mouseShortcut = event.button === 3 ? 'Mouse Back' : 'Mouse Forward';
      if (showShortcutSettings && capturingShortcut) {
        event.preventDefault();
        event.stopPropagation();
        assignShortcut(capturingShortcut, mouseShortcut);
        return;
      }
      if (!activeCue || showShortcutSettings) return;
      const action = (Object.keys(keyboardShortcuts) as ShortcutAction[]).find(key => keyboardShortcuts[key] === mouseShortcut);
      if (!action) return;
      event.preventDefault();
      event.stopPropagation();
      if (action === 'restart') restartPhase();
      else if (action === 'skip') skipPhase();
      else if (action === 'next') goToNextPhase();
      else if (action === 'reveal') revealAnswer();
      else if (action === 'favorite') void toggleCurrentFavorite();
    }
    window.addEventListener('keydown', handleKeyboardShortcut);
    window.addEventListener('auxclick', handleMouseSideButton, true);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcut);
      window.removeEventListener('auxclick', handleMouseSideButton, true);
    };
  }, [activeCue, capturingShortcut, keyboardShortcuts, showShortcutSettings]);

  function shortcutForEvent(event: Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>) {
    const modifiers = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift', event.metaKey && 'Meta'].filter(Boolean);
    const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
    return [...modifiers, key].join('+');
  }

  function captureShortcut(action: ShortcutAction, event: React.KeyboardEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.key === 'Escape') { setCapturingShortcut(null); setShortcutError(''); return; }
    if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return;
    const shortcut = shortcutForEvent(event);
    if (!event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
      setShortcutError('Add Ctrl, Alt, Shift, or Meta so the shortcut does not interrupt typing.');
      return;
    }
    assignShortcut(action, shortcut);
  }

  function assignShortcut(action: ShortcutAction, shortcut: string) {
    const conflict = (Object.keys(keyboardShortcuts) as ShortcutAction[]).find(key => key !== action && keyboardShortcuts[key] === shortcut);
    if (conflict) { setShortcutError('That shortcut is already assigned. Choose another key combination.'); return; }
    setKeyboardShortcuts(current => ({ ...current, [action]: shortcut }));
    setCapturingShortcut(null);
    setShortcutError('');
  }

  function formatShortcut(shortcut: string) {
    return shortcut.replace('ArrowLeft', '←').replace('ArrowRight', '→').replace('ArrowUp', '↑').replace('ArrowDown', '↓');
  }

  function focusLastWord(cue: SubtitleCue | null = activeCue) {
    if (!cue) return;
    const wordCount = Array.from(cue.text.matchAll(/[\p{L}\p{N}]+/gu)).length;
    const firstEditableWord = prefillFirstWord ? 1 : 0;
    const index = Math.min(Math.max(lastFocusedWordRef.current, firstEditableWord), wordCount - 1);
    if (index >= firstEditableWord) wordInputRefs.current[index]?.focus();
  }

  async function toggleVideoFullscreen() {
    const wrapper = gameVideoWrapRef.current;
    if (!wrapper) return;
    try {
      if (document.fullscreenElement === wrapper) await document.exitFullscreen();
      else await wrapper.requestFullscreen();
      window.setTimeout(focusLastWord, 0);
    } catch {
      setAnswerStatus('Could not change fullscreen mode.');
    }
  }

  async function loadSelectedVideo(selected: SelectedVideo | string | null) {
    if (!selected) return;
    if (typeof selected === 'string' || !Array.isArray(selected.tracks)) {
      setVideoError('The app is still running an old version. Close all game windows and restart it with npm run dev.');
      return;
    }
    try {
      if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime, true);
      setVideo({ path: selected.path, url: '' });
      setPlaybackKey('');
      setResumePosition(0);
      lastPositionSaveRef.current = { at: 0, position: -1, playbackKey: '' };
      setTracks(selected.tracks.filter(track => track.textSupported));
      setSubtitleCues([]);
      setSelectedTrack('');
      setExternalSubtitleName('');
      const textTracks = selected.tracks.filter(track => track.textSupported);
      setSubtitleStatus(textTracks.length
        ? `${textTracks.length} text subtitle track(s) found.`
        : selected.tracks.length
          ? `This video has subtitle tracks, but they are not text-based: ${selected.tracks.map(track => track.codec).join(', ')}.`
          : 'No subtitle tracks were found in this video.');
      setVideoError('');
      setSessionError('');
      setVideoLoading(true);
      setVideoProgress(0);
      const prepared = await window.desktop?.prepareVideo(selected.path, selected);
      if (prepared) {
        setPlaybackKey(prepared.playbackKey);
        setResumePosition(prepared.resumePosition);
        lastPositionSaveRef.current = { at: Date.now(), position: prepared.resumePosition, playbackKey: prepared.playbackKey };
        setVideo({ path: selected.path, url: prepared.url });
        setFavorites(await window.desktop?.loadFavorites() || []);
        setFavoritesStatus('');
        setVideoError('');
        if (prepared.savedSubtitleChoice?.kind === 'internal') {
          await chooseTrack(String(prepared.savedSubtitleChoice.streamIndex), selected.path, prepared.playbackKey);
        } else if (prepared.savedSubtitleChoice?.kind === 'external') {
          await loadExternalSubtitle(prepared.savedSubtitleChoice.path, prepared.playbackKey);
        }
      }
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Could not prepare this video.');
    } finally {
      setVideoLoading(false);
    }
  }

  async function chooseVideo() {
    try {
      const selected = await window.desktop?.chooseVideo();
      if (selected) await loadSelectedVideo(selected);
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Could not open this video.');
    }
  }

  async function chooseTrack(value: string, filePath = video?.path, sourceKey = playbackKey) {
    setSelectedTrack(value);
    setExternalSubtitleName('');
    setSubtitleCues([]);
    if (!value || !filePath || !window.desktop) {
      if (!value && sourceKey) void window.desktop?.saveSubtitleChoice(sourceKey, null);
      return;
    }
    setSubtitleLoading(true);
    setSubtitleStatus('');
    try {
      const cues = await window.desktop.extractSubtitle(filePath, Number(value));
      setSubtitleCues(cues);
      setSubtitleStatus(`Subtitle loaded · ${cues.length.toLocaleString('en-US')} lines`);
      if (sourceKey) await window.desktop.saveSubtitleChoice(sourceKey, { kind: 'internal', streamIndex: Number(value) });
    } catch {
      setSubtitleStatus('Could not read this subtitle track.');
    } finally {
      setSubtitleLoading(false);
    }
  }

  async function chooseExternalSubtitle() {
    if (!window.desktop?.chooseExternalSubtitle) return;
    setSubtitleLoading(true);
    setSubtitleStatus('');
    try {
      const selected = await window.desktop.chooseExternalSubtitle();
      if (!selected) return;
      await loadExternalSubtitle(selected.path);
    } catch (error) {
      setSubtitleStatus(error instanceof Error ? error.message : 'Could not read this subtitle file.');
    } finally {
      setSubtitleLoading(false);
    }
  }

  async function loadExternalSubtitle(filePath: string, sourceKey = playbackKey) {
    if (!window.desktop?.loadExternalSubtitle) return;
    setSubtitleLoading(true);
    setSubtitleStatus('');
    try {
      const selected = await window.desktop.loadExternalSubtitle(filePath);
      setSelectedTrack('');
      setExternalSubtitleName(selected.path.split(/[\\/]/).pop() || selected.path);
      setSubtitleCues(selected.cues);
      setSubtitleStatus(`External subtitle loaded · ${selected.cues.length.toLocaleString('en-US')} lines`);
      if (selected.cues.length && sourceKey) await window.desktop.saveSubtitleChoice(sourceKey, { kind: 'external', path: selected.path });
    } catch (error) {
      setSubtitleStatus(error instanceof Error ? error.message : 'Could not read this subtitle file.');
    } finally {
      setSubtitleLoading(false);
    }
  }

  async function toggleCurrentFavorite() {
    if (!activeCue || !window.desktop) return;
    const updated = await window.desktop.toggleFavorite({ start: activeCue.start, text: activeCue.text });
    setFavorites(updated);
    setFavoritesStatus('');
  }

  async function copyFavorites() {
    if (!favorites.length || !window.desktop) return;
    try {
      await window.desktop.copyText(favorites.map(favorite => favorite.text).join('\n'));
      setFavoritesStatus('Favorites copied to clipboard.');
    } catch {
      setFavoritesStatus('Could not copy favorites.');
    }
  }

  function eligibleCues() {
    return subtitleCues.filter(cue =>
      wordCount(cue.text) >= Math.max(1, minimumWords)
      && cue.text.length <= Math.max(1, maxCharacters),
    );
  }

  function startSession() {
    const available = eligibleCues();
    const preview = previewRef.current;
    const currentTime = preview && preview.readyState >= 1 ? preview.currentTime : resumePosition;
    const targetTime = currentTime + Math.max(1, interval);
    const firstCue = available.find(cue => cue.start >= targetTime)
      || available.find(cue => cue.start > currentTime);
    if (!firstCue) {
      setSessionError('There are no lines matching these criteria after the current video position. Lower the minimum word count or maximum length, or rewind the video.');
      return;
    }
    setSessionError('');
    setGameStartTime(currentTime);
    setNextCue(firstCue);
    setActiveCue(null);
    setAnswerWords([]);
    setAnswerStatus('');
    setRevealed(false);
    setFinished(false);
    setInGame(true);
    savePlaybackPosition(currentTime, true);
  }

  function onGameLoaded() {
    const player = gameVideoRef.current;
    if (!player) return;
    programmaticSeekTargetRef.current = gameStartTime;
    player.currentTime = gameStartTime;
    savePlaybackPosition(gameStartTime, true);
    void player.play().catch(() => setAnswerStatus('Click the video play button to start playback.'));
  }

  function restorePreviewPosition() {
    const player = previewRef.current;
    if (!player || resumePosition <= 0) return;
    const position = Math.min(resumePosition, Math.max(0, player.duration - 0.1));
    player.currentTime = position;
    if (position !== resumePosition) setResumePosition(position);
  }

  function findNextCueFrom(position: number) {
    const targetTime = position + Math.max(1, interval);
    const available = eligibleCues();
    return available.find(cue => cue.start >= targetTime)
      || available.find(cue => cue.start > position)
      || null;
  }

  function onGameSeeked() {
    const player = gameVideoRef.current;
    if (!player) return;
    const position = player.currentTime;
    savePlaybackPosition(position, true);
    const programmaticTarget = programmaticSeekTargetRef.current;
    if (programmaticTarget !== null && Math.abs(position - programmaticTarget) < 0.1) {
      programmaticSeekTargetRef.current = null;
      return;
    }
    programmaticSeekTargetRef.current = null;
    setPlaybackTime(position);
    setAnswerStatus('');
    setFinished(false);
    if (activeCue) {
      manualSeekPositionRef.current = position;
    } else {
      manualSeekPositionRef.current = null;
      setNextCue(findNextCueFrom(position));
    }
  }

  function onGameTimeUpdate() {
    const player = gameVideoRef.current;
    if (!player) return;
    const now = player.currentTime;
    savePlaybackPosition(now);
    setPlaybackTime(now);

    if (activeCue) {
      // A phase is the line that was just spoken. Replaying it stops at its
      // end again, while the phase remains active until the user changes it.
      if (replayingPhaseRef.current && now >= activeCue.end) {
        player.pause();
        replayingPhaseRef.current = false;
        window.setTimeout(() => focusLastWord(activeCue), 0);
      }
      return;
    }

    if (nextCue && now >= nextCue.end) {
      player.pause();
      setActiveCue(nextCue);
      setNextCue(null);
      const firstWord = nextCue.text.match(/[\p{L}\p{N}]+/u)?.[0];
      setAnswerWords(prefillFirstWord && firstWord ? [firstWord] : []);
      setAnswerStatus('');
      setRevealed(false);
      window.setTimeout(() => focusLastWord(nextCue), 0);
    }
  }

  function scheduleFollowingCue(cue: SubtitleCue) {
    const next = eligibleCues().find(item => item.start >= cue.start + Math.max(1, interval));
    setNextCue(next || null);
  }

  function scheduleFollowingPosition(position: number) {
    setNextCue(findNextCueFrom(position));
    manualSeekPositionRef.current = null;
  }

  function resumeAfterPhase(cue: SubtitleCue) {
    replayingPhaseRef.current = false;
    setActiveCue(null);
    setRevealed(false);
    setAnswerWords([]);
    setAnswerStatus('');
    if (manualSeekPositionRef.current !== null) scheduleFollowingPosition(manualSeekPositionRef.current);
    else scheduleFollowingCue(cue);
    void gameVideoRef.current?.play();
  }

  function updateWord(index: number, expectedWords: string[], value: string, cue: SubtitleCue) {
    const nextWords = [...answerWords];
    const typedLetters = Array.from(value).filter(character => /[\p{L}\p{N}]/u.test(character)).join('');
    const wordLimit = expectedWords[index].length;
    let focusIndex = index;
    if (typedLetters.length > wordLimit) {
      nextWords[index] = typedLetters.slice(0, wordLimit);
      let overflow = typedLetters.slice(wordLimit);
      for (let nextIndex = index + 1; nextIndex < expectedWords.length && overflow.length > 0; nextIndex += 1) {
        if (prefillFirstWord && nextIndex === 0) continue;
        const combined = `${overflow}${nextWords[nextIndex] || ''}`;
        const nextLimit = expectedWords[nextIndex].length;
        nextWords[nextIndex] = combined.slice(0, nextLimit);
        overflow = combined.slice(nextLimit);
        focusIndex = nextIndex;
      }
      lastFocusedWordRef.current = focusIndex;
      window.setTimeout(() => wordInputRefs.current[focusIndex]?.focus(), 0);
    } else {
      nextWords[index] = typedLetters;
    }
    setAnswerWords(nextWords);
    setAnswerStatus('');
    if (expectedWords.every((word, wordIndex) => normalizeAnswer(nextWords[wordIndex] || '') === normalizeAnswer(word))) {
      resumeAfterPhase(cue);
      return;
    }
    const currentValue = nextWords[index] || '';
    const isCompleteAndCorrect = currentValue.length === wordLimit
      && normalizeAnswer(currentValue) === normalizeAnswer(expectedWords[index]);
    if (isCompleteAndCorrect && index < expectedWords.length - 1) {
      const nextIndex = index + 1;
      lastFocusedWordRef.current = nextIndex;
      window.setTimeout(() => wordInputRefs.current[nextIndex]?.focus(), 0);
    }
  }

  function skipPhase() {
    if (!activeCue) return;
    const cue = activeCue;
    setActiveCue(null);
    setAnswerWords([]);
    setAnswerStatus('');
    setRevealed(false);
    replayingPhaseRef.current = false;
    if (manualSeekPositionRef.current !== null) scheduleFollowingPosition(manualSeekPositionRef.current);
    else scheduleFollowingCue(cue);
    void gameVideoRef.current?.play();
  }

  function restartPhase() {
    if (!activeCue || !gameVideoRef.current) return;
    manualSeekPositionRef.current = null;
    programmaticSeekTargetRef.current = activeCue.start;
    gameVideoRef.current.currentTime = activeCue.start;
    setRevealed(false);
    replayingPhaseRef.current = true;
    void gameVideoRef.current.play();
  }

  function revealAnswer() {
    if (!activeCue) return;
    setRevealed(true);
  }

  function goToNextPhase() {
    const player = gameVideoRef.current;
    if (!player) return;
    const afterTime = activeCue?.start ?? player.currentTime;
    const next = eligibleCues().find(cue => cue.start > afterTime + 0.05);
    if (!next) {
      setAnswerStatus('There are no more eligible lines in this video.');
      return;
    }
    player.pause();
    manualSeekPositionRef.current = null;
    programmaticSeekTargetRef.current = next.start;
    player.currentTime = next.start;
    setActiveCue(null);
    setNextCue(next);
    setAnswerWords([]);
    setAnswerStatus('');
    setRevealed(false);
    replayingPhaseRef.current = false;
    setFinished(false);
    void player.play();
  }

  function renderWordInputs(cue: SubtitleCue) {
    const expression = /[\p{L}\p{N}]+/gu;
    const expectedWords = Array.from(cue.text.matchAll(expression), match => match[0]);
    const pieces: React.ReactNode[] = [];
    let cursor = 0;
    let wordIndex = 0;
    for (const match of cue.text.matchAll(expression)) {
      const index = match.index ?? 0;
      const word = match[0];
      if (index > cursor) pieces.push(<span key={`text-${wordIndex}`}>{cue.text.slice(cursor, index)}</span>);
      const value = answerWords[wordIndex] || '';
      const isPrefilled = prefillFirstWord && wordIndex === 0;
      const shownValue = isPrefilled ? word : value;
      const isCorrect = shownValue.length > 0 && normalizeAnswer(shownValue) === normalizeAnswer(word);
      const typed = normalizeAnswer(value);
      const expected = normalizeAnswer(word);
      const hasWrongCharacter = Array.from(typed).some((character, characterIndex) => character !== Array.from(expected)[characterIndex]);
      const statusClass = isPrefilled || isCorrect ? 'word-correct' : hasWrongCharacter ? 'word-wrong' : '';
      const thisIndex = wordIndex;
      pieces.push(
        <input
          key={`word-${thisIndex}`}
          ref={element => { wordInputRefs.current[thisIndex] = element; }}
          className={`inline-word ${statusClass} ${isPrefilled ? 'prefilled-word' : ''}`}
          value={shownValue}
          style={{
            width: `${Math.max(1, word.length, value.length)}ch`,
            backgroundPosition: `${Math.min(value.length, word.length)}ch bottom`,
          }}
          onChange={event => updateWord(thisIndex, expectedWords, event.target.value, cue)}
          onFocus={() => { lastFocusedWordRef.current = thisIndex; }}
          readOnly={isPrefilled}
          onKeyDown={event => {
            const input = event.currentTarget;
            if (event.key === 'ArrowLeft' && input.selectionStart === 0 && thisIndex > (prefillFirstWord ? 1 : 0)) {
              event.preventDefault();
              const previous = wordInputRefs.current[thisIndex - 1];
              if (previous) { previous.focus(); previous.setSelectionRange(previous.value.length, previous.value.length); }
            } else if (event.key === 'ArrowRight' && input.selectionStart === input.value.length && thisIndex < expectedWords.length - 1) {
              event.preventDefault();
              const next = wordInputRefs.current[thisIndex + 1];
              if (next) { next.focus(); next.setSelectionRange(0, 0); }
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              const nextIndex = thisIndex + (event.key === 'ArrowUp' ? -1 : 1);
              const minIndex = prefillFirstWord ? 1 : 0;
              if (nextIndex >= minIndex && nextIndex < expectedWords.length) {
                event.preventDefault();
                const next = wordInputRefs.current[nextIndex];
                if (next) {
                  next.focus();
                  const position = Math.min(input.selectionStart ?? 0, next.value.length);
                  next.setSelectionRange(position, position);
                }
              }
            }
          }}
          aria-label={`Word ${thisIndex + 1}`}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />,
      );
      cursor = index + word.length;
      wordIndex += 1;
    }
    if (cursor < cue.text.length) pieces.push(<span key="text-end">{cue.text.slice(cursor)}</span>);
    return pieces.map((piece, index) => <Fragment key={index}>{piece}</Fragment>);
  }

  const captionCue = subtitleCues.find(cue => playbackTime >= cue.start && playbackTime <= cue.end);
  const currentCaption = captionCue && !activeCue && !(nextCue && captionCue.start === nextCue.start)
    ? captionCue.text
    : undefined;

  if (showShortcutSettings) {
    const shortcutRows: Array<{ action: ShortcutAction; label: string; description: string }> = [
      { action: 'restart', label: 'Replay line', description: 'Start the current subtitle line again.' },
      { action: 'skip', label: 'Skip exercise', description: 'Resume playback and continue the session.' },
      { action: 'next', label: 'Next phase', description: 'Jump to the next eligible subtitle.' },
      { action: 'reveal', label: 'Show answer', description: 'Reveal the current line without advancing.' },
      { action: 'favorite', label: 'Toggle favorite', description: 'Save or remove the current line.' },
    ];
    return (
      <main className="app-shell shortcuts-shell">
        <header className="topbar">
          <div className="brand-mark">ED</div>
          <div><p className="eyebrow">PERSONALIZE CONTROLS</p><h1>Keyboard shortcuts</h1></div>
          <button className="back-to-setup" onClick={() => { setShowShortcutSettings(false); setCapturingShortcut(null); }}>Back</button>
        </header>
        <section className="shortcut-workspace">
          <div className="shortcut-intro"><h2>Make the controls yours.</h2><p className="muted">Choose a button, then press the key combination you want to use.</p></div>
          <section className="card shortcut-card">
            {shortcutRows.map(row => (
              <div className="shortcut-row" key={row.action}>
                <div><strong>{row.label}</strong><p>{row.description}</p></div>
                <button className={`shortcut-key ${capturingShortcut === row.action ? 'listening' : ''}`} onClick={() => { setCapturingShortcut(row.action); setShortcutError(''); }} onKeyDown={event => capturingShortcut === row.action && captureShortcut(row.action, event)}>
                  {capturingShortcut === row.action ? 'Press keys…' : keyboardShortcuts[row.action] ? formatShortcut(keyboardShortcuts[row.action]) : 'Not assigned'}
                </button>
              </div>
            ))}
            <p className="helper">Click a shortcut, then press a combination with Ctrl, Alt, Shift, or Meta—or press the mouse Back or Forward button. Press Escape to cancel.</p>
            {shortcutError && <p className="video-error">{shortcutError}</p>}
            <button className="reset-shortcuts" onClick={() => { setKeyboardShortcuts(defaultShortcuts); setShortcutError(''); setCapturingShortcut(null); }}>Restore defaults</button>
          </section>
        </section>
        <footer><span>ENGLISH DICTATION</span><span>SHORTCUTS ARE SAVED ON THIS COMPUTER</span></footer>
      </main>
    );
  }

  if (inGame && video?.url) {
    return (
      <main className="app-shell game-shell">
        <header className="topbar">
          <div className="brand-mark">ED</div>
          <div><p className="eyebrow">DICTATION IN PROGRESS</p><h1>English Dictation</h1></div>
          <button className="back-to-setup shortcut-open-button" onClick={() => setShowShortcutSettings(true)}>Keyboard shortcuts</button>
          <button className="back-to-setup" onClick={() => { if (gameVideoRef.current) savePlaybackPosition(gameVideoRef.current.currentTime, true); setInGame(false); }}>Back to settings</button>
        </header>
        <section className="game-workspace">
          <div className="game-heading">
            <p className="eyebrow">LISTEN CAREFULLY</p>
            <h2>{activeCue ? 'Type the full line' : finished ? 'Video finished' : 'Session is playing'}</h2>
            <p className="muted">{activeCue ? 'Fill in the blanks over the video.' : finished ? 'You have reached the end of the video.' : 'The video will pause at the next selected line.'}</p>
          </div>
          <div className="game-layout">
            <section className="card game-player-card">
              <div className="game-video-wrap" ref={gameVideoWrapRef}>
                <video
                  ref={gameVideoRef}
                  className="game-video"
                  src={video.url}
                  controls
                  controlsList="nofullscreen"
                  preload="auto"
                  onLoadedMetadata={onGameLoaded}
                  onTimeUpdate={onGameTimeUpdate}
                  onSeeked={onGameSeeked}
                  onPause={() => { if (gameVideoRef.current) savePlaybackPosition(gameVideoRef.current.currentTime, true); }}
                  onEnded={() => { if (gameVideoRef.current) savePlaybackPosition(gameVideoRef.current.currentTime, true); setFinished(true); setNextCue(null); replayingPhaseRef.current = false; }}
                />
                <button className="fullscreen-button" onClick={() => void toggleVideoFullscreen()} aria-label={isVideoFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                  {isVideoFullscreen ? '⛶ Exit fullscreen' : '⛶ Fullscreen'}
                </button>
                {activeCue && <div className={`subtitle-overlay ${revealed ? 'revealed-overlay' : 'input-overlay'}`}>
                  {revealed ? activeCue.text : renderWordInputs(activeCue)}
                </div>}
                {!activeCue && subtitleMode === 'outside' && currentCaption && <div className="subtitle-overlay normal-caption">{currentCaption}</div>}
              </div>
              <div className="phase-actions">
                {activeCue && <button title={`Replay line${keyboardShortcuts.restart ? ` (${formatShortcut(keyboardShortcuts.restart)})` : ' (no shortcut)'}`} onClick={restartPhase}>↶ Back</button>}
                {activeCue && <button title={`Skip exercise${keyboardShortcuts.skip ? ` (${formatShortcut(keyboardShortcuts.skip)})` : ''}`} onClick={skipPhase}>Skip →</button>}
                <button title={`Next phase${keyboardShortcuts.next ? ` (${formatShortcut(keyboardShortcuts.next)})` : ''}`} onClick={goToNextPhase}>Next phase</button>
                {activeCue && !revealed && <button className="reveal-button" title={`Show answer${keyboardShortcuts.reveal ? ` (${formatShortcut(keyboardShortcuts.reveal)})` : ' (no shortcut)'}`} onClick={revealAnswer}>Show answer</button>}
                {activeCue && <button title={`Save or remove this subtitle${keyboardShortcuts.favorite ? ` (${formatShortcut(keyboardShortcuts.favorite)})` : ''}`} onClick={() => void toggleCurrentFavorite()}>
                  {favorites.some(favorite => favorite.start === activeCue.start && favorite.text === activeCue.text) ? '★ Favorited' : '☆ Favorite'}
                </button>}
                <button className="end-session-button" onClick={() => { if (gameVideoRef.current) savePlaybackPosition(gameVideoRef.current.currentTime, true); setInGame(false); }}>End session</button>
              </div>
              <section className="favorites-panel" aria-label="Favorite subtitles">
                <div className="favorites-heading"><strong>Favorites ({favorites.length})</strong><button onClick={() => void copyFavorites()} disabled={!favorites.length}>Copy favorites</button></div>
                <textarea
                  className="favorites-textarea"
                  aria-label="Saved favorite subtitles"
                  value={favorites.map(favorite => favorite.text).join('\n')}
                  placeholder="Favorite subtitles from this video will appear here."
                  readOnly
                />
                {favoritesStatus && <p className="game-hint">{favoritesStatus}</p>}
              </section>
              {activeCue && !revealed && <p className="game-hint">Use the arrow keys to move between letters and words.</p>}
              {answerStatus && <p className="answer-feedback">{answerStatus}</p>}
              {!activeCue && sessionError && <p className="video-error">{sessionError}</p>}
              <div className="game-transport">
                <span>{activeCue ? 'Current phase' : nextCue ? 'Next pause scheduled' : finished ? 'Session ended' : 'Continuous playback'}</span>
              </div>
            </section>
          </div>
        </section>
        <footer><span>ENGLISH DICTATION</span><span>PRACTICE AT YOUR OWN PACE</span></footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">ED</div>
        <div><p className="eyebrow">LOCAL LISTENING PRACTICE</p><h1>English Dictation</h1></div>
        <button className="back-to-setup shortcut-open-button" onClick={() => setShowShortcutSettings(true)}>Keyboard shortcuts</button>
        <span className="local-badge"><i /> Your files stay on this computer</span>
      </header>
      <section className="workspace">
        <div className="intro">
          <div><p className="eyebrow">STUDY SESSION</p><h2>Turn any scene into practice.</h2><p className="muted">Choose a video and subtitle track to create your dictation exercise.</p></div>
          <div className="step-indicator"><span>01</span><b />02<b />03</div>
        </div>
        <div className="columns">
          <section className="card media-card">
            <div className="card-heading"><div className="number">01</div><div><h3>Choose a video</h3><p>Select a file from your computer</p></div></div>
            <button className="dropzone" onClick={() => void chooseVideo()} disabled={videoLoading}>
              <span className="upload-icon">↑</span>
              <strong>{videoLoading ? (video ? 'Preparing video…' : 'Restoring previous video…') : video ? 'Video selected' : 'Open a video file'}</strong>
              <span className="file-name">{videoLoading ? 'Please wait while the last video is loaded.' : video?.path || 'MKV, MP4, AVI, MOV, and other formats'}</span>
              <span className="browse-button">Browse files</span>
            </button>
            {videoLoading && <div className="processing-panel" role="status" aria-live="polite">
              <div className="processing-copy"><strong>Preparing video</strong><span>{videoProgress === null ? 'Estimating conversion time…' : `${Math.round(videoProgress)}% complete`}</span></div>
              <div className="processing-track"><div className={videoProgress === null ? 'processing-fill indeterminate' : 'processing-fill'} style={videoProgress === null ? undefined : { width: `${Math.max(3, videoProgress)}%` }} /></div>
              <small>The video is being optimized for smooth playback.</small>
            </div>}
            {videoError && <p className="video-error">{videoError}</p>}
            {video?.url && <div className="video-preview-wrap">
              <video ref={previewRef} className="video-preview" src={video.url} controls onLoadedMetadata={restorePreviewPosition} onTimeUpdate={() => { if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime); }} onSeeked={() => { if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime, true); }} onPause={() => { if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime, true); }} />
              {resumePosition > 0 && <p className="helper resume-note">Playback will resume from {formatVideoTime(resumePosition)}.</p>}
            </div>}
            <div className="card-heading subtitle-heading"><div className="number">02</div><div><h3>Subtitle track</h3><p>Text subtitles found in the video</p></div></div>
            <div className="track-placeholder">
              <span className="caption-icon">CC</span>
              {tracks.length > 0 ? (
                <select className="track-select" value={selectedTrack} onChange={event => void chooseTrack(event.target.value)}>
                  <option value="">Choose a subtitle track</option>
                  {tracks.map(track => <option value={track.index} key={track.index}>{track.label}</option>)}
                </select>
              ) : <div><strong>{video ? 'Internal tracks' : 'Waiting for a video'}</strong><span>{subtitleStatus}</span></div>}
              <span className="chevron">⌄</span>
            </div>
            <div className="external-subtitle-control">
              <button onClick={() => void chooseExternalSubtitle()} disabled={subtitleLoading || !video}>{subtitleLoading ? 'Loading subtitles…' : externalSubtitleName ? 'Choose another .srt file' : 'Choose external .srt'}</button>
              {externalSubtitleName && <span className="external-subtitle-name" title={externalSubtitleName}>{externalSubtitleName}</span>}
            </div>
            {(subtitleStatus || subtitleLoading) && <p className="helper">{subtitleLoading ? 'Reading subtitle lines…' : subtitleStatus}</p>}
          </section>
          <section className="card settings-card">
            <div className="card-heading"><div className="number">03</div><div><h3>Configure your session</h3><p>Adjust the pace of the exercise</p></div></div>
            <label className="field-label" htmlFor="interval">Pause for an exercise every</label>
            <div className="input-with-unit"><input id="interval" type="number" min="1" value={interval} onChange={event => setInterval(Number(event.target.value))} /><span>seconds</span></div>
            <p className="helper">The video pauses at an eligible line after this interval.</p>
            <label className="field-label spaced" htmlFor="minimum">Minimum words per line</label>
            <div className="input-with-unit"><input id="minimum" type="number" min="1" value={minimumWords} onChange={event => setMinimumWords(Number(event.target.value))} /><span>words</span></div>
            <label className="field-label spaced" htmlFor="length">Maximum line length</label>
            <div className="input-with-unit"><input id="length" type="number" min="20" value={maxCharacters} onChange={event => setMaxCharacters(Number(event.target.value))} /><span>characters</span></div>
            <label className="prefill-setting"><input type="checkbox" checked={prefillFirstWord} onChange={event => setPrefillFirstWord(event.target.checked)} /><span><strong>Fill in the first word</strong><small>The word is shown as correct and cannot be edited.</small></span></label>
            <div className="subtitles-setting"><div><strong>Subtitles outside exercises</strong><span>They stay hidden during a phase</span></div><div className="segmented"><button className={subtitleMode === 'outside' ? 'active' : ''} onClick={() => setSubtitleMode('outside')}>Visible</button><button className={subtitleMode === 'off' ? 'active' : ''} onClick={() => setSubtitleMode('off')}>Off</button></div></div>
            {sessionError && <p className="video-error">{sessionError}</p>}
            <button className="start-button" onClick={startSession} disabled={!video?.url || (!selectedTrack && !externalSubtitleName) || !subtitleCues.length || videoLoading || subtitleLoading}>Continue <span>→</span></button>
            <p className="privacy-note">◆ &nbsp;No video or progress data is sent over the internet.</p>
          </section>
        </div>
      </section>
      <footer><span>ENGLISH DICTATION</span><span>PRACTICE AT YOUR OWN PACE</span></footer>
    </main>
  );
}
