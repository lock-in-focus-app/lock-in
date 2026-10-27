import {
  desktopHostName,
  linkProtocol,
  type FromDesktop,
  type Profile,
  type Session,
  type ToDesktop,
} from '@lock-in/core';

// The link to the desktop app. The browser starts the app's bridge when the extension
// connects (Native Messaging), and the bridge says "linked" once it reaches the running app.
// While linked, the profiles and the session stay in step with the app and every other
// linked browser: each side sends its changes, and the newest change wins. Without the app,
// none of this does anything and the extension works on its own. Satellites are handed over
// to the app, which keeps them; without it, the extension keeps them itself.

type SyncedKey = 'profiles' | 'activeSession';

export function linkDesktopApp(): void {
  let port: Browser.runtime.Port | undefined;
  let linked = false;
  // What the app last sent for each key, so the watchers can tell its changes from the user's.
  const fromApp: Partial<Record<SyncedKey, string>> = {};

  const send = (message: ToDesktop) => {
    if (linked) port?.postMessage(message);
  };

  async function sendState(keys: SyncedKey[]) {
    const [profileList, session, times] = await Promise.all([
      profiles.getValue(),
      activeSession.getValue(),
      syncedAt.getValue(),
    ]);
    send({
      type: 'state',
      ...(keys.includes('profiles') && { profiles: { value: profileList, updatedAt: times.profiles } }),
      ...(keys.includes('activeSession') && { activeSession: { value: session, updatedAt: times.activeSession } }),
    });
  }

  async function applyState(message: Extract<FromDesktop, { type: 'state' }>) {
    const times = await syncedAt.getValue();
    const next = { ...times };
    const updates: Parameters<typeof storage.setItems>[0] = [];
    if (message.profiles.updatedAt > times.profiles) {
      fromApp.profiles = JSON.stringify(message.profiles.value);
      next.profiles = message.profiles.updatedAt;
      updates.push({ item: profiles, value: message.profiles.value });
    }
    if (message.activeSession.updatedAt > times.activeSession) {
      fromApp.activeSession = JSON.stringify(message.activeSession.value);
      next.activeSession = message.activeSession.updatedAt;
      updates.push({ item: activeSession, value: message.activeSession.value });
    }
    if (updates.length) await storage.setItems([...updates, { item: syncedAt, value: next }]);
  }

  async function onMessage(message: FromDesktop) {
    switch (message.type) {
      case 'linked':
        linked = true;
        await desktopLinked.setValue(true);
        send({ type: 'hello', protocol: linkProtocol, browser: import.meta.env.BROWSER });
        await sendState(['profiles', 'activeSession']);
        for (const visit of await gateVisits.getValue()) send({ type: 'gateVisit', visit });
        await handOverSatellites();
        break;
      case 'unlinked':
        linked = false;
        await desktopLinked.setValue(false);
        break;
      case 'state':
        await applyState(message);
        break;
      case 'satelliteKept':
        await forgetSatellite(message.id);
        break;
    }
  }

  // A change made here is newer than anything the app has, so it's stamped and sent. This
  // runs even while unlinked, so changes made without the app still win once it's back.
  async function onLocalChange(key: SyncedKey, value: Profile[] | Session | null) {
    if (JSON.stringify(value) === fromApp[key]) return;
    delete fromApp[key];
    const times = await syncedAt.getValue();
    await syncedAt.setValue({ ...times, [key]: Math.max(Date.now(), times[key] + 1) });
    await sendState([key]);
  }

  profiles.watch((value) => void onLocalChange('profiles', value));
  activeSession.watch((value) => void onLocalChange('activeSession', value));

  // Gate visits go to the app's log as they happen and as the user answers "why?".
  gateVisits.watch((visits, previous) => {
    const before = new Map((previous ?? []).map((visit) => [visit.id, JSON.stringify(visit)]));
    for (const visit of visits) {
      if (before.get(visit.id) !== JSON.stringify(visit)) send({ type: 'gateVisit', visit });
    }
  });

  // Satellites go to the app, which keeps them from then on. Each stays here until the app
  // says it has it, so one launched as the link drops is handed over next time instead.
  async function handOverSatellites() {
    for (const satellite of await satellites.getValue()) send({ type: 'satellite', satellite });
  }
  satellites.watch((list, previous) => {
    const before = new Set((previous ?? []).map((satellite) => satellite.id));
    for (const satellite of list) {
      if (!before.has(satellite.id)) send({ type: 'satellite', satellite });
    }
  });

  void desktopLinked.setValue(false);
  port = browser.runtime.connectNative(desktopHostName);
  port.onMessage.addListener((message: FromDesktop) => void onMessage(message));
  // Fires straight away when the app isn't installed. The extension carries on by itself.
  port.onDisconnect.addListener(() => {
    port = undefined;
    linked = false;
    void desktopLinked.setValue(false);
  });
}
