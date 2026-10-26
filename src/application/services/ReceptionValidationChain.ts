import { ConfirmarRecepcionDto } from "../dtos/AvoChainDtos";

type Check = (estado: string, dto: ConfirmarRecepcionDto) => void;

export class ReceptionValidationChain {
  private checks: Check[] = [
    (estado) => { if (estado !== "En Transito") throw new Error("Solo se puede recibir un lote que esté En Transito."); },
    (_estado, dto) => { if (dto.rol !== "Receptor" || !dto.receptorId) throw new Error("Se requiere un receptor autorizado."); },
    (_estado, dto) => { if (!Number.isFinite(dto.temperaturaC) || dto.temperaturaC < 4 || dto.temperaturaC > 10) throw new Error("La temperatura de llegada debe estar entre 4°C y 10°C."); },
    (_estado, dto) => { if (!Number.isInteger(dto.cajasDanadas) || dto.cajasDanadas < 0) throw new Error("La cantidad de cajas dañadas debe ser un entero igual o mayor a cero."); }
  ];

  validar(estado: string, dto: ConfirmarRecepcionDto): void {
    for (const check of this.checks) check(estado, dto);
  }
}
