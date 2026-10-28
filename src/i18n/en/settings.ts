function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

export const settings = {
  title: 'Settings',
  account: 'Account',
  groups: 'Groups',
  changePassword: 'Change password',
  changePasswordDescription: 'You’ll stay signed in here and be signed out everywhere else.',
  changingPassword: 'Changing…',
  passwordChanged: 'Password changed',
  groupsNote: 'Members and invite links are on the',
  groupsPage: 'groups page',
  connectClaude: 'Connect Claude',
  connectDescription:
    'Let Claude read and change your recipes, ingredients, shopping list and pantry over MCP.',
  claudeApps: 'Claude.ai and Claude Desktop',
  connectorSteps:
    'Settings → Connectors → Add custom connector, paste this URL, then sign in and approve.',
  connectorUrl: 'Connector URL',
  command: 'Command',
  claudeCodeThen: 'Then run',
  claudeCodeSignIn: 'in Claude Code to sign in and approve.',
  connectedApps: 'Connected apps',
  unnamedApp: 'Unnamed app',
  connected: (date: string) => `Connected ${date}`,
  forScripts: 'For scripts',
  apiKeysDescription: 'API keys work with any MCP client that can send a bearer header.',
  keyCreated: (date: string) => `Created ${date}`,
  keyLastUsed: (date: string) => `, last used ${date}`,
  keyName: 'Key name',
  keyNamePlaceholder: 'Nightly meal-plan script',
  createKey: 'Create key',
  newKeyBefore: 'Key',
  newKeyAfter: 'created. Copy it now, it won’t be shown again.',
  apiKey: 'API key',
  header: 'Header',
  export: 'Export',
  exportDescription:
    'Download your recipes and the ingredient library as a JSON file, including comments and your notes.',
  includeImages: 'Include images',
  downloadExport: 'Download export',
  import: 'Import',
  importing: 'Importing…',
  importDescription: 'Load recipes from a JSON export.',
  exportFile: 'Export file',
  mode: 'Mode',
  merge: 'Merge into existing data',
  replace: 'Replace my recipes',
  replaceWarning:
    'Deletes all your recipes with their photos, comments and notes before importing. The ingredient library is kept.',
  imported: (recipes: number, ingredients: number, images: number) =>
    `Imported ${plural(recipes, 'recipe')}, ${plural(ingredients, 'new ingredient')} and ${plural(images, 'image')}.`,
  replaceTitle: 'Replace your recipes?',
  replaceDescription:
    'This permanently deletes all your recipes with their photos, comments and notes, then imports the file.',
  replaceConfirm: 'Replace',
}
