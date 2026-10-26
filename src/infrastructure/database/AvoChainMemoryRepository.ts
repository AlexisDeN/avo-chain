import { Finca } from "../../domain/entities/FincaBuilder";
import { IncidenteRuta, Lote } from "../../domain/entities/Lote";

export class AvoChainMemoryRepository {
  private fincas = new Map<string, Finca>();
  private lotes = new Map<string, Lote>();

  constructor() {
    this.seed();
  }

  guardarFinca(finca: Finca): Finca {
    const existeICA = Array.from(this.fincas.values()).some((item) => item.registroICA === finca.registroICA);
    if (existeICA) {
      throw new Error("El registro ICA ya existe en la base de datos.");
    }

    this.fincas.set(finca.id, finca);
    return finca;
  }

  buscarFinca(id: string): Finca | undefined {
    return this.fincas.get(id);
  }

  listarFincas(): Finca[] {
    return Array.from(this.fincas.values());
  }

  guardarLote(lote: Lote): Lote {
    this.lotes.set(lote.id, lote);
    return lote;
  }

  buscarLote(id: string): Lote | undefined {
    return this.lotes.get(id);
  }

  listarLotes(): Lote[] {
    return Array.from(this.lotes.values());
  }

  eliminarLote(id: string): void {
    if (!this.lotes.delete(id)) {
      throw new Error("Producto Falso o No Registrado.");
    }
  }

  agregarIncidente(idLote: string, incidente: IncidenteRuta): Lote {
    const lote = this.requireLote(idLote);
    lote.incidentes.push(incidente);
    return lote;
  }

  requireLote(id: string): Lote {
    const lote = this.buscarLote(id);
    if (!lote) {
      throw new Error("Producto Falso o No Registrado.");
    }

    return lote;
  }

  private seed(): void {
    const finca: Finca = {
      id: "FINCA-001",
      nombre: "Finca Las Palmas",
      registroICA: "ICA-12345",
      gps: "19.4207,-102.0629",
      certificadoPdfUrl: "https://avochain.local/certificados/FINCA-001.pdf",
      activa: true
    };

    this.fincas.set(finca.id, finca);
    this.lotes.set("AVO-2026-01024", {
      id: "AVO-2026-01024",
      pesoKg: 250,
      variedad: "Hass",
      fechaCosecha: "2026-09-13",
      fincaId: finca.id,
      estado: "En Punto de Venta",
      productorWallet: "0x819C...4U21",
      conductorId: "COND-001",
      qrGenerado: true,
      qrImpreso: true,
      txHashRegistro: "0xregistro01024",
      evidencias: [
        {
          id: "EVD-001",
          filename: "aguacates-origen.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 400000,
          url: "ipfs://QmAvoChainOrigen/aguacates-origen.jpg"
        }
      ],
      incidentes: [
        {
          id: "INC-001",
          tipo: "Retraso por Via",
          comentario: "Retencion corta en carretera.",
          conductorId: "COND-001",
          creadoEn: new Date("2026-09-13T15:00:00.000Z").toISOString()
        }
      ],
      eventos: [
        {
          tipo: "Registro",
          actor: "Productor",
          fecha: "2026-09-13T14:00:00.000Z",
          detalle: "Lote registrado en blockchain.",
          txHash: "0xregistro01024"
        },
        {
          tipo: "Despacho",
          actor: "Bodeguero",
          fecha: "2026-09-13T14:30:00.000Z",
          detalle: "Lote asignado al conductor COND-001.",
          txHash: "0xdespacho01024"
        },
        {
          tipo: "Recepcion",
          actor: "Tienda",
          fecha: "2026-09-13T16:00:00.000Z",
          detalle: "Lote recibido en punto de venta.",
          txHash: "0xrecepcion01024"
        }
      ]
    });
  }
}
