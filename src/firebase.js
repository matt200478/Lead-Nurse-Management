import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc } from 'firebase/firestore';

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

// Clean the App ID to prevent routing failures
export const getRotaDocRef = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...appId.split('/'), 'public', 'data', 'clinic_rota', 'shared_data'];
  if (segments.length % 2 !== 0) segments.push('doc');
  return doc(db, ...segments);
};

export const getTrainingDocRef = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...appId.split('/'), 'public', 'data', 'clinic_rota', 'training_data'];
  if (segments.length % 2 !== 0) segments.push('doc');
  return doc(db, ...segments);
};

export const getCoverBoardDocRef = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...appId.split('/'), 'public', 'data', 'clinic_rota', 'cover_board'];
  if (segments.length % 2 !== 0) segments.push('doc');
  return doc(db, ...segments);
};

export const getLeaveRequestsDocRef = () => {
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...appId.split('/'), 'public', 'data', 'clinic_rota', 'leave_requests'];
  if (segments.length % 2 !== 0) segments.push('doc');
  return doc(db, ...segments);
};
