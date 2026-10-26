import { cssForPage } from '@lock-in/core';
import { recipes } from '@lock-in/recipes';

export default defineContentScript({
  matches: recipes.flatMap((recipe) => recipe.matches),
  runAt: 'document_start',
  main(ctx) {
    // One <style> element holds this page's recipe CSS. It's filled in, emptied, or
    // updated as sessions start and stop, so tabs that are already open react immediately.
    const style = document.createElement('style');
    style.dataset.lockIn = '';
    document.documentElement.append(style);

    const apply = async () => {
      const [session, profileList] = await Promise.all([activeSession.getValue(), profiles.getValue()]);
      style.textContent = cssForPage({ url: location.href, session, profiles: profileList, recipes });
    };

    void apply();
    const unwatchSession = activeSession.watch(apply);
    const unwatchProfiles = profiles.watch(apply);
    ctx.onInvalidated(() => {
      unwatchSession();
      unwatchProfiles();
      style.remove();
    });
  },
});
