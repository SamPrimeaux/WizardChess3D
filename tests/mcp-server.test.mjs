import assert from 'node:assert/strict';
import test from 'node:test';
import { createMcpServer } from '../chatgpt-plugin/server.mjs';

test('ChatGPT Plugin & MCP server endpoints, tools, and UI resource', async () => {
  const server = createMcpServer({ appUrl: 'https://wizardchess.example', requireAuth: false });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.ok, true);
    assert.equal(healthJson.id, 'inneranimalmedia.wizard-chess-3d');

    // 2. OAuth protected resource metadata
    const oauthRes = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
    assert.equal(oauthRes.status, 200);
    const oauthJson = await oauthRes.json();
    assert.deepEqual(oauthJson.authorization_servers, ['https://inneranimalmedia.com']);

    // 3. MCP initialize & tools/list
    const listRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });
    assert.equal(listRes.status, 200);
    const listJson = await listRes.json();
    const toolNames = listJson.result.tools.map((t) => t.name);
    assert.ok(toolNames.includes('launch_game'));
    assert.ok(toolNames.includes('create_game'));
    assert.ok(toolNames.includes('submit_legal_move'));

    // 4. MCP resources/read ui://inneranimalmedia.wizard-chess-3d/game.html
    const readRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/read',
        params: { uri: 'ui://inneranimalmedia.wizard-chess-3d/game.html' },
      }),
    });
    const readJson = await readRes.json();
    assert.equal(readJson.result.contents[0].mimeType, 'text/html;profile=mcp-app');
    assert.match(readJson.result.contents[0].text, /Wizard Chess 3D/);

    // 5. MCP tools/call create_game -> submit_legal_move -> illegal move rejected
    const createRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'create_game', arguments: { playMode: 'local' } },
      }),
    });
    const createJson = await createRes.json();
    const gameId = createJson.result.structuredContent.gameId;
    assert.ok(gameId);

    const legalMoveRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'submit_legal_move', arguments: { gameId, san: 'e4' } },
      }),
    });
    const legalMoveJson = await legalMoveRes.json();
    assert.equal(legalMoveJson.result.isError, undefined);
    assert.equal(legalMoveJson.result.structuredContent.turn, 'b');

    const badMoveRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: { name: 'submit_legal_move', arguments: { gameId, san: 'e5' } },
      }),
    });
    // Note: e5 is legal for Black, so let's send an impossible Knight jump 'Ke8'
    const badMoveJson = await badMoveRes.json();
    assert.equal(badMoveJson.result.structuredContent.turn, 'w');

    const illegalRes = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: { name: 'submit_legal_move', arguments: { gameId, san: 'Ke8' } },
      }),
    });
    const illegalJson = await illegalRes.json();
    assert.equal(illegalJson.result.isError, true);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
