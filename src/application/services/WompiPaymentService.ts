import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { PaymentOrder, AvoChainMongoRepository } from "../../infrastructure/database/AvoChainMongoRepository";

type WompiTransaction = {
  id: string;
  reference: string;
  status: string;
  amount_in_cents: number;
  currency: string;
  customer_email?: string | null;
};

type WompiEvent = {
  event?: string;
  data?: { transaction?: WompiTransaction };
  environment?: string;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
};

export class WompiPaymentService {
  constructor(private readonly repository: AvoChainMongoRepository) {}

  async confirmarPagoDemo(emailValue: unknown) {
    if (process.env.PAYMENT_DEMO_ENABLED === "false") {
      throw new Error("La pasarela de demostración está desactivada.");
    }
    const email = this.normalizarEmail(emailValue);
    const existingEntitlement = await this.repository.obtenerAccesoPremium(email);
    if (existingEntitlement) return { email, plan: "premium", activo: true, yaEstabaActivo: true, simulacion: true };

    const amountInCents = (this.precioPremiumCop() ?? 99000) * 100;
    const reference = `DEMO-${randomUUID().replaceAll("-", "").slice(0, 20)}`;
    const transactionId = `SIMULADO-${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const now = new Date();
    const order: PaymentOrder = { reference, email, amountInCents, currency: "COP", status: "PENDING", createdAt: now, updatedAt: now };
    await this.repository.crearOrdenPago(order);
    await this.repository.actualizarOrdenPago(reference, "APPROVED", transactionId);
    await this.repository.activarPremium(email, reference, transactionId);
    return { email, plan: "premium", activo: true, referencia: reference, estado: "APPROVED", montoCop: amountInCents / 100, simulacion: true, mensaje: "Pago simulado: no se realizó ningún cobro." };
  }

  async crearCheckout(emailValue: unknown) {
    const email = this.normalizarEmail(emailValue);
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const priceCop = this.precioPremiumCop();
    if (!publicKey || !integritySecret || priceCop === null) {
      throw new Error("Checkout no configurado: completa WOMPI_PUBLIC_KEY, WOMPI_INTEGRITY_SECRET y un PREMIUM_PRICE_COP entero mayor que cero en .env, y reinicia el servidor.");
    }
    const amountInCents = priceCop * 100;

    const reference = `AVO-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const signature = createHash("sha256")
      .update(`${reference}${amountInCents}COP${integritySecret}`)
      .digest("hex");
    const now = new Date();
    const order: PaymentOrder = { reference, email, amountInCents, currency: "COP", status: "PENDING", createdAt: now, updatedAt: now };
    await this.repository.crearOrdenPago(order);

    const checkout = new URL("https://checkout.wompi.co/p/");
    checkout.searchParams.set("public-key", publicKey);
    checkout.searchParams.set("currency", "COP");
    checkout.searchParams.set("amount-in-cents", String(amountInCents));
    checkout.searchParams.set("reference", reference);
    checkout.searchParams.set("signature:integrity", signature);
    checkout.searchParams.set("customer-data:email", email);
    checkout.searchParams.set("redirect-url", `${this.appBaseUrl()}/?wompi=return`);
    return { reference, amountInCents, currency: "COP", checkoutUrl: checkout.toString() };
  }

  async estadoPremium(emailValue: unknown) {
    const email = this.normalizarEmail(emailValue);
    const [entitlement, ultimaOrden] = await Promise.all([
      this.repository.obtenerAccesoPremium(email),
      this.repository.buscarUltimaOrdenPago(email)
    ]);
    const premiumPagado = Boolean(entitlement);
    const modoBeta = process.env.PREMIUM_BETA !== "false";
    const plan = premiumPagado ? "premium" : modoBeta ? "beta" : "gratuito";
    const wompiConfigurado = Boolean(process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET && this.precioPremiumCop() !== null);
    return {
      email,
      plan,
      activo: premiumPagado || modoBeta,
      premiumPagado,
      modoBeta,
      wompi: {
        ambiente: process.env.WOMPI_ENVIRONMENT === "production" ? "production" : "sandbox",
        checkoutDisponible: wompiConfigurado,
        webhookConfigurado: Boolean(process.env.WOMPI_EVENTS_SECRET),
        precioCop: this.precioPremiumCop()
      },
      pagoDemoDisponible: process.env.PAYMENT_DEMO_ENABLED !== "false",
      ultimaOrden: ultimaOrden ? {
        referencia: ultimaOrden.reference,
        estado: ultimaOrden.status,
        montoCop: ultimaOrden.amountInCents / 100,
        creadaEn: ultimaOrden.createdAt
      } : null
    };
  }

  async procesarEvento(event: WompiEvent): Promise<void> {
    if (event.event !== "transaction.updated" || !event.data?.transaction) return;
    this.validarFirmaEvento(event);
    if (event.environment !== this.environmentWompi()) throw new Error("El evento pertenece a otro ambiente de Wompi.");
    await this.aplicarTransaccion(event.data.transaction);
  }

  async verificarRetorno(transactionIdValue: unknown) {
    if (typeof transactionIdValue !== "string" || !transactionIdValue.trim() || transactionIdValue.length > 200) {
      throw new Error("Wompi no devolvió un identificador de transacción válido.");
    }
    const base = process.env.WOMPI_ENVIRONMENT === "production"
      ? "https://production.wompi.co/v1/transactions/"
      : "https://sandbox.wompi.co/v1/transactions/";
    const response = await fetch(`${base}${encodeURIComponent(transactionIdValue)}`);
    if (!response.ok) throw new Error("No se pudo consultar la transacción en Wompi. Espera un momento y vuelve a intentarlo.");
    const payload = await response.json() as { data?: WompiTransaction };
    if (!payload.data) throw new Error("Wompi no devolvió los datos de la transacción.");
    await this.aplicarTransaccion(payload.data);
    return { estadoPago: payload.data.status, reference: payload.data.reference };
  }

  private async aplicarTransaccion(transaction: WompiTransaction): Promise<void> {
    if (!transaction.reference || !transaction.id || !Number.isSafeInteger(transaction.amount_in_cents)) return;
    const order = await this.repository.buscarOrdenPago(transaction.reference);
    if (!order) return;
    if (order.amountInCents !== transaction.amount_in_cents || order.currency !== transaction.currency) {
      throw new Error("El valor recibido no coincide con la orden de pago.");
    }
    if (transaction.customer_email && this.normalizarEmail(transaction.customer_email) !== order.email) {
      throw new Error("El correo de la transacción no coincide con la orden.");
    }

    const validStatuses: PaymentOrder["status"][] = ["PENDING", "APPROVED", "DECLINED", "ERROR", "VOIDED"];
    const status = validStatuses.includes(transaction.status as PaymentOrder["status"])
      ? transaction.status as PaymentOrder["status"]
      : "ERROR";
    await this.repository.actualizarOrdenPago(order.reference, status, transaction.id);
    if (status === "APPROVED") await this.repository.activarPremium(order.email, order.reference, transaction.id);
  }

  private validarFirmaEvento(event: WompiEvent): void {
    const secret = process.env.WOMPI_EVENTS_SECRET;
    const properties = event.signature?.properties;
    const checksum = event.signature?.checksum;
    if (!secret || !properties?.length || !checksum || !event.data || !Number.isFinite(event.timestamp)) {
      throw new Error("El evento de Wompi no tiene una firma verificable o falta WOMPI_EVENTS_SECRET.");
    }
    const valores = properties.map((property) => {
      const value = property.split(".").reduce<unknown>((current, key) =>
        current && typeof current === "object" ? (current as Record<string, unknown>)[key] : undefined, event.data as unknown);
      if (value === undefined || value === null) throw new Error("La firma del evento contiene campos incompletos.");
      return String(value);
    });
    const expected = createHash("sha256").update(`${valores.join("")}${event.timestamp}${secret}`).digest();
    const received = Buffer.from(checksum, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new Error("La firma del evento de Wompi no es válida.");
    }
  }

  private environmentWompi(): string {
    return process.env.WOMPI_ENVIRONMENT === "production" ? "prod" : "test";
  }

  private appBaseUrl(): string {
    return (process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, "");
  }

  private precioPremiumCop(): number | null {
    const raw = process.env.PREMIUM_PRICE_COP?.trim();
    if (!raw) return null;
    const amount = Number(raw);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }

  private normalizarEmail(value: unknown): string {
    if (typeof value !== "string") throw new Error("Escribe el correo asociado a la compra.");
    const email = value.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Escribe un correo electrónico válido.");
    return email;
  }
}
