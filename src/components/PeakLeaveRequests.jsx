import React, { useState, useEffect } from 'react';
import { Palmtree, User, ShieldCheck, CheckCircle, Trash2, Loader2, CalendarRange, X } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef, getLeaveRequestsDocRef } from '../firebase';

const HOLIDAY_BLOCKS = [
  'October Half-Term',
  'Christmas/New Year Block',
  'February Half-Term',
  'Easter Holidays',
  'Summer Peak Block'
];

export default function PeakLeaveRequests() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  const [staffList, setStaffList] = useState([]);
  const [requests, setRequests] = useState([]);

  const [viewMode, setViewMode] = useState('staff'); 
  const [currentStaffId, setCurrentStaffId] = useState('');
  
  const [formState, setFormState] = useState({
    priority1: '',
    priority2: '',
    notes: ''
  });

  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const unsubShared = onSnapshot(getRotaDocRef(), (docSnap) => {
      if (docSnap.exists() && docSnap.data().staffList) {
        setStaffList(docSnap.data().staffList);
      }
    });

    const unsubRequests = onSnapshot(getLeaveRequestsDocRef(), (docSnap) => {
      if (docSnap.exists() && docSnap.data().submissions) {
        setRequests(docSnap.data().submissions);
      } else {
        setDoc(getLeaveRequestsDocRef(), { submissions: [] }, { merge: true });
      }
      if (isMounted) setIsDbLoaded(true);
    });

    return () => { isMounted = false; unsubShared(); unsubRequests(); };
  }, [user]);

  const handleSubmit = () => {
    if (!currentStaffId || !formState.priority1) return;

    // Check if staff already submitted to update instead of duplicate
    const existingIndex = requests.findIndex(r => r.staffId === Number(currentStaffId));
    
    const newSubmission = {
      id: existingIndex >= 0 ? requests[existingIndex].id : Date.now().toString(),
      staffId: Number(currentStaffId),
      priority1: formState.priority1,
      priority2: formState.priority2,
      notes: formState.notes,
      submittedAt: new Date().toISOString()
    };

    let updatedRequests = [...requests];
    if (existingIndex >= 0) {
      updatedRequests[existingIndex] = newSubmission;
    } else {
      updatedRequests.push(newSubmission);
    }

    updateDoc(getLeaveRequestsDocRef(), { submissions: updatedRequests }).then(() => {
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      setFormState({ priority1: '', priority2: '', notes: '' });
      setCurrentStaffId('');
    }).catch(console.error);
  };

  const handleDeleteRequest = (id) => {
    if (window.confirm("Are you sure you want to delete this leave request?")) {
      const updatedRequests = requests.filter(r => r.id !== id);
      updateDoc(getLeaveRequestsDocRef(), { submissions: updatedRequests });
    }
  };

  const getStaffName = (id) => staffList.find(s => s.id === id)?.name || 'Unknown Staff';

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center text-teal-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  // Check if current selected staff has already submitted
  const hasSubmitted = currentStaffId ? requests.some(r => r.staffId === Number(currentStaffId)) : false;

  return (
    <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header & Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Palmtree className="w-7 h-7 text-teal-600" />
              Peak Leave Requests
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Submit priorities for historical-aware holiday allocation.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto">
            <button 
              onClick={() => setViewMode('staff')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 flex justify-center items-center gap-2 transition-all ${viewMode === 'staff' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <User className="w-4 h-4" /> Staff Form
            </button>
            <button 
              onClick={() => setViewMode('lead')}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 flex justify-center items-center gap-2 transition-all ${viewMode === 'lead' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <ShieldCheck className="w-4 h-4" /> Lead Nurse
            </button>
          </div>
        </div>

        {viewMode === 'staff' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl mx-auto">
            <div className="p-6 bg-teal-50 border-b border-teal-100 flex items-start gap-4">
              <div className="p-3 bg-white rounded-full shadow-sm text-teal-600 shrink-0">
                <CalendarRange className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Annual Peak Leave Form</h2>
                <p className="text-sm text-slate-600 mt-1">Please select your top priority holiday block for the upcoming year. Allocations are based on the historical fair-share system.</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {submitSuccess ? (
                <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl text-center border border-emerald-200">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-black">Request Submitted Successfully!</h3>
                  <p className="text-sm mt-2">Your peak leave priorities have been logged for review.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">1. What is your name? <span className="text-red-500">*</span></label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-slate-50 font-medium"
                      value={currentStaffId}
                      onChange={(e) => setCurrentStaffId(e.target.value)}
                    >
                      <option value="">-- Select Your Name --</option>
                      {staffList.filter(s => s.status !== 'Archived').map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                      ))}
                    </select>
                    {hasSubmitted && <p className="text-xs font-bold text-amber-600 mt-2 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> You have already submitted a request. Filling this out again will overwrite your previous entry.</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">2. Which peak holiday is your absolute #1 priority? <span className="text-red-500">*</span></label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      value={formState.priority1}
                      onChange={(e) => setFormState({...formState, priority1: e.target.value})}
                    >
                      <option value="">-- Select Priority 1 --</option>
                      {HOLIDAY_BLOCKS.map(h => <option key={`p1-${h}`} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">3. Which peak holiday is your #2 backup choice? <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <select 
                      className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      value={formState.priority2}
                      onChange={(e) => setFormState({...formState, priority2: e.target.value})}
                    >
                      <option value="">-- Select Priority 2 (Backup) --</option>
                      {HOLIDAY_BLOCKS.filter(h => h !== formState.priority1).map(h => <option key={`p2-${h}`} value={h}>{h}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">4. Are there any specific dates or notes we should be aware of? <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <textarea 
                      className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                      rows="3"
                      placeholder="e.g. Flight bookings already made, specific family event..."
                      value={formState.notes}
                      onChange={(e) => setFormState({...formState, notes: e.target.value})}
                    ></textarea>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <button 
                      onClick={handleSubmit}
                      disabled={!currentStaffId || !formState.priority1}
                      className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition-all shadow-sm"
                    >
                      {hasSubmitted ? 'Update My Request' : 'Submit Leave Request'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* LEAD NURSE DASHBOARD */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Submitted Requests Overview</h2>
                <p className="text-xs text-slate-500 mt-1">Review all staff submissions to aid in historical allocation planning.</p>
              </div>
              <div className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-600 shadow-sm">
                Total Submissions: {requests.length}
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-white border-b border-slate-200">
                    <th className="p-4 font-bold text-slate-700">Staff Member</th>
                    <th className="p-4 font-bold text-slate-700">Priority 1</th>
                    <th className="p-4 font-bold text-slate-700">Priority 2 (Backup)</th>
                    <th className="p-4 font-bold text-slate-700 min-w-[200px]">Notes</th>
                    <th className="p-4 font-bold text-slate-700 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length > 0 ? requests.sort((a,b) => new Date(a.submittedAt) - new Date(b.submittedAt)).map((req) => (
                    <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-900">{getStaffName(req.staffId)}</td>
                      <td className="p-4">
                        <span className="bg-teal-100 text-teal-800 border border-teal-200 px-2 py-1 rounded-md font-bold text-xs">
                          {req.priority1}
                        </span>
                      </td>
                      <td className="p-4">
                        {req.priority2 ? (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-md font-bold text-xs">
                            {req.priority2}
                          </span>
                        ) : <span className="text-slate-400 italic text-xs">None</span>}
                      </td>
                      <td className="p-4 text-slate-600 text-xs italic">
                        {req.notes ? `"${req.notes}"` : '-'}
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => handleDeleteRequest(req.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white hover:bg-red-50 transition-colors border border-transparent hover:border-red-200"
                          title="Delete Request"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500">
                        <Palmtree className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                        <p className="font-bold">No requests submitted yet.</p>
                        <p className="text-xs mt-1">When staff fill out the form, their data will appear here.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
