import { env } from "../env.js";
import { LocalMediaStorage } from "./local.js";
import { R2MediaStorage } from "./r2.js";
import type { MediaStorage } from "./storage.js";

let storage: MediaStorage | undefined;

export function getMediaStorage(): MediaStorage {
  if (storage) return storage;
  storage = env.MEDIA_DRIVER === "r2" ? new R2MediaStorage() : new LocalMediaStorage();
  return storage;
}

export type { MediaObjectStream, MediaStorage } from "./storage.js";
