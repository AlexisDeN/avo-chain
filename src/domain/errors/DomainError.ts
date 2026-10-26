export abstract class DomainError extends Error {
  constructor(message: string, public readonly statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class LoteNoEncontradoError extends DomainError {
  constructor(id: string) {
    super(`El lote con ID ${id} no existe.`, 404);
  }
}