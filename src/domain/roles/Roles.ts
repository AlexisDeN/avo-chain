export const ROLES_USUARIO = [
  "Productor",
  "Bodeguero",
  "Transportador",
  "Vendedor",
  "Administrador",
  "Inspector de calidad",
  "Receptor"
] as const;

export type RolUsuario = (typeof ROLES_USUARIO)[number];

export const ROLES_DESCRIPCION: Record<RolUsuario, string> = {
  Productor: "Registra fincas y lotes de aguacate.",
  Bodeguero: "Prepara y despacha lotes para su transporte.",
  Transportador: "Reporta novedades y ubicación durante el traslado.",
  Vendedor: "Recibe el producto en el punto de venta y registra su venta.",
  Administrador: "Consulta métricas globales y administra lotes.",
  "Inspector de calidad": "Revisa la calidad del producto y registra inspecciones.",
  Receptor: "Confirma la recepción del producto en su destino."
};

export const ROLES_INTERFAZ: Record<string, RolUsuario> = {
  productor: "Productor",
  calidad: "Inspector de calidad",
  bodega: "Bodeguero",
  conductor: "Transportador",
  tienda: "Vendedor",
  recepcion: "Receptor",
  admin: "Administrador"
};

export function esRolUsuario(rol: string): rol is RolUsuario {
  return (ROLES_USUARIO as readonly string[]).includes(rol);
}
