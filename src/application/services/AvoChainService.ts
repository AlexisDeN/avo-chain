import { randomUUID } from "node:crypto";
import { FincaBuilder } from "../../domain/entities/FincaBuilder";
import { EventoTrazabilidad, IncidenteRuta, Lote, LoteConOrigen } from "../../domain/entities/Lote";
import { QRGeneratorSingleton } from "../../domain/entities/QRGeneratorSingleton";
import { createLoteContextFromEstado } from "../../domain/state/LoteState";
import { BlockchainAdapter, OfflineScanProxy } from "../../infrastructure/adapters/BlockchainAdapter";
import { AvoChainMemoryRepository } from "../../infrastructure/database/AvoChainMemoryRepository";
import { StorageFactory } from "../../infrastructure/factories/StorageFactory";
import {
  ActualizarLoteDto,
  AsignarConductorDto,
  EscanearRecepcionDto,
  EvidenciaDto,
  RegistrarFincaDto,
  RegistrarLoteDto,
  ReportarIncidenteDto,
  VenderLoteDto
} from "../dtos/AvoChainDtos";

export class AvoChainService {
  private blockchain = new BlockchainAdapter();
  private offlineProxy = new OfflineScanProxy(this.blockchain);
  private storage = StorageFactory.getProvider("IPFS");
  private qrGenerator = QRGeneratorSingleton.getInstance();

  constructor(private repository: AvoChainMemoryRepository) {}

  listarLotes(): Lote[] {
    return this.repository.listarLotes();
  }

  registrarFinca(dto: RegistrarFincaDto) {
    if (dto.certificadoPdfSizeBytes && dto.certificadoPdfSizeBytes > 2 * 1024 * 1024) {
      throw new Error("El certificado PDF no puede pesar mas de 2MB.");
    }

    const finca = new FincaBuilder()
      .setId(`FINCA-${String(this.repository.listarFincas().length + 1).padStart(3, "0")}`)
      .setNombre(dto.nombre)
      .setICA(dto.registroICA)
      .setGPS(dto.gps)
      .setCertificado(dto.certificadoPdfUrl)
      .build();

    return this.repository.guardarFinca(finca);
  }

  async registrarLote(dto: RegistrarLoteDto): Promise<Lote> {
    if (dto.rol !== "Productor") throw new Error("La billetera no tiene permisos de Productor.");
    if (!dto.pesoKg || dto.pesoKg <= 0) throw new Error("El peso del lote debe ser mayor a 0 kg.");
    if (!dto.fincaId || !dto.variedad || !dto.fechaCosecha || !dto.wallet) {
      throw new Error("Finca, variedad, fecha, peso y wallet son obligatorios.");
    }
    if (!this.repository.buscarFinca(dto.fincaId)?.activa) {
      throw new Error("La finca no existe o no esta activa.");
    }

    const id = `AVO-${new Date(dto.fechaCosecha).getUTCFullYear()}-${String(this.repository.listarLotes().length + 1025).padStart(5, "0")}`;
    const txHash = await this.blockchain.registrarLoteBlockchain(id, dto.pesoKg, dto.fincaId);
    const lote: Lote = {
      id,
      pesoKg: dto.pesoKg,
      variedad: dto.variedad,
      fechaCosecha: dto.fechaCosecha,
      fincaId: dto.fincaId,
      estado: "Registrado",
      productorWallet: dto.wallet,
      qrGenerado: false,
      qrImpreso: false,
      txHashRegistro: txHash,
      evidencias: [],
      incidentes: [],
      eventos: [this.evento("Registro", "Productor", "Lote registrado en blockchain.", txHash)]
    };

    return this.repository.guardarLote(lote);
  }

  actualizarLote(idLote: string, dto: ActualizarLoteDto): Lote {
    if (dto.rol !== "Administrador") throw new Error("Solo el administrador puede editar bloques.");
    const lote = this.repository.requireLote(idLote);
    if (lote.estado === "Vendido") throw new Error("No se puede editar un bloque vendido.");
    if (dto.pesoKg !== undefined && dto.pesoKg <= 0) throw new Error("El peso del lote debe ser mayor a 0 kg.");
    if (dto.fincaId && !this.repository.buscarFinca(dto.fincaId)?.activa) throw new Error("La finca no existe o no esta activa.");

    lote.pesoKg = dto.pesoKg ?? lote.pesoKg;
    lote.variedad = dto.variedad?.trim() || lote.variedad;
    lote.fechaCosecha = dto.fechaCosecha || lote.fechaCosecha;
    lote.fincaId = dto.fincaId || lote.fincaId;
    lote.eventos.push(this.evento("Edicion", "Administrador", "Bloque actualizado desde administracion."));
    return this.repository.guardarLote(lote);
  }

  eliminarLote(idLote: string, rol: string): { eliminado: true; idLote: string } {
    if (rol !== "Administrador") throw new Error("Solo el administrador puede eliminar bloques.");
    const lote = this.repository.requireLote(idLote);
    if (lote.estado === "Vendido") throw new Error("No se puede eliminar un bloque vendido.");
    this.repository.eliminarLote(idLote);
    return { eliminado: true, idLote };
  }

  async agregarEvidencias(idLote: string, fotos: EvidenciaDto[]): Promise<Lote> {
    if (fotos.length < 1 || fotos.length > 5) throw new Error("Debes subir minimo 1 foto y maximo 5.");
    const lote = this.repository.requireLote(idLote);

    for (const foto of fotos) {
      if (!["image/jpeg", "image/png"].includes(foto.mimeType)) throw new Error("Solo se permiten fotos JPG o PNG.");
      if (foto.sizeBytes > 5 * 1024 * 1024) throw new Error("Cada foto debe pesar maximo 5MB.");
      const url = await this.storage.uploadImage(Buffer.from(foto.filename), foto.filename);
      lote.evidencias.push({ id: randomUUID(), ...foto, url });
    }

    lote.eventos.push(this.evento("Evidencia", "Productor", `${fotos.length} foto(s) guardadas en IPFS.`));
    return this.repository.guardarLote(lote);
  }

  async asignarConductor(idLote: string, dto: AsignarConductorDto): Promise<Lote> {
    if (dto.rol !== "Bodeguero") throw new Error("Solo el jefe de bodega puede despachar lotes.");
    if (dto.pinConfirmacion !== "1234") throw new Error("PIN de confirmacion invalido.");
    const lote = this.repository.requireLote(idLote);
    const context = createLoteContextFromEstado(lote.estado);
    context.despachar();

    const txHash = await this.blockchain.despacharLote(idLote, dto.conductorId);
    lote.estado = context.getEstadoNombre();
    lote.conductorId = dto.conductorId;
    lote.eventos.push(this.evento("Despacho", "Bodeguero", `Asignado a ${dto.conductorNombre}.`, txHash));
    return this.repository.guardarLote(lote);
  }

  async generarQR(idLote: string, autorizarReimpresion = false) {
    const lote = this.repository.requireLote(idLote);
    if (lote.estado !== "Registrado" && lote.estado !== "En Punto de Venta") {
      throw new Error("Solo se puede generar QR para un lote registrado o disponible para venta.");
    }
    if (lote.qrImpreso && !autorizarReimpresion) {
      throw new Error("El QR ya fue impreso. Se requiere autorizacion de jefe para reimprimir.");
    }

    const qrBase64 = await this.qrGenerator.generarQRBase64(idLote);
    lote.qrGenerado = true;
    lote.qrImpreso = true;
    lote.eventos.push(this.evento("QR", "Bodeguero", "QR generado con correccion de errores alta."));
    this.repository.guardarLote(lote);
    return { idLote, qrBase64 };
  }

  async recibirEnPuntoVenta(idLote: string, dto: EscanearRecepcionDto): Promise<Lote | { offlineStored: boolean; msg: string }> {
    const lote = this.repository.requireLote(idLote);
    if (dto.rutaEsperada && dto.rutaActual && dto.rutaEsperada !== dto.rutaActual) {
      throw new Error("Alerta: la caja no corresponde a esta ruta.");
    }
    if (dto.online === false) {
      return this.offlineProxy.escanearQR(idLote, dto.usuarioId, false);
    }

    const context = createLoteContextFromEstado(lote.estado);
    context.recibirEnPuntoVenta();
    const result = await this.offlineProxy.escanearQR(idLote, dto.usuarioId, true);
    lote.estado = context.getEstadoNombre();
    lote.eventos.push(this.evento("Recepcion", "Tienda", "QR escaneado en punto de venta.", result.txHash));
    return this.repository.guardarLote(lote);
  }

  async venderLote(idLote: string, dto: VenderLoteDto): Promise<Lote> {
    if (dto.rol !== "Vendedor") throw new Error("Solo el vendedor con permisos puede quemar el QR.");
    const lote = this.repository.requireLote(idLote);
    const context = createLoteContextFromEstado(lote.estado);
    context.vender();

    const txHash = await this.blockchain.quemarQrVendido(idLote, dto.vendedorId);
    lote.estado = context.getEstadoNombre();
    lote.eventos.push(this.evento("Venta", "Vendedor", "QR quemado despues de la venta.", txHash));
    return this.repository.guardarLote(lote);
  }

  async reportarIncidente(idLote: string, dto: ReportarIncidenteDto): Promise<Lote> {
    const lote = this.repository.requireLote(idLote);
    if (lote.conductorId !== dto.conductorId) {
      throw new Error("Solo se pueden reportar problemas de las cajas asignadas al conductor.");
    }
    if (!dto.comentario || dto.comentario.length > 180) throw new Error("El comentario es obligatorio y debe ser corto.");
    if (dto.tipo === "Dano en Empaque" && !dto.foto) throw new Error("Para dano en empaque debes subir foto.");

    const fotoUrl = dto.foto ? await this.storage.uploadImage(Buffer.from(dto.foto.filename), dto.foto.filename) : undefined;
    const incidente: IncidenteRuta = {
      id: randomUUID(),
      tipo: dto.tipo,
      comentario: dto.comentario,
      conductorId: dto.conductorId,
      fotoUrl,
      creadoEn: new Date().toISOString()
    };
    const txHash = await this.blockchain.registrarEvento(idLote, "incidente");
    lote.eventos.push(this.evento("Incidente", "Transportador", dto.tipo, txHash));
    return this.repository.agregarIncidente(idLote, incidente);
  }

  consultarOrigen(idLote: string): LoteConOrigen {
    const lote = this.repository.requireLote(idLote);
    if (lote.estado === "Vendido") {
      throw new Error("ALERTA: Codigo Reutilizado / Producto ya vendido.");
    }
    const finca = this.repository.buscarFinca(lote.fincaId);
    if (!finca) throw new Error("Finca de origen no encontrada.");
    return { ...lote, finca, autentico: true };
  }

  obtenerDashboard() {
    const lotes = this.repository.listarLotes();
    const porEstado = {
      registrados: lotes.filter((lote) => lote.estado === "Registrado").length,
      enTransito: lotes.filter((lote) => lote.estado === "En Transito").length,
      enPuntoDeVenta: lotes.filter((lote) => lote.estado === "En Punto de Venta").length,
      vendidos: lotes.filter((lote) => lote.estado === "Vendido").length
    };

    return {
      totales: lotes.length,
      ...porEstado,
      ultimosIncidentes: lotes.flatMap((lote) => lote.incidentes.map((incidente) => ({ idLote: lote.id, ...incidente }))).slice(-5)
    };
  }

  private evento(tipo: string, actor: string, detalle: string, txHash?: string): EventoTrazabilidad {
    return { tipo, actor, detalle, txHash, fecha: new Date().toISOString() };
  }
}
