# English Dictation

A local desktop app for practicing English listening and writing with video dialogue and subtitles.

## How it works

1. Open a video from your computer.
2. Select an internal text subtitle track.
3. Set the interval between exercises, the minimum number of words, and the maximum dialogue length.
4. Click **Continue**. The video plays through an eligible line and pauses at its end; the line stays hidden during the exercise.
5. Type the words into the blanks over the video. Each character has one underline, and typed characters fill those slots. If you type beyond a word's expected length, extra characters carry into the next word. A word turns red as soon as any typed character is wrong; a complete correct word turns green. Letter case and accents are ignored when checking answers. Hyphens and punctuation from the subtitle are preserved.

During a phase, **Back** replays the current line without clearing typed words and restores focus to the last active word field when playback pauses again. Other phase actions preserve that field position for when the exercise inputs return. **Skip** resumes the video. **Next phase** moves to another eligible line. **Show answer** only reveals the answer. Use the in-player **Fullscreen** button to keep the game overlay and inputs available in fullscreen mode.

In the session settings, **Fill in the first word** displays the first word as correct and locks it against editing. Subtitles can be visible outside exercises or turned off; the line used in an exercise remains hidden.

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

The project uses Electron, React, TypeScript, and Vite. FFmpeg and FFprobe are provided by the `ffmpeg-static` and `ffprobe-static` packages. FFmpeg prepares video formats that the built-in player cannot play directly and extracts internal subtitle tracks.

## Privacy and storage

Videos, subtitles, and progress stay on the computer; there is no database and no media is sent to a remote service. The app stores only the last selected video folder locally in `settings.json` inside Electron's user data directory. Temporary playback files are removed when the app closes.

## Product documentation

See [GAME_SPEC.md](GAME_SPEC.md) for requirements, behavior decisions, and items that are not yet implemented. Update the README and specification when changes affect how the app is used, its behavior, or its architecture.
