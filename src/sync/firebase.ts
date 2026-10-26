/* sync/firebase.ts — Firebase app, Firestore and Storage singletons.
 *
 * Uses the same Firebase project as the Birds journal (its security rules
 * already allow `households/{code}/…`); the nature journal keeps its own
 * collections under there (nature_observations, nature_members) and its
 * photos under households/{code}/nature-media/. The config is the public
 * Web SDK config — not a secret; access is controlled by the rules and the
 * journal code. */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentSingleTabManager, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyAPQuB8HSAaLnIWptriLCtLnpuqyDg4VFI',
  authDomain: 'ohad-avraham-birding-log.firebaseapp.com',
  projectId: 'ohad-avraham-birding-log',
  storageBucket: 'ohad-avraham-birding-log.firebasestorage.app',
  messagingSenderId: '977779496102',
  appId: '1:977779496102:web:1b529d33ff2d97de26d067',
};

let app: FirebaseApp | undefined;
let firestore: Firestore | undefined;
let storage: FirebaseStorage | undefined;

function getApp(): FirebaseApp {
  app ??= initializeApp(firebaseConfig, 'nature-journal');
  return app;
}

export function firebaseDb(): Firestore {
  firestore ??= initializeFirestore(getApp(), {
    // Some mobile networks reset Firestore's streaming connection — long
    // polling works everywhere (same choice as the Birds journal).
    experimentalForceLongPolling: true,
    // Writes made offline queue in IndexedDB and go out once back online.
    localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
  });
  return firestore;
}

export function firebaseStorage(): FirebaseStorage {
  storage ??= getStorage(getApp());
  return storage;
}
