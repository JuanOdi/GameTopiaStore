import {
  EmailAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { ref, set } from 'firebase/database';

import { auth, db } from './firebase';

export async function signUp(email: string, password: string) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await set(ref(db, `users/${result.user.uid}`), {
    email,
    role: 'user',
    createdAt: Date.now(),
  });
  return result.user;
}

export async function signIn(email: string, password: string) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  const userRef = ref(db, `users/${result.user.uid}`);
  const { get } = await import('firebase/database');
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    await set(userRef, {
      email,
      role: 'user',
      createdAt: Date.now(),
    });
  }
  return result.user;
}

export async function logOut() {
  await signOut(auth);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Not authenticated.');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
}
