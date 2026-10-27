import type { Satellite } from './generated/Satellite';
import type { GateVisit, Profile, Session } from './types';

// Messages between the extension and the desktop app, which talk over Native Messaging.
// They mirror the Rust ones in apps/desktop/src-tauri/src/link.rs.

/** The Native Messaging host the extension connects to: the desktop app's bridge. */
export const desktopHostName = 'io.github.lock_in_focus_app.lock_in';

/** Bumped when a change to the messages would break the other side. */
export const linkProtocol = 1;

/** A value kept in step between the extension and the app. The newest change wins. */
export interface Synced<T> {
  value: T;
  /** Epoch milliseconds. 0 means it has never been changed. */
  updatedAt: number;
}

export type ToDesktop =
  | { type: 'hello'; protocol: number; browser: string }
  | { type: 'state'; profiles?: Synced<Profile[]>; activeSession?: Synced<Session | null> }
  | { type: 'gateVisit'; visit: GateVisit }
  /** A satellite launched in the browser, handed over for the app to keep. */
  | { type: 'satellite'; satellite: Satellite };

export type FromDesktop =
  /** The bridge reached the app, or lost it. Sent by the bridge itself. */
  | { type: 'linked' }
  | { type: 'unlinked' }
  | { type: 'state'; profiles: Synced<Profile[]>; activeSession: Synced<Session | null> }
  /** The app has the satellite now, so the extension can let it go. */
  | { type: 'satelliteKept'; id: string };
