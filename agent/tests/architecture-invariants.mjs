import { checkRendererReadOnlyBoundaryFromConfig } from '../tools/check-renderer-read-only-boundary.mjs';
import { checkRendererMutationHardeningFromConfig } from '../tools/check-renderer-mutation-hardening.mjs';
await checkRendererReadOnlyBoundaryFromConfig();
await checkRendererMutationHardeningFromConfig();
await import('./architecture-invariants-legacy.mjs');
await import('./architecture-invariants-verifier-regressions.mjs');
await import('./renderer-read-only-boundary.mjs');
await import('./renderer-mutation-hardening.mjs');
