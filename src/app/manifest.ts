import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Recipes',
    short_name: 'Recipes',
    description: 'Household recipes, ingredients and shopping list',
    start_url: '/',
    display: 'standalone',
    background_color: '#fbf8f2',
    theme_color: '#fbf8f2',
    icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }],
  }
}
