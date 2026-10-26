import { LoteEstadoNombre } from "../state/LoteState";
import { Finca } from "./FincaBuilder";
import { RolUsuario } from "../roles/Roles";

export type { RolUsuario } from "../roles/Roles";

export interface InspeccionCalidad {
  humedad: number;
  temperaturaC: number;
  evaluacionFitosanitaria: string;
  destino: "Nacional" | "Exportacion";
  aprobada: boolean;
  informePdfUrl: string;
  informePdfSizeBytes: number;
  firmadoEn: string;
  inspectorId: string;
  hashInforme: string;
}

export interface RecepcionDestino {
  temperaturaC: number;
  cajasDanadas: number;
  temperaturaMaximaRutaC?: number;
  recibidoPor: string;
  recibidoEn: string;
}

export interface EvidenciaFoto {
  id: string;
  filename: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
  url: string;
}

export interface IncidenteRuta {
  id: string;
  tipo: "Camion varado" | "Choque" | "Trancon por vias cerradas" | "Via cerrada" | "Derrumbe" | "Falla mecanica" | "Clima adverso" | "Retraso por Via" | "Dano en Empaque" | "Falla Mecanica" | "Otro";
  comentario: string;
  conductorId: string;
  ubicacion?: { latitud: number; longitud: number; referencia?: string };
  fotoUrl?: string;
  creadoEn: string;
}

export interface EventoTrazabilidad {
  tipo: string;
  actor: string;
  fecha: string;
  detalle: string;
  txHash?: string;
}

export interface Lote {
  id: string;
  pesoKg: number;
  variedad: string;
  fechaCosecha: string;
  fincaId: string;
  estado: LoteEstadoNombre;
  inspeccionCalidad?: InspeccionCalidad;
  recepcionDestino?: RecepcionDestino;
  productorWallet: string;
  conductorId?: string;
  qrGenerado: boolean;
  qrImpreso: boolean;
  txHashRegistro: string;
  evidencias: EvidenciaFoto[];
  incidentes: IncidenteRuta[];
  eventos: EventoTrazabilidad[];
}

export interface LoteConOrigen extends Lote {
  finca: Finca;
  autentico: boolean;
}
