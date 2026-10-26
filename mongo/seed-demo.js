// Inserta datos de práctica sin borrar ni reemplazar documentos existentes.
// Ejecutar desde la raíz con: node mongo/seed-demo.js
require("dotenv").config();

const { MongoClient, ObjectId } = require("mongodb");
const { randomUUID } = require("node:crypto");

const uri = process.env.MONGODB_URI || "mongodb://avoadmin:change-this-password@127.0.0.1:27018/avochain?authSource=admin";
const databaseName = process.env.MONGODB_DATABASE || "avochain";
const roles = [
  ...Array(10).fill("Productor"),
  ...Array(8).fill("Transportista"),
  ...Array(6).fill("Inspector de calidad"),
  ...Array(5).fill("Bodeguero"),
  ...Array(5).fill("Receptor"),
  ...Array(4).fill("Vendedor"),
  ...Array(2).fill("Administrador")
];
const nombres = ["Valentina", "Santiago", "Isabella", "Mateo", "Camila", "Samuel", "Mariana", "Nicolas", "Luciana", "Gabriel", "Salome", "Daniel", "Antonella", "Sebastian", "Victoria", "Emiliano", "Gabriela", "Martin", "Julieta", "Andres", "Manuela", "David", "Renata", "Tomas", "Sara", "Jeronimo", "Laura", "Felipe", "Paula", "Alejandro", "Catalina", "Juan", "Elena", "Miguel", "Clara", "Esteban", "Mia", "Simon", "Eva", "Joaquin"];
const apellidos = ["Gomez", "Rodriguez", "Martinez", "Lopez", "Garcia", "Hernandez", "Ramirez", "Torres", "Diaz", "Vargas", "Castro", "Rojas", "Moreno", "Jimenez", "Ruiz"];
const fincasNombres = ["Las Palmas", "El Porvenir", "La Esperanza", "Monteverde", "El Roble", "Santa Elena", "Los Naranjos", "La Primavera", "El Paraíso", "Villa Clara", "San Miguel", "La Cumbre", "El Encanto", "Buenavista", "Los Arrayanes"];
const variedades = ["Hass", "Hass", "Hass", "Fuerte"];
const sucesos = ["Camion varado", "Choque", "Trancon por vias cerradas", "Via cerrada", "Derrumbe", "Falla mecanica", "Clima adverso"];
const estados = ["Registrado", "Aprobado_Calidad", "Rechazado_En_Origen", "En Transito", "En Punto de Venta", "Vendido"];
const fecha = (diasAtras, hora = 9) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - diasAtras);
  d.setUTCHours(hora, 0, 0, 0);
  return d;
};

async function main() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(databaseName);
    const collections = ["usuarios", "fincas", "lotes"];
    for (const name of collections) {
      if (!(await db.listCollections({ name }).hasNext())) await db.createCollection(name);
    }
    const [userCount, farmCount, lotCount] = await Promise.all(collections.map((name) => db.collection(name).countDocuments()));
    const missingUsers = Math.max(0, 40 - userCount);
    const missingFarms = Math.max(0, 15 - farmCount);
    const missingLots = Math.max(0, 120 - lotCount);
    const occupiedFarmIds = new Set((await db.collection("fincas").find({}, { projection: { codigoInterno: 1, registroICA: 1 } }).toArray()).flatMap((f) => [f.codigoInterno, f.registroICA]));
    const occupiedLotIds = new Set((await db.collection("lotes").find({}, { projection: { codigoLote: 1 } }).toArray()).map((l) => l.codigoLote));

    const usuarios = roles.slice(0, missingUsers).map((rol, i) => {
      const nombre = `${nombres[i]} ${apellidos[i % apellidos.length]}`;
      return {
        _id: new ObjectId(),
        walletAddress: `0x${randomUUID().replaceAll("-", "").toUpperCase()}`,
        nombre,
        rol,
        estadoActivo: true,
        fechaRegistro: fecha(120 - (i % 90))
      };
    });
    const existingUsers = await db.collection("usuarios").find().toArray();
    const allUsers = [...existingUsers, ...usuarios];
    const porRol = (rol) => allUsers.filter((u) => u.rol === rol);
    const productores = porRol("Productor");
    const transportistas = porRol("Transportista");
    const inspectores = porRol("Inspector de calidad");
    const bodegueros = porRol("Bodeguero");
    const receptores = porRol("Receptor");
    const vendedores = porRol("Vendedor");

    const fincas = fincasNombres.slice(0, missingFarms).map((nombre, i) => {
      const productor = productores[i % productores.length];
      let sequence = farmCount + i + 1;
      let id = `FINCA-${String(sequence).padStart(3, "0")}`;
      while (occupiedFarmIds.has(id) || occupiedFarmIds.has(`ICA-${String(2026000 + sequence - 1)}-C${String(sequence).padStart(4, "0")}`)) {
        sequence += 1;
        id = `FINCA-${String(sequence).padStart(3, "0")}`;
      }
      const gps = `${(1.2 + i * 0.17).toFixed(4)},${(-76.8 + i * 0.13).toFixed(4)}`;
      const registroICA = `ICA-${String(2026000 + sequence - 1)}-C${String(sequence).padStart(4, "0")}`;
      occupiedFarmIds.add(id);
      occupiedFarmIds.add(registroICA);
      const datosAplicacion = { id, nombre: `Finca ${nombre}`, registroICA, gps, activa: sequence % 15 !== 0, productorWallet: productor.walletAddress };
      return { _id: new ObjectId(), codigoInterno: id, productorId: productor._id, nombreFinca: datosAplicacion.nombre, registroICA: datosAplicacion.registroICA, ubicacionGPS: gps, certificadoICA_url: `https://ejemplo.invalid/certificados/${id}.pdf`, estado: datosAplicacion.activa ? "Activa" : "Inactiva", datosAplicacion };
    });

    const lotes = Array.from({ length: missingLots }, (_, i) => {
      const finca = fincas[i % fincas.length];
      const productor = allUsers.find((u) => u._id.equals(finca.productorId));
      const inspector = inspectores[i % inspectores.length];
      const transportista = transportistas[i % transportistas.length];
      const bodeguero = bodegueros[i % bodegueros.length];
      const receptor = receptores[i % receptores.length];
      const vendedor = vendedores[i % vendedores.length];
      const estado = estados[Math.floor(i / 20)];
      const cosecha = fecha(60 - (i % 45), 6);
      let sequence = lotCount + 1025 + i;
      let id = `AVO-${cosecha.getUTCFullYear()}-${String(sequence).padStart(5, "0")}`;
      while (occupiedLotIds.has(id)) {
        sequence += 1;
        id = `AVO-${cosecha.getUTCFullYear()}-${String(sequence).padStart(5, "0")}`;
      }
      occupiedLotIds.add(id);
      const tieneInspeccion = estado !== "Registrado";
      const aprobada = estado !== "Rechazado_En_Origen";
      const fechaInspeccion = fecha(50 - (i % 40), 8);
      const conductorAsignado = ["En Transito", "En Punto de Venta", "Vendido"].includes(estado);
      const recibido = ["En Punto de Venta", "Vendido"].includes(estado);
      const vendido = estado === "Vendido";
      const incidentes = (i % 4 === 0 || i % 7 === 0) ? [{
        id: randomUUID(), tipo: sucesos[i % sucesos.length], comentario: `Novedad de ruta registrada para ${id}.`, conductorId: transportista.walletAddress,
        ubicacion: { latitud: 4.4 + (i % 20) * 0.025, longitud: -75.8 + (i % 20) * 0.02, referencia: `Punto de control ${1 + (i % 8)}` },
        fotoUrl: `https://ejemplo.invalid/incidentes/${id}.jpg`, creadoEn: fecha(35 - (i % 25), 14).toISOString()
      }] : [];
      const eventos = [{ tipo: "Registro", actor: "Productor", fecha: fecha(60 - (i % 45), 7).toISOString(), detalle: "Lote registrado para trazabilidad.", txHash: `0xregistro${String(i + 1).padStart(8, "0")}` }];
      if (tieneInspeccion) eventos.push({ tipo: "InspeccionCalidad", actor: inspector.walletAddress, fecha: fechaInspeccion.toISOString(), detalle: aprobada ? "Inspección de calidad aprobada." : "Lote rechazado en origen." , txHash: `0xcalidad${String(i + 1).padStart(8, "0")}` });
      if (conductorAsignado) eventos.push({ tipo: "Despacho", actor: bodeguero.walletAddress, fecha: fecha(30 - (i % 20), 12).toISOString(), detalle: `Asignado a ${transportista.nombre}.`, txHash: `0xdespacho${String(i + 1).padStart(8, "0")}` });
      for (const incidente of incidentes) eventos.push({ tipo: "Incidente", actor: transportista.walletAddress, fecha: incidente.creadoEn, detalle: incidente.tipo, txHash: `0xincidente${String(i + 1).padStart(8, "0")}` });
      if (recibido) eventos.push({ tipo: "RecepcionDestino", actor: receptor.walletAddress, fecha: fecha(15 - (i % 12), 8).toISOString(), detalle: "Lote recibido en punto de venta.", txHash: `0xrecepcion${String(i + 1).padStart(8, "0")}` });
      if (vendido) eventos.push({ tipo: "Venta", actor: vendedor.walletAddress, fecha: fecha(5 - (i % 5), 11).toISOString(), detalle: "Venta registrada.", txHash: `0xventa${String(i + 1).padStart(8, "0")}` });

      const lote = {
        id, pesoKg: 350 + (i * 37) % 2200, variedad: variedades[i % variedades.length], fechaCosecha: cosecha.toISOString(), fincaId: finca.codigoInterno, estado,
        productorWallet: productor.walletAddress, ...(conductorAsignado ? { conductorId: transportista.walletAddress } : {}), qrGenerado: conductorAsignado || recibido || vendido, qrImpreso: conductorAsignado || recibido || vendido,
        txHashRegistro: `0xregistro${String(i + 1).padStart(8, "0")}`,
        evidencias: [{ id: randomUUID(), filename: `${id}-cosecha.jpg`, mimeType: "image/jpeg", sizeBytes: 380000 + i * 173, url: `https://ejemplo.invalid/evidencias/${id}.jpg` }],
        incidentes, eventos,
        ...(tieneInspeccion ? { inspeccionCalidad: { humedad: aprobada ? 61 + (i % 9) : 73 + (i % 4), temperaturaC: aprobada ? 4 + (i % 5) : 9 + (i % 3), evaluacionFitosanitaria: aprobada ? "Aprobado" : "No cumple los requisitos fitosanitarios", destino: i % 2 ? "Exportacion" : "Nacional", aprobada, informePdfUrl: `https://ejemplo.invalid/reportes/${id}.pdf`, informePdfSizeBytes: 280000 + i * 137, firmadoEn: fechaInspeccion.toISOString(), inspectorId: inspector.walletAddress, hashInforme: `sha256:demo${String(i + 1).padStart(8, "0")}` } } : {}),
        ...(recibido ? { recepcionDestino: { temperaturaC: 4 + (i % 7), cajasDanadas: i % 6, temperaturaMaximaRutaC: i % 9 === 0 ? 13 : 7 + (i % 5), recibidoPor: receptor.walletAddress, recibidoEn: fecha(15 - (i % 12), 8).toISOString() } } : {})
      };
      const doc = {
        codigoLote: id, hashBlockchain_registro: lote.txHashRegistro, estadoActual: estado, fincaId: finca._id,
        datosProduccion: { productorId: productor._id, pesoKg: lote.pesoKg, variedad: lote.variedad, fechaCosecha: cosecha, evidenciaFotografica: lote.evidencias.map((e) => ({ url: e.url, formato: "JPG", pesoMB: e.sizeBytes / (1024 * 1024) })) },
        ...(tieneInspeccion ? { inspeccionCalidad: { inspectorId: inspector._id, humedad: lote.inspeccionCalidad.humedad, temperatura: lote.inspeccionCalidad.temperaturaC, reportePDF_url: lote.inspeccionCalidad.informePdfUrl, aprobado: aprobada, fechaInspeccion, destino: lote.inspeccionCalidad.destino, evaluacionFitosanitaria: lote.inspeccionCalidad.evaluacionFitosanitaria, reportePDF_pesoBytes: lote.inspeccionCalidad.informePdfSizeBytes, hashInforme: lote.inspeccionCalidad.hashInforme } } : {}),
        ...(lote.qrGenerado ? { codigoQR: { empacadorId: bodeguero._id, urlImagenS3: `https://ejemplo.invalid/qr/${id}.png`, fechaGeneracion: fecha(30 - (i % 20), 11) } } : {}),
        ...(conductorAsignado ? { despacho: { jefeBodegaId: bodeguero._id, transportistaId: transportista._id, hashBlockchain_despacho: `0xdespacho${String(i + 1).padStart(8, "0")}`, fechaSalida: fecha(30 - (i % 20), 12) } } : {}),
        incidentesRuta: incidentes.map((incidente) => ({ transportistaId: transportista._id, tipoIncidente: incidente.tipo, descripcion: incidente.comentario, ubicacion: incidente.ubicacion, fotoEvidencia_url: incidente.fotoUrl, fechaReporte: new Date(incidente.creadoEn) })),
        ...(recibido ? { recepcionDestino: { receptorId: receptor._id, temperaturaLlegada: lote.recepcionDestino.temperaturaC, cajasDanadas: lote.recepcionDestino.cajasDanadas, hashBlockchain_recepcion: `0xrecepcion${String(i + 1).padStart(8, "0")}`, fechaLlegada: new Date(lote.recepcionDestino.recibidoEn), temperaturaMaximaRuta: lote.recepcionDestino.temperaturaMaximaRutaC } } : {}),
        ...(vendido ? { ventaFinal: { vendedorId: vendedor._id, hashBlockchain_quema: `0xventa${String(i + 1).padStart(8, "0")}`, fechaVenta: fecha(5 - (i % 5), 11) } } : {}),
        incidentes: lote.incidentes, eventos: lote.eventos, ...(lote.conductorId ? { conductorId: lote.conductorId } : {}), qrGenerado: lote.qrGenerado, qrImpreso: lote.qrImpreso, productorWallet: lote.productorWallet, txHashRegistro: lote.txHashRegistro, datosAplicacion: lote
      };
      return doc;
    });

    if (usuarios.length) await db.collection("usuarios").insertMany(usuarios);
    await db.collection("fincas").createIndex({ codigoInterno: 1 }, { unique: true });
    await db.collection("fincas").createIndex({ registroICA: 1 }, { unique: true });
    await db.collection("lotes").createIndex({ codigoLote: 1 }, { unique: true });
    await db.collection("lotes").createIndex({ fincaId: 1, estadoActual: 1 });
    if (fincas.length) await db.collection("fincas").insertMany(fincas);
    if (lotes.length) await db.collection("lotes").insertMany(lotes);
    const finalCounts = await Promise.all(collections.map((name) => db.collection(name).countDocuments()));
    console.log(`Datos de práctica listos en ${databaseName}: ${finalCounts[0]} usuarios, ${finalCounts[1]} fincas y ${finalCounts[2]} lotes.`);
    console.log(`Nuevos registros agregados: ${usuarios.length} usuarios, ${fincas.length} fincas y ${lotes.length} lotes.`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(`No se insertaron datos: ${error.message}`);
  process.exitCode = 1;
});
