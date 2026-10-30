// How the light pollution looks: city lights (the default) or a sunset-like glow. Remembered in
// this browser only.
export type Look = 'city' | 'sunset';

const KEY = 'lock-in-look';

export function useLook() {
  const look = useState<Look>('look', () => 'city');

  function setLook(next: Look) {
    look.value = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not remembered; that's fine.
    }
  }

  function restoreLook() {
    try {
      if (localStorage.getItem(KEY) === 'sunset') look.value = 'sunset';
    } catch {
      // Storage can be off; city lights it is.
    }
  }

  return { look, setLook, restoreLook };
}
