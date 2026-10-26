export interface IBlockchainAdapter {
  registrarLoteBlockchain(idLote: string, pesoKg: number, fincaId: string): Promise<string>;
  despacharLote(idLote: string, conductorId: string): Promise<string>;
  recibirEnPuntoVenta(idLote: string, usuarioId: string): Promise<string>;
  quemarQrVendido(idLote: string, vendedorId: string): Promise<string>;
  registrarEvento(idLote: string, tipo: string): Promise<string>;
}