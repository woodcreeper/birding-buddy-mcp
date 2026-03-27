import type { LifeListData, LifeListStore } from "./life-list.js";

const KV_KEY = "life-list";

export class KVLifeListStore implements LifeListStore {
  constructor(private kv: KVNamespace) {}

  async save(data: LifeListData): Promise<void> {
    await this.kv.put(KV_KEY, JSON.stringify(data));
  }

  async load(): Promise<LifeListData | null> {
    const raw = await this.kv.get(KV_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LifeListData;
  }
}
