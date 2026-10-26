import { Collection, Db, Document, MongoClient, ObjectId } from "mongodb";
import { Finca } from "../../domain/entities/FincaBuilder";
import { IncidenteRuta, Lote } from "../../domain/entities/Lote";

type StoredFinca = Document & { codigoInterno: string; productorId: ObjectId; datosAplicacion: Finca };
type StoredLote = Document & { codigoLote: string; fincaId: ObjectId; datosAplicacion: Lote };

export interface PaymentOrder {
  reference: string;
  email: string;
  amountInCents: number;
  currency: "COP";
  status: "PENDING" | "APPROVED" | "DECLINED" | "ERROR" | "VOIDED";
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class AvoChainMongoRepository {
  private client: MongoClient;
  private db!: Db;
  private usuarios!: Collection<Document>;
  private fincas!: Collection<StoredFinca>;
  private lotes!: Collection<StoredLote>;
  private pagos!: Collection<PaymentOrder & Document>;
  private premium!: Collection<Document>;

  constructor(uri = process.env.MONGODB_URI || "mongodb://avoadmin:change-this-password@127.0.0.1:27018/avochain?authSource=admin") {
    this.client = new MongoClient(uri);
  }

  async conectar(): Promise<void> {
    await this.client.connect();
    this.db = this.client.db(process.env.MONGODB_DATABASE || "avochain");
    this.usuarios = this.db.collection("usuarios");
    this.fincas = this.db.collection("fincas");
    this.lotes = this.db.collection("lotes");
    this.pagos = this.db.collection("pagosWompi");
    this.premium = this.db.collection("accesosPremium");
    await this.crearIndices();
  }

  async cerrar(): Promise<void> { await this.client.close(); }

  async crearOrdenPago(order: PaymentOrder): Promise<void> {
    await this.pagos.insertOne(order as PaymentOrder & Document);
  }

  async buscarOrdenPago(reference: string): Promise<PaymentOrder | null> {
    return this.pagos.findOne({ reference }) as Promise<PaymentOrder | null>;
  }

  async actualizarOrdenPago(reference: string, status: PaymentOrder["status"], transactionId?: string): Promise<void> {
    await this.pagos.updateOne({ reference }, { $set: { status, transactionId, updatedAt: new Date() } });
  }

  async buscarUltimaOrdenPago(email: string): Promise<PaymentOrder | null> {
    return this.pagos.find({ email: email.trim().toLowerCase() }).sort({ createdAt: -1 }).limit(1).next();
  }

  async activarPremium(email: string, reference: string, transactionId: string): Promise<void> {
    await this.premium.updateOne(
      { email },
      { $set: { email, activo: true, reference, transactionId, activadoEn: new Date() } },
      { upsert: true }
    );
  }

  async obtenerAccesoPremium(email: string): Promise<Document | null> {
    return this.premium.findOne({ email: email.trim().toLowerCase(), activo: true });
  }

  async tienePremium(email: string): Promise<boolean> {
    return Boolean(await this.obtenerAccesoPremium(email));
  }

  async guardarFinca(finca: Finca): Promise<Finca> {
    const productorId = await this.obtenerOCrearUsuario(finca.productorWallet || "0x819C...4U21", "Productor", finca.nombre);
    await this.fincas.updateOne(
      { codigoInterno: finca.id },
      { $set: { codigoInterno: finca.id, productorId, nombreFinca: finca.nombre, registroICA: finca.registroICA, ubicacionGPS: finca.gps, ...(finca.certificadoPdfUrl ? { certificadoICA_url: finca.certificadoPdfUrl } : {}), estado: finca.activa ? "Activa" : "Inactiva", datosAplicacion: finca } },
      { upsert: true }
    );
    return finca;
  }

  async buscarFinca(id: string): Promise<Finca | undefined> {
    const finca = await this.fincas.findOne({ codigoInterno: id });
    return finca?.datosAplicacion;
  }

  async listarFincas(): Promise<Finca[]> {
    const docs = await this.fincas.find().toArray();
    return docs.map((doc) => doc.datosAplicacion);
  }

  async guardarLote(lote: Lote): Promise<Lote> {
    const finca = await this.fincas.findOne({ codigoInterno: lote.fincaId });
    if (!finca) throw new Error("La finca referenciada no existe en MongoDB.");
    const productorId = await this.obtenerOCrearUsuario(lote.productorWallet, "Productor", lote.productorWallet);
    const doc: StoredLote = {
      codigoLote: lote.id,
      hashBlockchain_registro: lote.txHashRegistro,
      estadoActual: lote.estado,
      fincaId: finca._id,
      datosProduccion: {
        productorId, pesoKg: lote.pesoKg, variedad: lote.variedad, fechaCosecha: new Date(lote.fechaCosecha),
        evidenciaFotografica: lote.evidencias.map((e) => ({ url: e.url, formato: e.mimeType === "image/png" ? "PNG" : "JPG", pesoMB: e.sizeBytes / (1024 * 1024) }))
      },
      inspeccionCalidad: lote.inspeccionCalidad ? {
        inspectorId: await this.obtenerOCrearUsuario(lote.inspeccionCalidad.inspectorId, "Inspector de calidad", lote.inspeccionCalidad.inspectorId),
        humedad: lote.inspeccionCalidad.humedad, temperatura: lote.inspeccionCalidad.temperaturaC,
        reportePDF_url: lote.inspeccionCalidad.informePdfUrl, aprobado: lote.inspeccionCalidad.aprobada,
        fechaInspeccion: new Date(lote.inspeccionCalidad.firmadoEn), destino: lote.inspeccionCalidad.destino,
        evaluacionFitosanitaria: lote.inspeccionCalidad.evaluacionFitosanitaria, reportePDF_pesoBytes: lote.inspeccionCalidad.informePdfSizeBytes,
        hashInforme: lote.inspeccionCalidad.hashInforme
      } : undefined,
      codigoQR: lote.qrGenerado ? { empacadorId: await this.obtenerOCrearUsuario("EMPACADORA-DEMO", "Bodeguero", "Empacadora"), urlImagenS3: "", fechaGeneracion: new Date() } : undefined,
      despacho: lote.conductorId ? {
        jefeBodegaId: await this.obtenerOCrearUsuario("BODEGA-DEMO", "Bodeguero", "Bodega"),
        transportistaId: await this.obtenerOCrearUsuario(lote.conductorId, "Transportista", lote.conductorId),
        hashBlockchain_despacho: [...lote.eventos].reverse().find((e) => e.tipo === "Despacho")?.txHash || "",
        fechaSalida: new Date([...lote.eventos].reverse().find((e) => e.tipo === "Despacho")?.fecha || Date.now())
      } : undefined,
      incidentesRuta: await Promise.all(lote.incidentes.map(async (i) => ({
        transportistaId: await this.obtenerOCrearUsuario(i.conductorId, "Transportista", i.conductorId),
        tipoIncidente: i.tipo, descripcion: i.comentario,
        ...(i.ubicacion ? { ubicacion: { latitud: i.ubicacion.latitud, longitud: i.ubicacion.longitud, ...(i.ubicacion.referencia ? { referencia: i.ubicacion.referencia } : {}) } } : {}),
        ...(i.fotoUrl ? { fotoEvidencia_url: i.fotoUrl } : {}), fechaReporte: new Date(i.creadoEn)
      }))),
      recepcionDestino: lote.recepcionDestino ? {
        receptorId: await this.obtenerOCrearUsuario(lote.recepcionDestino.recibidoPor, "Receptor", lote.recepcionDestino.recibidoPor),
        temperaturaLlegada: lote.recepcionDestino.temperaturaC, cajasDanadas: lote.recepcionDestino.cajasDanadas,
        hashBlockchain_recepcion: [...lote.eventos].reverse().find((e) => e.tipo === "RecepcionDestino")?.txHash || "",
        fechaLlegada: new Date(lote.recepcionDestino.recibidoEn), temperaturaMaximaRuta: lote.recepcionDestino.temperaturaMaximaRutaC
      } : undefined,
      ventaFinal: lote.estado === "Vendido" ? {
        vendedorId: await this.obtenerOCrearUsuario("VENDEDOR-DEMO", "Vendedor", "Vendedor"),
        hashBlockchain_quema: [...lote.eventos].reverse().find((e) => e.tipo === "Venta")?.txHash || "",
        fechaVenta: new Date([...lote.eventos].reverse().find((e) => e.tipo === "Venta")?.fecha || Date.now())
      } : undefined,
      incidentes: lote.incidentes, eventos: lote.eventos, conductorId: lote.conductorId,
      qrGenerado: lote.qrGenerado, qrImpreso: lote.qrImpreso, productorWallet: lote.productorWallet,
      txHashRegistro: lote.txHashRegistro, datosAplicacion: lote
    };
    for (const [key, value] of Object.entries(doc)) if (value === undefined) delete doc[key];
    await this.lotes.updateOne({ codigoLote: lote.id }, { $set: doc }, { upsert: true });
    return lote;
  }

  async buscarLote(id: string): Promise<Lote | undefined> {
    const lote = await this.lotes.findOne({ codigoLote: id });
    return lote?.datosAplicacion;
  }

  async listarLotes(): Promise<Lote[]> {
    const docs = await this.lotes.find().toArray();
    return docs.map((doc) => doc.datosAplicacion);
  }

  async eliminarLote(id: string): Promise<void> {
    const result = await this.lotes.deleteOne({ codigoLote: id });
    if (!result.deletedCount) throw new Error("Producto Falso o No Registrado.");
  }

  async agregarIncidente(id: string, incidente: IncidenteRuta): Promise<Lote> {
    const lote = await this.requireLote(id);
    lote.incidentes.push(incidente);
    return this.guardarLote(lote);
  }

  async requireLote(id: string): Promise<Lote> {
    const lote = await this.buscarLote(id);
    if (!lote) throw new Error("Producto Falso o No Registrado.");
    return lote;
  }

  private async obtenerOCrearUsuario(walletAddress: string, rol: string, nombre: string): Promise<ObjectId> {
    const result = await this.usuarios.findOneAndUpdate(
      { walletAddress },
      { $setOnInsert: { walletAddress, nombre, rol, estadoActivo: true, fechaRegistro: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    return result?._id as ObjectId;
  }

  private async crearIndices(): Promise<void> {
    await Promise.all([
      this.usuarios.createIndex({ walletAddress: 1 }, { unique: true }),
      this.fincas.createIndex({ codigoInterno: 1 }, { unique: true }),
      this.fincas.createIndex({ registroICA: 1 }, { unique: true }),
      this.lotes.createIndex({ codigoLote: 1 }, { unique: true }),
      this.lotes.createIndex({ fincaId: 1, estadoActual: 1 }),
      this.pagos.createIndex({ reference: 1 }, { unique: true }),
      this.pagos.createIndex({ email: 1, status: 1 }),
      this.premium.createIndex({ email: 1 }, { unique: true })
    ]);
  }

}
