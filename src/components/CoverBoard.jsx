import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, User, CheckCircle, AlertCircle, Clock, Stethoscope } from 'lucide-react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function CoverBoard() {
  const [user, setUser] = useState(null);
  
  const [authInstance, setAuthInstance] = useState(null);
  const [rotaDocRef, setRotaDocRef] = useState(null);
  const [coverDocRef, setCoverDocRef] = useState(null);

  // Data States
  const [availableShifts, setAvailableShifts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [schedulesByWeek, setSchedulesByWeek] = useState({});

  // UI States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('lead_nurse'); // 'lead_nurse' | 'staff'
  const [currentStaffId, setCurrentStaffId] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');

  // Modal States
  const [isAddingShift, setIsAddingShift] = useState(false);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [newShiftForm, setNewShiftForm] = useState({ role: 'HCA', start: '08:00', end: '13:00' });
  
  const [viewShift, setViewShift] = useState(null);

  // --- Dynamic Module Resolution ---
  useEffect(() => {
    const loadModules = async () => {
      try {
        const firebasePath = '../firebase';
        const fb = await import(/* @vite-ignore */ firebasePath);
        setAuthInstance(fb.auth);
        setRotaDocRef(fb.getRotaDocRef());
        setCoverDocRef(fb.getCoverBoardDocRef());
      } catch (e) {
        // Safe Canvas Environment Fallback
        const localFirebaseConfig = {
          apiKey: "AIzaSy" + "Bmh_DbR07Lga_oc2hAoMKnCYfBhE2C3FU",
          authDomain: "lead-nurse-management.firebaseapp.com",
          projectId: "lead-nurse-management",
          storageBucket: "lead-nurse-management.firebasestorage.app",
          messagingSenderId: "442233471706",
          appId: "1:442233471706:web:ebc5301c40a54180279be3"
        };
        const fallbackApp = getApps().length === 0 ? initializeApp(localFirebaseConfig) : getApp();
        const fallbackAuth = getAuth(fallbackApp);
        signInAnonymously(fallbackAuth).catch(err => console.error(err));
        setAuthInstance(fallbackAuth);
        
        const constructRef = (folder) => {
          const appId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
          const segments = ['artifacts', ...appId.split('/'), 'public', 'data', 'clinic_rota', folder];
          if (segments.length % 2 !== 0) segments.push('doc');
          return doc(getFirestore(fallbackApp), ...segments);
        };
        setRotaDocRef(constructRef('shared_data'));
        setCoverDocRef(constructRef('cover_board'));
      }
    };
    loadModules();
  }, []);

  useEffect(() => {
    if (!authInstance) return;
    const unsubscribe = onAuthStateChanged(authInstance, setUser);
    return () => unsubscribe();
  }, [authInstance]);

  // Data Synchronisation
  useEffect(() => {
    if (!user || !rotaDocRef || !coverDocRef) return;
    
    const unsubRota = onSnapshot(rotaDocRef, (docSnap) => {
      if (docSnap.exists()) {
        if (docSnap.data().staffList) setStaffList(docSnap.data().staffList);
        if (docSnap.data().schedulesByWeek) setSchedulesByWeek(docSnap.data().schedulesByWeek);
      }
    });

    const unsubCover = onSnapshot(coverDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().shifts) {
        setAvailableShifts(docSnap.data().shifts);
      } else {
        setDoc(coverDocRef, { shifts: [] }, { merge: true });
      }
    });

    return () => { unsubRota(); unsubCover(); };
  }, [user, rotaDocRef, coverDocRef]);

  // --- Actions ---
  const handleAddShift = () => {
    if (!selectedDateStr || !newShiftForm.start || !newShiftForm.end) return;
    
    const newShift = {
      id: Date.now().toString(),
      date: selectedDateStr,
      role: newShiftForm.role,
      start: newShiftForm.start,
      end: newShiftForm.end,
      status: 'Open',
      claimedBy: null
    };

    const updatedShifts = [...availableShifts, newShift];
    updateDoc(coverDocRef, { shifts: updatedShifts }).catch(console.error);
    setIsAddingShift(false);
  };

  const handleClaimShift = (shiftId) => {
    if (!currentStaffId) return alert("Please select your staff profile first.");
    
    const updatedShifts = availableShifts.map(s => 
      s.id === shiftId ? { ...s, status: 'Pending', claimedBy: Number(currentStaffId) } : s
    );
    updateDoc(coverDocRef, { shifts: updatedShifts }).catch(console.error);
    setViewShift(null);
  };

  const handleApproveShift = (shift) => {
    // 1. Calculate which "Week Commencing" (Monday) this shift belongs to
    const shiftDate = new Date(shift.date);
    const dayOfWeek = shiftDate.getDay(); // 0 = Sun, 1 = Mon...
    const diff = shiftDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(shiftDate.setDate(diff));
    const wcString = monday.toISOString().split('T')[0]; // "YYYY-MM-DD"
    
    const stringDayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1];
    
    // 2. Add to Main Clinic Rota schedulesByWeek
    let weekSchedule = schedulesByWeek[wcString] || { ...schedulesByWeek['master'] };
    const shiftKey = `${shift.claimedBy}-${stringDayName}`;
    
    weekSchedule[shiftKey] = {
      start: shift.start,
      end: shift.end,
      clinic: 'Cover Shift', // Label it clearly
      roomId: ''
    };

    const updatedSchedules = { ...schedulesByWeek, [wcString]: weekSchedule };
    updateDoc(rotaDocRef, { schedulesByWeek: updatedSchedules }).catch(console.error);

    // 3. Mark as Approved on Cover Board
    const updatedShifts = availableShifts.map(s => 
      s.id === shift.id ? { ...s, status: 'Approved' } : s
    );
    updateDoc(coverDocRef, { shifts: updatedShifts }).catch(console.error);
    setViewShift(null);
  };

  const handleDeleteShift = (shiftId) => {
    const updatedShifts = availableShifts.filter(s => s.id !== shiftId);
    updateDoc(coverDocRef, { shifts: updatedShifts }).catch(console.error);
    setViewShift(null);
  };

  const handleRevokeClaim = (shiftId) => {
    const updatedShifts = availableShifts.map(s => 
      s.id === shiftId ? { ...s, status: 'Open', claimedBy: null } : s
    );
    updateDoc(coverDocRef, { shifts: updatedShifts }).catch(console.error);
    setViewShift(null);
  };

  // --- Calendar Generation ---
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => {
    let day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Map Sun=0 to Mon=0
  };

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  // --- Helpers ---
  const getRoleColors = (role, status) => {
    if (status === 'Approved') return 'bg-slate-100 text-slate-400 border-slate-200';
    if (status === 'Pending') return 'bg-amber-100 text-amber-700 border-amber-300';
    
    switch(role) {
      case 'Nurse': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'HCA': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'ANP': return 'bg-purple-100 text-purple-700 border-purple-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStaffName = (id) => staffList.find(s => s.id === id)?.name || 'Unknown';

const displayedShifts = availableShifts.filter(s => {
    if (roleFilter !== 'All' && s.role !== roleFilter) return false;
    // Don't show approved shifts on the board to avoid clutter
    if (s.status === 'Approved') return false; 
    return true;
  });

  return (
    <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Controls */}
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Stethoscope className="w-7 h-7 text-pink-600" />
              Shift Cover Board
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              {viewMode === 'lead_nurse' 
                ? "Manage available shifts and approve team requests." 
                : "Browse and claim available extra shifts."}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto">
            {/* View Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex font-bold text-sm shadow-inner w-full sm:w-auto">
              <button 
                onClick={() => { setViewMode('lead_nurse'); setRoleFilter('All'); }}
                className={`px-4 py-2 rounded-lg transition-all flex-1 ${viewMode === 'lead_nurse' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Lead Nurse
              </button>
              <button 
                onClick={() => setViewMode('staff')}
                className={`px-4 py-2 rounded-lg transition-all flex-1 ${viewMode === 'staff' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Staff Member
              </button>
            </div>

            {/* Staff Selector (Only visible in Staff Mode) */}
            {viewMode === 'staff' && (
              <select 
                value={currentStaffId} 
                onChange={e => setCurrentStaffId(e.target.value)}
                className="w-full sm:w-48 p-2.5 border border-indigo-200 bg-indigo-50 text-indigo-800 font-semibold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Who are you? --</option>
                {staffList.filter(s => s.status !== 'Archived').map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {['All', 'Nurse', 'HCA', 'ANP'].map(role => (
            <button 
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${roleFilter === role ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
            >
              {role === 'All' ? 'All Roles' : `${role} Only`}
            </button>
          ))}
        </div>

        {/* Calendar UI */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
            <button onClick={prevMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-bold text-slate-800">{MONTHS[currentMonth]} {currentYear}</h2>
            <button onClick={nextMonth} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-600"><ChevronRight className="w-5 h-5" /></button>
          </div>

          {/* Days of Week */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-white">
            {DAYS_OF_WEEK.map(day => (
              <div key={day} className="py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-500 border-r border-slate-100 last:border-r-0">
                {day.substring(0,3)}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 bg-slate-100 gap-px border-b border-slate-200">
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-slate-50/50 min-h-[120px] p-2"></div>
            ))}
            
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              
              // Find shifts for this day
              const dayShifts = displayedShifts.filter(s => s.date === dateStr);
              const isToday = new Date().toISOString().split('T')[0] === dateStr;

              return (
                <div key={dayNum} className={`bg-white min-h-[120px] p-2 flex flex-col group transition-colors ${viewMode === 'lead_nurse' ? 'hover:bg-slate-50' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-pink-600 text-white' : 'text-slate-700'}`}>
                      {dayNum}
                    </span>
                    {viewMode === 'lead_nurse' && (
                      <button 
                        onClick={() => { setSelectedDateStr(dateStr); setIsAddingShift(true); }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-pink-600 transition-all bg-white rounded-md shadow-sm border border-slate-200"
                        title="Post an available shift"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Shift Badges */}
                  <div className="space-y-1.5 flex-1">
                    {dayShifts.map(shift => (
                      <div 
                        key={shift.id}
                        onClick={() => setViewShift(shift)}
                        className={`text-[10px] p-1.5 rounded border cursor-pointer hover:shadow-md transition-all font-bold leading-tight ${getRoleColors(shift.role, shift.status)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{shift.role}</span>
                          {shift.status === 'Pending' && <Clock className="w-3 h-3 text-amber-600" />}
                        </div>
                        <div className="font-medium opacity-90 mt-0.5">{shift.start} - {shift.end}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* MODAL: Post New Shift (Lead Nurse Only) */}
        {isAddingShift && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-96 border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Post Available Shift</h3>
                <button onClick={() => setIsAddingShift(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-sm text-slate-500 mb-4 font-medium border-b border-slate-100 pb-3">Date: {new Date(selectedDateStr).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Cover Required</label>
                  <select 
                    value={newShiftForm.role} 
                    onChange={e => setNewShiftForm({...newShiftForm, role: e.target.value})}
                    className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="Nurse">Nurse</option>
                    <option value="HCA">HCA</option>
                    <option value="ANP">ANP</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start</label>
                    <input type="time" value={newShiftForm.start} onChange={e => setNewShiftForm({...newShiftForm, start: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Finish</label>
                    <input type="time" value={newShiftForm.end} onChange={e => setNewShiftForm({...newShiftForm, end: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500" />
                  </div>
                </div>
                <button onClick={handleAddShift} className="w-full mt-2 bg-pink-600 hover:bg-pink-700 text-white py-2.5 rounded-xl font-bold transition-all shadow-sm">Post Shift to Board</button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: View/Action Shift */}
        {viewShift && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl p-6 w-96 border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-slate-900">Shift Details</h3>
                <button onClick={() => setViewShift(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>

              <div className={`p-4 rounded-xl border mb-6 ${getRoleColors(viewShift.role, viewShift.status)}`}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-black uppercase tracking-widest text-sm">{viewShift.role} Cover</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/50">{viewShift.status}</span>
                </div>
                <div className="text-lg font-bold">{new Date(viewShift.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                <div className="font-medium opacity-90">{viewShift.start} - {viewShift.end}</div>
              </div>

              {/* LEAD NURSE CONTROLS */}
              {viewMode === 'lead_nurse' && (
                <div className="space-y-3">
                  {viewShift.status === 'Pending' ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm text-amber-800 font-medium mb-3 flex items-center gap-2">
                        <User className="w-5 h-5" /> <strong>{getStaffName(viewShift.claimedBy)}</strong> wants this shift.
                      </p>
                      <button onClick={() => handleApproveShift(viewShift)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg font-bold shadow-sm flex items-center justify-center gap-2 mb-2">
                        <CheckCircle className="w-5 h-5" /> Approve & Sync to Rota
                      </button>
                      <button onClick={() => handleRevokeClaim(viewShift.id)} className="w-full bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 py-2 rounded-lg font-bold">
                        Reject / Re-open Shift
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => handleDeleteShift(viewShift.id)} className="w-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                      <Trash2 className="w-5 h-5" /> Delete Posted Shift
                    </button>
                  )}
                </div>
              )}

              {/* STAFF CONTROLS */}
              {viewMode === 'staff' && (
                <div className="space-y-3">
                  {viewShift.status === 'Open' ? (
                    <button 
                      onClick={() => handleClaimShift(viewShift.id)}
                      disabled={!currentStaffId}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <Plus className="w-5 h-5" /> Claim Extra Shift
                    </button>
                  ) : (
                    viewShift.claimedBy === Number(currentStaffId) ? (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
                        <Clock className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-slate-700">You have claimed this shift.</p>
                        <p className="text-xs text-slate-500 mt-1">Awaiting Lead Nurse approval.</p>
                        <button onClick={() => handleRevokeClaim(viewShift.id)} className="mt-4 text-xs font-bold text-red-600 hover:underline">Cancel Claim</button>
                      </div>
                    ) : (
                      <p className="text-center text-sm font-bold text-slate-500 p-3 bg-slate-50 rounded-xl">Shift has been claimed by another team member.</p>
                    )
                  )}
                  {!currentStaffId && <p className="text-xs text-red-500 text-center font-semibold">Select your name from the dropdown above to claim.</p>}
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
