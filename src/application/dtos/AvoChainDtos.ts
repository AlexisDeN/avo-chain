import { IncidenteRuta, RolUsuario } from "../../domain/entities/Lote";

export interface RegistrarFincaDto {
  nombre: string;
  registroICA: string;
  gps: string;
  certificadoPdfUrl?: string;
  certificadoPdfSizeBytes?: number;
  wallet?: string;
}

export interface RegistrarLoteDto {
  pesoKg: number;
  variedad: string;
  fechaCosecha: string;
  fincaId: string;
  wallet: string;
  rol: RolUsuario;
}

export interface EvidenciaDto {
  filename: string;
  mimeType: "image/jpeg" | "image/png";
  sizeBytes: number;
}

export interface AsignarConductorDto {
  conductorId: string;
  conductorNombre: string;
  pinConfirmacion: string;
  rol: RolUsuario;
}

export interface EscanearRecepcionDto {
  usuarioId: string;
  rutaEsperada?: string;
  rutaActual?: string;
  online?: boolean;
}

export interface VenderLoteDto {
  vendedorId: string;
  rol: RolUsuario;
}

export interface ActualizarLoteDto {
  pesoKg?: number;
  variedad?: string;
  fechaCosecha?: string;
  fincaId?: string;
  rol: RolUsuario;
}

export interface ReportarIncidenteDto {
  conductorId: string;
  tipo: IncidenteRuta["tipo"];
  comentario: string;
  ubicacion: { latitud: number; longitud: number; referencia?: string };
  foto?: EvidenciaDto;
}

export interface InspeccionarCalidadDto {
  rol: string;
  inspectorId: string;
  destino: "Nacional" | "Exportacion";
  humedad: number;
  temperaturaC: number;
  evaluacionFitosanitaria: "Aprobada" | "Rechazada";
  informePdfMimeType: string;
  informePdfUrl: string;
  informePdfSizeBytes: number;
}

export interface ConfirmarRecepcionDto {
  rol: string;
  receptorId: string;
  temperaturaC: number;
  cajasDanadas: number;
  temperaturaMaximaRutaC?: number;
}
