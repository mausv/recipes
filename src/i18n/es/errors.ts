export const errors: Record<string, string> = {
  'Pick an ingredient for every line': 'Elige un ingrediente en cada renglón',
  'Pick a unit for every line': 'Elige una unidad en cada renglón',
  'Quantity must be a number': 'La cantidad debe ser un número',
  'Quantity must be > 0': 'La cantidad debe ser mayor que 0',
  'Steps cannot be empty': 'Los pasos no pueden estar vacíos',
  'Title is required': 'El título es obligatorio',
  'Servings must be a whole number': 'Las porciones deben ser un número entero',
  'Servings must be at least 1': 'Debe haber al menos 1 porción',
  'Servings must be a number': 'Las porciones deben ser un número',
  'Servings must be > 0': 'Las porciones deben ser mayores que 0',
  'Cooked weight must be a number': 'El peso cocido debe ser un número',
  'Cooked weight must be > 0': 'El peso cocido debe ser mayor que 0',
  'Name is required': 'El nombre es obligatorio',
  'Name must be 60 characters or less': 'El nombre debe tener 60 caracteres o menos',
  'Name must be 100 characters or less': 'El nombre debe tener 100 caracteres o menos',
  'Pick a valid date': 'Elige una fecha válida',
  'Pick a valid month': 'Elige un mes válido',
  'Pick a meal': 'Elige una comida',
  'Write a note': 'Escribe una nota',
  'Keep the note to 200 characters': 'La nota debe tener máximo 200 caracteres',
  'Pick a recipe or write a note': 'Elige una receta o escribe una nota',
  'Nothing to change': 'No hay nada que cambiar',
  'Invalid image id': 'ID de imagen no válido',
  'Unsupported export version, expected version 1':
    'Versión de exportación no compatible, se esperaba la versión 1',
  'Choose merge or replace': 'Elige combinar o reemplazar',
  'Calories must be a number': 'Las calorías deben ser un número',
  'Calories must be ≥ 0': 'Las calorías deben ser ≥ 0',
  'Protein must be a number': 'La proteína debe ser un número',
  'Protein must be ≥ 0': 'La proteína debe ser ≥ 0',
  'Carbs must be a number': 'Los carbohidratos deben ser un número',
  'Carbs must be ≥ 0': 'Los carbohidratos deben ser ≥ 0',
  'Fat must be a number': 'La grasa debe ser un número',
  'Fat must be ≥ 0': 'La grasa debe ser ≥ 0',
  'Fiber must be a number': 'La fibra debe ser un número',
  'Fiber must be ≥ 0': 'La fibra debe ser ≥ 0',
  'Unit name is required': 'El nombre de la unidad es obligatorio',
  'Unit grams must be a number': 'Los gramos de la unidad deben ser un número',
  'Unit grams must be > 0': 'Los gramos de la unidad deben ser mayores que 0',
  'Density must be a number': 'La densidad debe ser un número',
  'Density must be > 0': 'La densidad debe ser mayor que 0',
  'Custom units cannot be named g, kg, ml, l':
    'Las unidades propias no pueden llamarse g, kg, ml ni l',
  'Custom unit names must be unique': 'Cada unidad propia debe tener un nombre distinto',
  'Comment cannot be empty': 'El comentario no puede estar vacío',
  'Pick a recipe': 'Elige una receta',
  'Pick an ingredient': 'Elige un ingrediente',
  'Amount must be a number': 'La cantidad debe ser un número',
  'Amount must be > 0': 'La cantidad debe ser mayor que 0',
  'Invalid input': 'Dato no válido',

  'Ingredient not found': 'No se encontró el ingrediente',
  'Recipe not found': 'No se encontró la receta',
  'Comment not found': 'No se encontró el comentario',
  'You can only delete your own comments': 'Solo puedes borrar tus propios comentarios',
  'Connection not found': 'No se encontró la conexión',
  'Unknown ingredient': 'Ingrediente desconocido',
  'Only the owner can delete or share this recipe':
    'Solo quien creó la receta puede borrarla o compartirla',
  'Group not found': 'No se encontró el grupo',
  'API key not found': 'No se encontró la clave de API',
  'Entry not found': 'No se encontró la entrada',
  'Only notes have text': 'Solo las notas tienen texto',
  'Notes have no servings': 'Las notas no tienen porciones',
  'Only group admins can do that': 'Solo los admins del grupo pueden hacer eso',
  'This invite link is invalid or has expired':
    'Este enlace de invitación no es válido o ya expiró',
  'You’re the only admin. Make another member an admin before leaving.':
    'Nadie más es admin. Haz admin a otro miembro antes de salir.',
  'Member not found': 'No se encontró al miembro',
  'Use Leave to remove yourself': 'Usa Salir para dejar el grupo',
  'Invite not found': 'No se encontró la invitación',
  'Choose an image file': 'Elige un archivo de imagen',
  'Image must be 10 MB or smaller': 'La imagen debe pesar 10 MB o menos',
  'Unsupported language': 'Idioma no compatible',
  'Choose an export file': 'Elige un archivo de exportación',
  'The file is not valid JSON': 'El archivo no es un JSON válido',

  'Lookup failed, try again': 'La búsqueda falló, intenta de nuevo',
  'Sign up failed': 'No se pudo crear la cuenta',
  'Sign in failed': 'No se pudo iniciar sesión',
  'Could not complete the request': 'No se pudo completar la solicitud',

  'Invalid invite code': 'Código de invitación no válido',
  'Invalid email': 'Correo no válido',
  'Invalid password': 'Contraseña no válida',
  'Invalid email or password': 'Correo o contraseña incorrectos',
  'Password too short': 'La contraseña es muy corta',
  'Password too long': 'La contraseña es muy larga',
  'User already exists.': 'Ya existe una cuenta con ese correo.',
  'User already exists. Use another email.': 'Ya existe una cuenta con ese correo. Usa otro.',
  'Failed to create user': 'No se pudo crear la cuenta',
  'Failed to create session': 'No se pudo iniciar sesión',
  'Email not verified': 'Tu correo no está verificado',
  'Email and password sign up is not enabled':
    'El registro con correo y contraseña no está habilitado',
  'Too many requests. Please try again later.': 'Demasiados intentos. Intenta más tarde.',
}

const zodDetail = (message: string) =>
  errors[message] ??
  message.replace(
    /^Invalid input: expected (.+), received (.+)$/,
    'Dato no válido: se esperaba $1 y llegó $2'
  )

export const errorPatterns: [RegExp, (...groups: string[]) => string][] = [
  [
    /^Used by (.+)\. Remove it from those recipes first\.$/,
    (titles) => `Se usa en ${titles}. Quítalo de esas recetas primero.`,
  ],
  [/^Unit "(.+)" is used by (.+)$/, (unit, title) => `La unidad "${unit}" se usa en ${title}`],
  [
    /^Unknown unit "(.+)" for (.+)$/,
    (unit, ingredient) => `Unidad desconocida "${unit}" para ${ingredient}`,
  ],
  [
    /^Image (.+) is not a valid WebP image$/,
    (id) => `La imagen ${id} no es una imagen WebP válida`,
  ],
  [
    /^"(.+)" uses an ingredient missing from the file$/,
    (title) => `"${title}" usa un ingrediente que no está en el archivo`,
  ],
  [
    /^Invalid export file: (.+?)(?: at (\S+))?$/,
    (detail, path) =>
      `Archivo de exportación no válido: ${zodDetail(detail)}${path ? ` en ${path}` : ''}`,
  ],
]
