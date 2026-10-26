import type { InjectionKey, Ref } from 'vue';

/** What every region of a preview mock needs: the toggle values, and which toggle the user is pointing at. */
export interface PreviewContext {
  values: Ref<Record<string, boolean>>;
  highlight: Ref<string | undefined>;
}

export const previewKey: InjectionKey<PreviewContext> = Symbol('lock-in preview');
