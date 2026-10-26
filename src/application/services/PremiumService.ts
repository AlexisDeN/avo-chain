import { AvoChainMongoRepository } from "../../infrastructure/database/AvoChainMongoRepository";

export class PremiumService {
  constructor(private readonly repository: AvoChainMongoRepository) {}

  async reportes(email: string) {
    await this.exigirPremium(email);
    const [lotes, fincas] = await Promise.all([this.repository.listarLotes(), this.repository.listarFincas()]);
    const fincaNombre = new Map(fincas.map((finca) => [finca.id, finca.nombre]));
    const porFinca = new Map<string, { finca: string; lotes: number; kilos: number; incidentes: number }>();
    const porEstado = new Map<string, number>();
    for (const lote of lotes) {
      const nombre = fincaNombre.get(lote.fincaId) || lote.fincaId;
      const metrics = porFinca.get(lote.fincaId) || { finca: nombre, lotes: 0, kilos: 0, incidentes: 0 };
      metrics.lotes += 1;
      metrics.kilos += lote.pesoKg;
      metrics.incidentes += lote.incidentes.length;
      porFinca.set(lote.fincaId, metrics);
      porEstado.set(lote.estado, (porEstado.get(lote.estado) || 0) + 1);
    }
    return {
      generadosEn: new Date().toISOString(),
      totalLotes: lotes.length,
      totalFincas: fincas.length,
      totalViajes: lotes.filter((lote) => Boolean(lote.conductorId) || lote.eventos.some((evento) => evento.tipo === "Despacho")).length,
      totalTransportadores: new Set(lotes.map((lote) => lote.conductorId).filter(Boolean)).size,
      totalKg: lotes.reduce((total, lote) => total + lote.pesoKg, 0),
      totalIncidentes: lotes.reduce((total, lote) => total + lote.incidentes.length, 0),
      porEstado: Array.from(porEstado, ([estado, cantidad]) => ({ estado, cantidad })),
      porFinca: Array.from(porFinca.values()).sort((a, b) => b.kilos - a.kilos)
    };
  }

  async dashboard(email: string) {
    const reporte = await this.reportes(email);
    const estados = new Map(reporte.porEstado.map(({ estado, cantidad }) => [estado, cantidad]));
    return {
      ...reporte,
      totales: reporte.totalLotes,
      registrados: estados.get("Registrado") || 0,
      aprobadosCalidad: estados.get("Aprobado_Calidad") || 0,
      rechazadosOrigen: estados.get("Rechazado_En_Origen") || 0,
      enTransito: estados.get("En Transito") || 0,
      enPuntoDeVenta: estados.get("En Punto de Venta") || 0,
      vendidos: estados.get("Vendido") || 0
    };
  }

  async historialCsv(email: string, idLote: string): Promise<string> {
    await this.exigirPremium(email);
    const lote = await this.repository.requireLote(idLote);
    const eventos = [...lote.eventos].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const filas = [
      ["Lote", "Variedad", "Estado actual", "Fecha", "Evento", "Actor", "Detalle", "Hash blockchain"],
      ...eventos.map((evento) => [lote.id, lote.variedad, lote.estado, evento.fecha, evento.tipo, evento.actor, evento.detalle, evento.txHash || ""])
    ];
    return `\uFEFF${filas.map((fila) => fila.map((valor) => this.csv(valor)).join(",")).join("\r\n")}`;
  }

  private async exigirPremium(emailValue: string): Promise<void> {
    if (!emailValue || !(await this.repository.tienePremium(emailValue))) {
      throw new Error("Esta función requiere el plan Premium. Actívalo con Wompi o con la demostración de pago.");
    }
  }

  private csv(value: unknown): string {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }
}
