import { requestApi } from "../plans/api";
import { parseApiData } from "../network/http";
import {
  pushResultSchema,
  snapshotSchema,
  toWire,
  type LocalOperation,
  type OperationResult,
  type Snapshot,
} from "./contracts";

export interface SyncApi {
  /** null : rien n'a changé depuis le curseur (204). */
  pull(curseur: string | null): Promise<Snapshot | null>;
  push(
    operations: LocalOperation[],
  ): Promise<{ resultats: OperationResult[]; instantane: Snapshot }>;
}

export const httpSyncApi: SyncApi = {
  async pull(curseur) {
    const query = curseur ? `?curseur=${encodeURIComponent(curseur)}` : "";
    const body = await requestApi(`/sync/me${query}`);
    return body === null ? null : parseApiData(snapshotSchema, body);
  },
  async push(operations) {
    return parseApiData(pushResultSchema,
      await requestApi("/sync/me/operations", "POST", {
        operations: operations.map(toWire),
      }),
    );
  },
};
