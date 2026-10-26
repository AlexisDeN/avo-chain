// src/domain/state/LoteState.ts
export type LoteEstadoNombre = "Registrado" | "Aprobado_Calidad" | "Rechazado_En_Origen" | "En Transito" | "En Punto de Venta" | "Vendido";

export interface LoteState {
  nombreEstado: LoteEstadoNombre;
  despachar(loteContext: LoteContext): void;
  recibirEnPuntoVenta(loteContext: LoteContext): void;
  vender(loteContext: LoteContext): void;
}

export class EstadoRegistrado implements LoteState {
  nombreEstado: LoteEstadoNombre = "Registrado";

  despachar(loteContext: LoteContext): void {
    loteContext.setEstado(new EstadoEnTransito());
  }

  recibirEnPuntoVenta(): void {
    throw new Error("Solo se puede recibir en punto de venta un lote que esta en transito.");
  }

  vender(): void {
    throw new Error("No se puede vender directamente un lote registrado.");
  }
}

export class EstadoEnTransito implements LoteState {
  nombreEstado: LoteEstadoNombre = "En Transito";

  despachar(): void {
    throw new Error("El lote ya se encuentra en transito.");
  }

  recibirEnPuntoVenta(loteContext: LoteContext): void {
    loteContext.setEstado(new EstadoEnPuntoVenta());
  }

  vender(): void {
    throw new Error("El lote debe estar en punto de venta antes de venderse.");
  }
}

export class EstadoAprobadoCalidad implements LoteState {
  nombreEstado: LoteEstadoNombre = "Aprobado_Calidad";
  despachar(context: LoteContext): void { context.setEstado(new EstadoEnTransito()); }
  recibirEnPuntoVenta(): void { throw new Error("El lote aún no está en tránsito."); }
  vender(): void { throw new Error("El lote aún no está en punto de venta."); }
}

export class EstadoRechazadoOrigen implements LoteState {
  nombreEstado: LoteEstadoNombre = "Rechazado_En_Origen";
  despachar(): void { throw new Error("No se puede despachar un lote rechazado en origen."); }
  recibirEnPuntoVenta(): void { throw new Error("No se puede recibir un lote rechazado."); }
  vender(): void { throw new Error("No se puede vender un lote rechazado."); }
}

export class EstadoEnPuntoVenta implements LoteState {
  nombreEstado: LoteEstadoNombre = "En Punto de Venta";

  despachar(): void {
    throw new Error("El lote ya llego al punto de venta.");
  }

  recibirEnPuntoVenta(): void {
    throw new Error("El lote ya esta en punto de venta.");
  }

  vender(loteContext: LoteContext): void {
    loteContext.setEstado(new EstadoVendido());
  }
}

export class EstadoVendido implements LoteState {
  nombreEstado: LoteEstadoNombre = "Vendido";

  despachar(): void {
    throw new Error("El lote ya fue vendido y su QR esta invalidado.");
  }

  recibirEnPuntoVenta(): void {
    throw new Error("ALERTA: Codigo Reutilizado / Producto ya vendido.");
  }

  vender(): void {
    throw new Error("ALERTA: Codigo Reutilizado / Producto ya vendido.");
  }
}

export class LoteContext {
  private estado: LoteState;

  constructor(estadoInicial?: LoteState) {
    this.estado = estadoInicial || new EstadoRegistrado();
  }

  public setEstado(nuevoEstado: LoteState): void {
    this.estado = nuevoEstado;
  }

  public getEstadoNombre(): LoteEstadoNombre {
    return this.estado.nombreEstado;
  }

  public despachar(): void {
    this.estado.despachar(this);
  }

  public recibirEnPuntoVenta(): void {
    this.estado.recibirEnPuntoVenta(this);
  }

  public vender(): void {
    this.estado.vender(this);
  }
}

export function createLoteContextFromEstado(estado: LoteEstadoNombre): LoteContext {
  const states: Record<LoteEstadoNombre, LoteState> = {
    Registrado: new EstadoRegistrado(),
    Aprobado_Calidad: new EstadoAprobadoCalidad(),
    Rechazado_En_Origen: new EstadoRechazadoOrigen(),
    "En Transito": new EstadoEnTransito(),
    "En Punto de Venta": new EstadoEnPuntoVenta(),
    Vendido: new EstadoVendido()
  };

  return new LoteContext(states[estado]);
}
