/**
 * Firestore: коллекция `quizzes`, документ id = quiz.id.
 */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

let dbInstance = null;

export function getFirestoreDb() {
  if (dbInstance) return dbInstance;
  try {
    const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (e) {
    console.error('[Firebase]', e);
    return null;
  }
}

/** @param {{ id: string, data: () => Record<string, unknown> }} d */
function sanitizeQuizFromDoc(d) {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? '',
    description: data.description ?? '',
    source: 'community',
    resultTexts: data.resultTexts && typeof data.resultTexts === 'object' ? data.resultTexts : {},
    questions: Array.isArray(data.questions) ? data.questions : [],
  };
}

/**
 * @returns {() => void}
 */
export function subscribeQuizzes(onNext, onError) {
  const db = getFirestoreDb();
  if (!db) {
    onNext([]);
    return () => {};
  }
  const col = collection(db, 'quizzes');
  return onSnapshot(
    col,
    (snap) => {
      const pairs = snap.docs.map((d) => ({
        d,
        quiz: sanitizeQuizFromDoc(d),
        ms: d.data()?.createdAt?.toMillis?.() ?? 0,
      }));
      pairs.sort((a, b) => b.ms - a.ms);
      onNext(pairs.map((p) => p.quiz));
    },
    onError
  );
}

/** @param {{ id: string, title: string, description?: string, resultTexts?: Record<string, string>, questions: unknown[] }} quiz */
export async function saveQuizRemote(quiz) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase недоступен');
  const ref = doc(db, 'quizzes', quiz.id);
  await setDoc(ref, {
    title: quiz.title,
    description: quiz.description ?? '',
    source: 'community',
    resultTexts: quiz.resultTexts ?? {},
    questions: quiz.questions,
    createdAt: serverTimestamp(),
  });
}

export async function deleteQuizRemote(quizId) {
  const db = getFirestoreDb();
  if (!db) throw new Error('Firebase недоступен');
  await deleteDoc(doc(db, 'quizzes', quizId));
}

const MIGRATE_FLAG = 'twa_firestore_migrated_v1';

/**
 * Одноразово отправляет локальные тесты в Firestore (из прежнего localStorage).
 * @param {() => Array<{ id: string, title: string, description?: string, resultTexts?: Record<string, string>, questions: unknown[] }>} loadLocal
 */
export async function migrateLocalToFirestoreOnce(loadLocal) {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATE_FLAG)) return;
  const db = getFirestoreDb();
  if (!db) return;
  const local = loadLocal();
  if (!local.length) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MIGRATE_FLAG, '1');
    return;
  }
  for (const quiz of local) {
    const ref = doc(db, 'quizzes', quiz.id);
    await setDoc(ref, {
      title: quiz.title,
      description: quiz.description ?? '',
      source: 'community',
      resultTexts: quiz.resultTexts ?? {},
      questions: quiz.questions,
      createdAt: serverTimestamp(),
    });
  }
  if (typeof localStorage !== 'undefined') localStorage.setItem(MIGRATE_FLAG, '1');
}
