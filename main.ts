// Token launch radar — the entrypoint.
//
// This program reads one sealed DefiLlama snapshot and turns it into the
// hand-in: a ranked board of pre-token protocols, the static dashboard that
// presents it, and the dossier the judge reads. The ranking itself lives in
// lib/model.ts (the radar-2 model: each protocol's implied launch value is
// its TVL priced at the multiple the market already pays for traded peers
// in its category, adjusted for seven-day growth and for how long it has
// run with no token). Everything here is plumbing around that model.
//
// The plumbing is held to three rules:
//   - deterministic: the same snapshot bytes produce the same output
//     bytes, on the first run and on every rerun;
//   - self-cleaning: the output directory is the grader's mount, so it is
//     never removed — only the children this program owns are cleared;
//   - honest: a board that does not validate against its own snapshot is
//     refused here, with the reason, instead of being handed in broken.
//
// Node 22, standard library only. Run it as:
//   node main.ts --input <snapshot.json>
// with MAKEFUN_OUTPUT_DIR naming the output directory (default /output).

import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

/** Where the snapshot lives when the caller passes no --input. */
const DEFAULT_INPUT = '/input/snapshot.json';

/** The dossier's text budget, the cap the competition's gate names. */
const DOSSIER_TEXT_MAX_BYTES = 65536;

/**
 * What this program owns inside the output directory: its board, the
 * dashboard's data script, the two copied folders and the dossier.
 * Anything else that happens to sit in the output directory is not ours
 * to delete, and the directory itself is never ours to remove.
 */
const OWNED_CHILDREN = ['board.json', 'data.js', 'dashboard', 'screenshots', 'dossier.json'];

/** The snapshot path from argv: `--input path` or `--input=path`. */
function snapshotPath(argv: string[]): string {
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--input') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('--input must be followed by the snapshot path');
      }
      return value;
    }
    if (arg !== undefined && arg.startsWith('--input=')) {
      const value = arg.slice('--input='.length);
      if (value === '') throw new Error('--input= needs a snapshot path after the =');
      return value;
    }
  }
  return DEFAULT_INPUT;
}

/** The directory this file sits in: the repository root. */
function repoRoot(): string {
  return fileURLToPath(new URL('.', import.meta.url));
}

/**
 * Empty the output directory of the children this program manages and
 * make sure the directory itself exists. The directory is left standing:
 * in the grader it is a mounted /output owned by root, and removing it
 * fails — clearing its contents is all a rerun needs to start clean.
 */
function prepareOutput(outputDir: string): void {
  mkdirSync(outputDir, { recursive: true });
  for (const child of OWNED_CHILDREN) {
    rmSync(join(outputDir, child), { recursive: true, force: true });
  }
}

function run(): void {
  const input = snapshotPath(process.argv.slice(2));
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  const root = repoRoot();

  const snapshot = parseSnapshot(readFileSync(input, 'utf8'));
  const { board, radar } = buildRadar(snapshot);

  // The model grades its own homework before anything is written: a board
  // that fails the snapshot's own checks (coverage, ranks, farm plans)
  // stops the run here, where the reason is still readable.
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    throw new Error(`the board does not validate against its snapshot: ${issue}`);
  }

  prepareOutput(outputDir);

  // The board first: it is the entry's claim, rows ranked by implied value.
  writeFileSync(join(outputDir, 'board.json'), `${JSON.stringify({ rows: board }, null, 2)}\n`);

  // The dashboard's data rides beside its page as a script the page loads.
  writeFileSync(join(outputDir, 'data.js'), dataScript(radar));

  // The page and the screenshots are the repository's own, copied as they
  // stand; the program renders nothing and fetches nothing.
  cpSync(join(root, 'dashboard'), join(outputDir, 'dashboard'), { recursive: true });
  cpSync(join(root, 'screenshots'), join(outputDir, 'screenshots'), { recursive: true });

  // The dossier seals what is now in place, so it is written last.
  const dossier = buildDossier(outputDir, { text_max_bytes: DOSSIER_TEXT_MAX_BYTES });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);

  const top = board[0];
  console.log(
    `token radar: ${board.length} rows (${radar.watchlist_size} watchlist, ${radar.early_size} early), ` +
      `led by ${top ? `${top.name} at $${top.implied_value_usd}` : 'no one'}, ` +
      `dossier ${dossier.length} bytes, written to ${outputDir}`,
  );
}

// A failed run says why in one line and exits nonzero: the stack trace of
// a missing snapshot or an invalid board helps no one, least of all the
// log a grader keeps.
try {
  run();
} catch (error) {
  console.error(`token radar: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
