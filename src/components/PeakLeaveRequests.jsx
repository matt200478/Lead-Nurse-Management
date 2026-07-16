import React, { useState, useEffect } from 'react';
import { Palmtree, User, ShieldCheck, CheckCircle, Trash2, Loader2, CalendarRange, X, Wand2, Save, History, AlertTriangle, AlertCircle } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef, getLeaveRequestsDocRef } from '../firebase';

const HOLIDAY_BLOCKS = [
  'October Half-Term',
  'Christmas Block',
  'New Year Block',
  'February Half-Term',
  'Easter Holidays'
];

// Set the maximum number of staff allowed off per peak block
const MAX_OFF_PER_BLOCK = 2; 

export default function PeakLeaveRequests() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  const [staffList, setStaffList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState({}); 

  const [viewMode, setViewMode] = useState('staff'); 
  const [currentStaffId, setCurrentStaffId] = useState('');
  
  const [formState, setFormState] = useState({
    priority1: '',
    priority2: '',
    notes: ''
  });

  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Auto-Allocation States
  const [draftAllocation, setDraftAllocation] = useState(null);
  const [viewYear, setViewYear] = useState('Current');

  // Dynamic Leave Year Calculation (Runs 1st April to 31st March)
  const today = new Date();
  // If current month is Jan, Feb, or Mar (0, 1, 2), the leave year started last calendar year
  const currentLeaveYearStart = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  
  const lastYear = `${currentLeaveYearStart}/${(currentLeaveYearStart + 1).toString().slice(-2)}`; // e.g. "2026/27"
  const planningYear = `${currentLeaveYearStart + 1}/${(currentLeaveYearStart + 2).toString().slice(-2)}`; // e.g. "2027/28"

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
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.submissions) setRequests(data.submissions);
        if (data.history) setLeaveHistory(data.history);
      } else {
        setDoc(getLeaveRequestsDocRef(), { submissions: [], history: {} }, { merge: true });
      }
      if (isMounted) setIsDbLoaded(true);
    });

    return () => { isMounted = false; unsubShared(); unsubRequests(); };
  }, [user]);

  const handleSubmit = () => {
    if (!currentStaffId || !formState.priority1) return;
    
    const newSubmission = {
      id: Date.now().toString(),
      staffId: Number(currentStaffId),
      priority1: formState.priority1,
      priority2: formState.priority2,
      notes: formState.notes,
      submittedAt: new Date().toISOString()
    };

    const updatedRequests = [...requests, newSubmission];

    updateDoc(getLeaveRequestsDocRef(), { submissions: updatedRequests }).then(() => {
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setFormState({ priority1: '', priority2: '', notes: '' });
        setCurrentStaffId('');
      }, 3000);
    }).catch(console.error);
  };

  const handleDeleteRequest = (id) => {
    if (window.confirm("Are you sure you want to delete this leave request?")) {
      const updatedRequests = requests.filter(r => r.id !== id);
      updateDoc(getLeaveRequestsDocRef(), { submissions: updatedRequests });
    }
  };

  const getStaffName = (id) => staffList.find(s => s.id === id)?.name || 'Unknown Staff';

  // --- AUTO ALLOCATION ENGINE ---
  const handleGenerateDraft = () => {
    const draft = {};
    const previousHistory = leaveHistory[lastYear] || {};

    HOLIDAY_BLOCKS.forEach(block => {
      // 1. Find everyone who requested this block as Priority 1
      const requesters = requests.filter(r => r.priority1 === block);
      
      // 2. Score them based on last year's history
      const scored = requesters.map(req => {
        const lastYearStatus = previousHistory[block]?.[req.staffId] || 'No Request';
        let tier = 2; // Default: Middle of queue
        if (lastYearStatus === 'Worked') tier = 1; // Top priority
        if (lastYearStatus === 'Off') tier = 3; // Lowest priority
        
        return { ...req, tier, lastYearStatus, outcome: 'Pending', tieBreaker: false };
      });

      // 3. Sort by Tier (Tier 1 is first)
      scored.sort((a, b) => a.tier - b.tier);

      // 4. Allocate based on safe staffing limits
      let allocatedCount = 0;
      scored.forEach((s, idx) => {
        if (allocatedCount < MAX_OFF_PER_BLOCK) {
          s.outcome = 'Allocated';
          allocatedCount++;
        } else {
          s.outcome = 'Waitlisted';
        }
      });

      // 5. Detect Tie-Breakers at the cutoff boundary
      if (scored.length > MAX_OFF_PER_BLOCK) {
        const lastAllocatedTier = scored[MAX_OFF_PER_BLOCK - 1].tier;
        const firstWaitlistedTier = scored[MAX_OFF_PER_BLOCK].tier;
        
        if (lastAllocatedTier === firstWaitlistedTier) {
          scored.forEach(s => {
            if (s.tier === lastAllocatedTier) s.tieBreaker = true;
          });
        }
      }

      draft[block] = scored;
    });

    setDraftAllocation(draft);
  };

  const updateDraftOutcome = (block, staffId, newOutcome) => {
    setDraftAllocation(prev => ({
      ...prev,
      [block]: prev[block].map(req => 
        req.staffId === staffId ? { ...req, outcome: newOutcome, tieBreaker: false } : req
      )
    }));
  };

  // --- HISTORICAL MEMORY LOOP ---
  const handleFinalizeAndPublish = () => {
    if (!window.confirm(`Are you sure you want to finalise the ${planningYear} peak leave? This will permanently log the results to the history archive and clear current submissions.`)) return;

    const newHistoryYear = {};

    HOLIDAY_BLOCKS.forEach(block => {
      newHistoryYear[block] = {};
      const blockDraft = draftAllocation[block] || [];
      
      // Mark those who got it off
      blockDraft.forEach(req => {
        if (req.outcome === 'Allocated') {
          newHistoryYear[block][req.staffId] = 'Off';
        } else {
          newHistoryYear[block][req.staffId] = 'Worked'; // Waitlisted means they work it
        }
      });

      // For everyone else active who didn't request it, mark as 'No Request'
      staffList.filter(s => s.status !== 'Archived').forEach(staff => {
        if (!newHistoryYear[block][staff.id]) {
          newHistoryYear[block][staff.id] = 'No Request';
        }
      });
    });

    const updatedHistory = { ...leaveHistory, [planningYear]: newHistoryYear };

    updateDoc(getLeaveRequestsDocRef(), { 
      history: updatedHistory,
      submissions: [] // Wipe the slate clean for next year
    }).then(() => {
      setDraftAllocation(null);
      setViewYear('Current');
    }).catch(console.error);
  };

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center text-teal-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header & Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Palmtree className="w-7 h-7 text-teal-600" />
              Peak Leave Requests
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Manage fair-share holiday allocation using historical data.</p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto">
            <button 
              onClick={() => { setViewMode('staff'); setDraftAllocation(null); setViewYear('Current'); }}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 flex justify-center items-center gap-2 transition-all ${viewMode === 'staff' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <User className="w-4 h-4" /> Staff Form
            </button>
            <button 
              onClick={() => { setViewMode('lead'); setViewYear('Current'); }}
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
                <h2 className="text-lg font-bold text-slate-800">Annual Peak Leave Form ({planningYear})</h2>
                <p className="text-sm text-slate-600 mt-1">Please select your top priority holiday block for the upcoming leave year. Allocations are based on the historical fair-share system to ensure everyone gets a fair turn.</p>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {submitSuccess ? (
                <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl text-center border border-emerald-200">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-black">Request Submitted Successfully!</h3>
                  <p className="text-sm mt-2">Your peak leave priorities have been logged. The form will reset shortly.</p>
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
                      Submit Leave Request
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* LEAD NURSE DASHBOARD */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {viewYear === 'Current' ? `${planningYear} Planning Dashboard` : `${viewYear} Historical Archive`}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {viewYear === 'Current' ? 'Review submissions and auto-generate fair allocations.' : 'Read-only record of finalised leave allocations.'}
                </p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select 
                  className="p-2 border border-slate-300 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-teal-500 outline-none flex-1 sm:flex-none"
                  value={viewYear}
                  onChange={(e) => {
                    setViewYear(e.target.value);
                    setDraftAllocation(null);
                  }}
                >
                  <option value="Current">Current ({planningYear} Requests)</option>
                  {Object.keys(leaveHistory).sort().reverse().map(yr => (
                    <option key={yr} value={yr}>History: {yr}</option>
                  ))}
                </select>
                
                {viewYear === 'Current' && !draftAllocation && (
                  <button onClick={handleGenerateDraft} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors flex-1 sm:flex-none">
                    <Wand2 className="w-4 h-4" /> Auto-Generate Draft
                  </button>
                )}
              </div>
            </div>
            
            {/* HISTORICAL VIEW */}
            {viewYear !== 'Current' && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {HOLIDAY_BLOCKS.map(block => (
                    <div key={block} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-slate-100 p-3 font-bold text-slate-700 text-sm border-b border-slate-200 flex items-center gap-2">
                        <History className="w-4 h-4 text-slate-400" /> {block}
                      </div>
                      <div className="p-2">
                        {Object.entries(leaveHistory[viewYear]?.[block] || {}).map(([sId, status]) => {
                          const name = getStaffName(Number(sId));
                          if (status === 'No Request') return null; // Only show those who engaged
                          return (
                            <div key={sId} className="flex justify-between items-center p-2 text-sm border-b border-slate-50 last:border-0">
                              <span className="font-medium text-slate-800">{name}</span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${status === 'Off' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                                {status}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DRAFT ALLOCATION VIEW */}
            {viewYear === 'Current' && draftAllocation && (
              <div className="p-6 bg-indigo-50/30">
                <div className="flex items-center gap-2 mb-6 bg-indigo-100 text-indigo-800 p-4 rounded-xl border border-indigo-200">
                  <Wand2 className="w-5 h-5 shrink-0" />
                  <p className="text-sm font-medium"><strong>Draft Generated:</strong> System has scored staff based on {lastYear} history. Max <strong>{MAX_OFF_PER_BLOCK}</strong> allocated per block. Please review any amber Tie-Breakers below.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {HOLIDAY_BLOCKS.map(block => {
                    const blockReqs = draftAllocation[block] || [];
                    if (blockReqs.length === 0) return null;

                    return (
                      <div key={block} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-800 p-3 text-white font-bold flex justify-between items-center">
                          <span>{block}</span>
                          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-md">{blockReqs.length} Requests</span>
                        </div>
                        <div className="p-0">
                          {blockReqs.map(req => (
                            <div key={req.staffId} className={`p-4 border-b border-slate-100 last:border-0 ${req.tieBreaker ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-2">
                                    {getStaffName(req.staffId)}
                                    {req.tieBreaker && <AlertTriangle className="w-4 h-4 text-amber-500" title="Tie-Breaker Warning" />}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">
                                    Tier {req.tier} • Last Year: {req.lastYearStatus}
                                  </div>
                                </div>
                                <select 
                                  className={`text-xs font-bold p-1.5 rounded outline-none border cursor-pointer ${
                                    req.outcome === 'Allocated' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 
                                    'bg-slate-100 text-slate-600 border-slate-300'
                                  }`}
                                  value={req.outcome}
                                  onChange={(e) => updateDraftOutcome(block, req.staffId, e.target.value)}
                                >
                                  <option value="Allocated">Allocated</option>
                                  <option value="Waitlisted">Waitlisted</option>
                                </select>
                              </div>
                              {req.notes && <p className="text-xs text-slate-500 italic">"{req.notes}"</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200">
                  <button onClick={() => setDraftAllocation(null)} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors">Discard Draft</button>
                  <button onClick={handleFinalizeAndPublish} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-sm">
                    <Save className="w-5 h-5" /> Finalize & Publish {planningYear}
                  </button>
                </div>
              </div>
            )}

            {/* STANDARD SUBMISSION VIEW (Before Wand is clicked) */}
            {viewYear === 'Current' && !draftAllocation && (
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
            )}
          </div>
        )}

      </div>
    </div>
  );
}
