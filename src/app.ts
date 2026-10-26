import "dotenv/config";
    import express from "express";
    import cors from "cors";
    import path from "node:path";
    import { AvoChainFacadeController } from "./presentation/controllers/AvoChainFacadeController";
import { AvoChainService } from "./application/AvoChainService";
import { AvoChainMongoRepository } from "./infrastructure/database/AvoChainMongoRepository";
import { WompiPaymentService } from "./application/services/WompiPaymentService";
import { PremiumService } from "./application/services/PremiumService";
import { PaymentsController } from "./presentation/controllers/PaymentsController";
import { ROLES_USUARIO, ROLES_INTERFAZ, ROLES_DESCRIPCION } from "./domain/roles/Roles";

    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use(express.static(path.join(__dirname, "..", "public")));

    const repository = new AvoChainMongoRepository();
    const service = new AvoChainService(repository);
    const facadeController = new AvoChainFacadeController(service);
    const paymentsController = new PaymentsController(new WompiPaymentService(repository), new PremiumService(repository));
    const exigirPremium = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const email = String(req.query.email || req.body?.email || "").trim();
        if (!email || !(await repository.tienePremium(email))) {
          return res.status(403).json({ error: "Esta sección requiere Premium. Activa el plan con Wompi o con la demostración de pago." });
        }
        return next();
      } catch {
        return res.status(500).json({ error: "No se pudo validar el acceso Premium." });
      }
    };

    app.get("/health", (_req, res) => res.json({ status: "ok", service: "AvoChain" }));
    app.get("/api/v1/roles", (_req, res) => res.json({ roles: ROLES_USUARIO, rolesInterfaz: ROLES_INTERFAZ, descripciones: ROLES_DESCRIPCION }));
    app.post("/api/v1/pagos/wompi/checkout", paymentsController.crearCheckout);
    app.post("/api/v1/pagos/demo/confirmar", paymentsController.confirmarPagoDemo);
    app.post("/api/v1/pagos/wompi/verificar", paymentsController.verificarRetorno);
    app.post("/api/v1/pagos/wompi/webhook", paymentsController.webhook);
    app.get("/api/v1/pagos/wompi/estado", paymentsController.estado);
    app.get("/api/v1/premium/reportes", paymentsController.reportes);
    app.get("/api/v1/premium/lotes/:idLote/historial.csv", paymentsController.exportarHistorial);

    app.post("/api/v1/fincas", facadeController.registrarFinca);
    app.get("/api/v1/fincas", facadeController.listarFincas);
    app.get("/api/v1/lotes", facadeController.listarLotes);
    app.post("/api/v1/lotes", facadeController.registrarLote);
    app.patch("/api/v1/lotes/:idLote", exigirPremium, facadeController.actualizarLote);
    app.delete("/api/v1/lotes/:idLote", exigirPremium, facadeController.eliminarLote);
    app.post("/api/v1/lotes/:idLote/evidencias", facadeController.agregarEvidencias);
    app.post("/api/v1/lotes/:idLote/qr", facadeController.generarQR);
    app.post("/api/v1/lotes/:idLote/despacho", facadeController.asignarConductor);
    app.post("/api/v1/lotes/:idLote/inspeccion-calidad", facadeController.inspeccionarCalidad);
    app.post("/api/v1/lotes/:idLote/recepcion-destino", facadeController.confirmarRecepcionDestino);
    app.post("/api/v1/lotes/:idLote/recepcion", facadeController.escanearRecepcion);
    app.post("/api/v1/lotes/:idLote/incidentes", facadeController.reportarIncidente);
    app.post("/api/v1/lotes/:idLote/venta", facadeController.venderLote);
    app.get("/api/v1/producto/origen/:idLote", facadeController.consultarOrigenProducto);
    app.get("/api/v1/admin/dashboard", exigirPremium, paymentsController.dashboardPremium);
    app.get("/api/v1/admin/lotes/:idLote", exigirPremium, facadeController.obtenerDetalleLoteAdmin);

    const PORT = process.env.PORT || 3001;
    async function start(): Promise<void> {
      await repository.conectar();
      app.listen(PORT, () => console.log(`Backend AvoChain conectado a MongoDB en http://localhost:${PORT}`));
    }

    start().catch((error) => {
      console.error("No fue posible conectar con MongoDB:", error);
      process.exit(1);
    });
