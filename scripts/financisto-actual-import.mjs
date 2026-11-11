#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_CUTOFF = '2022-02-18';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:5006';
const DEFAULT_CLIENT_DATA_DIR = path.join(os.homedir(), 'Actual-pilot', 'financisto-import-client');
const DEFAULT_ACCOUNT_PREFIX = 'Financisto histórico';
const DEFAULT_EXPENSE_GROUP = 'Financisto histórico (importado)';
const DEFAULT_INCOME_GROUP = 'Financisto histórico (importado · ingresos)';
const CURRENCIES = new Set(['CLP', 'USD']);

const FIELD_NAMES = [
  'date',
  'time',
  'account',
  'amount',
  'currency',
  'original amount',
  'original currency',
  'category',
  'parent',
  'payee',
  'location',
  'project',
  'note',
];

function clean(value) {
  return String(value ?? '').trim();
}

function parseSemicolonCsv(text) {
  const input = String(text).replace(/^\ufeff/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
  };

  const pushRow = () => {
    pushCell();
    if (row.some(value => value !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ';') {
      pushCell();
    } else if (character === '\n') {
      pushRow();
    } else if (character === '\r') {
      if (input[index + 1] === '\n') index += 1;
      pushRow();
    } else {
      cell += character;
    }
  }

  if (quoted) throw new Error('CSV inválido: falta cerrar una comilla.');
  if (cell !== '' || row.length > 0) pushRow();

  if (rows.length === 0) return [];
  const headers = rows.shift().map((header, index) => index === 0 ? header.replace(/^\ufeff/, '') : header);

  return rows.map((values, rowIndex) => {
    if (values.length > headers.length) {
      throw new Error(`CSV inválido en la fila ${rowIndex + 2}: hay más columnas que encabezados.`);
    }
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

export function parseFinancistoCsv(text) {
  const rows = parseSemicolonCsv(text);
  const missingFields = FIELD_NAMES.filter(field => !rows.every(row => Object.hasOwn(row, field)));
  if (rows.length > 0 && missingFields.length > 0) {
    throw new Error(`CSV de Financisto sin columnas esperadas: ${missingFields.join(', ')}`);
  }
  return rows;
}

export function parseFinancistoAmount(value) {
  const raw = clean(value).replace(/\s/g, '');
  if (raw === '') return null;

  const sign = raw.startsWith('-') ? -1 : 1;
  const unsigned = raw.replace(/^[+-]/, '');
  let integerPart = unsigned;
  let decimalPart = '';

  const commaIndex = unsigned.lastIndexOf(',');
  const dotIndex = unsigned.lastIndexOf('.');
  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) {
      integerPart = unsigned.slice(0, commaIndex).replaceAll('.', '');
      decimalPart = unsigned.slice(commaIndex + 1);
    } else {
      integerPart = unsigned.slice(0, dotIndex).replaceAll(',', '');
      decimalPart = unsigned.slice(dotIndex + 1);
    }
  } else if (commaIndex >= 0) {
    integerPart = unsigned.slice(0, commaIndex);
    decimalPart = unsigned.slice(commaIndex + 1);
  } else if (dotIndex >= 0) {
    const trailingDigits = unsigned.length - dotIndex - 1;
    if (trailingDigits <= 2) {
      integerPart = unsigned.slice(0, dotIndex);
      decimalPart = unsigned.slice(dotIndex + 1);
    } else {
      integerPart = unsigned.replaceAll('.', '');
    }
  }

  integerPart = integerPart.replaceAll('.', '').replaceAll(',', '');
  if (!/^\d+$/.test(integerPart) || !/^\d*$/.test(decimalPart) || decimalPart.length > 2) {
    throw new Error(`Monto de Financisto inválido: ${value}`);
  }

  const cents = Number(integerPart) * 100 + Number(decimalPart.padEnd(2, '0') || 0);
  if (!Number.isSafeInteger(cents)) throw new Error(`Monto de Financisto fuera de rango: ${value}`);
  return sign * cents;
}

function validateDate(date, fieldName = 'fecha') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${fieldName} inválida: ${date}`);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${fieldName} inválida: ${date}`);
  }
  return date;
}

function categoryLabel(row) {
  const category = clean(row.category);
  const parent = clean(row.parent);
  if (!category && !parent) return null;
  if (!parent || !category) return category || parent;
  return `${parent} / ${category}`;
}

function transactionNotes(row) {
  const notes = [];
  const note = clean(row.note);
  const project = clean(row.project);
  const location = clean(row.location);
  const originalAmount = clean(row['original amount']);
  const originalCurrency = clean(row['original currency']);

  if (note) notes.push(note);
  if (project && project !== note) notes.push(`Proyecto: ${project}`);
  if (location) notes.push(`Lugar: ${location}`);
  if (originalAmount || originalCurrency) {
    notes.push(`Original: ${[originalAmount, originalCurrency].filter(Boolean).join(' ')}`);
  }
  return notes.join('\n') || undefined;
}

function sourceId(row, rowIndex) {
  const sourceFields = [
    rowIndex,
    row.date,
    row.time,
    row.account,
    row.amount,
    row.currency,
    row['original amount'],
    row['original currency'],
    row.category,
    row.parent,
    row.payee,
    row.location,
    row.project,
    row.note,
  ].map(value => String(value ?? ''));
  const digest = createHash('sha256').update(sourceFields.join('\u001f'), 'utf8').digest('hex');
  return `financisto-csv-${digest.slice(0, 32)}`;
}

export function buildImportPlan(rows, { cutoff = DEFAULT_CUTOFF, accountPrefix = DEFAULT_ACCOUNT_PREFIX, excludedRecords = [] } = {}) {
  validateDate(cutoff, 'corte');
  const groups = new Map();
  const categoryDefinitions = new Map();
  const byCurrency = {};
  let excludedFutureRows = 0;

  rows.forEach((row, rowIndex) => {
    if (excludedRecords.includes(rowIndex + 1)) return;
    const date = validateDate(clean(row.date));
    if (date > cutoff) {
      excludedFutureRows += 1;
      return;
    }

    const currency = clean(row.currency).toUpperCase();
    if (!CURRENCIES.has(currency)) throw new Error(`Moneda no soportada en la fila ${rowIndex + 2}: ${currency}`);
    const sourceAccount = clean(row.account);
    if (!sourceAccount) throw new Error(`Cuenta vacía en la fila ${rowIndex + 2}.`);
    const amount = parseFinancistoAmount(row.amount);
    if (amount === null) throw new Error(`Monto vacío en la fila ${rowIndex + 2}.`);

    const label = categoryLabel(row);
    const isIncome = label === 'Sueldo';
    const groupKey = `${currency}\u001f${sourceAccount}`;
    const group = groups.get(groupKey) ?? {
      currency,
      sourceAccount,
      targetAccount: `${accountPrefix} / ${sourceAccount}`,
      transactions: [],
    };
    const payee = clean(row.payee) || undefined;
    group.transactions.push({
      date,
      amount,
      payee,
      importedPayee: payee,
      categoryLabel: label,
      isIncome,
      notes: transactionNotes(row),
      imported_id: sourceId(row, rowIndex),
    });
    groups.set(groupKey, group);
    byCurrency[currency] = (byCurrency[currency] ?? 0) + 1;

    if (label) {
      const categoryKey = `${currency}\u001f${label}`;
      categoryDefinitions.set(categoryKey, { currency, label, isIncome });
    }
  });

  const sortedGroups = [...groups.values()]
    .sort((left, right) => left.currency.localeCompare(right.currency) || left.sourceAccount.localeCompare(right.sourceAccount, 'es'));
  for (const group of sortedGroups) {
    group.transactions.sort((left, right) => left.date.localeCompare(right.date) || left.imported_id.localeCompare(right.imported_id));
  }

  return {
    cutoff,
    totalRows: rows.length,
    includedRows: sortedGroups.reduce((sum, group) => sum + group.transactions.length, 0),
    excludedFutureRows,
    byCurrency,
    groups: sortedGroups,
    categories: [...categoryDefinitions.values()].sort((left, right) => left.currency.localeCompare(right.currency) || left.label.localeCompare(right.label, 'es')),
  };
}

function printPlan(plan, csvPath) {
  console.log(`CSV: ${csvPath}`);
  console.log(`Corte histórico: ${plan.cutoff}`);
  console.log(`Filas totales: ${plan.totalRows}`);
  console.log(`Se importarían: ${plan.includedRows}`);
  console.log(`Se excluirían por ser posteriores al corte: ${plan.excludedFutureRows}`);
  console.log(`Monedas: ${Object.entries(plan.byCurrency).map(([currency, count]) => `${currency}=${count}`).join(', ')}`);
  console.log(`Cuentas históricas: ${plan.groups.length}`);
  console.log(`Categorías históricas: ${plan.categories.length}`);
  for (const group of plan.groups) {
    console.log(`  ${group.currency} | ${group.sourceAccount} -> ${group.targetAccount} | ${group.transactions.length}`);
  }
}

function parseArguments(argv) {
  const options = {
    cutoff: DEFAULT_CUTOFF,
    serverUrl: process.env.ACTUAL_SERVER_URL || DEFAULT_SERVER_URL,
    clientDataDir: process.env.ACTUAL_CLIENT_DATA_DIR || DEFAULT_CLIENT_DATA_DIR,
    accountPrefix: DEFAULT_ACCOUNT_PREFIX,
    write: false,
    allowRules: false,
    batchSize: 500,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--write') options.write = true;
    else if (argument === '--allow-rules') options.allowRules = true;
    else if (argument === '--csv') options.csvPath = argv[++index];
    else if (argument === '--cutoff') options.cutoff = argv[++index];
    else if (argument === '--server-url') options.serverUrl = argv[++index];
    else if (argument === '--client-data-dir') options.clientDataDir = argv[++index];
    else if (argument === '--backup-dir') options.backupDir = argv[++index];
    else if (argument === '--clp-sync-id') options.clpSyncId = argv[++index];
    else if (argument === '--usd-sync-id') options.usdSyncId = argv[++index];
    else if (argument === '--batch-size') options.batchSize = Number(argv[++index]);
    else if (argument === '--help' || argument === '-h') options.help = true;
    else throw new Error(`Argumento desconocido: ${argument}`);
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1) throw new Error('--batch-size debe ser un entero positivo.');
  return options;
}

function printHelp() {
  console.log(`Uso:
  node scripts/financisto-actual-import.mjs --csv <archivo.csv>
  node scripts/financisto-actual-import.mjs --csv <archivo.csv> --write \
    --clp-sync-id <sync-id-clp> --usd-sync-id <sync-id-usd>

Por defecto solo muestra un dry-run. --write requiere ACTUAL_SESSION_TOKEN o ACTUAL_PASSWORD y exporta
un respaldo ZIP de cada presupuesto antes de modificarlo.

Opciones:
  --cutoff <YYYY-MM-DD>       Corte histórico (por defecto: ${DEFAULT_CUTOFF})
  --server-url <URL>          URL del servidor Actual
  --client-data-dir <DIR>     Caché local del cliente API
  --backup-dir <DIR>          Carpeta para ZIPs previos a la importación
  --clp-sync-id <ID>          Sync ID del presupuesto CLP
  --usd-sync-id <ID>          Sync ID del presupuesto USD
  --batch-size <N>            Transacciones por lote (por defecto: 500)
  --allow-rules               Permite importar aunque el presupuesto tenga reglas
  --write                     Ejecuta la escritura; sin esto solo hay dry-run
`);
}

function resolveActualApiModule() {
  if (process.env.ACTUAL_API_MODULE) return process.env.ACTUAL_API_MODULE;
  const nodePrefix = path.dirname(path.dirname(process.execPath));
  return path.join(nodePrefix, 'lib', 'node_modules', '@actual-app', 'cli', 'node_modules', '@actual-app', 'api', 'dist', 'index.js');
}

function slug(value) {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
}

function budgetForCurrency(plan, currency, options) {
  const syncId = currency === 'CLP' ? options.clpSyncId : options.usdSyncId;
  if (!syncId) throw new Error(`Falta --${currency.toLowerCase()}-sync-id para importar ${currency}.`);
  return { currency, syncId, groups: plan.groups.filter(group => group.currency === currency) };
}

async function loadBudget(api, syncId) {
  await api.downloadBudget(syncId);
  const budget = (await api.getBudgets()).find(item => item.groupId === syncId || item.cloudFileId === syncId);
  if (!budget) throw new Error(`No se pudo resolver el presupuesto para sync ID ${syncId}.`);
  await api.loadBudget(budget.id);
  return budget;
}

async function ensureCategoryGroup(apiRuntime, api, name, isIncome) {
  let groups = await api.getCategoryGroups();
  let group = groups.find(item => item.name === name && Boolean(item.is_income) === isIncome);
  if (group) return group;

  const id = await apiRuntime.send('category-group-create', { name, isIncome, hidden: false });
  groups = await api.getCategoryGroups();
  group = groups.find(item => item.id === id);
  if (!group || Boolean(group.is_income) !== isIncome) {
    throw new Error(`Actual no creó correctamente el grupo de categorías "${name}".`);
  }
  return group;
}

async function ensureCategories(apiRuntime, api, categoryDefinitions) {
  const expenseGroup = await ensureCategoryGroup(apiRuntime, api, DEFAULT_EXPENSE_GROUP, false);
  const incomeDefinitions = categoryDefinitions.filter(category => category.isIncome);
  const incomeGroup = incomeDefinitions.length > 0
    ? await ensureCategoryGroup(apiRuntime, api, DEFAULT_INCOME_GROUP, true)
    : null;
  const existing = await api.getCategories();
  const categoryIds = new Map();

  for (const definition of categoryDefinitions) {
    const group = definition.isIncome ? incomeGroup : expenseGroup;
    let category = existing.find(item => item.name === definition.label && item.group_id === group.id);
    if (!category) {
      const id = await api.createCategory({
        name: definition.label,
        group_id: group.id,
        is_income: definition.isIncome,
        hidden: false,
      });
      category = { id, name: definition.label, group_id: group.id, is_income: definition.isIncome };
      existing.push(category);
    }
    categoryIds.set(`${definition.currency}\u001f${definition.label}`, category.id);
  }
  return categoryIds;
}

export async function ensureAccounts(api, groups) {
  const accounts = await api.getAccounts();
  const accountIds = new Map();
  for (const group of groups) {
    let account = accounts.find(item => item.name === group.targetAccount);
    if (account) {
      if (account.offbudget) {
        throw new Error(`La cuenta "${group.targetAccount}" está fuera de presupuesto. Se requiere una cuenta dentro de presupuesto para conservar categorías.`);
      }
    } else {
      const id = await api.createAccount({ name: group.targetAccount, offbudget: false, closed: false });
      account = { id, name: group.targetAccount, offbudget: false, closed: false };
      accounts.push(account);
    }
    accountIds.set(group.sourceAccount, account.id);
  }
  return accountIds;
}

async function ensurePayees(api, groups) {
  const payees = await api.getPayees();
  const payeeIds = new Map(payees.map(payee => [payee.name.toLocaleLowerCase('es'), payee.id]));
  const names = new Set(groups.flatMap(group => group.transactions.map(transaction => transaction.payee).filter(Boolean)));
  for (const name of names) {
    const key = name.toLocaleLowerCase('es');
    if (!payeeIds.has(key)) {
      const id = await api.createPayee({ name });
      payeeIds.set(key, id);
    }
  }
  return payeeIds;
}

async function existingImportedIds(api, accountId, startDate, endDate) {
  const transactions = await api.getTransactions(accountId, startDate, endDate);
  return new Set(transactions.map(transaction => transaction.imported_id).filter(Boolean));
}

async function exportBackup(api, budget, backupDir) {
  await mkdir(backupDir, { recursive: true });
  const fileName = `${slug(budget.name || budget.id)}-before-financisto.zip`;
  const bytes = await api.exportBudget();
  await writeFile(path.join(backupDir, fileName), bytes);
  return path.join(backupDir, fileName);
}

async function importBudgetPlan(apiRuntime, api, budgetConfig, plan, options, backupDir) {
  const budget = await loadBudget(api, budgetConfig.syncId);
  const rules = await api.getRules();
  if (rules.length > 0 && !options.allowRules) {
    throw new Error(`El presupuesto "${budget.name}" tiene ${rules.length} regla(s). Ejecuta con --allow-rules solo después de revisarlas.`);
  }

  const backupPath = await exportBackup(api, budget, backupDir);
  const definitions = plan.categories.filter(category => category.currency === budgetConfig.currency);
  const categoryIds = await ensureCategories(apiRuntime, api, definitions);
  const accountIds = await ensureAccounts(api, budgetConfig.groups);
  const payeeIds = await ensurePayees(api, budgetConfig.groups);
  const results = [];

  for (const group of budgetConfig.groups) {
    const accountId = accountIds.get(group.sourceAccount);
    const startDate = group.transactions[0]?.date || plan.cutoff;
    const existingIds = await existingImportedIds(api, accountId, startDate, plan.cutoff);
    const pending = group.transactions.filter(transaction => !existingIds.has(transaction.imported_id));
    for (let index = 0; index < pending.length; index += options.batchSize) {
      const batch = pending.slice(index, index + options.batchSize).map(transaction => ({
        date: transaction.date,
        amount: transaction.amount,
        imported_id: transaction.imported_id,
        cleared: true,
        ...(transaction.payee ? {
          payee: payeeIds.get(transaction.payee.toLocaleLowerCase('es')),
          imported_payee: transaction.importedPayee,
        } : {}),
        ...(transaction.categoryLabel ? { category: categoryIds.get(`${budgetConfig.currency}\u001f${transaction.categoryLabel}`) } : {}),
        ...(transaction.notes ? { notes: transaction.notes } : {}),
      }));
      await api.addTransactions(accountId, batch, { runTransfers: false, learnCategories: false });
    }
    results.push({
      currency: group.currency,
      sourceAccount: group.sourceAccount,
      targetAccount: group.targetAccount,
      accountId,
      requested: group.transactions.length,
      skippedExisting: group.transactions.length - pending.length,
      added: pending.length,
    });
  }

  await api.sync();
  return { budget: budget.name, syncId: budgetConfig.syncId, backupPath, groups: results };
}

export function resolveAuthentication(env = process.env) {
  if (env.ACTUAL_SESSION_TOKEN) return { sessionToken: env.ACTUAL_SESSION_TOKEN };
  if (env.ACTUAL_PASSWORD) return { password: env.ACTUAL_PASSWORD };
  throw new Error('Para --write debes definir ACTUAL_SESSION_TOKEN o ACTUAL_PASSWORD; no lo guardes en el archivo.');
}

async function runWrite(plan, options) {
  const authentication = resolveAuthentication();
  const configs = [budgetForCurrency(plan, 'CLP', options), budgetForCurrency(plan, 'USD', options)];
  const backupDir = options.backupDir || path.join(os.homedir(), 'Actual-pilot-backups', `financisto-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  const apiModule = await import(pathToFileURL(resolveActualApiModule()).href);
  const apiRuntime = await apiModule.init({
    serverURL: options.serverUrl,
    dataDir: options.clientDataDir,
    ...authentication,
  });
  const results = [];
  try {
    for (const config of configs) {
      results.push(await importBudgetPlan(apiRuntime, apiModule, config, plan, options, backupDir));
    }
  } finally {
    await apiModule.shutdown();
  }
  console.log(`Importación terminada. Respaldos: ${backupDir}`);
  for (const result of results) {
    console.log(`  ${result.budget}: ${result.groups.reduce((total, group) => total + group.added, 0)} agregadas, ${result.groups.reduce((total, group) => total + group.skippedExisting, 0)} ya existentes`);
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    printHelp();
    return;
  }
  if (!options.csvPath) throw new Error('Falta --csv <archivo.csv>.');

  const rows = parseFinancistoCsv(await readFile(options.csvPath, 'utf8'));
  let excludedRecords = [];
  const decisionPath = path.join(os.homedir(), 'Actual-pilot', 'financisto-pilot-20260904', 'decision-duplicate-bch-mach.json');
  try {
    const decision = JSON.parse(await readFile(decisionPath, 'utf8'));
    if (decision.source === path.basename(options.csvPath)) {
      // Bind the reviewed record numbers to their exact content before skipping.
      for (const record of decision.excludeRecords) {
        const row = rows[record - 1];
        if (!row || `${row.date} ${row.time}` !== decision.timestamp || row.currency !== decision.currency ||
            ![decision.fromAccount, decision.toAccount].includes(row.account) ||
            Math.abs(parseFinancistoAmount(row.amount)) !== decision.amount * 100) {
          throw new Error('El CSV no coincide con los registros excluidos; revisar antes de reimportar.');
        }
      }
      excludedRecords = decision.excludeRecords;
      console.log(`Registros excluidos por decisión de reconciliación: ${excludedRecords.join(', ')}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  try {
    const decision = JSON.parse(await readFile(path.join(path.dirname(decisionPath), 'decision-duplicate-bci-cash.json'), 'utf8'));
    if (decision.source === path.basename(options.csvPath)) {
      for (const expected of decision.exclude) {
        const row = rows[expected.record - 1];
        if (!row || Object.entries(expected).some(([key, value]) => key !== 'record' && row[key] !== value)) throw new Error('El CSV no coincide con las exclusiones BCI/Cash revisadas.');
        excludedRecords.push(expected.record);
      }
      console.log(`Exclusiones de reconciliación totales: ${excludedRecords.length}`);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const plan = buildImportPlan(rows, { cutoff: options.cutoff, accountPrefix: options.accountPrefix, excludedRecords });
  printPlan(plan, options.csvPath);
  if (!options.write) {
    console.log('Dry-run: no se modificó Actual. Usa --write después de revisar este resumen.');
    return plan;
  }
  await runWrite(plan, options);
  return plan;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
