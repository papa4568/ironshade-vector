import { checkRendererReadOnlyBoundaryFromConfig } from '../tools/check-renderer-read-only-boundary.mjs';
await checkRendererReadOnlyBoundaryFromConfig();
await import('./architecture-invariants-legacy.mjs');
await import('./architecture-invariants-verifier-regressions.mjs');
await import('./renderer-read-only-boundary.mjs');
