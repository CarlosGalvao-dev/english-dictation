# English Dictation Specification

Last updated: 2026-10-15

This document records the requested game behavior and distinguishes implemented features from outstanding work. Update this specification and `README.md` when a change affects requirements, behavior, or usage instructions.

The application interface and project documentation are maintained in English.

## Goal

Practice English dictation with dialogue synchronized to subtitles in local videos. The player listens to a line and writes what the character just said, without seeing the subtitle during the phase.

## Session flow

1. The player chooses a video and a subtitle track.
2. The player sets the interval between exercises, the minimum number of words, and the maximum line length.
3. The video plays through the next eligible line and pauses at its end.
4. Word blanks appear over the video, preserving punctuation and hyphens from the line. Each character has one underline; entered characters fill the corresponding slots. Characters beyond a word's expected length carry into the next word.
5. Answer checking ignores letter case, accents, and special characters. As soon as a typed character is wrong at its position, the whole word turns red. A complete correct word turns green.

## Controls and rules

- **Back**: replays the current line from its beginning and pauses again at its end. It does not clear already typed words.
- **Skip**: ends the current exercise and resumes the video from its current position.
- **Next phase**: explicitly moves to a following eligible line.
- **Show answer**: reveals the answer without resuming the video or advancing the phase.
- **Focus retention**: phase actions remember the last active word field and restore it when the exercise inputs return. Replaying the line keeps all typed words.
- **Keyboard navigation**: left/right arrows move the caret between letters and cross word-field boundaries; up/down arrows move to the adjacent word while keeping the closest caret position.
- **Mouse and keyboard shortcuts**: the mouse Back side button replays the current line, the mouse Forward side button reveals the answer, and Shift+Enter skips it. Backspace remains available for normal text editing. Next phase has no shortcut. Tooltips on the controls display their shortcuts.
- **Manual seeking**: seeking to another point in the video recalculates the next eligible phase from that position, applying the configured interval. If a phase is active, it stays active; when the player resumes or skips it, the next phase is scheduled from the seek position.
- **Favorites**: save the active phase's subtitle locally. A panel below the phase controls lists saved lines and copies them as newline-separated text. Favorites are tied to the current source and are cleared when its processed cache is deleted or overwritten.
- **Game layout**: the video uses the available game width, with phase controls below it. The separate dictation instruction panel is removed; answer blanks and revealed answers remain over the video.
- **Fullscreen**: enter fullscreen through the in-player control so the game overlay and typing fields remain available over the video.
- While a phase is active, its subtitle line stays hidden even when subtitles are set to visible.
- Outside a phase, subtitles can be visible or turned off.
- **Fill in the first word** displays the first word and locks it against editing. It is off by default.
- Session preferences (interval, minimum word count, maximum line length, first-word prefill, and subtitle visibility), favorite lines, and cache identity are stored locally in Electron's `settings.json`; there is no database and answers or game progress are not saved.

## Current status and outstanding work

- Implemented: local Electron app with a React/TypeScript interface; video selection; detection and selection of internal text subtitle tracks; video preparation with FFmpeg; session settings; word-by-word exercise fields; phase controls below the enlarged player; arrow-key navigation; mouse side-button and keyboard shortcuts with button tooltips; seek-aware phase scheduling; and the option to fill in the first word.
- Implemented: session preferences are saved locally in `settings.json` and restored when the app starts.
- Implemented: locally remembers the last selected folder to make choosing another video easier.
- Implemented: keeps one processed playback video at `.video-cache/processed-video.mp4` in the project folder. Reopening an unchanged source reuses that file; processing a different or modified source overwrites it. The cache is ignored by Git.
- Implemented: favorites save the active subtitle locally, can be copied from the panel below the controls, and are cleared when the associated processed cache is deleted or overwritten.
- Planned improvement: returning to the game from **Back to settings** should restore the existing session at the same video position and phase, preserving the in-progress game state instead of starting over.
- Outstanding: selecting an external `.srt` subtitle file. The interface mentions this option, but the import flow is not implemented yet.
- Current limitation: image-based subtitle tracks (for example, PGS/VobSub) cannot be used as text by the game. A text subtitle track is required.
- No database: preferences, favorites, and the last video folder are stored locally; answers and game progress are not persisted.

## Current architecture

- **Electron**: desktop window, video file picker, local `settings.json` storage for the last selected folder, session preferences, and processed-cache identity; one persistent converted video in the project's ignored `.video-cache` folder; and FFmpeg/FFprobe integration.
- **React + TypeScript + Vite**: interface, HTML video player, session flow, and answer checking.
- **Static FFmpeg/FFprobe binaries**: stream inspection, extraction of internal subtitles, and video preparation for playback.
- **Local media transport**: temporary local HTTP server with byte-range (Range) support, needed for seeking and playback in the built-in player.
