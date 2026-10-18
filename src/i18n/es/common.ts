import type { common as en } from '../en/common'

export const common: typeof en = {
  appName: 'Recetas',
  appDescription: 'Recetas, ingredientes y lista de compras de tu hogar',
  save: 'Guardar',
  saving: 'Guardando…',
  cancel: 'Cancelar',
  delete: 'Eliminar',
  edit: 'Editar',
  close: 'Cerrar',
  creating: 'Creando…',
  copy: (label) => `Copiar ${label}`,
  copied: () => 'Copiado al portapapeles',
  revoke: (name) => `Revocar ${name}`,
}
