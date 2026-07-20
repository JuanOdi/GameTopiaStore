import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyAJCpiI2OeDDpKpFIfeqJtpOh9Zo8LFOAw',
  authDomain: 'gametopiastore-6e53d.firebaseapp.com',
  projectId: 'gametopiastore-6e53d',
  storageBucket: 'gametopiastore-6e53d.firebasestorage.app',
  messagingSenderId: '841838245628',
  appId: '1:841838245628:web:8c44d17338fb96ebbf8979',
  databaseURL: 'https://gametopiastore-6e53d-default-rtdb.firebaseio.com',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
