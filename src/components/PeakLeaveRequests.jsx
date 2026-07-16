import React, { useState, useEffect } from 'react';
import { Palmtree, User as UserIcon, ShieldCheck, CheckCircle, Trash2, Loader2, CalendarRange, Wand2, Save, History, AlertTriangle } from 'lucide-react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getRotaDocRef, getLeaveRequestsDocRef } from '../firebase';

const HOLIDAY_BLOCKS = ['October Half-Term', 'Christmas Block', 'New Year Block', 'February Half-Term', 'Easter Holidays'];
const MAX_OFF_PER_BLOCK = 2; 

export default function PeakLeaveRequests({ activeUser, isAdmin }) {
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [requests, setRequests] = useState([]);
  const [leaveHistory, setLeaveHistory] = useState({}); 

  // Force viewMode to 'staff' if not an admin
  const [viewMode, setViewMode] = useState(isAdmin ? 'lead' : 'staff'); 
  
  const [formState, setFormState] = useState({ priority1: '', priority2: '', notes: '' });
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [draftAllocation, setDraftAllocation] = useState(null);
  const [viewYear, setViewYear] = useState('Current');

  const today = new Date();
  const currentLeaveYearStart = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  const lastYear = `${currentLeaveYearStart}/${(currentLeaveYearStart + 1).toString().slice(-2)}`; 
  const planningYear = `${currentLeaveYearStart + 1}/${(currentLeaveYearStart + 2).toString().slice(-2)}`; 

  useEffect(() => {
    let isMounted = true;
    const unsubShared = onSnapshot(getRotaDocRef(), (docSnap) => {
      if (docSnap.exists() && docSnap.data().staffList) setStaffList(docSnap.data().staffList);
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
  }, []);

  const handleSubmit = () => {
    if (!formState.priority1) return;
    const newSubmission = {
      id: Date.now().toString(),
      staffId: activeUser.id,
      priority1: formState.priority1,
      priority2: formState.priority2,
      notes: formState.notes,
      submittedAt: new Date().toISOString()
    };

    updateDoc(getLeaveRequestsDocRef(), { submissions: [...requests, newSubmission] }).then(() => {
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setFormState({ priority1: '', priority2: '', notes: '' });
      }, 3000);
    }).catch(console.error);
  };

  const handleDeleteRequest = (id) => {
    if (window.confirm("Are you sure you want to delete this leave request?")) {
      updateDoc(getLeaveRequestsDocRef(), { submissions: requests.filter(r => r.id !== id) });
    }
  };

  const getStaffName = (id) => staffList.find(s => s.id === id)?.name || 'Unknown Staff';

  const handleGenerateDraft = () => {
    const draft = {};
    const previousHistory = leaveHistory[lastYear] || {};
    HOLIDAY_BLOCKS.forEach(block => {
      const requesters = requests.filter(r => r.priority1 === block);
      const scored = requesters.map(req => {
        const lastYearStatus = previousHistory[block]?.[req.staffId] || 'No Request';
        let tier = lastYearStatus === 'Worked' ? 1 : lastYearStatus === 'Off' ? 3 : 2;
        return { ...req, tier, lastYearStatus, outcome: 'Pending', tieBreaker: false };
      });
      scored.sort((a, b) => a.tier - b.tier);
      let allocatedCount = 0;
      scored.forEach(s => {
        s.outcome = allocatedCount < MAX_OFF_PER_BLOCK ? 'Allocated' : 'Waitlisted';
        if (s.outcome === 'Allocated') allocatedCount++;
      });
      if (scored.length > MAX_OFF_PER_BLOCK && scored[MAX_OFF_PER_BLOCK - 1].tier === scored[MAX_OFF_PER_BLOCK].tier) {
        const boundaryTier = scored[MAX_OFF_PER_BLOCK].tier;
        scored.forEach(s => { if (s.tier === boundaryTier) s.tieBreaker = true; });
      }
      draft[block] = scored;
    });
    setDraftAllocation(draft);
  };

  const updateDraftOutcome = (block, staffId, newOutcome) => {
    setDraftAllocation(prev => ({
      ...prev, [block]: prev[block].map(req => req.staffId === staffId ? { ...req, outcome: newOutcome, tieBreaker: false } : req)
    }));
  };

  const handleFinalizeAndPublish = () => {
    if (!window.confirm(`Finalise the ${planningYear} peak leave? This will log the results and clear current submissions.`)) return;
    const newHistoryYear = {};
    HOLIDAY_BLOCKS.forEach(block => {
      newHistoryYear[block] = {};
      const blockDraft = draftAllocation[block] || [];
      blockDraft.forEach(req => newHistoryYear[block][req.staffId] = req.outcome === 'Allocated' ? 'Off' : 'Worked');
      staffList.filter(s => s.status !== 'Archived').forEach(staff => {
        if (!newHistoryYear[block][staff.id]) newHistoryYear[block][staff.id] = 'No Request';
      });
    });
    updateDoc(getLeaveRequestsDocRef(), { 
      history: { ...leaveHistory, [planningYear]: newHistoryYear }, submissions: [] 
    }).then(() => { setDraftAllocation(null); setViewYear('Current'); }).catch(console.error);
  };

  if (!isDbLoaded) return <div className="flex-1 flex items-center justify-center text-teal-600"><Loader2 className="w-10 h-10 animate-spin" /></div>;

  return (
    <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Palmtree className="w-7 h-7 text-teal-600" /> Peak Leave Requests
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Manage fair-share holiday allocation using historical data.</p>
          </div>
          
          {isAdmin && (
            <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-inner w-full md:w-auto">
              <button onClick={() => { setViewMode('staff'); setDraftAllocation(null); setViewYear('Current'); }} className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 flex justify-center items-center gap-2 transition-all ${viewMode === 'staff' ? 'bg-white text-teal-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><UserIcon className="w-4 h-4" /> Staff Form</button>
              <button onClick={() => { setViewMode('lead'); setViewYear('Current'); }} className={`px-4 py-2 rounded-lg text-sm font-bold flex-1 flex justify-center items-center gap-2 transition-all ${viewMode === 'lead' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><ShieldCheck className="w-4 h-4" /> Lead Nurse</button>
            </div>
          )}
        </div>

        {viewMode === 'staff' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl mx-auto">
            <div className="p-6 bg-teal-50 border-b border-teal-100 flex justify-between items-center gap-4">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-white rounded-full shadow-sm text-teal-600 shrink-0"><CalendarRange className="w-6 h-6" /></div>
                 <div>
                   <h2 className="text-lg font-bold text-slate-800">Annual Peak Form ({planningYear})</h2>
                   <p className="text-xs text-slate-600 mt-1">Allocations are based on the historical fair-share system.</p>
                 </div>
              </div>
              <div className="bg-white px-3 py-1.5 rounded-lg border border-teal-200 shadow-sm text-xs font-bold text-teal-800 flex items-center gap-2">
                 <UserIcon className="w-3.5 h-3.5" /> {activeUser.name}
              </div>
            </div>

            <div className="p-6 space-y-6">
              {submitSuccess ? (
                <div className="bg-emerald-50 text-emerald-800 p-6 rounded-xl text-center border border-emerald-200">
                  <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <h3 className="text-lg font-black">Request Submitted!</h3>
                  <p className="text-sm mt-2">Your peak leave priorities have been securely logged.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">1. Which peak holiday is your absolute #1 priority? <span className="text-red-500">*</span></label>
                    <select className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white" value={formState.priority1} onChange={(e) => setFormState({...formState, priority1: e.target.value})}>
                      <option value="">-- Select Priority 1 --</option>
                      {HOLIDAY_BLOCKS.map(h => <option key={`p1-${h}`} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">2. Which peak holiday is your #2 backup choice? <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <select className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 bg-white" value={formState.priority2} onChange={(e) => setFormState({...formState, priority2: e.target.value})}>
                      <option value="">-- Select Priority 2 (Backup) --</option>
                      {HOLIDAY_BLOCKS.filter(h => h !== formState.priority1).map(h => <option key={`p2-${h}`} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">3. Any specific dates or notes we should be aware of? <span className="text-slate-400 font-normal">(Optional)</span></label>
                    <textarea className="w-full p-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-teal-500 text-sm" rows="3" placeholder="e.g. Flight bookings already made..." value={formState.notes} onChange={(e) => setFormState({...formState, notes: e.target.value})}></textarea>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <button onClick={handleSubmit} disabled={!formState.priority1} className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 text-white py-3 rounded-xl font-bold transition-all shadow-sm">Submit Leave Request</button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* LEAD NURSE DASHBOARD */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
             {/* ... Identical to previous lead nurse dashboard render ... */}
             <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  {viewYear === 'Current' ? `${planningYear} Planning Dashboard` : `${viewYear} Historical Archive`}
                </h2>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <select className="p-2 border border-slate-300 rounded-lg text-sm font-bold bg-white focus:ring-2 focus:ring-teal-500 outline-none flex-1 sm:flex-none" value={viewYear} onChange={(e) => { setViewYear(e.target.value); setDraftAllocation(null); }}>
                  <option value="Current">Current ({planningYear})</option>
                  {Object.keys(leaveHistory).sort().reverse().map(yr => <option key={yr} value={yr}>History: {yr}</option>)}
                </select>
                {viewYear === 'Current' && !draftAllocation && <button onClick={handleGenerateDraft} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm"><Wand2 className="w-4 h-4" /> Generate Draft</button>}
              </div>
            </div>

            {viewYear === 'Current' && !draftAllocation && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-white border-b border-slate-200">
                      <th className="p-4 font-bold text-slate-700">Staff Member</th>
                      <th className="p-4 font-bold text-slate-700">Priority 1</th>
                      <th className="p-4 font-bold text-slate-700">Priority 2</th>
                      <th className="p-4 font-bold text-slate-700">Notes</th>
                      <th className="p-4 font-bold text-slate-700 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4 font-bold text-slate-900">{getStaffName(req.staffId)}</td>
                        <td className="p-4"><span className="bg-teal-100 text-teal-800 border border-teal-200 px-2 py-1 rounded-md font-bold text-xs">{req.priority1}</span></td>
                        <td className="p-4">{req.priority2 || '-'}</td>
                        <td className="p-4 text-slate-600 text-xs italic">{req.notes || '-'}</td>
                        <td className="p-4 text-right"><button onClick={() => handleDeleteRequest(req.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            {viewYear === 'Current' && draftAllocation && (
              <div className="p-6 bg-indigo-50/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {HOLIDAY_BLOCKS.map(block => {
                    const blockReqs = draftAllocation[block] || [];
                    if (blockReqs.length === 0) return null;
                    return (
                      <div key={block} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="bg-slate-800 p-3 text-white font-bold flex justify-between items-center">
                          <span>{block}</span><span className="text-xs bg-white/20 px-2 py-0.5 rounded-md">{blockReqs.length} Requests</span>
                        </div>
                        <div className="p-0">
                          {blockReqs.map(req => (
                            <div key={req.staffId} className={`p-4 border-b border-slate-100 ${req.tieBreaker ? 'bg-amber-50' : ''}`}>
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <div className="font-bold text-slate-900 flex items-center gap-2">{getStaffName(req.staffId)}{req.tieBreaker && <AlertTriangle className="w-4 h-4 text-amber-500" />}</div>
                                  <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold">Tier {req.tier} • Last Year: {req.lastYearStatus}</div>
                                </div>
                                <select className={`text-xs font-bold p-1.5 rounded outline-none border ${req.outcome === 'Allocated' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-600'}`} value={req.outcome} onChange={(e) => updateDraftOutcome(block, req.staffId, e.target.value)}>
                                  <option value="Allocated">Allocated</option><option value="Waitlisted">Waitlisted</option>
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-slate-200">
                  <button onClick={() => setDraftAllocation(null)} className="px-6 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50">Discard Draft</button>
                  <button onClick={handleFinalizeAndPublish} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700"><Save className="w-5 h-5" /> Finalize & Publish {planningYear}</button>
                </div>
              </div>
            )}

            {viewYear !== 'Current' && (
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {HOLIDAY_BLOCKS.map(block => (
                  <div key={block} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 p-3 font-bold text-slate-700 text-sm border-b border-slate-200 flex items-center gap-2"><History className="w-4 h-4 text-slate-400" /> {block}</div>
                    <div className="p-2">
                      {Object.entries(leaveHistory[viewYear]?.[block] || {}).map(([sId, status]) => {
                        if (status === 'No Request') return null;
                        return (
                          <div key={sId} className="flex justify-between items-center p-2 text-sm border-b border-slate-50 last:border-0">
                            <span className="font-medium text-slate-800">{getStaffName(Number(sId))}</span>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${status === 'Off' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{status}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
