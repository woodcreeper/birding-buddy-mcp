import fs from "fs";
import path from "path";
import type { LifeListData, LifeListStore } from "./life-list.js";

const LIFE_LIST_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || "~",
  ".ebird-mcp"
);
const LIFE_LIST_PATH = path.join(LIFE_LIST_DIR, "life-list.json");

export class LocalLifeListStore implements LifeListStore {
  async save(data: LifeListData): Promise<void> {
    fs.mkdirSync(LIFE_LIST_DIR, { recursive: true });
    fs.writeFileSync(LIFE_LIST_PATH, JSON.stringify(data, null, 2), "utf-8");
  }

  async load(): Promise<LifeListData | null> {
    try {
      const raw = fs.readFileSync(LIFE_LIST_PATH, "utf-8");
      return JSON.parse(raw) as LifeListData;
    } catch {
      return null;
    }
  }
}
