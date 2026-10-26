// src/presentation/controllers/AvoChainFacadeController.ts
import { Request, Response } from "express";
import { AvoChainService } from "../../application/AvoChainService"; // Ruta corregida

export class AvoChainFacadeController {
  private service: AvoChainService;

  constructor(service: AvoChainService) {
    this.service = service;
  }

  registrarFinca = async (req: Request, res: Response) => this.handle(res, () => this.service.registrarFinca(req.body), 201);

  registrarLote = async (req: Request, res: Response) => this.handle(res, () => this.service.registrarLote(req.body), 201);

  listarLotes = async (_req: Request, res: Response) => this.handle(res, () => this.service.listarLotes());

  listarFincas = async (_req: Request, res: Response) => this.handle(res, () => this.service.listarFincas());

  actualizarLote = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.actualizarLote(this.param(req, "idLote"), req.body));

  eliminarLote = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.eliminarLote(this.param(req, "idLote"), String(req.query.rol || req.body?.rol || "")));

  agregarEvidencias = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.agregarEvidencias(this.param(req, "idLote"), req.body.fotos || []));

  asignarConductor = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.asignarConductor(this.param(req, "idLote"), req.body));

  inspeccionarCalidad = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.inspeccionarCalidad(this.param(req, "idLote"), req.body));

  confirmarRecepcionDestino = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.confirmarRecepcionDestino(this.param(req, "idLote"), req.body));

  generarQR = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.generarQR(this.param(req, "idLote"), Boolean(req.body?.autorizarReimpresion)));

  escanearRecepcion = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.recibirEnPuntoVenta(this.param(req, "idLote"), req.body));

  venderLote = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.venderLote(this.param(req, "idLote"), req.body));

  reportarIncidente = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.reportarIncidente(this.param(req, "idLote"), req.body), 201);

  consultarOrigenProducto = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.consultarOrigen(this.param(req, "idLote")));

  obtenerEstadisticasLecturaRapida = async (_req: Request, res: Response) =>
    this.handle(res, () => this.service.obtenerDashboard());

  obtenerDetalleLoteAdmin = async (req: Request, res: Response) =>
    this.handle(res, () => this.service.obtenerDetalleLoteAdmin(this.param(req, "idLote")));

  private async handle<T>(res: Response, action: () => T | Promise<T>, successStatus = 200) {
    try {
      const data = await action();
      return res.status(successStatus).json(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado.";
      const status = message.includes("Falso") || message.includes("No Registrado") ? 404 : 400;
      return res.status(status).json({ error: message });
    }
  }

  private param(req: Request, name: string): string {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
