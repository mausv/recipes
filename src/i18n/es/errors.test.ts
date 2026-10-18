import { describe, expect, it } from 'vitest'
import { translateError } from '../errors'

const sourceMessages = [
  'Pick an ingredient for every line',
  'Pick a unit for every line',
  'Quantity must be a number',
  'Quantity must be > 0',
  'Steps cannot be empty',
  'Title is required',
  'Servings must be a whole number',
  'Servings must be at least 1',
  'Servings must be a number',
  'Servings must be > 0',
  'Cooked weight must be a number',
  'Cooked weight must be > 0',
  'Name is required',
  'Name must be 60 characters or less',
  'Name must be 100 characters or less',
  'Pick a valid date',
  'Pick a valid month',
  'Pick a meal',
  'Write a note',
  'Keep the note to 200 characters',
  'Pick a recipe or write a note',
  'Nothing to change',
  'Invalid image id',
  'Unsupported export version, expected version 1',
  'Choose merge or replace',
  ...['Calories', 'Protein', 'Carbs', 'Fat', 'Fiber'].flatMap((label) => [
    `${label} must be a number`,
    `${label} must be ≥ 0`,
  ]),
  'Unit name is required',
  'Unit grams must be a number',
  'Unit grams must be > 0',
  'Density must be a number',
  'Density must be > 0',
  'Custom units cannot be named g, kg, ml, l',
  'Custom unit names must be unique',
  'Comment cannot be empty',
  'Pick a recipe',
  'Pick an ingredient',
  'Amount must be a number',
  'Amount must be > 0',
  'Ingredient not found',
  'Recipe not found',
  'Comment not found',
  'You can only delete your own comments',
  'Connection not found',
  'Unknown ingredient',
  'Only the owner can delete or share this recipe',
  'Group not found',
  'API key not found',
  'Entry not found',
  'Only notes have text',
  'Notes have no servings',
  'Only group admins can do that',
  'This invite link is invalid or has expired',
  'You’re the only admin. Make another member an admin before leaving.',
  'Member not found',
  'Use Leave to remove yourself',
  'Invite not found',
  'Choose an image file',
  'Image must be 10 MB or smaller',
  'Unsupported language',
  'Choose an export file',
  'The file is not valid JSON',
  'Lookup failed, try again',
  'Sign up failed',
  'Sign in failed',
  'Could not complete the request',
  'Invalid invite code',
  'Invalid email',
  'Invalid password',
  'Invalid email or password',
  'Password too short',
  'Password too long',
  'User already exists.',
  'User already exists. Use another email.',
  'Failed to create user',
  'Failed to create session',
  'Email not verified',
  'Email and password sign up is not enabled',
  'Too many requests. Please try again later.',
  'Used by Pancakes. Remove it from those recipes first.',
  'Unit "slice" is used by Toast',
  'Unknown unit "slice" for Bread',
  'Image 123 is not a valid WebP image',
  '"Toast" uses an ingredient missing from the file',
  'Invalid export file: Invalid input at recipes.0.title',
]

describe('Spanish errors', () => {
  it.each(sourceMessages)('translates %j', (message) => {
    const translated = translateError(message, 'es')
    expect(translated).not.toBe(message)
    expect(translated).not.toBe('')
  })

  it('keeps captured values verbatim', () => {
    expect(
      translateError('Used by Pancakes, Waffles. Remove it from those recipes first.', 'es')
    ).toBe('Se usa en Pancakes, Waffles. Quítalo de esas recetas primero.')
    expect(translateError('Unit "slice" is used by French toast', 'es')).toBe(
      'La unidad "slice" se usa en French toast'
    )
    expect(translateError('Unknown unit "cup" for Rice', 'es')).toBe(
      'Unidad desconocida "cup" para Rice'
    )
    expect(translateError('Image abc-123 is not a valid WebP image', 'es')).toBe(
      'La imagen abc-123 no es una imagen WebP válida'
    )
    expect(translateError('"Mom\'s pie" uses an ingredient missing from the file', 'es')).toBe(
      '"Mom\'s pie" usa un ingrediente que no está en el archivo'
    )
  })

  it('translates invalid export file details and paths', () => {
    expect(
      translateError('Invalid export file: Invalid image id at recipes.0.coverImageId', 'es')
    ).toBe('Archivo de exportación no válido: ID de imagen no válido en recipes.0.coverImageId')
    expect(
      translateError(
        'Invalid export file: Invalid input: expected string, received undefined at ingredients.2.name',
        'es'
      )
    ).toBe(
      'Archivo de exportación no válido: Dato no válido: se esperaba string y llegó undefined en ingredients.2.name'
    )
    expect(translateError('Invalid export file: Invalid input', 'es')).toBe(
      'Archivo de exportación no válido: Dato no válido'
    )
    expect(
      translateError('Invalid export file: Too small: expected array to have >=1 items', 'es')
    ).toBe('Archivo de exportación no válido: Too small: expected array to have >=1 items')
  })

  it('falls back to the original message', () => {
    expect(translateError('Something odd happened', 'es')).toBe('Something odd happened')
  })
})
