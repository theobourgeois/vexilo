const OPEN_DELAY_MS = 350;
const HANDOFF_WINDOW_MS = 500;

type Notify = (open: boolean) => void;

const cards = new Map<string, Notify>();

let activeId: string | null = null;
let pendingId: string | null = null;
let openTimer: number | null = null;
let lastCloseAt = 0;

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

export function enterFlagHover(id: string) {
  if (activeId === id) {
    clearOpenTimer();
    pendingId = null;
    return;
  }

  if (pendingId === id) {
    return;
  }

  clearOpenTimer();
  pendingId = id;

  const delay =
    Date.now() - lastCloseAt < HANDOFF_WINDOW_MS ? 0 : OPEN_DELAY_MS;

  if (delay === 0) {
    pendingId = null;
    openCard(id);
    return;
  }

  openTimer = window.setTimeout(() => {
    openTimer = null;
    pendingId = null;
    openCard(id);
  }, delay);
}

export function leaveFlagHover(id: string) {
  if (pendingId === id) {
    clearOpenTimer();
    pendingId = null;
  }
  if (activeId === id) {
    closeActive();
  }
}

export function registerFlagHoverCard(id: string, notify: Notify) {
  cards.set(id, notify);

  return () => {
    cards.delete(id);
    if (pendingId === id) {
      clearOpenTimer();
      pendingId = null;
    }
    if (activeId === id) {
      closeActive();
    }
  };
}
