import initSqlJs from "sql.js/dist/sql-asm.js";
import type { SqlDatabase, SqlExecutor, SqlParam } from "../sqlite-store";

/**
 * Adaptateur de test : moteur SQLite réel (sql.js, compilé en JS) exposé avec
 * la même interface qu'expo-sqlite, pour exécuter le vrai SQL du store.
 */
export async function createSqlJsDatabase(): Promise<SqlDatabase> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const executor: SqlExecutor = {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, params: SqlParam[]) {
      db.run(source, params);
    },
    async getAllAsync<T>(source: string, params: SqlParam[]) {
      const statement = db.prepare(source);
      statement.bind(params);
      const rows: T[] = [];
      while (statement.step()) rows.push(statement.getAsObject() as T);
      statement.free();
      return rows;
    },
    async getFirstAsync<T>(source: string, params: SqlParam[]) {
      const rows = await executor.getAllAsync<T>(source, params);
      return rows[0] ?? null;
    },
  };
  let file: Promise<void> = Promise.resolve();
  return {
    ...executor,
    withExclusiveTransactionAsync(task) {
      const run = file.then(async () => {
        db.exec("BEGIN");
        try {
          await task(executor);
          db.exec("COMMIT");
        } catch (error) {
          db.exec("ROLLBACK");
          throw error;
        }
      });
      file = run.catch(() => undefined);
      return run;
    },
  };
}
