import type { settings as en } from '../en/settings'

function plural(count: number, one: string, other: string) {
  return `${count} ${count === 1 ? one : other}`
}

export const settings: typeof en = {
  title: 'Ajustes',
  account: 'Cuenta',
  groups: 'Grupos',
  groupsNote: 'Los miembros y enlaces de invitación están en la',
  groupsPage: 'página de grupos',
  connectClaude: 'Conectar Claude',
  connectDescription:
    'Permite que Claude lea y modifique tus recetas, ingredientes, lista de compras y despensa mediante MCP.',
  claudeApps: 'Claude.ai y Claude Desktop',
  connectorSteps:
    'Ve a Configuración → Conectores → Agregar conector personalizado, pega esta URL, luego inicia sesión y aprueba.',
  connectorUrl: 'URL del conector',
  command: 'Comando',
  claudeCodeThen: 'Luego ejecuta',
  claudeCodeSignIn: 'en Claude Code para iniciar sesión y aprobar.',
  connectedApps: 'Apps conectadas',
  unnamedApp: 'App sin nombre',
  connected: (date) => `Conectada el ${date}`,
  forScripts: 'Para scripts',
  apiKeysDescription:
    'Las claves de API funcionan con cualquier cliente MCP que pueda enviar un encabezado bearer.',
  keyCreated: (date) => `Creada el ${date}`,
  keyLastUsed: (date) => `, último uso el ${date}`,
  keyName: 'Nombre de la clave',
  keyNamePlaceholder: 'Script nocturno del plan de comidas',
  createKey: 'Crear clave',
  newKeyBefore: 'Clave',
  newKeyAfter: 'creada. Cópiala ahora, no se volverá a mostrar.',
  apiKey: 'Clave de API',
  header: 'Encabezado',
  export: 'Exportar',
  exportDescription:
    'Descarga tus recetas y la biblioteca de ingredientes en un archivo JSON, con comentarios y tus notas.',
  includeImages: 'Incluir imágenes',
  downloadExport: 'Descargar exportación',
  import: 'Importar',
  importing: 'Importando…',
  importDescription: 'Carga recetas desde una exportación JSON.',
  exportFile: 'Archivo de exportación',
  mode: 'Modo',
  merge: 'Combinar con los datos existentes',
  replace: 'Reemplazar mis recetas',
  replaceWarning:
    'Elimina todas tus recetas con sus fotos, comentarios y notas antes de importar. La biblioteca de ingredientes se conserva.',
  imported: (recipes, ingredients, images) =>
    `Se importó: ${plural(recipes, 'receta', 'recetas')}, ${plural(ingredients, 'ingrediente nuevo', 'ingredientes nuevos')} y ${plural(images, 'imagen', 'imágenes')}.`,
  replaceTitle: '¿Reemplazar tus recetas?',
  replaceDescription:
    'Esto elimina para siempre todas tus recetas con sus fotos, comentarios y notas, y luego importa el archivo.',
  replaceConfirm: 'Reemplazar',
}
