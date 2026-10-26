// Base de datos: avochain

// Colección: usuarios
const esquemaUsuario = {
  _id: ObjectId("672f00000000000000000001"),
  walletAddress: "0xABC123...",
  nombre: "Carlos Mendoza",
  rol: "Transportista",
  estadoActivo: true,
  fechaRegistro: ISODate("2026-10-15T10:00:00Z")
};

// Colección: fincas
const esquemaFinca = {
  _id: ObjectId("672f00000000000000000002"),
  codigoInterno: "FINCA-001",
  productorId: ObjectId("672f00000000000000000001"),
  nombreFinca: "Finca Las Palmas",
  registroICA: "ICA-12345-C0987",
  ubicacionGPS: "4.5709,-74.2973",
  certificadoICA_url:
    "https://s3.aws.com/avochain/certificados/ica_laspalmas.pdf",
  estado: "Activa",
  datosAplicacion: {
    id: "FINCA-001",
    nombre: "Finca Las Palmas",
    registroICA: "ICA-12345-C0987",
    gps: "4.5709,-74.2973",
    activa: true
  }
};

// Colección: lotes
const esquemaLote = {
  _id: ObjectId("672f00000000000000000003"),
  codigoLote: "AVO-2026-01024",
  hashBlockchain_registro: "0xTxHashRegistro...",
  estadoActual: "En Transito",
  fincaId: ObjectId("672f00000000000000000002"),

  datosProduccion: {
    productorId: ObjectId("672f00000000000000000001"),
    pesoKg: 1500,
    variedad: "Hass",
    fechaCosecha: ISODate("2026-11-15T00:00:00Z"),
    evidenciaFotografica: [
      {
        url: "https://s3.aws.com/avochain/fotos/lote_01.jpg",
        formato: "JPG",
        pesoMB: 2.1
      }
    ]
  },

  inspeccionCalidad: {
    inspectorId: ObjectId("672f00000000000000000004"),
    humedad: 65.5,
    temperatura: 5.2,
    reportePDF_url:
      "https://s3.aws.com/avochain/reportes/calidad_01024.pdf",
    aprobado: true,
    fechaInspeccion: ISODate("2026-11-16T08:30:00Z"),
    destino: "Exportación",
    evaluacionFitosanitaria: "Aprobado",
    reportePDF_pesoBytes: 524288,
    hashInforme: "sha256:abc123..."
  },

  codigoQR: {
    empacadorId: ObjectId("672f00000000000000000005"),
    urlImagenS3: "https://s3.aws.com/avochain/qr/AVO-2026-01024.png",
    fechaGeneracion: ISODate("2026-11-16T10:00:00Z")
  },

  despacho: {
    jefeBodegaId: ObjectId("672f00000000000000000005"),
    transportistaId: ObjectId("672f00000000000000000006"),
    hashBlockchain_despacho: "0xTxHashDespacho...",
    fechaSalida: ISODate("2026-11-16T14:00:00Z")
  },

  incidentesRuta: [
    {
      transportistaId: ObjectId("672f00000000000000000006"),
      tipoIncidente: "Trancón por vía cerrada",
      descripcion: "Cierre temporal de la vía por derrumbe.",
      ubicacion: {
        latitud: 4.5709,
        longitud: -74.2973,
        referencia: "Kilómetro 45"
      },
      fotoEvidencia_url:
        "https://s3.aws.com/avochain/incidentes/cierre_via.jpg",
      fechaReporte: ISODate("2026-11-16T16:20:00Z")
    }
  ],

  recepcionDestino: {
    receptorId: ObjectId("672f00000000000000000007"),
    temperaturaLlegada: 6.0,
    cajasDanadas: 0,
    hashBlockchain_recepcion: "0xTxHashRecepcion...",
    fechaLlegada: ISODate("2026-11-17T07:15:00Z"),
    temperaturaMaximaRuta: 9.5
  },

  ventaFinal: {
    vendedorId: ObjectId("672f00000000000000000008"),
    hashBlockchain_quema: "0xTxHashBurn...",
    fechaVenta: ISODate("2026-11-20T11:45:00Z")
  },

  // Datos internos usados por la aplicación
  incidentes: [
    {
      tipo: "Trancón por vía cerrada",
      comentario: "Cierre temporal de la vía por derrumbe.",
      creadoEn: "2026-11-16T16:20:00.000Z",
      ubicacion: {
        latitud: 4.5709,
        longitud: -74.2973,
        referencia: "Kilómetro 45"
      }
    }
  ],

  eventos: [
    {
      tipo: "Registro",
      fecha: "2026-11-15T10:00:00.000Z",
      txHash: "0xTxHashRegistro..."
    },
    {
      tipo: "Despacho",
      fecha: "2026-11-16T14:00:00.000Z",
      txHash: "0xTxHashDespacho..."
    }
  ],

  conductorId: "conductor-001",
  qrGenerado: true,
  qrImpreso: true,
  productorWallet: "0xABC123...",
  txHashRegistro: "0xTxHashRegistro...",

  // Copia del objeto completo usado internamente por la aplicación
  datosAplicacion: {
    id: "AVO-2026-01024",
    fincaId: "FINCA-001",
    estado: "En Transito",
    pesoKg: 1500,
    variedad: "Hass",
    fechaCosecha: "2026-11-15T00:00:00.000Z",
    productorWallet: "0xABC123...",
    conductorId: "conductor-001",
    qrGenerado: true,
    qrImpreso: true
  }
};