import { Lote, LoteConOrigen } from "../domain/entities/Lote";

export interface IAvoChainRepository {
  guardarLote(lote: Lote): Promise<void>;
  obtenerLotePorId(id: string): Promise<Lote | null>;
  obtenerLoteConOrigen(id: string): Promise<LoteConOrigen | null>;
  actualizarLote(lote: Lote): Promise<void>;
  listarLotes(): Promise<Lote[]>;
}