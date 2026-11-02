'use strict';

const { spawn } = require('node:child_process');

// Runs FFmpeg, forwards conversion progress, and lets the caller cancel it.
//
// Resolves with `{ cancelled: true }` when the caller cancelled, `{ cancelled:
// false }` on a clean exit, and rejects with FFmpeg's own message on failure.
// No Electron dependency, so it can be tested with plain `node --test`.
function startFfmpeg({ ffmpegPath, args, duration = 0, onProgress = () => {} }) {
  const child = spawn(ffmpegPath, args, { windowsHide: true });
  let cancelled = false;
  let settled = false;

  const promise = new Promise((resolve, reject) => {
    let errorText = '';
    let progressBuffer = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', chunk => { errorText += chunk; });

    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      progressBuffer += chunk;
      const lines = progressBuffer.split(/\r?\n/);
      progressBuffer = lines.pop() || '';
      for (const line of lines) {
        if (line === 'progress=end') {
          onProgress(100);
          continue;
        }
        if (!line.startsWith('out_time_ms=')) continue;
        const outputTime = Number(line.slice('out_time_ms='.length));
        const seconds = Number(duration);
        // A null percentage keeps the indeterminate progress animation running.
        const percent = Number.isFinite(outputTime) && seconds > 0
          ? Math.max(0, Math.min(100, outputTime / (seconds * 1_000_000) * 100))
          : null;
        onProgress(percent);
      }
    });

    child.once('error', error => {
      if (settled) return;
      settled = true;
      reject(error);
    });

    child.once('close', code => {
      if (settled) return;
      settled = true;
      if (cancelled) resolve({ cancelled: true });
      else if (code === 0) resolve({ cancelled: false });
      else reject(new Error(errorText.trim() || `FFmpeg exited with code ${code}`));
    });
  });

  return {
    promise,
    cancel() {
      if (settled || cancelled) return;
      cancelled = true;
      try {
        child.kill('SIGKILL');
      } catch { /* The process already exited. */ }
    },
  };
}

module.exports = { startFfmpeg };
