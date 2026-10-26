import { Request, Response } from "express";
import { PremiumService } from "../../application/services/PremiumService";
import { WompiPaymentService } from "../../application/services/WompiPaymentService";

export class PaymentsController {
  constructor(private readonly payments: WompiPaymentService, private readonly premium: PremiumService) {}

  crearCheckout = async (req: Request, res: Response) => {
    try { return res.status(201).json(await this.payments.crearCheckout(req.body?.email)); }
    catch (error) { return this.error(res, error); }
  };

  confirmarPagoDemo = async (req: Request, res: Response) => {
    try { return res.status(201).json(await this.payments.confirmarPagoDemo(req.body?.email)); }
    catch (error) { return this.error(res, error); }
  };

  estado = async (req: Request, res: Response) => {
    try { return res.json(await this.payments.estadoPremium(req.query.email)); }
    catch (error) { return this.error(res, error); }
  };

  verificarRetorno = async (req: Request, res: Response) => {
    try { return res.json(await this.payments.verificarRetorno(req.body?.transactionId)); }
    catch (error) { return this.error(res, error); }
  };

  webhook = async (req: Request, res: Response) => {
    try { await this.payments.procesarEvento(req.body); return res.sendStatus(200); }
    catch (error) { return this.error(res, error); }
  };

  reportes = async (req: Request, res: Response) => {
    try { return res.json(await this.premium.reportes(String(req.query.email || ""))); }
    catch (error) { return this.error(res, error); }
  };

  dashboardPremium = async (req: Request, res: Response) => {
    try { return res.json(await this.premium.dashboard(String(req.query.email || ""))); }
    catch (error) { return this.error(res, error); }
  };

  exportarHistorial = async (req: Request, res: Response) => {
    try {
      const csv = await this.premium.historialCsv(String(req.query.email || ""), this.param(req, "idLote"));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="historial-${this.param(req, "idLote")}.csv"`);
      return res.send(csv);
    } catch (error) { return this.error(res, error); }
  };

  private error(res: Response, error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    const status = message.includes("no existe") || message.includes("No Registrado")
      ? 404
      : message.includes("requiere el plan Premium") || message.includes("requiere Premium") ? 403 : 400;
    return res.status(status).json({ error: message });
  }

  private param(req: Request, name: string): string {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : value;
  }
}
