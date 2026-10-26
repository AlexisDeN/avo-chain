const database = db.getSiblingDB("avochain");

database.createCollection("usuarios", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["walletAddress", "nombre", "rol", "estadoActivo", "fechaRegistro"],
      properties: {
        walletAddress: { bsonType: "string" },
        nombre: { bsonType: "string" },
        rol: { enum: ["Productor", "Inspector de calidad", "Bodeguero", "Transportista", "Receptor", "Vendedor", "Administrador"] },
        estadoActivo: { bsonType: "bool" },
        fechaRegistro: { bsonType: "date" }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

database.createCollection("fincas", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["productorId", "nombreFinca", "registroICA", "ubicacionGPS", "estado"],
      properties: {
        productorId: { bsonType: "objectId" },
        nombreFinca: { bsonType: "string" },
        registroICA: { bsonType: "string" },
        ubicacionGPS: { bsonType: "string" },
        certificadoICA_url: { bsonType: "string" },
        estado: { enum: ["Activa", "Inactiva"] }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

database.createCollection("lotes", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["codigoLote", "estadoActual", "fincaId", "datosProduccion"],
      properties: {
        codigoLote: { bsonType: "string" },
        hashBlockchain_registro: { bsonType: "string" },
        estadoActual: { enum: ["Registrado", "Aprobado_Calidad", "Rechazado_En_Origen", "En Transito", "En Punto de Venta", "Vendido"] },
        fincaId: { bsonType: "objectId" },
        datosProduccion: {
          bsonType: "object",
          required: ["productorId", "pesoKg", "variedad", "fechaCosecha"],
          properties: {
            productorId: { bsonType: "objectId" },
            pesoKg: { bsonType: ["double", "int", "long", "decimal"] },
            variedad: { bsonType: "string" },
            fechaCosecha: { bsonType: "date" },
            evidenciaFotografica: { bsonType: "array", items: { bsonType: "object", required: ["url", "formato", "pesoMB"], properties: { url: { bsonType: "string" }, formato: { bsonType: "string" }, pesoMB: { bsonType: ["double", "int", "long", "decimal"] } } } }
          }
        },
        inspeccionCalidad: {
          bsonType: "object",
          required: ["inspectorId", "humedad", "temperatura", "reportePDF_url", "aprobado", "fechaInspeccion"],
          properties: {
            inspectorId: { bsonType: "objectId" }, humedad: { bsonType: ["double", "int", "long", "decimal"] },
            temperatura: { bsonType: ["double", "int", "long", "decimal"] }, reportePDF_url: { bsonType: "string" },
            aprobado: { bsonType: "bool" }, fechaInspeccion: { bsonType: "date" }
          }
        },
        codigoQR: { bsonType: "object", properties: { empacadorId: { bsonType: "objectId" }, urlImagenS3: { bsonType: "string" }, fechaGeneracion: { bsonType: "date" } } },
        despacho: { bsonType: "object", properties: { jefeBodegaId: { bsonType: "objectId" }, transportistaId: { bsonType: "objectId" }, hashBlockchain_despacho: { bsonType: "string" }, fechaSalida: { bsonType: "date" } } },
        incidentesRuta: { bsonType: "array", items: { bsonType: "object", properties: { transportistaId: { bsonType: "objectId" }, tipoIncidente: { bsonType: "string" }, descripcion: { bsonType: "string" }, ubicacion: { bsonType: "object", properties: { latitud: { bsonType: ["double", "int", "long", "decimal"] }, longitud: { bsonType: ["double", "int", "long", "decimal"] }, referencia: { bsonType: "string" } } }, fotoEvidencia_url: { bsonType: "string" }, fechaReporte: { bsonType: "date" } } } },
        recepcionDestino: { bsonType: "object", properties: { receptorId: { bsonType: "objectId" }, temperaturaLlegada: { bsonType: ["double", "int", "long", "decimal"] }, cajasDanadas: { bsonType: ["int", "long"] }, hashBlockchain_recepcion: { bsonType: "string" }, fechaLlegada: { bsonType: "date" } } },
        ventaFinal: { bsonType: "object", properties: { vendedorId: { bsonType: "objectId" }, hashBlockchain_quema: { bsonType: "string" }, fechaVenta: { bsonType: "date" } } }
      }
    }
  },
  validationLevel: "strict",
  validationAction: "error"
});

database.usuarios.createIndex({ walletAddress: 1 }, { unique: true });
database.fincas.createIndex({ registroICA: 1 }, { unique: true });
database.fincas.createIndex({ productorId: 1 });
database.lotes.createIndex({ codigoLote: 1 }, { unique: true });
database.lotes.createIndex({ fincaId: 1, estadoActual: 1 });
database.lotes.createIndex({ "datosProduccion.productorId": 1 });
database.lotes.createIndex({ "inspeccionCalidad.inspectorId": 1 });
