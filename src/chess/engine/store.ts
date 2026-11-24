import type { Engine } from './engine';

/**
 * Mutable singleton: the live engine instance. Per-frame values never go through React state.
 * `loaded` records that the loader finished even if the engine mounts a moment later.
 */
export const bus: { engine: Engine | null; loaded: boolean } = { engine: null, loaded: false };
