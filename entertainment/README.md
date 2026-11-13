# Wizard Chess 3D — InnerAnimalMedia Entertainment Package

- **Package ID:** `inneranimalmedia.wizard-chess-3d`
- **Version:** `1.0.0`
- **Publisher:** InnerAnimalMedia
- **Category:** Entertainment

## Host Integration

Load the built web application (`wizard-chess-3d-web.zip`) inside a standalone tab, side-stage iframe (`?hostMode=side-stage`), or fullscreen portal.

### Host Handshake Events
- **Ready Notification:** `window.parent.postMessage({ type: 'iam:entertainment:ready', packageId: 'inneranimalmedia.wizard-chess-3d', version: '1.0.0', payload }, '*')`
- **State Updates:** `window.parent.postMessage({ type: 'iam:entertainment:state', packageId: 'inneranimalmedia.wizard-chess-3d', version: '1.0.0', payload: { state, summary } }, '*')`
- **Direct JS Bridge (Optional):** Define `window.InnerAnimalEntertainment` (`registerApp`, `emitEvent`, `getSettings`, `hostMode`) on the host frame.

## Contracts & Artwork
- `app.manifest.json` — Host metadata, entry flags, capabilities, storage keys.
- `schemas/settings.schema.json` — User preferences contract (`schemaVersion: 1`).
- `schemas/save-state.schema.json` — Saved/archived game state contract (`schemaVersion: 1`).
- `assets/icon-512x512.png`, `assets/cover-1280x720.png` — Storefront branding assets.
