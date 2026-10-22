import { getStorageConfig } from "@/server/config";
import type { MediaStorage } from "@/server/storage/types";

export type { MediaStorage, StoredAsset } from "@/server/storage/types";

const globalForStorage = globalThis as typeof globalThis & { __starreelStorage?: Promise<MediaStorage> };

/** The configured storage driver. Drivers load lazily so unused ones cost nothing. */
export function getStorage(): Promise<MediaStorage> {
  globalForStorage.__starreelStorage ??= (async () => {
    const config = getStorageConfig();
    if (config.driver === "cloudinary") {
      const { CloudinaryMediaStorage } = await import("@/server/storage/cloudinary");
      return new CloudinaryMediaStorage(config);
    }
    const { LocalMediaStorage } = await import("@/server/storage/local");
    return new LocalMediaStorage(config.root);
  })().catch((error) => {
    globalForStorage.__starreelStorage = undefined;
    throw error;
  });
  return globalForStorage.__starreelStorage;
}
