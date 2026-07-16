import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Loader2, Delete } from 'lucide-react';
import { onSnapshot } from 'firebase/firestore';
import { getRotaDocRef } from '../firebase';

export default function LockScreen({ onLogin }) {
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(getRotaDocRef(), (docSnap) => {
      if (docSnap.exists() && docSnap.data().staffList) {
        setStaffList(docSnap.data().staffList.filter(s => s.status !== 'Archived'));
      }
      setIsLoading(false);
    });
    return () => unsub();
  }, []);

  const handlePinInput = (num) => {
    setError(false);
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) verifyLogin(newPin);
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError(false);
  };

  const verifyLogin = (enteredPin) => {
    const staff = staffList.find(s => s.id === Number(selectedStaff));
    if (!staff) return;

    // Default PIN is 0000 if not explicitly set in the database yet
    const correctPin = staff.pin || '0000';

    if (enteredPin === correctPin) {
      onLogin(staff);
    } else {
      setError(true);
      setPin('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-indigo-500">
        <Loader2 className="w-12 h-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 font-sans">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="bg-indigo-600 p-8 flex flex-col items-center justify-center text-white">
          <ShieldCheck className="w-12 h-12 mb-3 opacity-90" />
          <h1 className="text-2xl font-black tracking-tight">Practice Manager</h1>
          <p className="text-indigo-200 font-medium text-sm mt-1">Secure Staff Portal</p>
        </div>

        <div className="p-8">
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-700 mb-2">Select Your Profile</label>
            <select 
              className="w-full p-3.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-bold text-slate-800 text-lg"
              value={selectedStaff}
              onChange={(e) => { setSelectedStaff(e.target.value); setPin(''); setError(false); }}
            >
              <option value="">-- Tap to Select --</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className={`transition-opacity duration-300 ${selectedStaff ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
            <div className="flex justify-center gap-3 mb-6">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className={`w-4 h-4 rounded-full transition-colors ${pin.length > i ? 'bg-indigo-600' : 'bg-slate-200'} ${error ? 'bg-red-500 animate-pulse' : ''}`} />
              ))}
            </div>

            {error && <p className="text-red-500 text-sm font-bold text-center mb-4">Incorrect PIN. Please try again.</p>}

            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button key={num} onClick={() => handlePinInput(num.toString())} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors active:scale-95 shadow-sm">
                  {num}
                </button>
              ))}
              <div className="p-4"></div>
              <button onClick={() => handlePinInput('0')} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-2xl font-black text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors active:scale-95 shadow-sm">0</button>
              <button onClick={handleDelete} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center active:scale-95 shadow-sm"><Delete className="w-7 h-7" /></button>
            </div>
            
            <p className="text-center text-xs text-slate-400 font-medium mt-6 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" /> Default PIN is 0000
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
