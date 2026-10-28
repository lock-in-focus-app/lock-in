export default defineBackground(() => {
  // Syncs run one at a time, so two quick changes can't interleave their rule updates.
  let queue = Promise.resolve();
  const sync = () =>
    (queue = queue.then(syncRedirects).catch((error) => console.error('Lock In: could not update redirects', error)));

  // Sites people add themselves need the content script too, once Lock In may reach them.
  let scripts = Promise.resolve();
  const syncScripts = () =>
    (scripts = scripts
      .then(syncOwnSiteScripts)
      .catch((error) => console.error('Lock In: could not update added sites', error)));
  const syncAll = () => {
    void sync();
    void syncScripts();
  };

  browser.runtime.onInstalled.addListener(syncAll);
  browser.runtime.onStartup.addListener(syncAll);
  activeSession.watch(sync);
  profiles.watch(syncAll);
  browser.permissions.onAdded.addListener(syncAll);
  browser.permissions.onRemoved.addListener(syncAll);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === passAlarm) void sync();
  });

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (isCloseTabRequest(message) && sender.tab?.id !== undefined) {
      void browser.tabs.remove(sender.tab.id);
      return;
    }
    if (!isSyncRequest(message)) return;
    void sync().then(() => sendResponse());
    return true;
  });

  // However a session ends (here, in the app or in another browser), the satellites in orbit
  // come back. Nothing pops up; they wait in the popup.
  activeSession.watch((session, previous) => {
    if (previous && session?.id !== previous.id) void bringSatellitesBack();
  });

  linkDesktopApp();
});
