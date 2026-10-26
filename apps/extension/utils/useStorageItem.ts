import { onUnmounted, ref, type Ref } from 'vue';
import type { WxtStorageItem } from 'wxt/utils/storage';

/** A ref that mirrors a storage item and stays in sync when another context changes it. */
export function useStorageItem<T>(item: WxtStorageItem<T, Record<string, unknown>>): Ref<T | undefined> {
  const value = ref<T>();
  void item.getValue().then((stored) => (value.value = stored));
  const unwatch = item.watch((stored) => (value.value = stored));
  onUnmounted(unwatch);
  return value as Ref<T | undefined>;
}
