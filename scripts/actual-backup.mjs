#!/usr/bin/env node
// Daily Actual Budget backup & retention manager.
// Exports Finanzas CLP/USD (.zip), state.json, and consistent SQLite/blob copies (excluding YNAB archives)
// to Google Drive without pruning backups or other runs' evidence.
import { mkdir, mkdtemp, readFile, writeFile, readdir, stat, copyFile, cp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { BUDGETS } from './actual-daily-policy.mjs';

const pilotDir = process.env.ACTUAL_PILOT_DIR || '/Users/birrein/Actual-pilot';
const dailyDir = process.env.ACTUAL_DAILY_DIR || join(pilotDir, 'daily');
const serverDataDir = process.env.ACTUAL_DATA_DIR || join(pilotDir, 'data');
const serverFilesDir = process.env.ACTUAL_SERVER_FILES || join(pilotDir, 'server-files');
const userFilesDir = process.env.ACTUAL_USER_FILES || join(pilotDir, 'user-files');
const backupDest = process.env.ACTUAL_BACKUP_DEST || '/Users/birrein/Library/CloudStorage/GoogleDrive-birrein@gmail.com/Mi unidad/Backups/ActualBudget';
const apiPath = process.env.ACTUAL_API_PATH || new URL('./actual-runtime/node_modules/@actual-app/api/dist/index.js', import.meta.url).href;
const serverURL = process.env.ACTUAL_SERVER_URL || 'http://127.0.0.1:5006';

const args = process.argv.slice(2);
const hasFlag = flag => args.includes(flag);
const getOption = flag => {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : null;
};

const todaySantiago = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const temporaryClients = [];
let ownedWriteLock = false;

function getSessionToken() {
  if (process.env.ACTUAL_SESSION_TOKEN) return process.env.ACTUAL_SESSION_TOKEN.trim();
  return execFileSync(
    '/usr/bin/security',
    ['find-generic-password', '-a', 'actual-server', '-s', 'actual-budget-session-token', '-w'],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  ).trim();
}

async function sha256File(filePath) {
  const buf = await readFile(filePath);
  return {
    size: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
  };
}

function sqliteVacuumInto(srcPath, destPath) {
  assert(existsSync(srcPath), `Missing SQLite file: ${srcPath}`);
  if (existsSync(destPath)) {
    throw new Error(`Destination SQLite file already exists: ${destPath}`);
  }
  const escaped = destPath.replace(/'/g, "''");
  execFileSync('/usr/bin/sqlite3', [srcPath, `VACUUM INTO '${escaped}';`], { encoding: 'utf8' });
  const check = execFileSync('/usr/bin/sqlite3', [destPath, 'PRAGMA integrity_check;'], { encoding: 'utf8' }).trim();
  assert.equal(check, 'ok', `SQLite integrity check failed for ${destPath}: ${check}`);
}

function resolveActiveFileIds(accountDbPath, activeGroupIds) {
  assert(existsSync(accountDbPath), `Missing account.sqlite at ${accountDbPath}`);
  const quoted = activeGroupIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
  const out = execFileSync(
    '/usr/bin/sqlite3',
    ['-json', accountDbPath, `SELECT id, group_id, name FROM files WHERE deleted = 0 AND group_id IN (${quoted});`],
    { encoding: 'utf8' }
  ).trim();
  return out ? JSON.parse(out) : [];
}

async function exportActiveBudgets(destDir) {
  const api = await import(apiPath);
  const token = getSessionToken();
  for (const [currency, info] of Object.entries(BUDGETS)) {
    const dataDir = await mkdtemp(join(dailyDir, 'client-backup-'));
    temporaryClients.push(dataDir);
    await api.init({ serverURL, sessionToken: token, dataDir });
    try {
      await api.downloadBudget(info.syncId);
      const zipBuffer = await api.exportBudget();
      const zipName = `Finanzas-${currency}.zip`;
      await writeFile(join(destDir, zipName), zipBuffer, { mode: 0o600 });
    } finally {
      await api.shutdown();
    }
  }
}

async function collectCleanupCandidates(referenceTimeMs) {
  const sevenDaysMs = 7 * 86400 * 1000;
  const cutoffMs = referenceTimeMs - sevenDaysMs;
  const localBackupsToDelete = [];
  const staleClientsToDelete = [];
  const staleSnapshotsToDelete = [];

  const txBackupsRoot = join(dailyDir, 'backups');
  if (existsSync(txBackupsRoot)) {
    const entries = await readdir(txBackupsRoot);
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const fullPath = join(txBackupsRoot, name);
      const m = /^(\d{10,})-(CLP|USD)$/.exec(name);
      let itemTimeMs = m ? Number(m[1]) : (await stat(fullPath)).mtimeMs;
      if (itemTimeMs < cutoffMs) {
        localBackupsToDelete.push(fullPath);
      }
    }
  }

  if (existsSync(dailyDir)) {
    const entries = await readdir(dailyDir);
    for (const name of entries) {
      const fullPath = join(dailyDir, name);
      if (name.startsWith('client-') && !temporaryClients.includes(fullPath)) {
        const st = await stat(fullPath);
        if (st.mtimeMs < cutoffMs) {
          staleClientsToDelete.push(fullPath);
        }
      } else if (/^snapshot-(CLP|USD)-\d+\.json$/.test(name)) {
        const st = await stat(fullPath);
        if (st.mtimeMs < cutoffMs) {
          staleSnapshotsToDelete.push(fullPath);
        }
      }
    }
  }

  return { localBackupsToDelete, staleClientsToDelete, staleSnapshotsToDelete };
}

async function collectDriveRotationCandidates(dailyRoot, monthlyRoot, keepDaily = 30, keepMonthly = 12) {
  const dailyToDelete = [];
  const monthlyToDelete = [];

  if (existsSync(dailyRoot)) {
    const dirs = (await readdir(dailyRoot))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
      .sort();
    if (dirs.length > keepDaily) {
      for (const oldDir of dirs.slice(0, dirs.length - keepDaily)) {
        dailyToDelete.push(join(dailyRoot, oldDir));
      }
    }
  }

  if (existsSync(monthlyRoot)) {
    const dirs = (await readdir(monthlyRoot))
      .filter(d => /^\d{4}-\d{2}$/.test(d))
      .sort();
    if (dirs.length > keepMonthly) {
      for (const oldDir of dirs.slice(0, dirs.length - keepMonthly)) {
        monthlyToDelete.push(join(monthlyRoot, oldDir));
      }
    }
  }

  return { dailyToDelete, monthlyToDelete };
}

async function buildManifest(baseDir, dateStr, relativePaths) {
  const files = [];
  for (const rel of relativePaths.sort()) {
    const info = await sha256File(join(baseDir, rel));
    files.push({ path: rel, size: info.size, sha256: info.sha256 });
  }
  return {
    version: 1,
    date: dateStr,
    createdAt: new Date().toISOString(),
    budgets: BUDGETS,
    files,
  };
}

async function hasActiveRun() {
  const stateSrc = join(dailyDir, 'state.json');
  if (!existsSync(stateSrc)) return false;
  try {
    const st = JSON.parse(await readFile(stateSrc, 'utf8'));
    return Boolean(st && st.activeRun);
  } catch {
    return true;
  }
}

async function isDailyRunBusy() {
  return existsSync(join(dailyDir, 'write.lock')) || await hasActiveRun();
}

async function waitForDailyIdle() {
  const pollMs = Number(process.env.ACTUAL_BACKUP_POLL_MS) || 15000;
  const maxWaitMs = Number(process.env.ACTUAL_BACKUP_MAX_WAIT_MS) || 20 * 60 * 1000;
  const start = Date.now();
  while (await isDailyRunBusy()) {
    if (Date.now() - start >= maxWaitMs) {
      return { waitedForIdleMs: Date.now() - start, proceededWithActiveRun: true };
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
  return { waitedForIdleMs: Date.now() - start, proceededWithActiveRun: false };
}

async function main() {
  const commit = hasFlag('--commit');
  const force = hasFlag('--force');
  const dateStr = getOption('--date') || todaySantiago();
  assert(/^\d{4}-\d{2}-\d{2}$/.test(dateStr), `Invalid --date: ${dateStr}`);
  const monthStr = dateStr.slice(0, 7);
  const referenceTimeMs = Date.parse(`${dateStr}T23:59:59Z`);

  const idleStatus = commit
    ? await waitForDailyIdle()
    : { waitedForIdleMs: 0, proceededWithActiveRun: await isDailyRunBusy() };
  if (commit) {
    assert(!idleStatus.proceededWithActiveRun, 'Active run or write lock did not clear');
    // Use the adapter's atomic lock, and recheck the lease after acquiring it.
    await mkdir(join(dailyDir, 'write.lock'), { mode: 0o700 });
    ownedWriteLock = true;
    assert(!await hasActiveRun(), 'Active run started before backup acquired the lock');
  }

  const activeGroupIds = Object.values(BUDGETS).map(b => b.syncId);
  const accountDbPath = join(serverFilesDir, 'account.sqlite');
  const activeFiles = resolveActiveFileIds(accountDbPath, activeGroupIds);

  const dailyRoot = join(backupDest, 'daily');
  const monthlyRoot = join(backupDest, 'monthly');
  const dayTargetDir = join(dailyRoot, dateStr);
  const monthTargetDir = join(monthlyRoot, monthStr);

  const cleanup = await collectCleanupCandidates(referenceTimeMs);

  if (!commit) {
    const rotation = await collectDriveRotationCandidates(dailyRoot, monthlyRoot, 30, 12);
    return {
      mode: 'dry-run',
      date: dateStr,
      targetDailyDir: dayTargetDir,
      targetMonthlyDir: monthTargetDir,
      activeFiles,
      cleanup: {
        localBackupsCount: cleanup.localBackupsToDelete.length,
        staleClientsCount: cleanup.staleClientsToDelete.length,
        staleSnapshotsCount: cleanup.staleSnapshotsToDelete.length,
      },
      rotation,
    };
  }

  await mkdir(dailyRoot, { recursive: true, mode: 0o700 });
  await mkdir(monthlyRoot, { recursive: true, mode: 0o700 });

  let created = false;
  const manifestPath = join(dayTargetDir, 'manifest.json');
  const monthlyManifestPath = join(monthTargetDir, 'manifest.json');
  if (force) assert(!existsSync(dayTargetDir) && !existsSync(monthTargetDir), 'Refusing to overwrite existing backup');
  assert(!existsSync(dayTargetDir) || existsSync(manifestPath), 'Existing daily backup incomplete');
  assert(!existsSync(monthTargetDir) || existsSync(monthlyManifestPath), 'Existing monthly backup incomplete');
  if (!existsSync(manifestPath) || force) {
    const stagingDir = `${dayTargetDir}.tmp-${Date.now()}`;
    await mkdir(join(stagingDir, 'server-files'), { recursive: true, mode: 0o700 });
    await mkdir(join(stagingDir, 'user-files'), { recursive: true, mode: 0o700 });

    try {
      const relativeFiles = [];

      // The server migration registry must accompany the account database.
      let migrationBytes;
      try {
        migrationBytes = await readFile(join(serverDataDir, '.migrate'));
        const migration = JSON.parse(migrationBytes.toString('utf8'));
        assert(typeof migration.lastRun === 'string' && migration.lastRun.length > 0);
        assert(Array.isArray(migration.migrations) && migration.migrations.length > 0);
      } catch (cause) {
        throw new Error('Missing or invalid Actual server migration marker', { cause });
      }
      await mkdir(join(stagingDir, 'data'), { recursive: true, mode: 0o700 });
      await writeFile(join(stagingDir, 'data', '.migrate'), migrationBytes, { mode: 0o600 });
      relativeFiles.push('data/.migrate');

      // 1. Export Finanzas CLP & Finanzas USD (.zip)
      await exportActiveBudgets(stagingDir);
      relativeFiles.push('Finanzas-CLP.zip', 'Finanzas-USD.zip');

      // 2. Copy state.json
      const stateSrc = join(dailyDir, 'state.json');
      assert(existsSync(stateSrc), `Missing state.json at ${stateSrc}`);
      await copyFile(stateSrc, join(stagingDir, 'state.json'));
      relativeFiles.push('state.json');

      // 3. Consistent SQLite copy of server-files/account.sqlite
      sqliteVacuumInto(accountDbPath, join(stagingDir, 'server-files', 'account.sqlite'));
      relativeFiles.push('server-files/account.sqlite');

      // 4. Consistent SQLite copy of active group-*.sqlite and file-*.blob in user-files
      for (const groupId of activeGroupIds) {
        const groupName = `group-${groupId}.sqlite`;
        const groupSrc = join(userFilesDir, groupName);
        assert(existsSync(groupSrc), `Missing ${groupName} in ${userFilesDir}`);
        sqliteVacuumInto(groupSrc, join(stagingDir, 'user-files', groupName));
        relativeFiles.push(`user-files/${groupName}`);
      }

      for (const f of activeFiles) {
        const blobName = `file-${f.id}.blob`;
        const blobSrc = join(userFilesDir, blobName);
        if (existsSync(blobSrc)) {
          await copyFile(blobSrc, join(stagingDir, 'user-files', blobName));
          relativeFiles.push(`user-files/${blobName}`);
        }
      }

      // 5. Write manifest.json
      const manifest = await buildManifest(stagingDir, dateStr, relativeFiles);
      await writeFile(join(stagingDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600 });

      await cp(stagingDir, dayTargetDir, { recursive: true });
      created = true;
    } finally {
      await rm(stagingDir, { recursive: true, force: true });
    }
  }

  // Promote to monthly backup if current month doesn't have one yet (or if forced)
  let monthlyCreated = false;
  if (!existsSync(monthlyManifestPath) || force) {
    await cp(dayTargetDir, monthTargetDir, { recursive: true });
    monthlyCreated = true;
  }

  // Retention requires separate reference-aware review and independent remote verification.

  return {
    mode: 'commit',
    date: dateStr,
    created,
    monthlyCreated,
    waitedForIdleMs: idleStatus.waitedForIdleMs,
    proceededWithActiveRun: idleStatus.proceededWithActiveRun,
    dailyDir: dayTargetDir,
    monthlyDir: monthTargetDir,
    prunedLocal: {
      backups: 0,
      staleClients: 0,
      staleSnapshots: 0,
    },
    rotatedDrive: {
      daily: 0,
      monthly: 0,
    },
  };
}

try {
  const result = await main();
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
} finally {
  for (const dir of temporaryClients) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (e) {
      console.error(`Warning: temporary client cleanup failed for ${dir}: ${e.message}`);
    }
  }
  if (ownedWriteLock) await rm(join(dailyDir, 'write.lock'), { recursive: true });
}
