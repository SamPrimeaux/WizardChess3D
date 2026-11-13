import type { GameSettings, SavedGameState } from '../../engine/storage';

export const ENTERTAINMENT_APP_ID = 'inneranimalmedia.wizard-chess-3d';
export const ENTERTAINMENT_APP_VERSION = '1.0.0';
export const ENTERTAINMENT_PUBLISHER = 'InnerAnimalMedia';
export const ENTERTAINMENT_CATEGORY = 'Entertainment';

export type EntertainmentHostMode = 'standalone' | 'side-stage' | 'embedded' | 'fullscreen';

export interface EntertainmentHostHandshake {
  hostDetected: boolean;
  hostMode: EntertainmentHostMode;
  hostOrigin: string | null;
  playerLabel?: string;
}

declare global {
  interface Window {
    InnerAnimalEntertainment?: {
      hostMode?: EntertainmentHostMode;
      registerApp?: (manifest: Record<string, unknown>) => void;
      emitEvent?: (eventName: string, payload: unknown) => void;
      getSettings?: () => Partial<GameSettings> | null;
    };
  }
}

export function detectEntertainmentHost(): EntertainmentHostHandshake {
  if (typeof window === 'undefined') {
    return { hostDetected: false, hostMode: 'standalone', hostOrigin: null };
  }

  const params = new URLSearchParams(window.location.search);
  const hostParam = params.get('hostMode') || params.get('iamHost');

  if (window.InnerAnimalEntertainment) {
    return {
      hostDetected: true,
      hostMode: window.InnerAnimalEntertainment.hostMode || 'side-stage',
      hostOrigin: window.location.origin,
    };
  }

  if (hostParam === 'side-stage' || hostParam === 'embedded' || hostParam === 'fullscreen') {
    return {
      hostDetected: true,
      hostMode: hostParam,
      hostOrigin: document.referrer || null,
    };
  }

  return { hostDetected: false, hostMode: 'standalone', hostOrigin: null };
}

export function notifyEntertainmentHostReady(settings: GameSettings): EntertainmentHostHandshake {
  const handshake = detectEntertainmentHost();
  if (typeof window === 'undefined') return handshake;

  const contractMeta = {
    packageId: ENTERTAINMENT_APP_ID,
    version: ENTERTAINMENT_APP_VERSION,
    publisher: ENTERTAINMENT_PUBLISHER,
    category: ENTERTAINMENT_CATEGORY,
    capabilities: [
      'single-player-ai',
      'local-two-player',
      'chess-clock',
      'pgn-fen-export',
      'offline-pwa',
      'webgl-with-2d-fallback',
    ],
    settings,
  };

  try {
    if (window.InnerAnimalEntertainment?.registerApp) {
      window.InnerAnimalEntertainment.registerApp(contractMeta);
    }
    if (handshake.hostDetected && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'iam:entertainment:ready',
          packageId: ENTERTAINMENT_APP_ID,
          version: ENTERTAINMENT_APP_VERSION,
          payload: contractMeta,
        },
        '*'
      );
    }
  } catch {
    // Host bridge must degrade silently when running standalone
  }

  return handshake;
}

export function emitEntertainmentStateUpdate(state: SavedGameState | null, summary: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.InnerAnimalEntertainment?.emitEvent) {
      window.InnerAnimalEntertainment.emitEvent('state-update', { state, summary });
    }
    const host = detectEntertainmentHost();
    if (host.hostDetected && window.parent && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'iam:entertainment:state',
          packageId: ENTERTAINMENT_APP_ID,
          version: ENTERTAINMENT_APP_VERSION,
          payload: { state, summary },
        },
        '*'
      );
    }
  } catch {
    // Silent fallback when standalone
  }
}
