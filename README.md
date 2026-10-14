# English Dictation

A local desktop app for practicing English listening and writing with video dialogue and subtitles.

## How it works

1. Open a video from your computer.
2. Select an internal text subtitle track.
3. Set the interval between exercises, the minimum number of words, and the maximum dialogue length.
4. Click **Continue**. The video plays through an eligible line and pauses at its end; the line stays hidden during the exercise.
5. Type the words into the blanks over the video. Each character has one underline, and typed characters fill those slots. If you type beyond a word's expected length, extra characters carry into the next word. A word turns red as soon as any typed character is wrong; a complete correct word turns green. Letter case and accents are ignored when checking answers. Hyphens and punctuation from the subtitle are preserved.

During a phase, **Back** replays the current line without clearing typed words and restores focus to the last active word field when playback pauses again. **Skip** resumes the video. **Next phase** moves to another eligible line. **Show answer** only reveals the answer. These controls are below the larger video player. Use the mouse **Back** side button to replay the line, **Shift+Enter** to skip it, and the mouse **Forward** side button to show the answer. Tooltips show these shortcuts; Next phase has no shortcut. Backspace remains available for normal text editing. Use the arrow keys to move the caret between letters and navigate between word fields. Use the in-player **Fullscreen** button to keep the game overlay and inputs available in fullscreen mode.

Seeking manually in the video recalculates the next eligible exercise from the new position, using the configured interval. If a phase is already active, it remains active; when you resume or skip it, the next exercise is scheduled from the seek position.

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

The project uses Electron, React, TypeScript, and Vite. FFmpeg and FFprobe are provided by the `ffmpeg-static` and `ffprobe-static` packages. FFmpeg prepares video formats that the built-in player cannot play directly and extracts internal subtitle tracks. The latest converted video is cached as one file at `.video-cache/processed-video.mp4` in the project folder. Reopening an unchanged source reuses it; processing a different or changed source overwrites it. Videos that the player can play directly do not need this cache.

## Privacy and storage

Videos, subtitles, preferences, and progress stay on the computer; there is no database and no media is sent to a remote service. The app stores the last selected video folder, session preferences, and the source identity for the cache locally in `settings.json` inside Electron's user data directory and restores those preferences on the next launch. The cache folder is ignored by Git. Answers and progress are not saved.

## Product documentation

See [GAME_SPEC.md](GAME_SPEC.md) for requirements, behavior decisions, and items that are not yet implemented. Update the README and specification when changes affect how the app is used, its behavior, or its architecture.
