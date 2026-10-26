export class Finca {
  public id!: string;
  public nombre!: string;
  public registroICA!: string;
  public gps!: string;
  public certificadoPdfUrl?: string;
  public activa = true;
  public productorWallet?: string;
}

export class FincaBuilder {
  private finca: Finca = new Finca();

  setId(id: string): FincaBuilder {
    this.finca.id = id.trim();
    return this;
  }

  setNombre(nombre: string): FincaBuilder {
    this.finca.nombre = sanitizeText(nombre);
    return this;
  }

  setICA(ica: string): FincaBuilder {
    this.finca.registroICA = sanitizeText(ica);
    return this;
  }

  setGPS(gps: string): FincaBuilder {
    this.finca.gps = sanitizeText(gps);
    return this;
  }

  setCertificado(url?: string): FincaBuilder {
    if (url) this.finca.certificadoPdfUrl = sanitizeText(url);
    return this;
  }

  build(): Finca {
    if (!this.finca.id || !this.finca.nombre || !this.finca.registroICA || !this.finca.gps) {
      throw new Error("Nombre, GPS y registro ICA son obligatorios.");
    }
    return this.finca;
  }
}

function sanitizeText(value: string): string {
  return value.replace(/[<>]/g, "").trim();
}
