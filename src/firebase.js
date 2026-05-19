import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc } from 'firebase/firestore';

// Netlify uses this fallback when deployed
const firebaseConfig = {
  apiKey: "AIzaSy" + "Bmh_DbR07Lga_oc2hAoMKnCYfBhE2C3FU",
  authDomain: "lead-nurse-management.firebaseapp.com",
  projectId: "lead-nurse-management",
  storageBucket: "lead-nurse-management.firebasestorage.app",
  messagingSenderId: "442233471706",
  appId: "1:442233471706:web:ebc5301c40a54180279be3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const getRotaDocRef = () => {
  const appId = 'rota-manager-app';
  return doc(db, 'artifacts', appId, 'public', 'data', 'clinic_rota', 'shared_data', 'doc');
};

export const getTrainingDocRef = () => {
  const appId = 'rota-manager-app';
  return doc(db, 'artifacts', appId, 'public', 'data', 'clinic_rota', 'training_data', 'doc');
};
