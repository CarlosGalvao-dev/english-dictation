# English Dictation Specification

Last updated: 2026-10-13

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
- **Fullscreen**: enter fullscreen through the in-player control so the game overlay and typing fields remain available over the video.
- While a phase is active, its subtitle line stays hidden even when subtitles are set to visible.
- Outside a phase, subtitles can be visible or turned off.
- **Fill in the first word** displays the first word and locks it against editing. It is off by default.
- There is no database and no saved progress.

## Current status and outstanding work

- Implemented: local Electron app with a React/TypeScript interface; video selection; detection and selection of internal text subtitle tracks; video preparation with FFmpeg; session settings; word-by-word exercise fields; phase controls; and the option to fill in the first word.
- Implemented: locally remembers the last selected folder to make choosing another video easier.
- Outstanding: selecting an external `.srt` subtitle file. The interface mentions this option, but the import flow is not implemented yet.
- Current limitation: image-based subtitle tracks (for example, PGS/VobSub) cannot be used as text by the game. A text subtitle track is required.
- No persistence: answers, session settings, and progress are not stored in a database.

## Current architecture

- **Electron**: desktop window, video file picker, local storage for the last selected folder, and FFmpeg/FFprobe integration.
- **React + TypeScript + Vite**: interface, HTML video player, session flow, and answer checking.
- **Static FFmpeg/FFprobe binaries**: stream inspection, extraction of internal subtitles, and video preparation for playback.
- **Local media transport**: temporary local HTTP server with byte-range (Range) support, needed for seeking and playback in the built-in player.
