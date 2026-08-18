const TRIGGER_SELECTOR = '[data-flag-hover-trigger]';
const PREVIEW_SELECTOR = '[data-flag-hover-preview]';
const OPEN_DELAY_MS = 350;
const HANDOFF_DELAY_MS = 0;
const HANDOFF_WINDOW_MS = 500;

type Notify = (open: boolean) => void;

const cards = new Map<string, Notify>();

let activeId: string | null = null;
let pendingId: string | null = null;
let openTimer: number | null = null;
let lastCloseAt = 0;
let listenerCount = 0;

function clearOpenTimer() {
  if (openTimer === null) {
    return;
  }
  window.clearTimeout(openTimer);
  openTimer = null;
}

function closeActive() {
  if (!activeId) {
    return;
  }
  cards.get(activeId)?.(false);
  activeId = null;
  lastCloseAt = Date.now();
}

function openCard(id: string) {
  if (activeId === id) {
    return;
  }
  closeActive();
  if (!cards.has(id)) {
    return;
  }
  activeId = id;
  cards.get(id)?.(true);
}

function targetIdAtPoint(clientX: number, clientY: number): string | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const element of elements) {
    if (!(element instanceof Element)) {
      continue;
    }
    if (element.closest(PREVIEW_SELECTOR)) {
      continue;
    }
    const trigger = element.closest(TRIGGER_SELECTOR);
    if (trigger instanceof HTMLElement) {
      return trigger.getAttribute('data-flag-hover-trigger');
    }
  }
  return null;
}

function setPendingTarget(nextId: string | null) {
  if (nextId === activeId) {
    if (pendingId !== null) {
      clearOpenTimer();
      pendingId = null;
    }
    return;
  }

  if (nextId === pendingId) {
    return;
  }

  clearOpenTimer();
  pendingId = nextId;

  if (activeId) {
    closeActive();
  }

  if (!nextId) {
    return;
  }

  const delay =
    Date.now() - lastCloseAt < HANDOFF_WINDOW_MS
      ? HANDOFF_DELAY_MS
      : OPEN_DELAY_MS;

  if (delay === 0) {
    pendingId = null;
    openCard(nextId);
    return;
  }

  openTimer = window.setTimeout(() => {
    openTimer = null;
    pendingId = null;
    openCard(nextId);
  }, delay);
}

function handlePointerMove(event: PointerEvent) {
  if (event.pointerType !== 'mouse') {
    return;
  }
  setPendingTarget(targetIdAtPoint(event.clientX, event.clientY));
}

function handlePointerLeaveDocument(event: PointerEvent) {
  if (event.relatedTarget !== null) {
    return;
  }
  clearOpenTimer();
  pendingId = null;
  closeActive();
}

function attachListeners() {
  if (listenerCount === 0) {
    document.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    document.addEventListener('pointerleave', handlePointerLeaveDocument);
  }
  listenerCount += 1;
}

function detachListeners() {
  listenerCount = Math.max(0, listenerCount - 1);
  if (listenerCount > 0) {
    return;
  }
  document.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerleave', handlePointerLeaveDocument);
  clearOpenTimer();
  pendingId = null;
  closeActive();
}

export function registerFlagHoverCard(id: string, notify: Notify) {
  cards.set(id, notify);
  attachListeners();

  return () => {
    cards.delete(id);
    if (pendingId === id) {
      clearOpenTimer();
      pendingId = null;
    }
    if (activeId === id) {
      closeActive();
    }
    detachListeners();
  };
}
