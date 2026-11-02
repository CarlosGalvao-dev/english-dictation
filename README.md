# English Dictation

A local desktop app for practicing English listening and writing with video dialogue and subtitles.

## How it works

1. Open a video from your computer.
2. Select an internal text subtitle track or load an external `.srt` file.
3. Set the interval between exercises, the minimum number of words, and the maximum dialogue length.
4. Click **Continue**. The video plays through an eligible line and pauses at its end; the line stays hidden during the exercise.
5. Type the words into the blanks over the video. Each character has one underline, and typed characters fill those slots. If you type beyond a word's expected length, extra characters carry into the next word. A word turns red as soon as any typed character is wrong; a complete correct word turns green. Letter case and accents are ignored when checking answers. Hyphens and punctuation from the subtitle are preserved.

During a phase, **Back** replays the current line without clearing typed words and restores focus to the last active word field when playback pauses again. **Skip** resumes the video. **Next phase** moves to another eligible line. **Show answer** only reveals the answer. These controls are below the larger video player. The default shortcuts are Mouse Back for Replay line, **Shift+Enter** for Skip exercise, Mouse Forward for Show answer, and no shortcut for Next phase or Toggle favorite. Open **Keyboard shortcuts** from setup or the game to assign a key combination or either mouse side button to each action. The shortcuts are saved on this computer, and the control tooltips show the current assignment. Backspace remains available for normal text editing. Use the arrow keys to move the caret between letters and navigate between word fields. Use the in-player **Fullscreen** button to keep the game overlay and inputs available in fullscreen mode.

When a video needs conversion for playback, a progress bar shows the FFmpeg processing progress. If its duration cannot be read, the bar shows an indeterminate progress animation. **Cancel preparation** stops the conversion while it runs: the partial file is discarded, any previously cached video is kept, and the setup returns to its empty state so you can choose another file.

The app remembers the last selected video, its subtitle source, and each video's playback position on this computer. On the next launch, it reloads the video and subtitle automatically and resumes the preview from its saved position. Playback position is saved while playing, when pausing, and when seeking.

Seeking manually in the video recalculates the next eligible exercise from the new position, using the configured interval. If a phase is already active, it remains active; when you resume or skip it, the next exercise is scheduled from the seek position.

During a phase, click **Favorite** to save its subtitle locally. The favorites panel below the phase controls lists saved lines and **Copy favorites** copies them as newline-separated text. Favorites are tied to the current video and are cleared when its processed cache is overwritten or deleted.

In the session settings, **Fill in the first word** displays the first word as correct and locks it against editing. Subtitles can be visible outside exercises or turned off; the line used in an exercise remains hidden.

## Planned improvement

Returning from **Back to settings** should preserve the current game session, including the video position and active phase, so the player can resume where they left off.


## Run in development

Requirements: Node.js and npm installed on Windows.

```powershell
npm install
npm run dev
```

## Build

```powershell
npm run build
```

Run the unit tests for the playback decisions with `npm test`.

The project uses Electron, React, TypeScript, and Vite. FFmpeg and FFprobe are provided by the `ffmpeg-static` and `ffprobe-static` packages. FFprobe reports the video, audio, and subtitle streams; FFmpeg extracts internal subtitle tracks and prepares media that the built-in player cannot play, always using the cheapest step that works:

- **No conversion** when the container and codecs are already playable.
- **Remux** when only the container is wrong, for example an MKV holding H.264 and AAC: every stream is copied, so it takes seconds and loses nothing.
- **Audio-only conversion** when the video is playable but its audio is not, for example AC-3 or DTS.
- **Full re-encode** only when the video codec itself is unsupported, such as HEVC, MPEG-4 Part 2, or 10-bit H.264.

The app also chooses which audio track to play: it prefers English, skips commentaries, and remuxes a file whose default track is a dub so the chosen track is the one you hear. The prepared video is cached as one file at `.video-cache/processed-video.mp4` (or `.webm` when the source is VP8, VP9, or AV1), in the project folder. Preparation writes to a temporary `.part` file that replaces the cache only after it succeeds, so cancelling or failing never damages the previous cache. Reopening an unchanged source with the same audio track reuses the cache; a different or changed source replaces it. Videos that the player can play directly do not need this cache.

## Privacy and storage

Videos, subtitles, preferences, favorites, and playback positions stay on the computer; there is no database and no media is sent to a remote service. The app stores the last selected video and folder, subtitle source per video, session preferences, keyboard shortcuts, favorite lines, playback position per video, and the source identity for the cache locally in `settings.json` inside Electron's user data directory and restores them when appropriate on the next launch. Favorites are cleared when the associated cache is deleted or replaced. The cache folder is ignored by Git. Typed answers and the active exercise state are not saved.

## Product documentation

See [GAME_SPEC.md](GAME_SPEC.md) for requirements, behavior decisions, and items that are not yet implemented. Update the README and specification when changes affect how the app is used, its behavior, or its architecture.
