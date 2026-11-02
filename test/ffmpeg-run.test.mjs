import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { startFfmpeg } = require('../electron/ffmpeg-run.cjs');
const ffmpegPath = require('ffmpeg-static');

function temporaryOutput(name) {
  return path.join(os.tmpdir(), `english-dictation-${process.pid}-${name}`);
}

// Mirrors buildFfmpegArgs: the progress pipe is what makes stdout readable.
const silentVideo = output => [
  '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=160x120:rate=10', '-t', '1',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-progress', 'pipe:1', '-nostats', output,
];

const longVideo = output => [
  '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=30', '-t', '120',
  '-c:v', 'libx264', '-preset', 'veryslow', '-progress', 'pipe:1', '-nostats', output,
];

test('resolves a completed conversion and reports progress', async () => {
  const output = temporaryOutput('done.mp4');
  const progress = [];
  try {
    const run = startFfmpeg({
      ffmpegPath,
      args: silentVideo(output),
      duration: 1,
      onProgress: percent => progress.push(percent),
    });
    const result = await run.promise;
    assert.deepEqual(result, { cancelled: false });
    assert.ok(fs.statSync(output).size > 0);
    assert.ok(progress.length > 0, 'progress must be reported');
    assert.equal(progress.at(-1), 100);
  } finally {
    fs.rmSync(output, { force: true });
  }
});

test('cancels a running conversion and stops FFmpeg', async () => {
  const output = temporaryOutput('cancelled.mp4');
  const progress = [];
  try {
    const run = startFfmpeg({
      ffmpegPath,
      args: longVideo(output),
      duration: 120,
      onProgress: percent => progress.push(percent),
    });
    // Let FFmpeg start writing, then cancel mid-conversion.
    await new Promise(resolve => setTimeout(resolve, 400));
    run.cancel();
    const result = await run.promise;
    assert.deepEqual(result, { cancelled: true });
    assert.ok(progress.length > 0, 'progress must be reported before cancelling');
  } finally {
    fs.rmSync(output, { force: true });
  }
});

test('cancelling before completion never rejects', async () => {
  const output = temporaryOutput('early-cancel.mp4');
  try {
    const run = startFfmpeg({
      ffmpegPath,
      args: longVideo(output),
      duration: 60,
    });
    run.cancel();
    run.cancel();
    const result = await run.promise;
    assert.deepEqual(result, { cancelled: true });
  } finally {
    fs.rmSync(output, { force: true });
  }
});

test('rejects with the FFmpeg message when the conversion fails', async () => {
  const run = startFfmpeg({
    ffmpegPath,
    args: ['-y', '-v', 'error', '-i', path.join(os.tmpdir(), 'missing-file-that-does-not-exist.mkv'), '-c', 'copy', temporaryOutput('broken.mp4')],
  });
  await assert.rejects(run.promise, /No such file|Invalid argument|missing-file/i);
});

test('stays silent about cancelling an already finished run', async () => {
  const output = temporaryOutput('late-cancel.mp4');
  try {
    const run = startFfmpeg({ ffmpegPath, args: silentVideo(output), duration: 1 });
    const result = await run.promise;
    run.cancel();
    assert.deepEqual(result, { cancelled: false });
  } finally {
    fs.rmSync(output, { force: true });
  }
});
