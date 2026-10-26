export default defineBackground(() => {
  // Syncs run one at a time, so two quick changes can't interleave their rule updates.
  let queue = Promise.resolve();
  const sync = () =>
    (queue = queue.then(syncRedirects).catch((error) => console.error('Lock In: could not update redirects', error)));

  browser.runtime.onInstalled.addListener(sync);
  browser.runtime.onStartup.addListener(sync);
  activeSession.watch(sync);
  profiles.watch(sync);
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === passAlarm) void sync();
  });

  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isSyncRequest(message)) return;
    void sync().then(() => sendResponse());
    return true;
  });
});
