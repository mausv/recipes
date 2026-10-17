# Recipes

Self-hosted recipe app for a household: recipes with nutrition, ingredients, shopping list and pantry. Next.js, SQLite (Drizzle) and Better Auth.

## Development

```sh
pnpm install
cp .env.example .env   # set BETTER_AUTH_SECRET (openssl rand -base64 32) and INVITE_CODE
pnpm dev
```

Sign-up is invite-only: open http://localhost:3000/signup and enter `INVITE_CODE` to create an account. Share the code with the rest of the household.

Set `USDA_API_KEY` (free at https://fdc.nal.usda.gov/api-key-signup) to include USDA FoodData Central in nutrition search; without it, only Open Food Facts is used.

After changing `src/db/schema.ts`, run `pnpm db:generate`.

## Data

The SQLite database (`recipes.db`) and uploaded images live in `DATA_DIR` (default `./data`). Migrations run on startup.

## Backup

Settings → Export downloads recipes, ingredients, comments and notes as JSON, optionally with images. Import the file on the same page to restore it: merge updates matching records and adds the rest, replace wipes the library first.

## Connect Claude (MCP)

The app serves an MCP server at `/api/mcp` (Streamable HTTP, stateless) with full read and write access. Claude signs in with OAuth 2.1: the app is its own authorization server, with dynamic client registration and refresh tokens.

- Claude.ai / Claude Desktop: Settings → Connectors → Add custom connector, URL `https://your-host/api/mcp`, then sign in and approve.
- Claude Code:

  ```sh
  claude mcp add --transport http recipes https://your-host/api/mcp
  ```

  Then run `/mcp` in Claude Code to sign in and approve.

Claude.ai and Claude Desktop connectors connect from Anthropic's servers, so the app must be reachable on public HTTPS and `BETTER_AUTH_URL` must be set to that URL. Claude Code connects directly and also works against a local or private address.

Settings → Connect Claude lists connected apps; revoking one cuts off its tokens immediately.

For scripts, create an API key in Settings and send it as `Authorization: Bearer <KEY>`. Revoke a key in Settings to cut off access.

Tools:

- `list_recipes`, `get_recipe`: search recipes; full recipe with nutrition, comments and your note
- `create_recipe`, `update_recipe`, `delete_recipe`: manage recipes (lines reference library ingredients)
- `search_ingredients`, `get_ingredient`: browse the ingredient library (macros per 100 g)
- `create_ingredient`, `update_ingredient`, `delete_ingredient`: manage the library
- `lookup_nutrition`: search Open Food Facts / USDA for per-100 g nutrition
- `get_shopping_list`: merged needs with the pantry applied, free-text items and the pantry
- `add_recipe_to_shopping_list`, `add_shopping_item`: add to the list
- `check_shopping_items`, `remove_shopping_items`, `clear_checked_items`, `clear_shopping_list`: edit the list
- `move_bought_to_pantry`, `set_pantry_item`, `remove_pantry_item`: manage the pantry
- `add_comment`, `save_note`: comment on a recipe or save your private note
- `list_tags`: every recipe tag

## Docker

```sh
cp .env.example .env   # fill in as above
docker compose up -d --build
```

`DATA_DIR` is mounted from `./data` on the host.
