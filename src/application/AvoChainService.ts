import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { FincaBuilder } from "../domain/entities/FincaBuilder";
import { EventoTrazabilidad, IncidenteRuta, Lote, LoteConOrigen, InspeccionCalidad } from "../domain/entities/Lote";
import { QRGeneratorSingleton } from "../domain/entities/QRGeneratorSingleton";
import { createLoteContextFromEstado } from "../domain/state/LoteState";
import { ExportQualityStrategy, NationalQualityStrategy } from "../domain/quality/QualityStrategy";
import { ReceptionValidationChain } from "./services/ReceptionValidationChain";
import { BlockchainAdapter, OfflineScanProxy } from "../infrastructure/adapters/BlockchainAdapter";
import { AvoChainMongoRepository } from "../infrastructure/database/AvoChainMongoRepository";
import { StorageFactory } from "../infrastructure/factories/StorageFactory";
import {
  ActualizarLoteDto,
  AsignarConductorDto,
  InspeccionarCalidadDto,
  ConfirmarRecepcionDto,
  EscanearRecepcionDto,
  EvidenciaDto,
  RegistrarFincaDto,
  RegistrarLoteDto,
  ReportarIncidenteDto,
  VenderLoteDto
} from "./dtos/AvoChainDtos";

export class AvoChainService {
  private blockchain = new BlockchainAdapter();
  private offlineProxy = new OfflineScanProxy(this.blockchain);
  private storage = StorageFactory.getProvider("IPFS");
  private qrGenerator = QRGeneratorSingleton.getInstance();

  constructor(private repository: AvoChainMongoRepository) {}

  async listarLotes(): Promise<Lote[]> {
    return this.repository.listarLotes();
  }

  async listarFincas() {
    return this.repository.listarFincas();
  }

  async obtenerDetalleLoteAdmin(idLote: string) {
    const lote = await this.repository.requireLote(idLote);
    const finca = await this.repository.buscarFinca(lote.fincaId);
    const ultimaUbicacion = [...lote.incidentes].reverse().find((incidente) => incidente.ubicacion)?.ubicacion;
    const ultimoIncidenteConUbicacion = [...lote.incidentes].reverse().find((incidente) => incidente.ubicacion);
    let ubicacionActual: Record<string, unknown>;
    if (lote.estado === "En Transito") {
      ubicacionActual = ultimaUbicacion && ultimoIncidenteConUbicacion
        ? { ...ultimaUbicacion, fuente: `Último reporte GPS: ${ultimoIncidenteConUbicacion.tipo}`, actualizadaEn: ultimoIncidenteConUbicacion.creadoEn, enTiempoReal: false }
        : { descripcion: "Sin ubicación GPS reportada durante el tránsito", enTiempoReal: false };
    } else if (lote.estado === "En Punto de Venta") {
      ubicacionActual = { descripcion: "En punto de venta", actualizadaEn: lote.recepcionDestino?.recibidoEn, enTiempoReal: false };
    } else if (lote.estado === "Vendido") {
      ubicacionActual = { descripcion: "Lote vendido", actualizadaEn: [...lote.eventos].reverse().find((evento) => evento.tipo === "Venta")?.fecha, enTiempoReal: false };
    } else {
      ubicacionActual = ultimaUbicacion && ultimoIncidenteConUbicacion
        ? { ...ultimaUbicacion, fuente: `Último reporte GPS: ${ultimoIncidenteConUbicacion.tipo}`, actualizadaEn: ultimoIncidenteConUbicacion.creadoEn, enTiempoReal: false }
        : { descripcion: "Ubicación aún no reportada", enTiempoReal: false };
    }
    return { ...lote, finca, ubicacionActual, ultimaUbicacionGPS: ultimoIncidenteConUbicacion ? { ...ultimoIncidenteConUbicacion.ubicacion, incidente: ultimoIncidenteConUbicacion.tipo, reportadaEn: ultimoIncidenteConUbicacion.creadoEn } : null };
  }

  async registrarFinca(dto: RegistrarFincaDto) {
    if (dto.certificadoPdfSizeBytes && dto.certificadoPdfSizeBytes > 2 * 1024 * 1024) {
      throw new Error("El certificado PDF no puede pesar mas de 2MB.");
    }

    const fincasExistentes = await this.repository.listarFincas();
    const finca = new FincaBuilder()
      .setId(`FINCA-${String(fincasExistentes.length + 1).padStart(3, "0")}`)
      .setNombre(dto.nombre)
      .setICA(dto.registroICA)
      .setGPS(dto.gps)
      .setCertificado(dto.certificadoPdfUrl)
      .build();
    finca.productorWallet = dto.wallet || "0x819C...4U21";

    return this.repository.guardarFinca(finca);
  }

  async registrarLote(dto: RegistrarLoteDto): Promise<Lote> {
    if (dto.rol !== "Productor") throw new Error("La billetera no tiene permisos de Productor.");
    if (!dto.pesoKg || dto.pesoKg <= 0) throw new Error("El peso del lote debe ser mayor a 0 kg.");
    if (!dto.fincaId || !dto.variedad || !dto.fechaCosecha || !dto.wallet) {
      throw new Error("Finca, variedad, fecha, peso y wallet son obligatorios.");
    }
    
    const finca = await this.repository.buscarFinca(dto.fincaId);
    if (!finca?.activa) {
      throw new Error("La finca no existe o no esta activa.");
    }

    const lotesExistentes = await this.repository.listarLotes();
    const id = `AVO-${new Date(dto.fechaCosecha).getUTCFullYear()}-${String(lotesExistentes.length + 1025).padStart(5, "0")}`;
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

  async actualizarLote(idLote: string, dto: ActualizarLoteDto): Promise<Lote> {
    if (dto.rol !== "Administrador") throw new Error("Solo el administrador puede editar bloques.");
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado === "Vendido") throw new Error("No se puede editar un bloque vendido.");
    if (dto.pesoKg !== undefined && dto.pesoKg <= 0) throw new Error("El peso del lote debe ser mayor a 0 kg.");
    
    if (dto.fincaId) {
      const finca = await this.repository.buscarFinca(dto.fincaId);
      if (!finca?.activa) throw new Error("La finca no existe o no esta activa.");
    }

    lote.pesoKg = dto.pesoKg ?? lote.pesoKg;
    lote.variedad = dto.variedad?.trim() || lote.variedad;
    lote.fechaCosecha = dto.fechaCosecha || lote.fechaCosecha;
    lote.fincaId = dto.fincaId || lote.fincaId;
    lote.eventos.push(this.evento("Edicion", "Administrador", "Bloque actualizado desde administracion."));
    return this.repository.guardarLote(lote);
  }

  async eliminarLote(idLote: string, rol: string): Promise<{ eliminado: true; idLote: string }> {
    if (rol !== "Administrador") throw new Error("Solo el administrador puede eliminar bloques.");
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado === "Vendido") throw new Error("No se puede eliminar un bloque vendido.");
    await this.repository.eliminarLote(idLote);
    return { eliminado: true, idLote };
  }

  async agregarEvidencias(idLote: string, fotos: EvidenciaDto[]): Promise<Lote> {
    if (fotos.length < 1 || fotos.length > 5) throw new Error("Debes subir minimo 1 foto y maximo 5.");
    const lote = await this.repository.requireLote(idLote);

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
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado !== "Aprobado_Calidad") throw new Error("El lote debe estar Aprobado_Calidad antes del despacho.");
    const context = createLoteContextFromEstado(lote.estado);
    context.despachar();

    const txHash = await this.blockchain.despacharLote(idLote, dto.conductorId);
    lote.estado = context.getEstadoNombre();
    lote.conductorId = dto.conductorId;
    lote.eventos.push(this.evento("Despacho", "Bodeguero", `Asignado a ${dto.conductorNombre}.`, txHash));
    return this.repository.guardarLote(lote);
  }

  async inspeccionarCalidad(idLote: string, dto: InspeccionarCalidadDto): Promise<Lote> {
    if (dto.rol !== "Inspector de calidad") throw new Error("Solo un inspector de calidad autorizado puede evaluar el lote.");
    if (!dto.inspectorId || !["Nacional", "Exportacion"].includes(dto.destino)) throw new Error("Inspector y destino son obligatorios.");
    if (!Number.isFinite(dto.humedad) || !Number.isFinite(dto.temperaturaC)) throw new Error("Humedad y temperatura deben ser valores numéricos.");
    if (dto.informePdfMimeType !== "application/pdf" || !dto.informePdfUrl?.trim() || !Number.isInteger(dto.informePdfSizeBytes) || dto.informePdfSizeBytes <= 0 || dto.informePdfSizeBytes > 2 * 1024 * 1024) {
      throw new Error("Se requiere un informe PDF válido de máximo 2MB.");
    }
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado !== "Registrado") throw new Error("Solo se pueden inspeccionar lotes registrados.");
    if (lote.inspeccionCalidad) throw new Error("La inspección firmada es inmutable y ya existe.");

    const strategy = dto.destino === "Exportacion" ? new ExportQualityStrategy() : new NationalQualityStrategy();
    const aprobada = strategy.evaluar(dto);
    const calidad: InspeccionCalidad = {
      humedad: dto.humedad, temperaturaC: dto.temperaturaC,
      evaluacionFitosanitaria: dto.evaluacionFitosanitaria, destino: dto.destino,
      aprobada, informePdfUrl: dto.informePdfUrl, informePdfSizeBytes: dto.informePdfSizeBytes,
      firmadoEn: new Date().toISOString(), inspectorId: dto.inspectorId,
      hashInforme: createHash("sha256").update(`${dto.informePdfUrl}:${dto.informePdfSizeBytes}:${dto.inspectorId}:${Date.now()}`).digest("hex")
    };
    lote.inspeccionCalidad = calidad;
    lote.estado = aprobada ? "Aprobado_Calidad" : "Rechazado_En_Origen";
    const txHash = await this.blockchain.registrarEvento(idLote, aprobada ? "calidad_aprobada" : "calidad_rechazada");
    lote.eventos.push(this.evento("InspeccionCalidad", "Inspector de calidad", aprobada ? "Lote aprobado." : "Lote rechazado en origen.", txHash));
    return this.repository.guardarLote(lote);
  }

  async confirmarRecepcionDestino(idLote: string, dto: ConfirmarRecepcionDto): Promise<Lote> {
    const lote = await this.repository.requireLote(idLote);
    new ReceptionValidationChain().validar(lote.estado, dto);
    if (dto.temperaturaMaximaRutaC !== undefined && !Number.isFinite(dto.temperaturaMaximaRutaC)) throw new Error("La temperatura máxima de ruta no es válida.");
    const txHash = await this.blockchain.recibirEnPuntoVenta(idLote, dto.receptorId);
    lote.estado = "En Punto de Venta";
    lote.recepcionDestino = { temperaturaC: dto.temperaturaC, cajasDanadas: dto.cajasDanadas, temperaturaMaximaRutaC: dto.temperaturaMaximaRutaC, recibidoPor: dto.receptorId, recibidoEn: new Date().toISOString() };
    lote.eventos.push(this.evento("RecepcionDestino", "Receptor", `Recepción confirmada; ${dto.cajasDanadas} cajas dañadas.`, txHash));
    if ((dto.temperaturaMaximaRutaC ?? 0) > 12) lote.eventos.push(this.evento("AlertaTemperatura", "Sistema", `Temperatura máxima de ruta ${dto.temperaturaMaximaRutaC}°C superó 12°C.`));
    return this.repository.guardarLote(lote);
  }

  async generarQR(idLote: string, autorizarReimpresion = false) {
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado !== "Aprobado_Calidad" && lote.estado !== "En Punto de Venta") {
      throw new Error("Solo se puede generar QR para un lote registrado o disponible para venta.");
    }
    if (lote.qrImpreso && !autorizarReimpresion) {
      throw new Error("El QR ya fue impreso. Se requiere autorizacion de jefe para reimprimir.");
    }

    const qrBase64 = await this.qrGenerator.generarQRBase64(idLote);
    lote.qrGenerado = true;
    lote.qrImpreso = true;
    lote.eventos.push(this.evento("QR", "Bodeguero", "QR generado con correccion de errores alta."));
    await this.repository.guardarLote(lote);
    return { idLote, qrBase64 };
  }

  async recibirEnPuntoVenta(idLote: string, dto: EscanearRecepcionDto): Promise<Lote | { offlineStored: boolean; msg: string }> {
    const lote = await this.repository.requireLote(idLote);
    if (dto.rutaEsperada && dto.rutaActual && dto.rutaEsperada !== dto.rutaActual) {
      throw new Error("Alerta: la caja no corresponde a esta ruta.");
    }
    if (dto.online === false) {
      return this.offlineProxy.escanearQR(idLote, dto.usuarioId, false);
    }

    throw new Error("La recepción final requiere rol, temperatura y cajas dañadas. Usa /recepcion-destino.");

  }

  async venderLote(idLote: string, dto: VenderLoteDto): Promise<Lote> {
    if (dto.rol !== "Vendedor") throw new Error("Solo el vendedor con permisos puede quemar el QR.");
    const lote = await this.repository.requireLote(idLote);
    const context = createLoteContextFromEstado(lote.estado);
    context.vender();

    const txHash = await this.blockchain.quemarQrVendido(idLote, dto.vendedorId);
    lote.estado = context.getEstadoNombre();
    lote.eventos.push(this.evento("Venta", "Vendedor", "QR quemado despues de la venta.", txHash));
    return this.repository.guardarLote(lote);
  }

  async reportarIncidente(idLote: string, dto: ReportarIncidenteDto): Promise<Lote> {
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado !== "En Transito") throw new Error("Solo se pueden reportar sucesos de un lote que está En Transito.");
    if (lote.conductorId !== dto.conductorId) {
      throw new Error("Solo se pueden reportar problemas de las cajas asignadas al conductor.");
    }
    if (!dto.comentario || dto.comentario.length > 180) throw new Error("El comentario es obligatorio y debe ser corto.");
    if (!dto.ubicacion || !Number.isFinite(dto.ubicacion.latitud) || dto.ubicacion.latitud < -90 || dto.ubicacion.latitud > 90 || !Number.isFinite(dto.ubicacion.longitud) || dto.ubicacion.longitud < -180 || dto.ubicacion.longitud > 180) {
      throw new Error("Indica una ubicación GPS válida para el incidente.");
    }
    if (dto.ubicacion.referencia && dto.ubicacion.referencia.length > 120) throw new Error("La referencia de ubicación no puede superar 120 caracteres.");
    if (dto.tipo === "Dano en Empaque" && !dto.foto) throw new Error("Para daño en empaque debes adjuntar foto.");

    const fotoUrl = dto.foto ? await this.storage.uploadImage(Buffer.from(dto.foto.filename), dto.foto.filename) : undefined;
    const incidente: IncidenteRuta = {
      id: randomUUID(),
      tipo: dto.tipo,
      comentario: dto.comentario,
      conductorId: dto.conductorId,
      ubicacion: dto.ubicacion,
      fotoUrl,
      creadoEn: new Date().toISOString()
    };
    const txHash = await this.blockchain.registrarEvento(idLote, dto.tipo);
    lote.incidentes.push(incidente);
    lote.eventos.push(this.evento("IncidenteRuta", "Transportador", `${dto.tipo}: ${dto.comentario}`, txHash));
    return this.repository.guardarLote(lote);
  }

  async consultarOrigen(idLote: string): Promise<LoteConOrigen> {
    const lote = await this.repository.requireLote(idLote);
    if (lote.estado === "Vendido") {
      throw new Error("ALERTA: Codigo Reutilizado / Producto ya vendido.");
    }
    const finca = await this.repository.buscarFinca(lote.fincaId);
    if (!finca) throw new Error("Finca de origen no encontrada.");
    return { ...lote, finca, autentico: true };
  }

  async obtenerDashboard() {
    const lotes = await this.repository.listarLotes();
    const porEstado = {
      registrados: lotes.filter((lote) => lote.estado === "Registrado").length,
      aprobadosCalidad: lotes.filter((lote) => lote.estado === "Aprobado_Calidad").length,
      rechazadosOrigen: lotes.filter((lote) => lote.estado === "Rechazado_En_Origen").length,
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
