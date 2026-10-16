import { Fragment, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    desktop?: {
      chooseVideo: () => Promise<SelectedVideo | string | null>;
      prepareVideo: (filePath: string, videoInfo: VideoInfo) => Promise<{ url: string; converted: boolean }>;
      extractSubtitle: (filePath: string, streamIndex: number) => Promise<SubtitleCue[]>;
      loadSessionPreferences: () => Promise<SessionPreferences | null>;
      saveSessionPreferences: (preferences: SessionPreferences) => Promise<boolean>;
      loadFavorites: () => Promise<FavoriteLine[]>;
      toggleFavorite: (favorite: FavoriteLine) => Promise<FavoriteLine[]>;
      copyText: (text: string) => Promise<boolean>;
      onFavoritesCleared: (callback: () => void) => () => void;
    };
  }
}

type SubtitleTrack = { index: number; codec: string; label: string; textSupported: boolean };
type SubtitleCue = { start: number; end: number; text: string };
type VideoInfo = { videoCodec: string; pixelFormat: string; format: string };
type SelectedVideo = VideoInfo & { path: string; tracks: SubtitleTrack[] };
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
  const [videoLoading, setVideoLoading] = useState(false);
  const [tracks, setTracks] = useState<SubtitleTrack[]>([]);
  const [selectedTrack, setSelectedTrack] = useState('');
  const [subtitleStatus, setSubtitleStatus] = useState('Internal subtitle tracks will appear here');
  const [subtitleLoading, setSubtitleLoading] = useState(false);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleMode, setSubtitleMode] = useState<'outside' | 'off'>('outside');
  const [minimumWords, setMinimumWords] = useState(5);
  const [interval, setInterval] = useState(30);
  const [maxCharacters, setMaxCharacters] = useState(100);
  const [prefillFirstWord, setPrefillFirstWord] = useState(false);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
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
      if (!activeCue) return;
      if (event.key === 'Enter' && event.shiftKey) {
        event.preventDefault();
        skipPhase();
      }
    }
    function handleMouseSideButton(event: MouseEvent) {
      if (!activeCue || (event.button !== 3 && event.button !== 4)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.button === 3) restartPhase();
      else revealAnswer();
    }
    window.addEventListener('keydown', handleKeyboardShortcut);
    window.addEventListener('auxclick', handleMouseSideButton, true);
    return () => {
      window.removeEventListener('keydown', handleKeyboardShortcut);
      window.removeEventListener('auxclick', handleMouseSideButton, true);
    };
  }, [activeCue]);

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

  async function chooseVideo() {
    try {
      const selected = await window.desktop?.chooseVideo();
      if (!selected) return;
      if (typeof selected === 'string' || !Array.isArray(selected.tracks)) {
        setVideoError('The app is still running an old version. Close all game windows and restart it with npm run dev.');
        return;
      }
      setVideo({ path: selected.path, url: '' });
      setTracks(selected.tracks.filter(track => track.textSupported));
      setSubtitleCues([]);
      setSelectedTrack('');
      const textTracks = selected.tracks.filter(track => track.textSupported);
      setSubtitleStatus(textTracks.length
        ? `${textTracks.length} text subtitle track(s) found.`
        : selected.tracks.length
          ? `This video has subtitle tracks, but they are not text-based: ${selected.tracks.map(track => track.codec).join(', ')}.`
          : 'No subtitle tracks were found in this video.');
      setVideoError('');
      setSessionError('');
      setVideoLoading(true);
      const prepared = await window.desktop?.prepareVideo(selected.path, selected);
      if (prepared) {
        setVideo({ path: selected.path, url: prepared.url });
        setFavorites(await window.desktop?.loadFavorites() || []);
        setFavoritesStatus('');
        setVideoError('');
      }
    } catch (error) {
      setVideoError(error instanceof Error ? error.message : 'Could not prepare this video.');
    } finally {
      setVideoLoading(false);
    }
  }

  async function chooseTrack(value: string) {
    setSelectedTrack(value);
    setSubtitleCues([]);
    if (!value || !video || !window.desktop) return;
    setSubtitleLoading(true);
    setSubtitleStatus('');
    try {
      const cues = await window.desktop.extractSubtitle(video.path, Number(value));
      setSubtitleCues(cues);
      setSubtitleStatus(`Subtitle loaded · ${cues.length.toLocaleString('en-US')} lines`);
    } catch {
      setSubtitleStatus('Could not read this subtitle track.');
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
    const currentTime = previewRef.current?.currentTime || 0;
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
  }

  function onGameLoaded() {
    const player = gameVideoRef.current;
    if (!player) return;
    programmaticSeekTargetRef.current = gameStartTime;
    player.currentTime = gameStartTime;
    void player.play().catch(() => setAnswerStatus('Click the video play button to start playback.'));
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

  if (inGame && video?.url) {
    return (
      <main className="app-shell game-shell">
        <header className="topbar">
          <div className="brand-mark">ED</div>
          <div><p className="eyebrow">DICTATION IN PROGRESS</p><h1>English Dictation</h1></div>
          <button className="back-to-setup" onClick={() => setInGame(false)}>Back to settings</button>
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
                  onEnded={() => { setFinished(true); setNextCue(null); replayingPhaseRef.current = false; }}
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
                {activeCue && <button title="Back (Mouse Back button)" onClick={restartPhase}>↶ Back</button>}
                {activeCue && <button title="Skip (Shift+Enter)" onClick={skipPhase}>Skip →</button>}
                <button title="Next phase (no keyboard shortcut)" onClick={goToNextPhase}>Next phase</button>
                {activeCue && !revealed && <button className="reveal-button" title="Show answer (Mouse Forward button)" onClick={revealAnswer}>Show answer</button>}
                {activeCue && <button title="Save or remove this subtitle from favorites" onClick={() => void toggleCurrentFavorite()}>
                  {favorites.some(favorite => favorite.start === activeCue.start && favorite.text === activeCue.text) ? '★ Favorited' : '☆ Favorite'}
                </button>}
                <button className="end-session-button" onClick={() => setInGame(false)}>End session</button>
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
            <button className="dropzone" onClick={() => void chooseVideo()}>
              <span className="upload-icon">↑</span>
              <strong>{video ? 'Video selected' : 'Open a video file'}</strong>
              <span className="file-name">{videoLoading ? 'Preparing video for playback…' : video?.path || 'MKV, MP4, AVI, MOV, and other formats'}</span>
              <span className="browse-button">Browse files</span>
            </button>
            {videoError && <p className="video-error">{videoError}</p>}
            {video?.url && <div className="video-preview-wrap"><video ref={previewRef} className="video-preview" src={video.url} controls /></div>}
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
            {(subtitleStatus || subtitleLoading) && <p className="helper">{subtitleLoading ? 'Reading subtitle lines…' : subtitleStatus}</p>}
            <p className="helper">External .srt subtitles are not supported yet.</p>
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
            <button className="start-button" onClick={startSession} disabled={!video?.url || !selectedTrack || !subtitleCues.length || videoLoading || subtitleLoading}>Continue <span>→</span></button>
            <p className="privacy-note">◆ &nbsp;No video or progress data is sent over the internet.</p>
          </section>
        </div>
      </section>
      <footer><span>ENGLISH DICTATION</span><span>PRACTICE AT YOUR OWN PACE</span></footer>
    </main>
  );
}
