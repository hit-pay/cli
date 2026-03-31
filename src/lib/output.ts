import chalk from 'chalk';
import Table from 'cli-table3';

let jsonMode = false;

export function setJsonMode(enabled: boolean): void {
  jsonMode = enabled;
}

export function isJsonMode(): boolean {
  return jsonMode;
}

/** Print data as JSON or human-readable table */
export function printData(data: unknown): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else if (Array.isArray(data)) {
    printTable(data);
  } else if (typeof data === 'object' && data !== null) {
    printKeyValue(data as Record<string, unknown>);
  } else {
    console.log(data);
  }
}

/** Print array of objects as a table */
export function printTable(rows: Record<string, unknown>[], columns?: string[]): void {
  if (rows.length === 0) {
    console.log(chalk.dim('No results.'));
    return;
  }

  const cols = columns || Object.keys(rows[0]);
  const table = new Table({
    head: cols.map((c) => chalk.bold(c)),
    style: { head: [], border: [] },
  });

  for (const row of rows) {
    table.push(cols.map((c) => formatValue(row[c])));
  }

  console.log(table.toString());
}

/** Print a single object as key-value pairs */
export function printKeyValue(obj: Record<string, unknown>): void {
  const table = new Table({
    style: { head: [], border: [] },
  });

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      table.push([chalk.bold(key), formatValue(value)]);
    }
  }

  console.log(table.toString());
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return chalk.dim('—');
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

/** Print success message */
export function success(msg: string): void {
  if (!jsonMode) {
    console.log(chalk.green('✓') + ' ' + msg);
  }
}

/** Print error message */
export function error(msg: string): void {
  console.error(chalk.red('✗') + ' ' + msg);
}

/** Print info message */
export function info(msg: string): void {
  if (!jsonMode) {
    console.log(chalk.blue('ℹ') + ' ' + msg);
  }
}

/** Print warning message */
export function warn(msg: string): void {
  if (!jsonMode) {
    console.log(chalk.yellow('⚠') + ' ' + msg);
  }
}
