'use strict';

// Decides how a source video can reach the built-in player (Chromium/Electron).
//
// Chromium understands the MP4/MOV and WebM containers, decodes H.264 at 8-bit
// 4:2:0, VP8, VP9 and AV1, and plays AAC, MP3, Opus and Vorbis audio. Anything
// else has to change before playback. The cheapest fix wins:
//
//   direct  - the file already plays as it is
//   remux   - only the container is wrong: copy every stream, seconds, no loss
//   audio   - the video is fine, only its audio has to be re-encoded
//   encode  - the video codec itself is unsupported, so re-encode it
//
// This module has no Electron or Node dependencies so it can be unit tested
// with plain `node --test`.

const MP4_EXTENSIONS = new Set(['.mp4', '.m4v', '.mov']);
const WEBM_EXTENSIONS = new Set(['.webm']);

const H264_PIXEL_FORMATS = new Set(['yuv420p', 'yuvj420p']);
const MODERN_VIDEO_CODECS = new Set(['vp8', 'vp9', 'av1']);
const MP4_VIDEO_CODECS = new Set(['h264', 'vp9', 'av1']);
const WEBM_VIDEO_CODECS = new Set(['vp8', 'vp9', 'av1']);
const MP4_AUDIO_CODECS = new Set(['aac', 'mp3']);
const WEBM_AUDIO_CODECS = new Set(['opus', 'vorbis']);

const LANGUAGE_NAMES = {
  eng: 'English', en: 'English', por: 'Portuguese', pt: 'Portuguese', spa: 'Spanish', es: 'Spanish',
  fra: 'French', fre: 'French', fr: 'French', deu: 'German', ger: 'German', de: 'German',
  ita: 'Italian', it: 'Italian', jpn: 'Japanese', ja: 'Japanese', kor: 'Korean', ko: 'Korean',
  zho: 'Chinese', chi: 'Chinese', zh: 'Chinese', rus: 'Russian', ru: 'Russian',
  nld: 'Dutch', dut: 'Dutch', pol: 'Polish', tur: 'Turkish', ara: 'Arabic', hin: 'Hindi',
};

// Commentaries and audio descriptions are the wrong thing to dictate, but the
// language still wins: an English commentary beats a Portuguese dub for practice.
const DISTRACTING_TITLES = /commentary|coment[aá]rio|descriptive|descri[cç][aã]o|narration|audiobook/i;

function normalizeCodec(value) {
  return String(value || '').trim().toLowerCase();
}

function languageName(code) {
  const key = String(code || '').trim().toLowerCase();
  return LANGUAGE_NAMES[key] || (key && key !== 'und' ? String(code) : 'Unknown language');
}

function isEnglish(language) {
  const key = String(language || '').trim().toLowerCase();
  return key === 'eng' || key === 'en' || key.startsWith('en-') || key.startsWith('en_');
}

function isVideoNative(codec, pixelFormat) {
  const name = normalizeCodec(codec);
  if (name === 'h264') return H264_PIXEL_FORMATS.has(normalizeCodec(pixelFormat));
  return MODERN_VIDEO_CODECS.has(name);
}

// Language dominates: a Portuguese dub is useless for English practice even when
// the English track is only a commentary. The title then breaks ties.
function audioRank(track) {
  let language = 20;
  if (isEnglish(track?.language)) language = 0;
  else if (!track?.language || normalizeCodec(track.language) === 'und') language = 10;
  const distracting = DISTRACTING_TITLES.test(String(track?.title || '')) ? 1 : 0;
  return language + distracting;
}

// Prefers the original English track, then an untagged one, then whatever comes
// first. Sorting is stable, so equal ranks keep the file's stream order.
function pickAudioTrack(audioTracks) {
  if (!Array.isArray(audioTracks) || audioTracks.length === 0) return null;
  const ranked = audioTracks
    .map((track, position) => ({ track, position, rank: audioRank(track) }))
    .sort((left, right) => left.rank - right.rank || left.position - right.position);
  return ranked[0].track;
}

function containerOf(extension) {
  const value = String(extension || '').trim().toLowerCase();
  if (MP4_EXTENSIONS.has(value)) return 'mp4';
  if (WEBM_EXTENSIONS.has(value)) return 'webm';
  return null;
}

function codecFitsContainer(container, videoCodec, audioCodec) {
  const videos = container === 'mp4' ? MP4_VIDEO_CODECS : WEBM_VIDEO_CODECS;
  const audios = container === 'mp4' ? MP4_AUDIO_CODECS : WEBM_AUDIO_CODECS;
  return videos.has(videoCodec) && (!audioCodec || audios.has(audioCodec));
}

// Chromium plays the container's default audio track, so a file is only "direct"
// when that is already the track we want. Otherwise a remux makes the choice real.
function playerAudioIndex(audioTracks) {
  const tracks = Array.isArray(audioTracks) ? audioTracks : [];
  const chosen = tracks.find(track => track.default === true) || tracks[0];
  return chosen && Number.isInteger(chosen.index) ? chosen.index : null;
}

function planPlayback({ extension, videoCodec, pixelFormat, audioTracks, videoIndex } = {}) {
  const codec = normalizeCodec(videoCodec);
  const audio = pickAudioTrack(audioTracks);
  const audioCodec = audio ? normalizeCodec(audio.codec) : '';
  const container = containerOf(extension);
  const videoNative = isVideoNative(codec, pixelFormat);
  const playsRequestedAudio = audio === null || audio.index === playerAudioIndex(audioTracks);
  const shared = {
    videoCodec: codec || null,
    pixelFormat: normalizeCodec(pixelFormat) || null,
    videoIndex: Number.isInteger(videoIndex) ? videoIndex : null,
    audioIndex: audio && Number.isInteger(audio.index) ? audio.index : null,
    audioCodec: audioCodec || null,
    audioLanguage: audio ? String(audio.language || '') : '',
    audioTitle: audio ? String(audio.title || '') : '',
  };

  if (container && videoNative && playsRequestedAudio && codecFitsContainer(container, codec, audioCodec)) {
    return { ...shared, mode: 'direct', target: container };
  }

  if (videoNative) {
    const remuxTarget = ['mp4', 'webm'].find(target => codecFitsContainer(target, codec, audioCodec));
    if (remuxTarget) return { ...shared, mode: 'remux', target: remuxTarget };

    // The video stream is playable but no native container accepts the audio.
    const target = MP4_VIDEO_CODECS.has(codec) ? 'mp4' : 'webm';
    return { ...shared, mode: 'audio', target, audioEncoder: target === 'mp4' ? 'aac' : 'libopus' };
  }

  return { ...shared, mode: 'encode', target: 'mp4' };
}

// Output arguments for FFmpeg. `-progress pipe:1` keeps the existing progress
// bar working for every mode, including fast remuxes.
function buildFfmpegArgs(plan, inputPath, outputPath) {
  const args = ['-y', '-v', 'error', '-i', inputPath, '-map'];
  args.push(plan.videoIndex === null || plan.videoIndex === undefined ? '0:v:0' : `0:${plan.videoIndex}`);
  if (plan.audioIndex !== null && plan.audioIndex !== undefined) {
    args.push('-map', `0:${plan.audioIndex}`);
  } else {
    args.push('-map', '0:a:0?');
  }
  if (plan.target === 'mp4') args.push('-movflags', '+faststart');

  if (plan.mode === 'remux') {
    args.push('-c', 'copy');
  } else if (plan.mode === 'audio') {
    const encoder = plan.audioEncoder || 'aac';
    args.push('-c:v', 'copy', '-c:a', encoder, '-b:a', encoder === 'libopus' ? '160k' : '192k');
  } else if (plan.mode === 'encode') {
    args.push(
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '24', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k',
    );
  } else {
    throw new Error(`Cannot build FFmpeg arguments for the "${plan.mode}" playback mode.`);
  }

  args.push('-progress', 'pipe:1', '-nostats', outputPath);
  return args;
}

// Turns `ffprobe -of json` output into the shape the interface and the planner
// use. Cover art is exposed by FFprobe as a video stream, so it must be skipped
// when locating the real video track.
function summarizeProbe(probe, { path: filePath = '', isTextSubtitle = () => false } = {}) {
  const streams = Array.isArray(probe?.streams) ? probe.streams : [];
  const tracks = streams
    .filter(stream => stream.codec_type === 'subtitle')
    .map((stream, index) => {
      const language = stream.tags?.language || 'Unknown language';
      const title = stream.tags?.title;
      const textSupported = isTextSubtitle(stream.codec_name);
      return {
        index: stream.index,
        codec: stream.codec_name,
        textSupported,
        label: `${title ? `${title} · ` : `Subtitle ${index + 1} · `}${language} · ${stream.codec_name}${textSupported ? '' : ' (image/not supported)'}`,
      };
    });
  const audioTracks = streams
    .filter(stream => stream.codec_type === 'audio')
    .map(stream => {
      const language = stream.tags?.language || '';
      const title = stream.tags?.title || '';
      const channels = Number(stream.channels) || 0;
      return {
        index: stream.index,
        codec: stream.codec_name || 'unknown',
        channels,
        language,
        title,
        default: stream.disposition?.default === 1,
        label: `${title ? `${title} · ` : ''}${languageName(language)} · ${stream.codec_name}${channels ? ` · ${channels}ch` : ''}`,
      };
    });
  const videoStream = streams.find(stream => stream.codec_type === 'video' && stream.disposition?.attached_pic !== 1);
  return {
    path: filePath,
    tracks,
    audioTracks,
    videoStreamIndex: Number.isInteger(videoStream?.index) ? videoStream.index : null,
    videoCodec: videoStream?.codec_name || 'unknown',
    pixelFormat: videoStream?.pix_fmt || '',
    format: probe?.format?.format_name || '',
    duration: Number(probe?.format?.duration) || 0,
  };
}

module.exports = {
  planPlayback,
  buildFfmpegArgs,
  pickAudioTrack,
  playerAudioIndex,
  isVideoNative,
  languageName,
  containerOf,
  summarizeProbe,
};
