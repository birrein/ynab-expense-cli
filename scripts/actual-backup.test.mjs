import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const scriptPath = new URL('./actual-backup.mjs', import.meta.url).pathname;

function createSqliteDb(dbPath, sql) {
  execFileSync('/usr/bin/sqlite3', [dbPath, sql]);
}

async function setupIsolatedEnv() {
  const root = await mkdtemp(join(tmpdir(), 'actual-backup-test-'));
  const pilotDir = join(root, 'Actual-pilot');
  const dailyDir = join(pilotDir, 'daily');
  const serverFilesDir = join(pilotDir, 'server-files');
  const userFilesDir = join(pilotDir, 'user-files');
  const driveBackupDir = join(root, 'DriveBackups', 'ActualBudget');

  await mkdir(join(dailyDir, 'backups'), { recursive: true });
  await mkdir(serverFilesDir, { recursive: true });
  await mkdir(userFilesDir, { recursive: true });
  await mkdir(driveBackupDir, { recursive: true });
  await mkdir(join(pilotDir, 'data'), { recursive: true });
  await writeFile(join(pilotDir, 'data', '.migrate'), JSON.stringify({lastRun:'example.js',migrations:[{title:'example.js',timestamp:1}]}));

  // Create state.json and candidate json in dailyDir
  await writeFile(join(dailyDir, 'state.json'), JSON.stringify({ version: 1, dailyThrough: '2026-10-20' }));
  await writeFile(join(dailyDir, '2026-10-10-candidate.json'), JSON.stringify({ amount: -1000 }));

  // Create SQLite databases in server-files and user-files
  createSqliteDb(join(serverFilesDir, 'account.sqlite'), `
    CREATE TABLE files (id TEXT PRIMARY KEY, group_id TEXT, name TEXT, deleted BOOLEAN DEFAULT FALSE);
    INSERT INTO files VALUES
      ('file-clp-id', '5c58e53d-be34-4968-b944-f5b3b8b3b874', 'Finanzas CLP', 0),
      ('file-usd-id', 'da939d35-040a-4a5a-9309-f83aa809a1c6', 'Finanzas USD', 0),
      ('file-ynab-clp', '84c7b3ba-8389-4b0c-9bad-59041c29c0d2', 'Archivo YNAB CLP', 0),
      ('file-ynab-usd', '51e1e127-74c7-4052-8bba-c691d1cb53f1', 'Archivo YNAB USD', 0);
  `);

  createSqliteDb(join(userFilesDir, 'group-5c58e53d-be34-4968-b944-f5b3b8b3b874.sqlite'), 'CREATE TABLE messages (id INT); INSERT INTO messages VALUES (1);');
  createSqliteDb(join(userFilesDir, 'group-da939d35-040a-4a5a-9309-f83aa809a1c6.sqlite'), 'CREATE TABLE messages (id INT); INSERT INTO messages VALUES (2);');
  createSqliteDb(join(userFilesDir, 'group-84c7b3ba-8389-4b0c-9bad-59041c29c0d2.sqlite'), 'CREATE TABLE messages (id INT); INSERT INTO messages VALUES (99);');

  await writeFile(join(userFilesDir, 'file-file-clp-id.blob'), 'clp-blob-content');
  await writeFile(join(userFilesDir, 'file-file-usd-id.blob'), 'usd-blob-content');
  await writeFile(join(userFilesDir, 'file-file-ynab-clp.blob'), 'ynab-clp-blob-content');

  // Create mock API module
  const apiMockPath = join(root, 'mock-api.mjs');
  await writeFile(apiMockPath, `
    import { writeFile, access } from 'node:fs/promises';
    let currentSyncId = null;
    let dataDir = null;
    export async function init(opts) {
      await access(process.env.ACTUAL_DAILY_DIR + '/write.lock');
      dataDir = opts.dataDir;
      await writeFile(dataDir + '/marker', 'temp');
      return {};
    }
    export async function downloadBudget(syncId) {
      currentSyncId = syncId;
    }
    export async function exportBudget() {
      return Buffer.from('ZIP_CONTENT_FOR_' + currentSyncId);
    }
    export async function shutdown() {}
  `);

  return { root, pilotDir, dailyDir, serverFilesDir, userFilesDir, driveBackupDir, apiMockPath };
}

test('creates daily and monthly backup excluding YNAB files and verifies manifest', async () => {
  const env = await setupIsolatedEnv();
  try {
    const res = spawnSync(process.execPath, [scriptPath, '--commit', '--date', '2026-10-21'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ACTUAL_PILOT_DIR: env.pilotDir,
        ACTUAL_DAILY_DIR: env.dailyDir,
        ACTUAL_BACKUP_DEST: env.driveBackupDir,
        ACTUAL_API_PATH: env.apiMockPath,
        ACTUAL_SESSION_TOKEN: 'test-token',
      },
    });
    assert.equal(res.status, 0, res.stderr);
    const output = JSON.parse(res.stdout);
    assert.equal(output.date, '2026-10-21');
    assert.equal(output.created, true);

    const dayDir = join(env.driveBackupDir, 'daily', '2026-10-21');
    const monthDir = join(env.driveBackupDir, 'monthly', '2026-10');

    // Check exported zips and state.json
    assert.equal(await readFile(join(dayDir, 'Finanzas-CLP.zip'), 'utf8'), 'ZIP_CONTENT_FOR_5c58e53d-be34-4968-b944-f5b3b8b3b874');
    assert.equal(await readFile(join(dayDir, 'Finanzas-USD.zip'), 'utf8'), 'ZIP_CONTENT_FOR_da939d35-040a-4a5a-9309-f83aa809a1c6');
    assert.deepEqual(JSON.parse(await readFile(join(dayDir, 'state.json'), 'utf8')), { version: 1, dailyThrough: '2026-10-20' });

    // Check server-files and filtered user-files (no YNAB)
    const userFilesBackedUp = (await readdir(join(dayDir, 'user-files'))).sort();
    assert.deepEqual(userFilesBackedUp, [
      'file-file-clp-id.blob',
      'file-file-usd-id.blob',
      'group-5c58e53d-be34-4968-b944-f5b3b8b3b874.sqlite',
      'group-da939d35-040a-4a5a-9309-f83aa809a1c6.sqlite',
    ]);

    // Check SQLite integrity on backed up server-files/account.sqlite
    const integrity = execFileSync('/usr/bin/sqlite3', [join(dayDir, 'server-files', 'account.sqlite'), 'PRAGMA integrity_check;'], { encoding: 'utf8' }).trim();
    assert.equal(integrity, 'ok');

    // Check monthly snapshot was also populated for 2026-10
    const manifest = JSON.parse(await readFile(join(monthDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.date, '2026-10-21');
    assert.ok(Array.isArray(manifest.files) && manifest.files.length === 9);
    assert.deepEqual(JSON.parse(await readFile(join(dayDir, 'data', '.migrate'), 'utf8')), {lastRun:'example.js',migrations:[{title:'example.js',timestamp:1}]});
    const migrationEntry = manifest.files.find(x => x.path === 'data/.migrate');
    const migrationBytes = await readFile(join(dayDir, 'data', '.migrate'));
    const { createHash } = await import('node:crypto');
    assert.equal(migrationEntry.sha256, createHash('sha256').update(migrationBytes).digest('hex'));
    assert.equal(migrationEntry.size, migrationBytes.length);

    // Check own temporary client-* directory was cleaned up
    const remainingClients = (await readdir(env.dailyDir)).filter(x => x.startsWith('client-'));
    assert.equal(remainingClients.length, 0);
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

for (const bad of ['missing', 'malformed']) {
  test(`refuses a new backup when server migration marker is ${bad}`, async () => {
    const env = await setupIsolatedEnv();
    try {
      const marker = join(env.pilotDir, 'data', '.migrate');
      if (bad === 'missing') await rm(marker); else await writeFile(marker, '{}');
      const res = spawnSync(process.execPath, [scriptPath, '--commit', '--date', '2026-10-21'], {
        encoding: 'utf8', env: {...process.env, ACTUAL_PILOT_DIR:env.pilotDir, ACTUAL_DAILY_DIR:env.dailyDir, ACTUAL_BACKUP_DEST:env.driveBackupDir, ACTUAL_API_PATH:env.apiMockPath, ACTUAL_SESSION_TOKEN:'test-token'},
      });
      assert.notEqual(res.status, 0, 'must refuse an unusable backup');
      assert.match(res.stderr, /migration marker/i);
      assert.ok(!(await readdir(join(env.driveBackupDir, 'daily')).catch(() => [])).includes('2026-10-21'));
      assert.ok(!(await readdir(env.dailyDir)).includes('write.lock'));
    } finally { await rm(env.root, {recursive:true, force:true}); }
  });
}

test('preserves local transaction backups, clients, snapshots and candidate JSONs regardless of age', async () => {
  const env = await setupIsolatedEnv();
  try {
    const nowMs = Date.parse('2026-10-21T12:00:00Z');
    const tenDaysAgoMs = nowMs - 10 * 86400 * 1000;
    const twoDaysAgoMs = nowMs - 2 * 86400 * 1000;

    // Transaction backups in daily/backups/<timestamp>-CLP
    const oldBackup = join(env.dailyDir, 'backups', `${tenDaysAgoMs}-CLP`);
    const recentBackup = join(env.dailyDir, 'backups', `${twoDaysAgoMs}-CLP`);
    await mkdir(oldBackup, { recursive: true });
    await mkdir(recentBackup, { recursive: true });
    await writeFile(join(oldBackup, 'budget.zip'), 'old');
    await writeFile(join(recentBackup, 'budget.zip'), 'recent');
    await utimes(oldBackup, tenDaysAgoMs / 1000, tenDaysAgoMs / 1000);
    await utimes(recentBackup, twoDaysAgoMs / 1000, twoDaysAgoMs / 1000);

    // Stale client-* and recent client-*
    const staleClient = join(env.dailyDir, 'client-stale');
    const recentClient = join(env.dailyDir, 'client-recent');
    await mkdir(staleClient, { recursive: true });
    await mkdir(recentClient, { recursive: true });
    await utimes(staleClient, tenDaysAgoMs / 1000, tenDaysAgoMs / 1000);
    await utimes(recentClient, twoDaysAgoMs / 1000, twoDaysAgoMs / 1000);

    // Stale snapshot-*.json
    const staleSnapshot = join(env.dailyDir, `snapshot-CLP-${tenDaysAgoMs}.json`);
    await writeFile(staleSnapshot, '{}');
    await utimes(staleSnapshot, tenDaysAgoMs / 1000, tenDaysAgoMs / 1000);

    // Candidate json from 10 days ago must NEVER be deleted
    const candidatePath = join(env.dailyDir, '2026-10-10-candidate.json');
    await utimes(candidatePath, tenDaysAgoMs / 1000, tenDaysAgoMs / 1000);

    const res = spawnSync(process.execPath, [scriptPath, '--commit', '--date', '2026-10-21'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ACTUAL_PILOT_DIR: env.pilotDir,
        ACTUAL_DAILY_DIR: env.dailyDir,
        ACTUAL_BACKUP_DEST: env.driveBackupDir,
        ACTUAL_API_PATH: env.apiMockPath,
        ACTUAL_SESSION_TOKEN: 'test-token',
      },
    });
    assert.equal(res.status, 0, res.stderr);

    const remainingBackups = await readdir(join(env.dailyDir, 'backups'));
    assert.deepEqual(remainingBackups.sort(), [`${tenDaysAgoMs}-CLP`,`${twoDaysAgoMs}-CLP`].sort());

    const dailyEntries = await readdir(env.dailyDir);
    assert.ok(dailyEntries.includes('client-stale'), 'other clients must be preserved');
    assert.ok(dailyEntries.includes('client-recent'), 'recent client must be preserved');
    assert.ok(dailyEntries.includes(`snapshot-CLP-${tenDaysAgoMs}.json`), 'other snapshots must be preserved');
    assert.ok(dailyEntries.includes('2026-10-10-candidate.json'), 'candidate json must be preserved');
    assert.ok(dailyEntries.includes('state.json'), 'state.json must be preserved');
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('does not rotate older cloud backups automatically', async () => {
  const env = await setupIsolatedEnv();
  try {
    // Seed 35 daily backups and 14 monthly backups
    for (let i = 1; i <= 35; i++) {
      const d = new Date(Date.UTC(2026, 9, 21 - i)).toISOString().slice(0, 10);
      await mkdir(join(env.driveBackupDir, 'daily', d), { recursive: true });
    }
    for (let m = 1; m <= 14; m++) {
      const ym = new Date(Date.UTC(2026, 9 - m, 1)).toISOString().slice(0, 7);
      await mkdir(join(env.driveBackupDir, 'monthly', ym), { recursive: true });
    }

    const res = spawnSync(process.execPath, [scriptPath, '--commit', '--date', '2026-10-21'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        ACTUAL_PILOT_DIR: env.pilotDir,
        ACTUAL_DAILY_DIR: env.dailyDir,
        ACTUAL_BACKUP_DEST: env.driveBackupDir,
        ACTUAL_API_PATH: env.apiMockPath,
        ACTUAL_SESSION_TOKEN: 'test-token',
      },
    });
    assert.equal(res.status, 0, res.stderr);

    const dailyDirs = (await readdir(join(env.driveBackupDir, 'daily'))).sort();
    assert.equal(dailyDirs.length, 36);
    assert.equal(dailyDirs[dailyDirs.length - 1], '2026-10-21');

    const monthlyDirs = (await readdir(join(env.driveBackupDir, 'monthly'))).sort();
    assert.equal(monthlyDirs.length, 15);
    assert.equal(monthlyDirs[monthlyDirs.length - 1], '2026-10');
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('waits for activeRun in state.json or write.lock to clear before backing up', async () => {
  const env = await setupIsolatedEnv();
  try {
    // Start with activeRun set and write.lock present
    await writeFile(join(env.dailyDir, 'state.json'), JSON.stringify({
      version: 1,
      dailyThrough: '2026-10-20',
      activeRun: { id: 'run-in-progress', startedAt: '2026-10-22T11:10:00Z' },
    }));
    await mkdir(join(env.dailyDir, 'write.lock'));

    // Spawn a background timer that clears write.lock and activeRun after 150ms
    const timer = setTimeout(async () => {
      await rm(join(env.dailyDir, 'write.lock'), { recursive: true, force: true });
      await writeFile(join(env.dailyDir, 'state.json'), JSON.stringify({
        version: 1,
        dailyThrough: '2026-10-21',
        activeRun: null,
      }));
    }, 150);

    const childResult = await new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, [scriptPath, '--commit', '--date', '2026-10-22'], {
        env: {
          ...process.env,
          ACTUAL_PILOT_DIR: env.pilotDir,
          ACTUAL_DAILY_DIR: env.dailyDir,
          ACTUAL_BACKUP_DEST: env.driveBackupDir,
          ACTUAL_API_PATH: env.apiMockPath,
          ACTUAL_SESSION_TOKEN: 'test-token',
          ACTUAL_BACKUP_POLL_MS: '50',
          ACTUAL_BACKUP_MAX_WAIT_MS: '2000',
        },
      });
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => { stdout += d; });
      proc.stderr.on('data', d => { stderr += d; });
      proc.on('error', reject);
      proc.on('close', status => resolve({ status, stdout, stderr }));
    });
    clearTimeout(timer);
    assert.equal(childResult.status, 0, childResult.stderr);
    const out = JSON.parse(childResult.stdout);
    assert.ok(out.waitedForIdleMs >= 50, `Expected waitedForIdleMs >= 50, got ${out.waitedForIdleMs}`);
    assert.equal(out.proceededWithActiveRun, false);

    // Verify the backed up state.json has the updated dailyThrough ('2026-10-21') and activeRun: null
    const backedUpState = JSON.parse(await readFile(join(env.driveBackupDir, 'daily', '2026-10-22', 'state.json'), 'utf8'));
    assert.equal(backedUpState.dailyThrough, '2026-10-21');
    assert.equal(backedUpState.activeRun, null);
  } finally {
    await rm(env.root, { recursive: true, force: true });
  }
});

test('fails closed if the active run persists past the deadline',async()=>{
 const e=await setupIsolatedEnv();try{
  await writeFile(join(e.dailyDir,'state.json'),JSON.stringify({activeRun:{id:'busy'}}));
  const r=spawnSync(process.execPath,[scriptPath,'--commit','--date','2026-10-22'],{encoding:'utf8',env:{...process.env,ACTUAL_PILOT_DIR:e.pilotDir,ACTUAL_BACKUP_DEST:e.driveBackupDir,ACTUAL_API_PATH:e.apiMockPath,ACTUAL_SESSION_TOKEN:'test-token',ACTUAL_BACKUP_POLL_MS:'20',ACTUAL_BACKUP_MAX_WAIT_MS:'80'}});
  assert.notEqual(r.status,0);assert.deepEqual(await readdir(e.driveBackupDir),[]);
 }finally{await rm(e.root,{recursive:true,force:true})}
});
test('force does not overwrite existing daily or monthly backup',async()=>{
 const e=await setupIsolatedEnv();try{
  const day=join(e.driveBackupDir,'daily','2026-10-22');await mkdir(day,{recursive:true});await writeFile(join(day,'manifest.json'),'keep');
  const r=spawnSync(process.execPath,[scriptPath,'--commit','--force','--date','2026-10-22'],{encoding:'utf8',env:{...process.env,ACTUAL_PILOT_DIR:e.pilotDir,ACTUAL_BACKUP_DEST:e.driveBackupDir,ACTUAL_API_PATH:e.apiMockPath,ACTUAL_SESSION_TOKEN:'test-token'}});
  assert.notEqual(r.status,0);assert.equal(await readFile(join(day,'manifest.json'),'utf8'),'keep');
 }finally{await rm(e.root,{recursive:true,force:true})}
});
test('failed export cleans only its own client directory',async()=>{
 const e=await setupIsolatedEnv();try{
  await writeFile(e.apiMockPath,"export async function init(){};export async function downloadBudget(){throw Error('export failed')};export async function shutdown(){};");
  await mkdir(join(e.dailyDir,'client-elsewhere'));
  const r=spawnSync(process.execPath,[scriptPath,'--commit','--date','2026-10-22'],{encoding:'utf8',env:{...process.env,ACTUAL_PILOT_DIR:e.pilotDir,ACTUAL_BACKUP_DEST:e.driveBackupDir,ACTUAL_API_PATH:e.apiMockPath,ACTUAL_SESSION_TOKEN:'test-token'}});
  assert.notEqual(r.status,0);assert.deepEqual((await readdir(e.dailyDir)).filter(x=>x.startsWith('client-')),['client-elsewhere']);
 }finally{await rm(e.root,{recursive:true,force:true})}
});

