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

const portuguese: Record<string, string> = {
  Language: 'Idioma', 'English (United States)': 'Inglês (Estados Unidos)', 'Português (Brasil)': 'Português (Brasil)', 'English Dictation': 'Ditado em Inglês', Fullscreen: 'Tela cheia', ' (no shortcut)': ' (sem atalho)',
  'Switch to light appearance': 'Mudar para o tema claro', 'Switch to dark appearance': 'Mudar para o tema escuro', Light: 'Claro', Dark: 'Escuro',
  'PERSONALIZE CONTROLS': 'PERSONALIZE OS CONTROLES', 'Keyboard shortcuts': 'Atalhos do teclado', Back: 'Voltar',
  'Make the controls yours.': 'Personalize os controles.', 'Choose a button, then press the key combination you want to use.': 'Escolha um botão e pressione a combinação de teclas que deseja usar.',
  'Replay line': 'Repetir a fala', 'Start the current subtitle line again.': 'Recomeçar a legenda atual.', 'Skip exercise': 'Pular exercício', 'Resume playback and continue the session.': 'Retomar o vídeo e continuar a sessão.',
  'Next phase': 'Próxima etapa', 'Jump to the next eligible subtitle.': 'Ir para a próxima legenda válida.', 'Show answer': 'Mostrar resposta', 'Reveal the current line without advancing.': 'Revelar a fala atual sem avançar.',
  'Toggle favorite': 'Alternar favorito', 'Save or remove the current line.': 'Salvar ou remover a fala atual.', 'Press keys…': 'Pressione as teclas…', 'Not assigned': 'Não configurado',
  'Click a shortcut, then press a combination with Ctrl, Alt, Shift, or Meta—or press the mouse Back or Forward button. Press Escape to cancel.': 'Clique em um atalho e pressione uma combinação com Ctrl, Alt, Shift ou Meta — ou use os botões voltar/avançar do mouse. Pressione Esc para cancelar.',
  'Restore defaults': 'Restaurar padrão', 'SHORTCUTS ARE SAVED ON THIS COMPUTER': 'ATALHOS SALVOS NESTE COMPUTADOR', 'DICTATION IN PROGRESS': 'DITADO EM ANDAMENTO',
  'Back to settings': 'Voltar às configurações', 'LISTEN CAREFULLY': 'OUÇA COM ATENÇÃO', 'Type the full line': 'Digite a frase completa', 'Video finished': 'Vídeo finalizado', 'Session is playing': 'Sessão em andamento',
  'Fill in the blanks over the video.': 'Preencha os espaços enquanto assiste ao vídeo.', 'You have reached the end of the video.': 'Você chegou ao final do vídeo.', 'The video will pause at the next selected line.': 'O vídeo será pausado na próxima fala selecionada.',
  'Exit fullscreen': 'Sair da tela cheia', 'Enter fullscreen': 'Entrar em tela cheia', 'Favorite subtitles': 'Legendas favoritas', Favorites: 'Favoritos', 'Copy favorites': 'Copiar favoritos',
  'Saved favorite subtitles': 'Legendas favoritas salvas', 'Favorite subtitles from this video will appear here.': 'As legendas favoritas deste vídeo aparecerão aqui.', 'Use the arrow keys to move between letters and words.': 'Use as setas para navegar entre letras e palavras.',
  'Current phase': 'Etapa atual', 'Next pause scheduled': 'Próxima pausa agendada', 'Session ended': 'Sessão encerrada', 'Continuous playback': 'Reprodução contínua', 'PRACTICE AT YOUR OWN PACE': 'PRATIQUE NO SEU RITMO',
  'LOCAL LISTENING PRACTICE': 'PRÁTICA DE COMPREENSÃO LOCAL', 'Your files stay on this computer': 'Seus arquivos ficam neste computador', 'STUDY SESSION': 'SESSÃO DE ESTUDO',
  'Turn any scene into practice.': 'Transforme qualquer cena em exercício.', 'Choose a video and subtitle track to create your dictation exercise.': 'Escolha um vídeo e uma legenda para criar seu exercício de ditado.',
  'Choose a video': 'Escolha um vídeo', 'Select a file from your computer': 'Selecione um arquivo do computador', 'Preparing video…': 'Preparando vídeo…', 'Restoring previous video…': 'Restaurando vídeo anterior…', 'Video selected': 'Vídeo selecionado', 'Open a video file': 'Abrir arquivo de vídeo',
  'Please wait while the last video is loaded.': 'Aguarde enquanto o último vídeo é carregado.', 'MKV, MP4, AVI, MOV, and other formats': 'MKV, MP4, AVI, MOV e outros formatos', 'Browse files': 'Procurar arquivos', 'Preparing video': 'Preparando vídeo', 'Estimating conversion time…': 'Estimando o tempo de conversão…', 'complete': 'concluído', 'The video is being optimized for smooth playback.': 'O vídeo está sendo otimizado para uma reprodução fluida.',
  'Playback will resume from': 'A reprodução será retomada em', 'Subtitle track': 'Faixa de legenda', 'Text subtitles found in the video': 'Legendas de texto encontradas no vídeo', 'Choose a subtitle track': 'Escolha uma faixa de legenda', 'Internal tracks': 'Faixas internas', 'Waiting for a video': 'Aguardando um vídeo', 'Internal subtitle tracks will appear here': 'As faixas de legenda internas aparecerão aqui',
  'Loading subtitles…': 'Carregando legendas…', 'Choose another .srt file': 'Escolher outro arquivo .srt', 'Choose external .srt': 'Escolher arquivo .srt externo', 'Reading subtitle lines…': 'Lendo as linhas da legenda…',
  'Configure your session': 'Configure sua sessão', 'Adjust the pace of the exercise': 'Ajuste o ritmo do exercício', 'Pause for an exercise every': 'Pausar para um exercício a cada', seconds: 'segundos',
  'The video pauses at an eligible line after this interval.': 'O vídeo pausa em uma fala válida após esse intervalo.', 'Minimum words per line': 'Mínimo de palavras por fala', words: 'palavras', 'Maximum line length': 'Tamanho máximo da fala', characters: 'caracteres',
  'Fill in the first word': 'Preencher a primeira palavra', 'The word is shown as correct and cannot be edited.': 'A palavra aparece como correta e não pode ser editada.', 'Subtitles outside exercises': 'Legendas fora dos exercícios', 'They stay hidden during a phase': 'Elas ficam ocultas durante cada etapa', Visible: 'Visíveis', Off: 'Desativadas', Continue: 'Continuar', 'No video or progress data is sent over the internet.': 'Nenhum vídeo ou dado de progresso é enviado pela internet.',
  'ENGLISH DICTATION': 'DITADO EM INGLÊS', 'Add Ctrl, Alt, Shift, or Meta so the shortcut does not interrupt typing.': 'Adicione Ctrl, Alt, Shift ou Meta para que o atalho não interrompa a digitação.', 'That shortcut is already assigned. Choose another key combination.': 'Esse atalho já está configurado. Escolha outra combinação de teclas.',
  'Could not change fullscreen mode.': 'Não foi possível alterar o modo de tela cheia.', 'The app is still running an old version. Close all game windows and restart it with npm run dev.': 'O aplicativo ainda está em uma versão antiga. Feche todas as janelas do jogo e reinicie com npm run dev.', 'No subtitle tracks were found in this video.': 'Nenhuma faixa de legenda foi encontrada neste vídeo.',
  'Could not restore the previous video.': 'Não foi possível restaurar o vídeo anterior.', 'Favorites cleared because the video cache was deleted.': 'Os favoritos foram apagados porque o cache de vídeos foi excluído.', 'Could not prepare this video.': 'Não foi possível preparar este vídeo.', 'Could not open this video.': 'Não foi possível abrir este vídeo.',
  'This video has subtitle tracks, but they are not text-based:': 'Este vídeo tem faixas de legenda, mas elas não são de texto:', 'text subtitle track(s) found.': 'faixa(s) de legenda de texto encontrada(s).', 'Subtitle loaded': 'Legenda carregada', lines: 'linhas', 'Could not read this subtitle track.': 'Não foi possível ler esta faixa de legenda.',
  'Could not read this subtitle file.': 'Não foi possível ler este arquivo de legenda.', 'External subtitle loaded': 'Legenda externa carregada', 'Favorites copied to clipboard.': 'Favoritos copiados para a área de transferência.', 'Could not copy favorites.': 'Não foi possível copiar os favoritos.', 'Save or remove this subtitle': 'Salvar ou remover esta legenda',
  'There are no lines matching these criteria after the current video position. Lower the minimum word count or maximum length, or rewind the video.': 'Não há falas que atendam a esses critérios após a posição atual do vídeo. Reduza o mínimo de palavras ou o tamanho máximo, ou volte o vídeo.',
  'Click the video play button to start playback.': 'Clique em reproduzir no vídeo para iniciar.', 'There are no more eligible lines in this video.': 'Não há mais falas válidas neste vídeo.', 'Skip →': 'Pular →', 'End session': 'Encerrar sessão', 'Favorited': 'Favoritado', 'Favorite': 'Favoritar',
  'Shortcuts saved on this computer': 'Atalhos salvos neste computador',
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
  const [language, setLanguage] = useState<'en-US' | 'pt-BR'>(() => {
    try {
      return window.localStorage.getItem('english-dictation-language') === 'pt-BR' ? 'pt-BR' : 'en-US';
    } catch {
      return 'en-US';
    }
  });
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const tr = (text: string) => {
    if (language !== 'pt-BR') return text;
    if (portuguese[text]) return portuguese[text];
    let match = text.match(/^(\d+) text subtitle track\(s\) found\.$/);
    if (match) return `${match[1]} faixa(s) de legenda de texto encontrada(s).`;
    match = text.match(/^(Subtitle loaded|External subtitle loaded) · (.+) lines$/);
    if (match) return `${match[1] === 'Subtitle loaded' ? 'Legenda carregada' : 'Legenda externa carregada'} · ${match[2]} linhas`;
    match = text.match(/^This video has subtitle tracks, but they are not text-based: (.+)\.$/);
    if (match) return `Este vídeo tem faixas de legenda, mas elas não são de texto: ${match[1]}.`;
    return text;
  };
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return window.localStorage.getItem('english-dictation-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem('english-dictation-theme', theme); } catch { /* Theme remains active for this session. */ }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    try { window.localStorage.setItem('english-dictation-language', language); } catch { /* Language remains active for this session. */ }
  }, [language]);

  function languageControl() {
    const languageName = language === 'en-US' ? 'English (United States)' : 'Português (Brasil)';
    return <div className="language-control">
      <button className="language-button" type="button" aria-label={tr('Language')} title={languageName} aria-expanded={showLanguageMenu} onClick={() => setShowLanguageMenu(open => !open)}>
        <span aria-hidden="true">{language === 'en-US' ? '🇺🇸' : '🇧🇷'}</span><span className="language-chevron" aria-hidden="true">⌄</span>
      </button>
      {showLanguageMenu && <div className="language-menu" role="menu" aria-label={tr('Language')}>
        <button type="button" role="menuitemradio" aria-checked={language === 'en-US'} onClick={() => { setLanguage('en-US'); setShowLanguageMenu(false); }}><span>🇺🇸</span> English (United States)</button>
        <button type="button" role="menuitemradio" aria-checked={language === 'pt-BR'} onClick={() => { setLanguage('pt-BR'); setShowLanguageMenu(false); }}><span>🇧🇷</span> Português (Brasil)</button>
      </div>}
    </div>;
  }

  function themeControl() {
    return <button
      className="theme-toggle"
      type="button"
      onClick={() => setTheme(current => current === 'dark' ? 'light' : 'dark')}
      aria-label={tr(`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`)}
      title={tr(`Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`)}
    ><span aria-hidden="true">{theme === 'dark' ? '☼' : '☾'}</span><span>{tr(theme === 'dark' ? 'Light' : 'Dark')}</span></button>;
  }

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
          aria-label={`${language === 'pt-BR' ? 'Palavra' : 'Word'} ${thisIndex + 1}`}
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

  function renderPhaseActions(className = '') {
    return <div className={`phase-actions ${className}`}>
      {activeCue && <button title={`${tr('Replay line')}${keyboardShortcuts.restart ? ` (${formatShortcut(keyboardShortcuts.restart)})` : tr(' (no shortcut)')}`} onClick={restartPhase}>↶ {tr('Back')}</button>}
      {activeCue && <button title={`${tr('Skip exercise')}${keyboardShortcuts.skip ? ` (${formatShortcut(keyboardShortcuts.skip)})` : ''}`} onClick={skipPhase}>{tr('Skip →')}</button>}
      <button title={`${tr('Next phase')}${keyboardShortcuts.next ? ` (${formatShortcut(keyboardShortcuts.next)})` : ''}`} onClick={goToNextPhase}>{tr('Next phase')}</button>
      {activeCue && !revealed && <button className="reveal-button" title={`${tr('Show answer')}${keyboardShortcuts.reveal ? ` (${formatShortcut(keyboardShortcuts.reveal)})` : tr(' (no shortcut)')}`} onClick={revealAnswer}>{tr('Show answer')}</button>}
      {activeCue && <button title={`${tr('Save or remove this subtitle')}${keyboardShortcuts.favorite ? ` (${formatShortcut(keyboardShortcuts.favorite)})` : ''}`} onClick={() => void toggleCurrentFavorite()}>
        {favorites.some(favorite => favorite.start === activeCue.start && favorite.text === activeCue.text) ? `★ ${tr('Favorited')}` : `☆ ${tr('Favorite')}`}
      </button>}
      <button className="end-session-button" onClick={() => { if (gameVideoRef.current) savePlaybackPosition(gameVideoRef.current.currentTime, true); setInGame(false); }}>{tr('End session')}</button>
    </div>;
  }

  if (showShortcutSettings) {
    const shortcutRows: Array<{ action: ShortcutAction; label: string; description: string }> = [
      { action: 'restart', label: tr('Replay line'), description: tr('Start the current subtitle line again.') },
      { action: 'skip', label: tr('Skip exercise'), description: tr('Resume playback and continue the session.') },
      { action: 'next', label: tr('Next phase'), description: tr('Jump to the next eligible subtitle.') },
      { action: 'reveal', label: tr('Show answer'), description: tr('Reveal the current line without advancing.') },
      { action: 'favorite', label: tr('Toggle favorite'), description: tr('Save or remove the current line.') },
    ];
    return (
      <main className="app-shell shortcuts-shell" data-theme={theme}>
        <header className="topbar">
          <div className="brand-mark">ED</div>
          <div><p className="eyebrow">{tr('PERSONALIZE CONTROLS')}</p><h1>{tr('Keyboard shortcuts')}</h1></div>
          <button className="back-to-setup" onClick={() => { setShowShortcutSettings(false); setCapturingShortcut(null); }}>{tr('Back')}</button>
          {languageControl()}
          {themeControl()}
        </header>
        <section className="shortcut-workspace">
          <div className="shortcut-intro"><h2>{tr('Make the controls yours.')}</h2><p className="muted">{tr('Choose a button, then press the key combination you want to use.')}</p></div>
          <section className="card shortcut-card">
            {shortcutRows.map(row => (
              <div className="shortcut-row" key={row.action}>
                <div><strong>{row.label}</strong><p>{row.description}</p></div>
                <button className={`shortcut-key ${capturingShortcut === row.action ? 'listening' : ''}`} onClick={() => { setCapturingShortcut(row.action); setShortcutError(''); }} onKeyDown={event => capturingShortcut === row.action && captureShortcut(row.action, event)}>
                  {capturingShortcut === row.action ? tr('Press keys…') : keyboardShortcuts[row.action] ? formatShortcut(keyboardShortcuts[row.action]) : tr('Not assigned')}
                </button>
              </div>
            ))}
            <p className="helper">{tr('Click a shortcut, then press a combination with Ctrl, Alt, Shift, or Meta—or press the mouse Back or Forward button. Press Escape to cancel.')}</p>
            {shortcutError && <p className="video-error">{tr(shortcutError)}</p>}
            <button className="reset-shortcuts" onClick={() => { setKeyboardShortcuts(defaultShortcuts); setShortcutError(''); setCapturingShortcut(null); }}>{tr('Restore defaults')}</button>
          </section>
        </section>
        <footer><span>{tr('ENGLISH DICTATION')}</span><span>{tr('SHORTCUTS ARE SAVED ON THIS COMPUTER')}</span></footer>
      </main>
    );
  }

  if (inGame && video?.url) {
    return (
      <main className="app-shell game-shell" data-theme={theme}>
        <header className="topbar">
          <div className="brand-mark">ED</div>
          <div><p className="eyebrow">{tr('DICTATION IN PROGRESS')}</p><h1>{tr('English Dictation')}</h1></div>
          <button className="back-to-setup shortcut-open-button" onClick={() => setShowShortcutSettings(true)}>{tr('Keyboard shortcuts')}</button>
          <button className="back-to-setup" onClick={() => { if (gameVideoRef.current) savePlaybackPosition(gameVideoRef.current.currentTime, true); setInGame(false); }}>{tr('Back to settings')}</button>
          {languageControl()}
          {themeControl()}
        </header>
        <section className="game-workspace">
          <div className="game-heading">
            <p className="eyebrow">{tr('LISTEN CAREFULLY')}</p>
            <h2>{tr(activeCue ? 'Type the full line' : finished ? 'Video finished' : 'Session is playing')}</h2>
            <p className="muted">{tr(activeCue ? 'Fill in the blanks over the video.' : finished ? 'You have reached the end of the video.' : 'The video will pause at the next selected line.')}</p>
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
                {renderPhaseActions('fullscreen-phase-actions')}
                <button className="fullscreen-button" onClick={() => void toggleVideoFullscreen()} aria-label={tr(isVideoFullscreen ? 'Exit fullscreen' : 'Enter fullscreen')}>
                  {isVideoFullscreen ? `⛶ ${tr('Exit fullscreen')}` : `⛶ ${tr('Fullscreen')}`}
                </button>
                {activeCue && <div className={`subtitle-overlay ${revealed ? 'revealed-overlay' : 'input-overlay'}`}>
                  {revealed ? activeCue.text : renderWordInputs(activeCue)}
                </div>}
                {!activeCue && subtitleMode === 'outside' && currentCaption && <div className="subtitle-overlay normal-caption">{currentCaption}</div>}
              </div>
              {renderPhaseActions()}
              <section className="favorites-panel" aria-label={tr('Favorite subtitles')}>
                <div className="favorites-heading"><strong>{tr('Favorites')} ({favorites.length})</strong><button onClick={() => void copyFavorites()} disabled={!favorites.length}>{tr('Copy favorites')}</button></div>
                <textarea
                  className="favorites-textarea"
                  aria-label={tr('Saved favorite subtitles')}
                  value={favorites.map(favorite => favorite.text).join('\n')}
                  placeholder={tr('Favorite subtitles from this video will appear here.')}
                  readOnly
                />
                {favoritesStatus && <p className="game-hint">{tr(favoritesStatus)}</p>}
              </section>
              {activeCue && !revealed && <p className="game-hint">{tr('Use the arrow keys to move between letters and words.')}</p>}
              {answerStatus && <p className="answer-feedback">{tr(answerStatus)}</p>}
              {!activeCue && sessionError && <p className="video-error">{tr(sessionError)}</p>}
              <div className="game-transport">
                <span>{tr(activeCue ? 'Current phase' : nextCue ? 'Next pause scheduled' : finished ? 'Session ended' : 'Continuous playback')}</span>
              </div>
            </section>
          </div>
        </section>
        <footer><span>{tr('ENGLISH DICTATION')}</span><span>{tr('PRACTICE AT YOUR OWN PACE')}</span></footer>
      </main>
    );
  }

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="brand-mark">ED</div>
        <div><p className="eyebrow">{tr('LOCAL LISTENING PRACTICE')}</p><h1>{tr('English Dictation')}</h1></div>
        <button className="back-to-setup shortcut-open-button" onClick={() => setShowShortcutSettings(true)}>{tr('Keyboard shortcuts')}</button>
        <span className="local-badge"><i /> {tr('Your files stay on this computer')}</span>
        {languageControl()}
        {themeControl()}
      </header>
      <section className="workspace">
        <div className="intro">
          <div><p className="eyebrow">{tr('STUDY SESSION')}</p><h2>{tr('Turn any scene into practice.')}</h2><p className="muted">{tr('Choose a video and subtitle track to create your dictation exercise.')}</p></div>
          <div className="step-indicator"><span>01</span><b />02<b />03</div>
        </div>
        <div className="columns">
          <section className="card media-card">
            <div className="card-heading"><div className="number">01</div><div><h3>{tr('Choose a video')}</h3><p>{tr('Select a file from your computer')}</p></div></div>
            <button className="dropzone" onClick={() => void chooseVideo()} disabled={videoLoading}>
              <span className="upload-icon">↑</span>
              <strong>{tr(videoLoading ? (video ? 'Preparing video…' : 'Restoring previous video…') : video ? 'Video selected' : 'Open a video file')}</strong>
              <span className="file-name">{videoLoading ? tr('Please wait while the last video is loaded.') : video?.path || tr('MKV, MP4, AVI, MOV, and other formats')}</span>
              <span className="browse-button">{tr('Browse files')}</span>
            </button>
            {videoLoading && <div className="processing-panel" role="status" aria-live="polite">
              <div className="processing-copy"><strong>{tr('Preparing video')}</strong><span>{videoProgress === null ? tr('Estimating conversion time…') : `${Math.round(videoProgress)}% ${tr('complete')}`}</span></div>
              <div className="processing-track"><div className={videoProgress === null ? 'processing-fill indeterminate' : 'processing-fill'} style={videoProgress === null ? undefined : { width: `${Math.max(3, videoProgress)}%` }} /></div>
              <small>{tr('The video is being optimized for smooth playback.')}</small>
            </div>}
            {videoError && <p className="video-error">{tr(videoError)}</p>}
            {video?.url && <div className="video-preview-wrap">
              <video ref={previewRef} className="video-preview" src={video.url} controls onLoadedMetadata={restorePreviewPosition} onTimeUpdate={() => { if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime); }} onSeeked={() => { if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime, true); }} onPause={() => { if (previewRef.current) savePlaybackPosition(previewRef.current.currentTime, true); }} />
              {resumePosition > 0 && <p className="helper resume-note">{tr('Playback will resume from')} {formatVideoTime(resumePosition)}.</p>}
            </div>}
            <div className="card-heading subtitle-heading"><div className="number">02</div><div><h3>{tr('Subtitle track')}</h3><p>{tr('Text subtitles found in the video')}</p></div></div>
            <div className="track-placeholder">
              <span className="caption-icon">CC</span>
              {tracks.length > 0 ? (
                <select className="track-select" value={selectedTrack} onChange={event => void chooseTrack(event.target.value)}>
                  <option value="">{tr('Choose a subtitle track')}</option>
                  {tracks.map(track => <option value={track.index} key={track.index}>{track.label}</option>)}
                </select>
              ) : <div><strong>{tr(video ? 'Internal tracks' : 'Waiting for a video')}</strong><span>{tr(subtitleStatus)}</span></div>}
              <span className="chevron">⌄</span>
            </div>
            <div className="external-subtitle-control">
              <button onClick={() => void chooseExternalSubtitle()} disabled={subtitleLoading || !video}>{tr(subtitleLoading ? 'Loading subtitles…' : externalSubtitleName ? 'Choose another .srt file' : 'Choose external .srt')}</button>
              {externalSubtitleName && <span className="external-subtitle-name" title={externalSubtitleName}>{externalSubtitleName}</span>}
            </div>
            {(subtitleStatus || subtitleLoading) && <p className="helper">{subtitleLoading ? tr('Reading subtitle lines…') : tr(subtitleStatus)}</p>}
          </section>
          <section className="card settings-card">
            <div className="card-heading"><div className="number">03</div><div><h3>{tr('Configure your session')}</h3><p>{tr('Adjust the pace of the exercise')}</p></div></div>
            <label className="field-label" htmlFor="interval">{tr('Pause for an exercise every')}</label>
            <div className="input-with-unit"><input id="interval" type="number" min="1" value={interval} onChange={event => setInterval(Number(event.target.value))} /><span>{tr('seconds')}</span></div>
            <p className="helper">{tr('The video pauses at an eligible line after this interval.')}</p>
            <label className="field-label spaced" htmlFor="minimum">{tr('Minimum words per line')}</label>
            <div className="input-with-unit"><input id="minimum" type="number" min="1" value={minimumWords} onChange={event => setMinimumWords(Number(event.target.value))} /><span>{tr('words')}</span></div>
            <label className="field-label spaced" htmlFor="length">{tr('Maximum line length')}</label>
            <div className="input-with-unit"><input id="length" type="number" min="20" value={maxCharacters} onChange={event => setMaxCharacters(Number(event.target.value))} /><span>{tr('characters')}</span></div>
            <label className="prefill-setting"><input type="checkbox" checked={prefillFirstWord} onChange={event => setPrefillFirstWord(event.target.checked)} /><span><strong>{tr('Fill in the first word')}</strong><small>{tr('The word is shown as correct and cannot be edited.')}</small></span></label>
            <div className="subtitles-setting"><div><strong>{tr('Subtitles outside exercises')}</strong><span>{tr('They stay hidden during a phase')}</span></div><div className="segmented"><button className={subtitleMode === 'outside' ? 'active' : ''} onClick={() => setSubtitleMode('outside')}>{tr('Visible')}</button><button className={subtitleMode === 'off' ? 'active' : ''} onClick={() => setSubtitleMode('off')}>{tr('Off')}</button></div></div>
            {sessionError && <p className="video-error">{tr(sessionError)}</p>}
            <button className="start-button" onClick={startSession} disabled={!video?.url || (!selectedTrack && !externalSubtitleName) || !subtitleCues.length || videoLoading || subtitleLoading}>{tr('Continue')} <span>→</span></button>
            <p className="privacy-note">◆ &nbsp;{tr('No video or progress data is sent over the internet.')}</p>
          </section>
        </div>
      </section>
      <footer><span>{tr('ENGLISH DICTATION')}</span><span>{tr('PRACTICE AT YOUR OWN PACE')}</span></footer>
    </main>
  );
}
