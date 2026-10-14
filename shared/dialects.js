/**
 * Renders the abstract schema from `schema.js` into concrete DDL for a given
 * dialect. Two dialects are supported:
 *
 *   mysql   -> TiDB Cloud Starter (the cloud hub)
 *   sqlite  -> the local database on the shop PC
 *
 * Add a new column type in `schema.js`, then teach both maps below about it.
 */

const MYSQL_TYPES = {
  id: () => 'CHAR(26)',
  string: (c) => `VARCHAR(${c.length ?? 255})`,
  text: () => 'TEXT',
  int: () => 'INT',
  bigint: () => 'BIGINT',
  bool: () => 'TINYINT(1)',
  json: () => 'JSON',
};

const SQLITE_TYPES = {
  id: () => 'TEXT',
  string: () => 'TEXT',
  text: () => 'TEXT',
  int: () => 'INTEGER',
  bigint: () => 'INTEGER',
  bool: () => 'INTEGER',
  json: () => 'TEXT',
};

function quote(name, dialect) {
  return dialect === 'mysql' ? `\`${name}\`` : `"${name}"`;
}

function formatDefault(value) {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function columnSql(column, dialect, types) {
  return '  ' + columnDefinition(column, dialect, types);
}

/**
 * Render one column definition (without leading indentation) so it can be used
 * both inside CREATE TABLE and in ALTER TABLE ADD COLUMN migrations.
 */
export function columnDefinition(column, dialect, typesOverride) {
  const types = typesOverride ?? (dialect === 'mysql' ? MYSQL_TYPES : SQLITE_TYPES);
  const parts = [quote(column.name, dialect), types[column.type](column)];
  if (dialect === 'mysql') {
    parts.push(column.nullable ? 'NULL' : 'NOT NULL');
  } else if (!column.nullable) {
    parts.push('NOT NULL');
  }
  if (column.default !== undefined) {
    parts.push(`DEFAULT ${formatDefault(column.default)}`);
  }
  return parts.join(' ');
}

/** MySQL/TiDB statements (one CREATE TABLE per table). */
export function mysqlStatements(tables) {
  const statements = [];
  for (const table of tables) {
    const lines = table.columns.map((c) => columnSql(c, 'mysql', MYSQL_TYPES));
    const pk = table.primaryKey ?? 'id';
    lines.push(`  PRIMARY KEY (${quote(pk, 'mysql')})`);
    for (const column of table.columns) {
      if (column.unique) {
        lines.push(
          `  UNIQUE KEY ${quote(`uk_${table.name}_${column.name}`, 'mysql')} (${quote(column.name, 'mysql')})`,
        );
      }
    }
    for (const index of table.indexes ?? []) {
      const kind = index.unique ? 'UNIQUE KEY' : 'KEY';
      const cols = index.columns.map((c) => quote(c, 'mysql')).join(', ');
      lines.push(`  ${kind} ${quote(index.name, 'mysql')} (${cols})`);
    }
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${quote(table.name, 'mysql')} (\n` +
        `${lines.join(',\n')}\n` +
        ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci',
    );
  }
  return statements;
}

/** SQLite statements (CREATE TABLE + CREATE INDEX, all idempotent). */
export function sqliteStatements(tables) {
  const statements = [];
  for (const table of tables) {
    const lines = table.columns.map((c) => columnSql(c, 'sqlite', SQLITE_TYPES));
    const pk = table.primaryKey ?? 'id';
    lines.push(`  PRIMARY KEY (${quote(pk, 'sqlite')})`);
    statements.push(
      `CREATE TABLE IF NOT EXISTS ${quote(table.name, 'sqlite')} (\n${lines.join(',\n')}\n)`,
    );
    for (const column of table.columns) {
      if (column.unique) {
        statements.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${quote(`uk_${table.name}_${column.name}`, 'sqlite')} ` +
            `ON ${quote(table.name, 'sqlite')} (${quote(column.name, 'sqlite')})`,
        );
      }
    }
    for (const index of table.indexes ?? []) {
      const unique = index.unique ? 'UNIQUE ' : '';
      const cols = index.columns.map((c) => quote(c, 'sqlite')).join(', ');
      statements.push(
        `CREATE ${unique}INDEX IF NOT EXISTS ${quote(index.name, 'sqlite')} ` +
          `ON ${quote(table.name, 'sqlite')} (${cols})`,
      );
    }
  }
  return statements;
}

export function renderMySQL(tables) {
  return mysqlStatements(tables).join(';\n\n') + ';';
}

export function renderSQLite(tables) {
  return sqliteStatements(tables).join(';\n\n') + ';';
}
