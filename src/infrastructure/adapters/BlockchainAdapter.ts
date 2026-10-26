import { IBlockchainAdapter } from "./IBlockchainAdapter";

export class BlockchainAdapter implements IBlockchainAdapter {
  async registrarLoteBlockchain(idLote: string, pesoKg: number, fincaId: string): Promise<string> {
    return this.withTimeout(this.mockTx("registro", idLote, `${pesoKg}-${fincaId}`), 5000);
  }

  async despacharLote(idLote: string, conductorId: string): Promise<string> {
    return this.withTimeout(this.mockTx("despacho", idLote, conductorId), 5000);
  }

  async recibirEnPuntoVenta(idLote: string, usuarioId: string): Promise<string> {
    return this.withTimeout(this.mockTx("recepcion", idLote, usuarioId), 5000);
  }

  async quemarQrVendido(idLote: string, vendedorId: string): Promise<string> {
    return this.withTimeout(this.mockTx("venta", idLote, vendedorId), 5000);
  }

  async registrarEvento(idLote: string, tipo: string): Promise<string> {
    return this.withTimeout(this.mockTx("evento", idLote, tipo), 5000);
  }

  private async mockTx(operacion: string, idLote: string, detalle: string): Promise<string> {
    const raw = `${operacion}-${idLote}-${detalle}-${Date.now()}`;
    return `0x${Buffer.from(raw).toString("hex").slice(0, 32)}`;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeout = new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Timeout de conexion blockchain.")), timeoutMs);
    });

    return Promise.race([promise, timeout]);
  }
}

export class OfflineScanProxy {
  private colaLocales: Array<{ idLote: string; usuario: string; fecha: Date }> = [];

  constructor(private blockchainAdapter: IBlockchainAdapter) {} // Usa la interfaz para soltura del patron

  async escanearQR(idLote: string, usuario: string, isOnline: boolean) {
    if (!isOnline) {
      this.colaLocales.push({ idLote, usuario, fecha: new Date() });
      return { offlineStored: true, msg: "Guardado localmente sin internet." };
    }

    const txHash = await this.blockchainAdapter.recibirEnPuntoVenta(idLote, usuario);
    return { offlineStored: false, msg: "Transaccion confirmada en red.", txHash };
  }
}