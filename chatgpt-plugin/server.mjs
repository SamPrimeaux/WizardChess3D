import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_ID = 'inneranimalmedia.wizard-chess-3d';
const UI_RESOURCE_URI = 'ui://inneranimalmedia.wizard-chess-3d/game.html';
const UI_MIME_TYPE = 'text/html;profile=mcp-app';

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function summarizeSession(session) {
  const chess = session.chess;
  let statusText = chess.turn() === 'w' ? 'White to move' : 'Black to move';
  let result = '*';
  let isGameOver = chess.isGameOver();
  if (chess.isCheckmate()) {
    result = chess.turn() === 'w' ? '0-1' : '1-0';
    statusText = `Checkmate — ${chess.turn() === 'w' ? 'Black' : 'White'} wins`;
  } else if (chess.isDraw()) {
    result = '1/2-1/2';
    statusText = chess.isStalemate() ? 'Stalemate — Draw' : 'Draw';
  } else if (chess.inCheck()) {
    statusText += ' (Check!)';
  }

  return {
    gameId: session.id,
    fen: chess.fen(),
    pgn: chess.pgn(),
    turn: chess.turn(),
    playMode: session.playMode,
    playerColor: session.playerColor,
    difficulty: session.difficulty,
    clockPreset: session.clockPreset,
    moveCount: chess.history().length,
    moves: chess.history(),
    legalMovesCount: chess.moves().length,
    isGameOver,
    result,
    statusText,
    updatedAt: session.updatedAt,
  };
}

function renderMcpWidgetHtml(appUrl) {
  const safeUrl = String(appUrl || 'https://mcp.inneranimalmedia.com/').replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Wizard Chess 3D — MCP App</title>
  <style>
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #080a0f; color: #f0ece1; font-family: Inter, system-ui, sans-serif; }
    .frame-wrap { position: relative; width: 100%; height: 100%; min-height: 480px; }
    iframe { width: 100%; height: 100%; border: 0; display: block; }
  </style>
</head>
<body>
  <div class="frame-wrap">
    <iframe id="wc-frame" src="${safeUrl}?mcpApp=1&displayMode=inline" allow="fullscreen; autoplay" title="Wizard Chess 3D"></iframe>
  </div>
  <script>
    window.addEventListener('message', function (ev) {
      var frame = document.getElementById('wc-frame');
      if (frame && frame.contentWindow && ev.source !== frame.contentWindow) {
        try { frame.contentWindow.postMessage(ev.data, '*'); } catch (e) {}
      }
    });
  </script>
</body>
</html>`;
}

export function createMcpServer({
  appUrl = process.env.WIZARD_CHESS_APP_URL || 'https://mcp.inneranimalmedia.com',
  requireAuth = process.env.MCP_REQUIRE_AUTH === '1',
} = {}) {
  const sessions = new Map();

  function getOrCreateSession(gameId, opts = {}) {
    if (gameId && sessions.has(gameId)) {
      return sessions.get(gameId);
    }
    const id = gameId || `wc-${randomUUID().slice(0, 8)}`;
    const chess = new Chess();
    if (opts.pgn) {
      chess.loadPgn(opts.pgn);
    } else if (opts.fen) {
      chess.load(opts.fen);
    }
    const session = {
      id,
      chess,
      playMode: opts.playMode === 'local' ? 'local' : 'ai',
      playerColor: opts.playerColor === 'b' ? 'b' : 'w',
      difficulty: ['novice', 'club', 'master'].includes(opts.difficulty) ? opts.difficulty : 'club',
      clockPreset: ['bullet', 'blitz', 'rapid', 'unlimited'].includes(opts.clockPreset)
        ? opts.clockPreset
        : 'blitz',
      updatedAt: new Date().toISOString(),
    };
    sessions.set(id, session);
    return session;
  }

  const tools = [
    {
      name: 'launch_game',
      description: 'Launch interactive Wizard Chess 3D MCP App board.',
      inputSchema: {
        type: 'object',
        properties: {
          playMode: { type: 'string', enum: ['ai', 'local'] },
          playerColor: { type: 'string', enum: ['w', 'b'] },
          difficulty: { type: 'string', enum: ['novice', 'club', 'master'] },
          clockPreset: { type: 'string', enum: ['bullet', 'blitz', 'rapid', 'unlimited'] },
          displayMode: { type: 'string', enum: ['inline', 'fullscreen'] },
        },
      },
      _meta: {
        ui: { resourceUri: UI_RESOURCE_URI },
      },
    },
    {
      name: 'create_game',
      description: 'Create a new authoritative Wizard Chess 3D game session.',
      inputSchema: {
        type: 'object',
        properties: {
          playMode: { type: 'string', enum: ['ai', 'local'] },
          playerColor: { type: 'string', enum: ['w', 'b'] },
          difficulty: { type: 'string', enum: ['novice', 'club', 'master'] },
          clockPreset: { type: 'string', enum: ['bullet', 'blitz', 'rapid', 'unlimited'] },
        },
      },
    },
    {
      name: 'resume_saved_game',
      description: 'Resume or hydrate a Wizard Chess game from gameId, FEN, or PGN.',
      inputSchema: {
        type: 'object',
        properties: {
          gameId: { type: 'string' },
          fen: { type: 'string' },
          pgn: { type: 'string' },
        },
      },
    },
    {
      name: 'get_game_state',
      description: 'Fetch FEN, PGN, turn, legal moves count, and status for a session.',
      inputSchema: {
        type: 'object',
        required: ['gameId'],
        properties: {
          gameId: { type: 'string' },
        },
      },
    },
    {
      name: 'submit_legal_move',
      description: 'Validate and execute a legal chess move in SAN or from/to square format.',
      inputSchema: {
        type: 'object',
        required: ['gameId'],
        properties: {
          gameId: { type: 'string' },
          san: { type: 'string' },
          from: { type: 'string' },
          to: { type: 'string' },
          promotion: { type: 'string', enum: ['q', 'r', 'b', 'n'] },
        },
      },
    },
    {
      name: 'list_game_history',
      description: 'List active or archived game sessions tracked by this server.',
      inputSchema: { type: 'object', properties: {} },
    },
  ];

  function callTool(name, args = {}) {
    if (name === 'launch_game' || name === 'create_game') {
      const session = getOrCreateSession(undefined, args);
      const summary = summarizeSession(session);
      return {
        content: [
          {
            type: 'text',
            text: `Started Wizard Chess 3D session ${summary.gameId} (${summary.playMode}, ${summary.difficulty}). ${summary.statusText}.`,
          },
        ],
        structuredContent: {
          ...summary,
          displayMode: args.displayMode === 'fullscreen' ? 'fullscreen' : 'inline',
        },
        _meta: {
          ui: { resourceUri: UI_RESOURCE_URI },
        },
      };
    }

    if (name === 'resume_saved_game') {
      const session = getOrCreateSession(args.gameId, args);
      const summary = summarizeSession(session);
      return {
        content: [{ type: 'text', text: `Resumed session ${summary.gameId}: ${summary.statusText}.` }],
        structuredContent: summary,
        _meta: { ui: { resourceUri: UI_RESOURCE_URI } },
      };
    }

    if (name === 'get_game_state') {
      const session = sessions.get(args.gameId);
      if (!session) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Game session '${args.gameId}' was not found.` }],
        };
      }
      const summary = summarizeSession(session);
      return {
        content: [{ type: 'text', text: `${summary.statusText} (${summary.moveCount} moves) — FEN: ${summary.fen}` }],
        structuredContent: summary,
      };
    }

    if (name === 'submit_legal_move') {
      const session = sessions.get(args.gameId);
      if (!session) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Game session '${args.gameId}' was not found.` }],
        };
      }
      try {
        const result = args.san
          ? session.chess.move(args.san)
          : session.chess.move({ from: args.from, to: args.to, promotion: args.promotion || 'q' });
        if (!result) {
          return {
            isError: true,
            content: [{ type: 'text', text: 'Illegal chess move rejected.' }],
          };
        }
        session.updatedAt = new Date().toISOString();
        const summary = summarizeSession(session);
        return {
          content: [{ type: 'text', text: `Played ${result.san}. ${summary.statusText}.` }],
          structuredContent: {
            ...summary,
            lastMove: { san: result.san, from: result.from, to: result.to },
          },
        };
      } catch (err) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Illegal chess move: ${err.message}` }],
        };
      }
    }

    if (name === 'list_game_history') {
      const games = Array.from(sessions.values()).map(summarizeSession);
      return {
        content: [{ type: 'text', text: `Found ${games.length} Wizard Chess session(s).` }],
        structuredContent: { games },
      };
    }

    return {
      isError: true,
      content: [{ type: 'text', text: `Unknown tool: ${name}` }],
    };
  }

  async function readBodyJson(req) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks).toString('utf8').trim();
    return raw ? JSON.parse(raw) : {};
  }

  function sendJson(res, status, data, extraHeaders = {}) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
      ...extraHeaders,
    });
    res.end(JSON.stringify(data));
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
      });
      res.end();
      return;
    }

    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, id: PACKAGE_ID, version: '1.0.0', sessions: sessions.size });
      return;
    }

    if (url.pathname === '/.well-known/oauth-protected-resource') {
      sendJson(res, 200, {
        resource: 'https://mcp.inneranimalmedia.com/mcp',
        authorization_servers: ['https://inneranimalmedia.com'],
        scopes_supported: ['iam:profile', 'iam:workspaces', 'mcp:tools', 'mcp:userinfo'],
        bearer_methods_supported: ['header'],
      });
      return;
    }

    if (url.pathname === '/.well-known/ai-plugin.json') {
      const data = readJsonSafe(path.join(__dirname, '.well-known/ai-plugin.json'));
      if (data) return sendJson(res, 200, data);
    }

    if (url.pathname === '/openapi.json') {
      const data = readJsonSafe(path.join(__dirname, 'openapi.json'));
      if (data) return sendJson(res, 200, data);
    }

    if (url.pathname === '/manifest.json') {
      const data = readJsonSafe(path.join(__dirname, 'manifest.json'));
      if (data) return sendJson(res, 200, data);
    }

    // Optional Bearer Auth gate for secured MCP deployments
    const isProtectedEndpoint = url.pathname === '/mcp' || url.pathname.startsWith('/actions/');
    if (requireAuth && isProtectedEndpoint) {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ') || auth.length < 16) {
        sendJson(
          res,
          401,
          { error: 'unauthorized', message: 'Bearer token required for InnerAnimalMedia MCP tools' },
          {
            'WWW-Authenticate':
              'Bearer resource_metadata="https://mcp.inneranimalmedia.com/.well-known/oauth-protected-resource"',
          }
        );
        return;
      }
    }

    // OpenAPI REST Action endpoints
    if (req.method === 'POST' && url.pathname === '/actions/create_game') {
      const body = await readBodyJson(req).catch(() => ({}));
      const result = callTool('create_game', body);
      return sendJson(res, 200, result.structuredContent);
    }

    if (req.method === 'GET' && url.pathname === '/actions/get_game_state') {
      const gameId = url.searchParams.get('gameId') || '';
      const result = callTool('get_game_state', { gameId });
      return sendJson(res, result.isError ? 404 : 200, result.isError ? { error: result.content[0].text } : result.structuredContent);
    }

    if (req.method === 'POST' && url.pathname === '/actions/submit_legal_move') {
      const body = await readBodyJson(req).catch(() => ({}));
      const result = callTool('submit_legal_move', body);
      return sendJson(res, result.isError ? 400 : 200, result.isError ? { error: result.content[0].text } : result.structuredContent);
    }

    if (req.method === 'GET' && url.pathname === '/actions/list_game_history') {
      const result = callTool('list_game_history', {});
      return sendJson(res, 200, result.structuredContent);
    }

    // MCP JSON-RPC 2.0 Streamable HTTP endpoint
    if (url.pathname === '/mcp' && req.method === 'POST') {
      let rpc;
      try {
        rpc = await readBodyJson(req);
      } catch {
        return sendJson(res, 400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
      }

      const id = rpc.id ?? null;
      const method = rpc.method;
      const params = rpc.params || {};

      if (method === 'initialize') {
        return sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-11-21',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: { name: PACKAGE_ID, version: '1.0.0' },
          },
        });
      }

      if (method === 'tools/list') {
        return sendJson(res, 200, { jsonrpc: '2.0', id, result: { tools } });
      }

      if (method === 'tools/call') {
        const result = callTool(params.name, params.arguments || {});
        return sendJson(res, 200, { jsonrpc: '2.0', id, result });
      }

      if (method === 'resources/list') {
        return sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: UI_RESOURCE_URI,
                name: 'Wizard Chess 3D Interactive Board',
                mimeType: UI_MIME_TYPE,
                description: '3D Gothic Cathedral Wizard Chess MCP App UI',
              },
            ],
          },
        });
      }

      if (method === 'resources/read') {
        if (params.uri !== UI_RESOURCE_URI) {
          return sendJson(res, 200, {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Unknown resource URI: ${params.uri}` },
          });
        }
        return sendJson(res, 200, {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri: UI_RESOURCE_URI,
                mimeType: UI_MIME_TYPE,
                text: renderMcpWidgetHtml(appUrl),
              },
            ],
          },
        });
      }

      return sendJson(res, 200, {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
    }

    sendJson(res, 404, { error: 'Not found' });
  });

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const port = Number(process.env.PORT || 8787);
  const server = createMcpServer();
  server.listen(port, '0.0.0.0', () => {
    console.log(`[WizardChess3D MCP Server] listening on http://0.0.0.0:${port}/mcp`);
  });
}
