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
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
