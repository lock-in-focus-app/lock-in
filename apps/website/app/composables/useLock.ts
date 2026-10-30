// Whether you're locked in, shared by the hero's switch, the session readout and the sky.
// Scrolling past the hero (or opening a reading page) locks in once by itself; after that, or
// once you've used a switch yourself, only you start and end it.
export function useLock() {
  const locked = useState('locked', () => false);
  const lockedAt = useState('locked-at', () => 0);
  const autoLock = useState('auto-lock', () => true);

  function setLocked(on: boolean) {
    locked.value = on;
    lockedAt.value = on ? Date.now() : 0;
  }

  function toggle() {
    autoLock.value = false;
    setLocked(!locked.value);
  }

  function lockOnce() {
    if (!autoLock.value) return;
    autoLock.value = false;
    if (!locked.value) setLocked(true);
  }

  return { locked, lockedAt, toggle, lockOnce };
}
