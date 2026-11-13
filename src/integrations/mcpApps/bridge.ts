export type McpDisplayMode = 'inline' | 'fullscreen';

export interface McpToolResultPayload {
  gameId?: string;
  fen?: string;
  pgn?: string;
  playMode?: 'ai' | 'local';
  difficulty?: 'novice' | 'club' | 'master';
  playerColor?: 'w' | 'b';
  clockPreset?: 'bullet' | 'blitz' | 'rapid' | 'unlimited';
  turn?: 'w' | 'b';
  statusText?: string;
  displayMode?: McpDisplayMode;
  authenticated?: boolean;
}

export interface McpBridgeCallbacks {
  onToolPayload: (payload: McpToolResultPayload) => void;
  onDisplayModeChange?: (mode: McpDisplayMode) => void;
}

declare global {
  interface Window {
    openai?: {
      toolInput?: McpToolResultPayload;
      toolOutput?: McpToolResultPayload;
      displayMode?: McpDisplayMode;
      requestDisplayMode?: (opts: { mode: McpDisplayMode }) => Promise<{ mode: McpDisplayMode }>;
      callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      sendFollowUpMessage?: (opts: { prompt: string }) => Promise<void>;
    };
  }
}

let rpcCounter = 1;

export function isMcpHostEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.openai) return true;
  const params = new URLSearchParams(window.location.search);
  return params.get('mcpApp') === '1' || params.get('displayMode') === 'inline';
}

export function getInitialMcpDisplayMode(): McpDisplayMode {
  if (typeof window === 'undefined') return 'fullscreen';
  if (window.openai?.displayMode === 'inline') return 'inline';
  const params = new URLSearchParams(window.location.search);
  return params.get('displayMode') === 'inline' ? 'inline' : 'fullscreen';
}

export function postMcpRpcNotification(method: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
  try {
    window.parent.postMessage(
      {
        jsonrpc: '2.0',
        method,
        params,
      },
      '*'
    );
  } catch {
    // Ignore cross-origin postMessage failures when standalone
  }
}

export function postMcpRpcRequest(method: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.parent || window.parent === window) return;
  try {
    window.parent.postMessage(
      {
        jsonrpc: '2.0',
        id: `wc3d-${rpcCounter++}`,
        method,
        params,
      },
      '*'
    );
  } catch {
    // Ignore when standalone
  }
}

export function syncMcpModelContext(summary: {
  fen: string;
  turn: 'w' | 'b';
  moveCount: number;
  lastSan?: string;
  status: string;
}): void {
  if (!isMcpHostEmbedded()) return;
  postMcpRpcNotification('ui/update-model-context', {
    content: [
      {
        type: 'text',
        text: `Wizard Chess 3D state: ${summary.status} | Turn: ${
          summary.turn === 'w' ? 'White' : 'Black'
        } | Plies: ${summary.moveCount}${summary.lastSan ? ` | Last: ${summary.lastSan}` : ''} | FEN: ${summary.fen}`,
      },
    ],
    structuredContent: summary,
  });
}

export function requestMcpDisplayMode(mode: McpDisplayMode): void {
  if (typeof window === 'undefined') return;
  if (window.openai?.requestDisplayMode) {
    window.openai.requestDisplayMode({ mode }).catch(() => {});
  }
  postMcpRpcRequest('ui/request-display-mode', { mode });
}

export function initMcpAppsBridge(callbacks: McpBridgeCallbacks): () => void {
  if (typeof window === 'undefined') return () => {};

  if (window.openai?.toolOutput) {
    callbacks.onToolPayload(window.openai.toolOutput);
  } else if (window.openai?.toolInput) {
    callbacks.onToolPayload(window.openai.toolInput);
  }

  const handleMessage = (event: MessageEvent) => {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    // JSON-RPC 2.0 MCP Apps notifications from host (ChatGPT / MCP client)
    if (data.jsonrpc === '2.0' && typeof data.method === 'string') {
      if (data.method === 'ui/notifications/tool-input' && data.params?.arguments) {
        callbacks.onToolPayload(data.params.arguments as McpToolResultPayload);
      } else if (data.method === 'ui/notifications/tool-result') {
        const structured =
          data.params?.structuredContent || data.params?.result || data.params;
        if (structured && typeof structured === 'object') {
          callbacks.onToolPayload(structured as McpToolResultPayload);
        }
      } else if (data.method === 'ui/notifications/host-context-changed') {
        const nextMode = data.params?.displayMode;
        if (nextMode === 'inline' || nextMode === 'fullscreen') {
          callbacks.onDisplayModeChange?.(nextMode);
        }
      }
    }
  };

  window.addEventListener('message', handleMessage);

  if (isMcpHostEmbedded()) {
    postMcpRpcRequest('ui/initialize', {
      appInfo: {
        name: 'Wizard Chess 3D',
        version: '1.0.0',
        packageId: 'inneranimalmedia.wizard-chess-3d',
      },
      appCapabilities: {
        availableDisplayModes: ['inline', 'fullscreen'],
      },
      protocolVersion: '2025-11-21',
    });
  }

  return () => {
    window.removeEventListener('message', handleMessage);
  };
}
