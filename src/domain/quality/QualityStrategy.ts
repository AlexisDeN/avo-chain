export interface QualityMeasurements {
  humedad: number;
  temperaturaC: number;
  evaluacionFitosanitaria: string;
}

export interface QualityStrategy {
  evaluar(mediciones: QualityMeasurements): boolean;
}

export class ExportQualityStrategy implements QualityStrategy {
  evaluar(m: QualityMeasurements): boolean {
    return m.evaluacionFitosanitaria === "Aprobada" && m.humedad >= 60 && m.humedad <= 70 && m.temperaturaC >= 4 && m.temperaturaC <= 8;
  }
}

// No se definieron rangos nacionales en HU-11; se conservan los límites indicados y
// se permite sustituir esta estrategia al incorporar la norma nacional aplicable.
export class NationalQualityStrategy implements QualityStrategy {
  evaluar(m: QualityMeasurements): boolean {
    return m.evaluacionFitosanitaria === "Aprobada" && m.humedad >= 60 && m.humedad <= 70 && m.temperaturaC >= 4 && m.temperaturaC <= 8;
  }
}
