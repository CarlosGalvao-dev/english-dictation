import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { planPlayback, buildFfmpegArgs, pickAudioTrack, languageName, summarizeProbe } = require('../electron/video-plan.cjs');

const englishAac = { index: 1, codec: 'aac', language: 'eng', title: '' };
const englishAc3 = { index: 1, codec: 'ac3', language: 'eng', title: '' };

function plan(extension, videoCodec, pixelFormat, audioTracks = [englishAac]) {
  return planPlayback({ extension, videoCodec, pixelFormat, audioTracks });
}

function argsFor(decision) {
  return buildFfmpegArgs(decision, 'C:\\media\\input.mkv', 'C:\\cache\\output.mp4');
}

test('plays natively when the container and both codecs are supported', () => {
  const decision = plan('.mp4', 'h264', 'yuv420p');
  assert.equal(decision.mode, 'direct');
  assert.equal(decision.target, 'mp4');
  assert.equal(decision.audioIndex, 1);
});

test('plays natively without an audio track', () => {
  assert.equal(plan('.mp4', 'h264', 'yuv420p', []).mode, 'direct');
  assert.equal(plan('.webm', 'vp9', 'yuv420p', []).mode, 'direct');
});

test('treats yuvj420p and the mov/m4v extensions as native', () => {
  assert.equal(plan('.mov', 'h264', 'yuvj420p').mode, 'direct');
  assert.equal(plan('.m4v', 'h264', 'yuv420p').mode, 'direct');
});

test('plays VP8, VP9 and AV1 webm files natively', () => {
  assert.equal(plan('.webm', 'vp8', 'yuv420p', [{ index: 1, codec: 'vorbis', language: 'eng' }]).mode, 'direct');
  assert.equal(plan('.webm', 'vp9', 'yuv420p', [{ index: 1, codec: 'opus', language: 'eng' }]).mode, 'direct');
  assert.equal(plan('.webm', 'av1', 'yuv420p', [{ index: 1, codec: 'opus', language: 'eng' }]).mode, 'direct');
});

test('remuxes an MKV that already holds playable H.264 and AAC', () => {
  const decision = plan('.mkv', 'h264', 'yuv420p');
  assert.equal(decision.mode, 'remux');
  assert.equal(decision.target, 'mp4');

  const args = argsFor(decision);
  assert.deepEqual(args.slice(args.indexOf('-c'), args.indexOf('-c') + 2), ['-c', 'copy']);
  assert.ok(!args.includes('libx264'));
  assert.ok(args.includes('+faststart'));
  assert.deepEqual(args.slice(args.indexOf('-map'), args.indexOf('-map') + 2), ['-map', '0:v:0']);
  assert.deepEqual(args.slice(args.lastIndexOf('-map'), args.lastIndexOf('-map') + 2), ['-map', '0:1']);
});

test('remuxes VP8/Vorbis into WebM and keeps AV1/Opus in WebM', () => {
  const vp8 = plan('.mkv', 'vp8', 'yuv420p', [{ index: 1, codec: 'vorbis', language: 'eng' }]);
  assert.equal(vp8.mode, 'remux');
  assert.equal(vp8.target, 'webm');
  assert.ok(!argsFor(vp8).includes('+faststart'), 'WebM output must not receive MP4 flags');

  const av1 = plan('.mkv', 'av1', 'yuv420p', [{ index: 1, codec: 'opus', language: 'eng' }]);
  assert.equal(av1.mode, 'remux');
  assert.equal(av1.target, 'webm');
});

test('moves VP8 out of an MP4 without re-encoding the video', () => {
  // WebM accepts VP8 but not AAC, so only the audio is re-encoded to Opus.
  const decision = plan('.mp4', 'vp8', 'yuv420p');
  assert.equal(decision.mode, 'audio');
  assert.equal(decision.target, 'webm');
  assert.equal(decision.audioEncoder, 'libopus');
  const args = argsFor(decision);
  assert.deepEqual(args.slice(args.indexOf('-c:v'), args.indexOf('-c:v') + 2), ['-c:v', 'copy']);
});

test('re-encodes only the audio when the video is playable but the audio is not', () => {
  const decision = plan('.mkv', 'h264', 'yuv420p', [englishAc3]);
  assert.equal(decision.mode, 'audio');
  assert.equal(decision.target, 'mp4');
  assert.equal(decision.audioEncoder, 'aac');

  const args = argsFor(decision);
  assert.deepEqual(args.slice(args.indexOf('-c:v'), args.indexOf('-c:v') + 2), ['-c:v', 'copy']);
  assert.ok(args.includes('-c:a'));
  assert.ok(args.includes('aac'));
  assert.ok(!args.includes('libx264'));
});

test('re-encodes PCM audio from MOV files', () => {
  const decision = plan('.mov', 'h264', 'yuv420p', [{ index: 1, codec: 'pcm_s16le', language: 'eng' }]);
  assert.equal(decision.mode, 'audio');
});

test('re-encodes the video when the codec is unsupported', () => {
  for (const [codec, pixelFormat] of [['hevc', 'yuv420p'], ['mpeg4', 'yuv420p'], ['vc1', 'yuv420p'], ['h264', 'yuv420p10le'], ['h264', 'yuv422p'], ['prores', 'yuv422p10le']]) {
    const decision = plan('.mkv', codec, pixelFormat);
    assert.equal(decision.mode, 'encode', `${codec}/${pixelFormat} should be re-encoded`);
    const args = argsFor(decision);
    assert.equal(args[args.indexOf('-c:v') + 1], 'libx264');
    assert.ok(args.includes('yuv420p'));
    assert.ok(!args.includes('-c'), 'a full re-encode must not copy any stream');
  }
});

test('prefers the English track over dubs and untagged audio', () => {
  const tracks = [
    { index: 1, codec: 'aac', language: 'por', title: 'Portuguese' },
    { index: 2, codec: 'ac3', language: 'eng', title: 'English 5.1' },
    { index: 3, codec: 'aac', language: 'spa', title: 'Spanish' },
  ];
  assert.equal(pickAudioTrack(tracks).index, 2);
});

test('plays directly only when the default audio is the chosen track', () => {
  const dubbed = [
    { index: 1, codec: 'aac', language: 'por', title: 'Dublado', default: true },
    { index: 2, codec: 'aac', language: 'eng', title: 'English', default: false },
  ];
  const decision = planPlayback({ extension: '.mp4', videoCodec: 'h264', pixelFormat: 'yuv420p', audioTracks: dubbed });
  assert.equal(decision.mode, 'remux', 'the player would pick the Portuguese dub, so the file must be remuxed');
  assert.equal(decision.audioIndex, 2);

  const original = [
    { index: 1, codec: 'aac', language: 'eng', title: 'English', default: true },
    { index: 2, codec: 'aac', language: 'por', title: 'Dublado', default: false },
  ];
  assert.equal(planPlayback({ extension: '.mp4', videoCodec: 'h264', pixelFormat: 'yuv420p', audioTracks: original }).mode, 'direct');

  const noFlags = [{ index: 1, codec: 'aac', language: 'eng', title: '' }];
  assert.equal(planPlayback({ extension: '.mp4', videoCodec: 'h264', pixelFormat: 'yuv420p', audioTracks: noFlags }).mode, 'direct');
});

test('prefers a regular English track over an English commentary', () => {
  const tracks = [
    { index: 1, codec: 'aac', language: 'eng', title: 'Commentary with the creators' },
    { index: 2, codec: 'aac', language: 'eng', title: 'English' },
  ];
  assert.equal(pickAudioTrack(tracks).index, 2);
});

test('keeps an English commentary ahead of a foreign dub', () => {
  const tracks = [
    { index: 1, codec: 'aac', language: 'por', title: 'Portuguese' },
    { index: 2, codec: 'aac', language: 'eng', title: 'Audio commentary' },
  ];
  assert.equal(pickAudioTrack(tracks).index, 2);
});

test('falls back to the first track when nothing is tagged', () => {
  const tracks = [{ index: 1, codec: 'aac', language: '', title: '' }, { index: 2, codec: 'aac', language: '', title: '' }];
  assert.equal(pickAudioTrack(tracks).index, 1);
  assert.equal(pickAudioTrack([]), null);
  assert.equal(pickAudioTrack(undefined), null);
});

test('maps the chosen audio stream by its absolute index', () => {
  const decision = plan('.mkv', 'h264', 'yuv420p', [{ index: 7, codec: 'aac', language: 'eng' }]);
  assert.equal(decision.audioIndex, 7);
  const args = argsFor(decision);
  assert.equal(args[args.indexOf('-map') + 1], '0:v:0');
  assert.equal(args[args.indexOf('-map', args.indexOf('-map') + 1) + 1], '0:7');
});

test('always requests progress output and writes to the requested path', () => {
  for (const mode of [plan('.mkv', 'h264', 'yuv420p'), plan('.mkv', 'h264', 'yuv420p', [englishAc3]), plan('.mkv', 'hevc', 'yuv420p')]) {
    const args = argsFor(mode);
    assert.deepEqual(args.slice(-4), ['-progress', 'pipe:1', '-nostats', 'C:\\cache\\output.mp4']);
    assert.equal(args[0], '-y');
  }
});

test('refuses to build arguments for a direct playback decision', () => {
  assert.throws(() => argsFor(plan('.mp4', 'h264', 'yuv420p')), /direct/);
});

test('translates common language tags for the interface', () => {
  assert.equal(languageName('eng'), 'English');
  assert.equal(languageName('POR'), 'Portuguese');
  assert.equal(languageName('und'), 'Unknown language');
  assert.equal(languageName('xyz'), 'xyz');
  assert.equal(languageName(''), 'Unknown language');
});

test('summarizes FFprobe output, skipping cover art', () => {
  const probe = {
    streams: [
      { index: 0, codec_type: 'video', codec_name: 'mjpeg', pix_fmt: 'yuvj420p', disposition: { attached_pic: 1 } },
      { index: 1, codec_type: 'video', codec_name: 'hevc', pix_fmt: 'yuv420p10le' },
      { index: 2, codec_type: 'audio', codec_name: 'aac', channels: 2, tags: { language: 'por', title: 'Dublado' }, disposition: { default: 1 } },
      { index: 3, codec_type: 'audio', codec_name: 'ac3', channels: 6, tags: { language: 'eng' } },
      { index: 4, codec_type: 'subtitle', codec_name: 'subrip', tags: { language: 'eng' } },
      { index: 5, codec_type: 'subtitle', codec_name: 'hdmv_pgs_subtitle', tags: { language: 'eng' } },
    ],
    format: { format_name: 'matroska,webm', duration: '1332.0' },
  };
  const summary = summarizeProbe(probe, { path: 'C:\\media\\episode.mkv', isTextSubtitle: codec => codec === 'subrip' });

  assert.equal(summary.path, 'C:\\media\\episode.mkv');
  assert.equal(summary.videoStreamIndex, 1, 'cover art must not be treated as the video track');
  assert.equal(summary.videoCodec, 'hevc');
  assert.equal(summary.pixelFormat, 'yuv420p10le');
  assert.equal(summary.format, 'matroska,webm');
  assert.equal(summary.duration, 1332);

  assert.equal(summary.audioTracks.length, 2);
  assert.equal(summary.audioTracks[0].label, 'Dublado · Portuguese · aac · 2ch');
  assert.equal(summary.audioTracks[0].default, true);
  assert.equal(summary.audioTracks[1].label, 'English · ac3 · 6ch');
  assert.equal(summary.audioTracks[1].channels, 6);
  assert.equal(summary.audioTracks[1].title, '');
  assert.equal(summary.audioTracks[1].default, false);

  assert.equal(summary.tracks.length, 2);
  assert.equal(summary.tracks[0].textSupported, true);
  assert.equal(summary.tracks[1].textSupported, false);
  assert.match(summary.tracks[1].label, /image\/not supported/);

  // The summary feeds the planner directly; an English track must win even here.
  const decision = planPlayback({ extension: '.mkv', ...summary, audioTracks: summary.audioTracks });
  assert.equal(decision.audioIndex, 3);
  assert.equal(decision.mode, 'encode');
});

test('summarizes a probe without streams', () => {
  const summary = summarizeProbe({}, { path: 'empty.mp4' });
  assert.deepEqual(summary.tracks, []);
  assert.deepEqual(summary.audioTracks, []);
  assert.equal(summary.videoStreamIndex, null);
  assert.equal(summary.videoCodec, 'unknown');
  assert.equal(summary.duration, 0);
});
