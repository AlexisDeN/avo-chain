// src/infrastructure/factories/StorageFactory.ts
export interface StorageProvider {
  uploadImage(fileBuffer: Buffer, filename: string): Promise<string>;
}

export class IPFSStorageProvider implements StorageProvider {
  async uploadImage(_fileBuffer: Buffer, filename: string): Promise<string> {
    return `ipfs://QmAvoChainMock/${encodeURIComponent(filename)}`;
  }
}

export class StorageFactory {
  static getProvider(type: "IPFS" | "S3"): StorageProvider {
    if (type === "IPFS") return new IPFSStorageProvider();
    throw new Error("Proveedor de almacenamiento no soportado.");
  }
}
