const BLOCKED_COMBAT_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'Space', 'KeyQ', 'KeyE', 'KeyF', 'KeyR', 'KeyV', 'KeyX',
  'Digit4', 'Digit5', 'Digit6',
]);

const BLOCKED_POINTER_EVENTS = [
  'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
  'touchstart', 'touchmove', 'touchend', 'touchcancel',
  'mousedown', 'mousemove', 'mouseup', 'click',
] as const;

export type MissionVisualFrameGateStatus = {
  blocked: boolean;
  detail: string;
};

export interface MissionVisualFrameGate {
  readonly status: MissionVisualFrameGateStatus;
  block(detail?: string): void;
  release(): void;
  setDetail(detail: string): void;
  dispose(): void;
}

type Raf = (callback: FrameRequestCallback) => number;

type NavigatorWithGamepads = Navigator & {
  getGamepads?: () => (Gamepad | null)[];
};

function gameRootFor(canvas: HTMLCanvasElement) {
  return canvas.closest<HTMLElement>('.game-root');
}

function detailCopy(detail: string) {
  if (detail === 'authored-assets') return 'ASSEMBLING AUTHORED ENVIRONMENT + COLLISION LANDMARKS';
  if (detail === 'backend-fallback') return 'RECOVERING RENDER BACKEND + REBUILDING FIELD LANDMARKS';
  if (detail === 'route-transition') return 'ASSEMBLING NEXT MISSION SPACE + COLLISION LANDMARKS';
  return 'ASSEMBLING ENVIRONMENT + COLLISION LANDMARKS';
}

class BrowserMissionVisualFrameGate implements MissionVisualFrameGate {
  private blocked = false;
  private detail = 'startup';
  private disposed = false;
  private overlay: HTMLDivElement | null = null;
  private originalRequestAnimationFrame: Raf | null = null;
  private patchedRequestAnimationFrame: Raf | null = null;
  private frozenTimestamp = 0;
  private readonly onBlockedKeyDown = (event: KeyboardEvent) => {
    if (!this.blocked || !BLOCKED_COMBAT_KEYS.has(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  private readonly onBlockedPointerInput = (event: Event) => {
    if (!this.blocked) return;
    if (event.cancelable) event.preventDefault();
    event.stopImmediatePropagation();
  };

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.block('startup');
  }

  get status(): MissionVisualFrameGateStatus {
    return { blocked: this.blocked, detail: this.detail };
  }

  block(detail = 'authored-assets') {
    if (this.disposed) return;
    this.detail = detail;
    if (!this.blocked) {
      this.blocked = true;
      this.freezeFrameClock();
      const view = this.canvas.ownerDocument.defaultView;
      view?.addEventListener('keydown', this.onBlockedKeyDown, true);
      for (const eventName of BLOCKED_POINTER_EVENTS) {
        view?.addEventListener(eventName, this.onBlockedPointerInput, { capture: true, passive: false });
      }
    }
    this.publishBlockedPresentation();
  }

  release() {
    if (!this.blocked) return;
    this.blocked = false;
    this.restoreFrameClock();
    const view = this.canvas.ownerDocument.defaultView;
    view?.removeEventListener('keydown', this.onBlockedKeyDown, true);
    for (const eventName of BLOCKED_POINTER_EVENTS) {
      view?.removeEventListener(eventName, this.onBlockedPointerInput, true);
    }
    this.overlay?.remove();
    this.overlay = null;
    this.canvas.dataset.missionVisualGate = 'ready';
    const root = gameRootFor(this.canvas);
    if (root) {
      root.dataset.missionVisualGate = 'ready';
      root.setAttribute('aria-busy', 'false');
    }
  }

  setDetail(detail: string) {
    this.detail = detail;
    if (this.blocked) this.publishBlockedPresentation();
  }

  dispose() {
    if (this.disposed) return;
    this.release();
    this.disposed = true;
  }

  private freezeFrameClock() {
    const view = this.canvas.ownerDocument.defaultView;
    if (!view || this.patchedRequestAnimationFrame) return;
    this.frozenTimestamp = view.performance.now();
    const original = view.requestAnimationFrame.bind(view) as Raf;
    const patched: Raf = callback => original(actualTimestamp => {
      if (!this.blocked) {
        callback(actualTimestamp);
        return;
      }
      this.withSuppressedGamepads(() => callback(this.frozenTimestamp));
    });
    this.originalRequestAnimationFrame = original;
    this.patchedRequestAnimationFrame = patched;
    view.requestAnimationFrame = patched;
  }

  private restoreFrameClock() {
    const view = this.canvas.ownerDocument.defaultView;
    if (view && this.originalRequestAnimationFrame && this.patchedRequestAnimationFrame
      && view.requestAnimationFrame === this.patchedRequestAnimationFrame) {
      view.requestAnimationFrame = this.originalRequestAnimationFrame;
    }
    this.originalRequestAnimationFrame = null;
    this.patchedRequestAnimationFrame = null;
  }

  private withSuppressedGamepads(run: () => void) {
    const view = this.canvas.ownerDocument.defaultView;
    const navigator = view?.navigator as NavigatorWithGamepads | undefined;
    if (!navigator || typeof navigator.getGamepads !== 'function') {
      run();
      return;
    }

    const existingOwnDescriptor = Object.getOwnPropertyDescriptor(navigator, 'getGamepads');
    let suppressed = false;
    try {
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => [],
      });
      suppressed = true;
    } catch {
      // Some runtimes make Navigator methods non-configurable. Pointer/keyboard input
      // is still captured and frame time remains frozen while presentation is gated.
    }

    try {
      run();
    } finally {
      if (!suppressed) return;
      try {
        if (existingOwnDescriptor) Object.defineProperty(navigator, 'getGamepads', existingOwnDescriptor);
        else Reflect.deleteProperty(navigator, 'getGamepads');
      } catch {
        // Best effort only; restoring the browser-owned method is preferred but a hostile
        // test double must not break mission deployment cleanup.
      }
    }
  }

  private publishBlockedPresentation() {
    const root = gameRootFor(this.canvas);
    if (root) {
      root.dataset.missionVisualGate = 'loading';
      root.setAttribute('aria-busy', 'true');
    }
    this.canvas.dataset.missionVisualGate = 'loading';
    this.canvas.dataset.missionVisualGateDetail = this.detail;

    const document = this.canvas.ownerDocument;
    if (!this.overlay?.isConnected) {
      const overlay = document.createElement('div');
      overlay.dataset.missionVisualLoadingOverlay = 'true';
      overlay.setAttribute('role', 'status');
      overlay.setAttribute('aria-live', 'polite');
      overlay.setAttribute('aria-atomic', 'true');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '2147483647',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '24px',
        background: 'radial-gradient(circle at 50% 44%, rgba(21,43,43,.98), rgba(3,7,8,.998) 68%)',
        color: '#d8ebe4',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        textAlign: 'center',
        pointerEvents: 'none',
        touchAction: 'none',
      });
      const kicker = document.createElement('small');
      kicker.textContent = 'MISSION VISUALS // FIELD ASSEMBLY';
      Object.assign(kicker.style, { letterSpacing: '0.18em', opacity: '0.7', fontWeight: '800' });
      const title = document.createElement('strong');
      title.dataset.missionVisualLoadingTitle = 'true';
      Object.assign(title.style, { fontSize: 'clamp(18px, 3vw, 30px)', letterSpacing: '0.05em' });
      const detail = document.createElement('span');
      detail.dataset.missionVisualLoadingDetail = 'true';
      Object.assign(detail.style, { maxWidth: '620px', opacity: '0.78', fontSize: '12px', lineHeight: '1.5' });
      detail.textContent = 'COMBAT INPUT HELD UNTIL THE PLAYABLE FIELD IS READABLE';
      overlay.append(kicker, title, detail);
      (root ?? document.body).append(overlay);
      this.overlay = overlay;
    }
    const title = this.overlay?.querySelector<HTMLElement>('[data-mission-visual-loading-title]');
    if (title) title.textContent = detailCopy(this.detail);
  }
}

class NoopMissionVisualFrameGate implements MissionVisualFrameGate {
  private blocked = true;
  private detail = 'startup';
  get status() { return { blocked: this.blocked, detail: this.detail }; }
  block(detail = 'authored-assets') { this.blocked = true; this.detail = detail; }
  release() { this.blocked = false; }
  setDetail(detail: string) { this.detail = detail; }
  dispose() { this.blocked = false; }
}

export function createMissionVisualFrameGate(canvas: HTMLCanvasElement): MissionVisualFrameGate {
  return canvas?.ownerDocument?.defaultView
    ? new BrowserMissionVisualFrameGate(canvas)
    : new NoopMissionVisualFrameGate();
}
