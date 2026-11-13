# Wizard Chess 3D — ChatGPT Plugin & MCP Apps Server

- **Package ID:** `inneranimalmedia.wizard-chess-3d`
- **Version:** `1.0.0`
- **Publisher:** InnerAnimalMedia
- **MCP UI Resource URI:** `ui://inneranimalmedia.wizard-chess-3d/game.html` (`text/html;profile=mcp-app`)

## Running Standalone
```bash
npm install
WIZARD_CHESS_APP_URL=https://your-deployed-wizard-chess-url.example npm start
```
Set `PORT` (defaults to `8787`). Optional OAuth enforcement can be enabled with `MCP_REQUIRE_AUTH=1`.

## MCP Tools Exposed
- `launch_game` — Returns the interactive `ui://inneranimalmedia.wizard-chess-3d/game.html` resource and initial game payload.
- `create_game` — Creates a new authoritative `chess.js` session.
- `resume_saved_game` — Hydrates an existing session from FEN/PGN or session ID.
- `get_game_state` — Fetches FEN, PGN, turn, legal moves count, and status.
- `submit_legal_move` — Validates and applies SAN or from/to chess moves.
- `list_game_history` — Lists recent sessions stored in server memory.

## OAuth Metadata Alignment
- Protected Resource Metadata: `https://mcp.inneranimalmedia.com/.well-known/oauth-protected-resource`
- Authorization Server Metadata: `https://inneranimalmedia.com/.well-known/oauth-authorization-server`
- Supported Scopes: `iam:profile`, `iam:workspaces`, `mcp:tools`, `mcp:userinfo`
- PKCE: `S256`
