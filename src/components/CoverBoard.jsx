import React, { useState, useEffect } from 'react';
import { CalendarDays, User, Plus, Clock, CheckCircle, ShieldCheck, Filter, ChevronLeft, ChevronRight, Loader2, AlertCircle, X, Trash2, List } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, getRotaDocRef, getCoverBoardDocRef } from '../firebase';

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CoverBoard() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  const [staffList, setStaffList] = useState([]);
  const [roles, setRoles] = useState([]);
  const [availableShifts, setAvailableShifts] = useState([]);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('lead'); 
  const [displayStyle, setDisplayStyle] = useState('calendar'); // 'calendar' or 'list'
  const [currentStaffId, setCurrentStaffId] = useState('');
  
  // Filtering States
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Open', 'Pending', 'Approved'

  const [viewShift, setViewShift] = useState(null);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  const [newShift, setNewShift] = useState({ date: '', role: '', start: '', end: '', notes: '' });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const unsubShared = onSnapshot(getRotaDocRef(), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.staffList) setStaffList(data.staffList);
        if (data.roles) {
          setRoles(data.roles);
          if (newShift.role === '' && data.roles.length > 0) {
            setNewShift(prev => ({ ...prev, role: data.roles[0].name }));
          }
        }
      }
    });

    const unsubCover = onSnapshot(getCoverBoardDocRef(), (docSnap) => {
      if (docSnap.exists() && docSnap.data().shifts) {
        setAvailableShifts(docSnap.data().shifts);
      } else {
        setDoc(getCoverBoardDocRef(), { shifts: [] }, { merge: true });
      }
      if (isMounted) setIsDbLoaded(true);
    });

    return () => { isMounted = false; unsubShared(); unsubCover(); };
  }, [user, newShift.role]);

  const getRoleColorClass = (roleName) => {
    const role = roles.find(r => r.name === roleName);
    return role ? `${role.color} text-white shadow-sm border border-black/10` : 'bg-slate-500 text-white shadow-sm border border-black/10';
  };

  const handlePostShift = () => {
    if (!newShift.date || !newShift.start || !newShift.end || !newShift.role) return;

    const shiftId = Date.now().toString();
    const shiftData = {
      id: shiftId,
      ...newShift,
      status: 'Open',
      claimedBy: null
    };

    const updatedShifts = [...availableShifts, shiftData];
    updateDoc(getCoverBoardDocRef(), { shifts: updatedShifts });

    setIsPostModalOpen(false);
    setNewShift({ date: '', role: roles.length > 0 ? roles[0].name : '', start: '', end: '', notes: '' });
  };

  const handleClaimShift = (shiftId) => {
    if (!currentStaffId) return alert("Please select your staff profile first.");
    
    const shiftToClaim = availableShifts.find(s => s.id === shiftId);
    const staff = staffList.find(s => s.id === Number(currentStaffId));
    
    if (staff && shiftToClaim && staff.role !== shiftToClaim.role) {
        return alert(`Role mismatch: As a ${staff.role}, you cannot claim a ${shiftToClaim.role} shift.`);
    }

    const updatedShifts = availableShifts.map(s => 
      s.id === shiftId ? { ...s, status: 'Pending', claimedBy: Number(currentStaffId) } : s
    );
    updateDoc(getCoverBoardDocRef(), { shifts: updatedShifts }).catch(console.error);
    setViewShift(null);
  };

  const handleRevokeClaim = (shiftId) => {
    const updatedShifts = availableShifts.map(s => 
      s.id === shiftId ? { ...s, status: 'Open', claimedBy: null } : s
    );
    updateDoc(getCoverBoardDocRef(), { shifts: updatedShifts });
    setViewShift(null);
  };

  const getWeekKey = (dateStr) => {
      const date = new Date(dateStr);
      const day = date.getDay() || 7; 
      date.setDate(date.getDate() + 4 - day);
      const year = date.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const days = Math.floor((date - firstDayOfYear) / (24 * 60 * 60 * 1000));
      const weekNum = Math.ceil((days + firstDayOfYear.getDay() + 1) / 7);
      return `${year}-W${weekNum.toString().padStart(2, '0')}`;
  };

  const handleApproveShift = async (shiftId) => {
    const shiftToApprove = availableShifts.find(s => s.id === shiftId);
    if (!shiftToApprove || !shiftToApprove.claimedBy) return;

    try {
      const updatedShifts = availableShifts.map(s => 
        s.id === shiftId ? { ...s, status: 'Approved' } : s
      );
      await updateDoc(getCoverBoardDocRef(), { shifts: updatedShifts });

      const rotaSnap = await getDoc(getRotaDocRef());
      if (rotaSnap.exists()) {
          const rotaData = rotaSnap.data();
          const schedulesByWeek = rotaData.schedulesByWeek || { 'master': {} };
          
          const weekKey = getWeekKey(shiftToApprove.date);
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const dayName = dayNames[new Date(shiftToApprove.date).getDay()];
          const staffIdStr = shiftToApprove.claimedBy.toString();
          
          if (!schedulesByWeek[weekKey]) schedulesByWeek[weekKey] = {};
          
          if (!schedulesByWeek[weekKey][staffIdStr]) {
              if (schedulesByWeek['master'] && schedulesByWeek['master'][staffIdStr]) {
                  schedulesByWeek[weekKey][staffIdStr] = JSON.parse(JSON.stringify(schedulesByWeek['master'][staffIdStr]));
              } else {
                  schedulesByWeek[weekKey][staffIdStr] = {};
              }
          }
          
          schedulesByWeek[weekKey][staffIdStr][dayName] = {
              start: shiftToApprove.start,
              end: shiftToApprove.end,
              isCover: true
          };
          
          await updateDoc(getRotaDocRef(), { schedulesByWeek });
      }
      setViewShift(null);
    } catch (e) {
      console.error("Error approving shift:", e);
      alert("Shift approved, but failed to sync to the Clinic Rota automatically.");
    }
  };

  const handleDeleteShift = (shiftId) => {
    const updatedShifts = availableShifts.filter(s => s.id !== shiftId);
    updateDoc(getCoverBoardDocRef(), { shifts: updatedShifts });
    setViewShift(null);
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center text-pink-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  const startingBlankDays = firstDay === 0 ? 6 : firstDay - 1;

  const today = new Date();
  const isToday = (day, currentMonth, currentYear) => {
    return day === today.getDate() && currentMonth === today.getMonth() && currentYear === today.getFullYear();
  };

  // Filter shifts based on both Role and Status
  const displayedShifts = availableShifts.filter(s => {
    if (roleFilter !== 'All' && s.role !== roleFilter) return false;
    if (statusFilter !== 'All' && s.status !== statusFilter) return false;
    return true;
  });

  const sortedListShifts = [...displayedShifts].sort((a, b) => {
    const dateDiff = new Date(a.date) - new Date(b.date);
    if (dateDiff !== 0) return dateDiff;
    return a.start.localeCompare(b.start);
  });

  return (
    <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <CalendarDays className="w-7 h-7 text-pink-600" />
              Shift Cover Board
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Post open shifts and allow staff to proactively claim extra hours.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
              <button 
                onClick={() => setViewMode('lead')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'lead' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <ShieldCheck className="w-4 h-4" /> Lead Nurse
              </button>
              <button 
                onClick={() => setViewMode('staff')}
                className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${viewMode === 'staff' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}
              >
                <User className="w-4 h-4" /> Staff Member
              </button>
            </div>
            
            <div className="hidden md:block h-8 w-px bg-slate-300 mx-1"></div>

            <div className="flex items-center gap-1 bg-slate-200 p-1 rounded-xl shadow-inner border border-slate-300">
              <button 
                onClick={() => setDisplayStyle('calendar')} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${displayStyle === 'calendar' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <CalendarDays className="w-4 h-4" /> <span className="hidden sm:inline">Calendar</span>
              </button>
              <button 
                onClick={() => setDisplayStyle('list')} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${displayStyle === 'list' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <List className="w-4 h-4" /> <span className="hidden sm:inline">List Shifts</span>
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'staff' && (
          <div className="bg-pink-50 border border-pink-200 p-4 rounded-xl mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-pink-800">
              <User className="w-6 h-6" />
              <div>
                <h3 className="font-bold">Staff View Active</h3>
                <p className="text-xs font-medium opacity-80">Select your name to claim available shifts.</p>
              </div>
            </div>
            <select 
              className="w-full sm:w-64 p-2.5 border border-pink-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 bg-white font-medium text-slate-700 shadow-sm"
              value={currentStaffId}
              onChange={(e) => setCurrentStaffId(e.target.value)}
            >
              <option value="">-- Select Your Profile --</option>
              {staffList.filter(s => s.status !== 'Archived').map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role ? s.role : 'Unassigned'})</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          {displayStyle === 'calendar' ? (
            <div className="flex items-center gap-4 bg-white p-2 rounded-xl shadow-sm border border-slate-200 shrink-0">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronLeft className="w-5 h-5 text-slate-600" /></button>
              <h2 className="text-lg font-black text-slate-800 min-w-[140px] text-center">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><ChevronRight className="w-5 h-5 text-slate-600" /></button>
            </div>
          ) : (
            <div className="shrink-0">
              <h2 className="text-lg font-black text-slate-800">All Shift Postings</h2>
            </div>
          )}

          <div className="flex flex-col gap-2 w-full md:w-auto items-start md:items-end">
            {/* Role Filter Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 mr-2 text-sm font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                <Filter className="w-4 h-4" /> Role:
              </div>
              {['All', ...roles.map(r => r.name)].map(role => (
                <button 
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${roleFilter === role ? 'bg-slate-800 text-white ring-2 ring-slate-800 ring-offset-1' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  {role}
                </button>
              ))}
            </div>

            {/* Status Filter Row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 mr-2 text-sm font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-200">
                <Filter className="w-4 h-4" /> Status:
              </div>
              {['All', 'Open', 'Pending', 'Approved'].map(status => (
                <button 
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${statusFilter === status ? 'bg-slate-800 text-white ring-2 ring-slate-800 ring-offset-1' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  {status === 'Approved' ? 'Covered' : status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {displayStyle === 'calendar' ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map(day => (
                <div key={day} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {Array.from({ length: startingBlankDays }).map((_, i) => (
                <div key={`blank-${i}`} className="min-h-[120px] p-2 border-b border-r border-slate-100 bg-slate-50/50"></div>
              ))}

              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                
                const dayShifts = displayedShifts.filter(s => s.date === dateStr);
                const isCurrentDay = isToday(day, currentDate.getMonth(), currentDate.getFullYear());

                return (
                  <div 
                    key={day} 
                    className={`min-h-[120px] p-2 border-b border-r border-slate-100 transition-colors group relative ${dayShifts.length > 0 ? 'bg-indigo-50/30' : 'hover:bg-slate-50'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-sm font-bold flex items-center justify-center w-7 h-7 rounded-full ${isCurrentDay ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400'}`}>
                        {day}
                      </span>
                      {viewMode === 'lead' && (
                        <button 
                          onClick={() => { setNewShift({...newShift, date: dateStr}); setIsPostModalOpen(true); }}
                          className="opacity-0 group-hover:opacity-100 p-1 bg-indigo-100 text-indigo-600 rounded hover:bg-indigo-200 transition-all"
                          title="Post Shift on this date"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-1.5">
                      {dayShifts.map(shift => (
                        <div 
                          key={shift.id}
                          onClick={() => setViewShift(shift)}
                          className={`p-1.5 rounded text-xs font-bold cursor-pointer transition-transform hover:scale-[1.02] ${shift.status === 'Pending' ? 'bg-amber-100 text-amber-800 border border-amber-300 border-dashed animate-pulse' : shift.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-inner' : getRoleColorClass(shift.role)}`}
                        >
                          <div className="flex justify-between items-center truncate">
                            <span>{shift.role}</span>
                            <div className="flex items-center gap-1">
                              {shift.status === 'Pending' && <Clock className="w-3 h-3 shrink-0" />}
                              {shift.status === 'Approved' && <CheckCircle className="w-3 h-3 shrink-0 text-emerald-600" />}
                              {viewMode === 'lead' && (
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if(window.confirm('Are you sure you want to delete this shift?')) handleDeleteShift(shift.id); 
                                  }}
                                  className={`opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all ${shift.status === 'Approved' ? 'hover:bg-emerald-200 text-emerald-700' : 'hover:bg-black/20 text-white'}`}
                                  title="Quick Delete Shift"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="font-medium text-[10px] opacity-90 mt-0.5 truncate">
                            {shift.start} - {shift.end}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-2">
             <div className="space-y-3 p-4 max-h-[70vh] overflow-y-auto">
               {sortedListShifts.length > 0 ? sortedListShifts.map(shift => (
                  <div key={shift.id} onClick={() => setViewShift(shift)} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-slate-50 border border-slate-200 rounded-xl hover:border-pink-300 hover:bg-pink-50/30 cursor-pointer transition-all gap-4 shadow-sm">
                     <div className="flex items-center gap-4">
                        <div className={`px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider ${shift.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : getRoleColorClass(shift.role)}`}>{shift.role}</div>
                        <div>
                           <div className="font-black text-slate-800 text-base">{new Date(shift.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                           <div className="text-sm text-slate-500 font-bold flex items-center gap-1 mt-0.5"><Clock className="w-4 h-4"/> {shift.start} - {shift.end}</div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
                        {shift.status === 'Pending' && <span className="flex items-center justify-center gap-1 text-sm font-bold text-amber-600 bg-amber-100 px-3 py-1.5 rounded-lg w-full sm:w-auto"><Clock className="w-4 h-4"/> Pending</span>}
                        {shift.status === 'Open' && <span className="flex items-center justify-center gap-1 text-sm font-bold text-blue-600 bg-blue-100 px-3 py-1.5 rounded-lg w-full sm:w-auto"><CheckCircle className="w-4 h-4"/> Open</span>}
                        {shift.status === 'Approved' && <span className="flex items-center justify-center gap-1 text-sm font-bold text-emerald-700 bg-emerald-100 px-3 py-1.5 rounded-lg w-full sm:w-auto"><CheckCircle className="w-4 h-4"/> Covered</span>}
                     </div>
                  </div>
               )) : (
                  <div className="text-center p-12 text-slate-500 flex flex-col items-center">
                    <CalendarDays className="w-12 h-12 text-slate-300 mb-4" />
                    <p className="text-lg font-bold text-slate-700">No Shifts Found</p>
                    <p className="text-sm mt-1">There are currently no shifts matching your selected filters.</p>
                  </div>
               )}
             </div>
          </div>
        )}
      </div>

      {/* VIEW SHIFT MODAL */}
      {viewShift && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] max-w-[95vw] overflow-hidden">
            <div className={`p-6 text-white flex justify-between items-start ${viewShift.status === 'Pending' ? 'bg-amber-500' : viewShift.status === 'Approved' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-white/20 rounded text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                    {viewShift.status === 'Pending' ? 'Action Required' : viewShift.status === 'Approved' ? 'Covered Shift' : 'Available Shift'}
                  </span>
                </div>
                <h3 className="text-2xl font-black">{viewShift.role} Cover</h3>
                <p className="font-medium opacity-90 text-sm mt-1">
                  {new Date(viewShift.date).toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setViewShift(null)} className="text-white/70 hover:text-white bg-white/10 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6">
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
                <div className="p-3 bg-white rounded-full shadow-sm">
                  <Clock className="w-6 h-6 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-0.5">Shift Times</p>
                  <p className="text-lg font-black text-slate-800">{viewShift.start} - {viewShift.end}</p>
                </div>
              </div>

              {viewShift.notes && (
                <div className="mb-6">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Lead Nurse Notes</p>
                  <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{viewShift.notes}"</p>
                </div>
              )}

              {/* LEAD NURSE CONTROLS */}
              {viewMode === 'lead' && (
                <div className="space-y-3">
                  {viewShift.status === 'Pending' && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <p className="text-sm text-amber-800 font-medium mb-4 text-center">
                        <strong>{staffList.find(s => s.id === viewShift.claimedBy)?.name}</strong> has claimed this shift.
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveShift(viewShift.id)} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-bold transition-colors shadow-sm flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" /> Approve</button>
                        <button onClick={() => handleRevokeClaim(viewShift.id)} className="flex-1 bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 py-2 rounded-lg font-bold transition-colors">Reject</button>
                      </div>
                    </div>
                  )}

                  {viewShift.status === 'Approved' && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                      <p className="text-sm text-emerald-800 font-medium text-center">
                        <strong>{staffList.find(s => s.id === viewShift.claimedBy)?.name || 'A team member'}</strong> is covering this shift.
                      </p>
                    </div>
                  )}

                  <button onClick={() => { if(window.confirm('Are you sure you want to completely delete this shift?')) handleDeleteShift(viewShift.id); }} className="w-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 mt-4">
                    <Trash2 className="w-4 h-4" /> Delete Shift Posting
                  </button>
                </div>
              )}

              {/* STAFF CONTROLS */}
              {viewMode === 'staff' && (
                <div className="space-y-3">
                  {viewShift.status === 'Open' && (
                    <>
                      <button 
                        onClick={() => handleClaimShift(viewShift.id)}
                        disabled={!currentStaffId || staffList.find(s => s.id === Number(currentStaffId))?.role !== viewShift.role}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <Plus className="w-5 h-5" /> Claim Extra Shift
                      </button>
                      
                      {/* Validation Messages */}
                      {!currentStaffId && (
                        <p className="text-xs text-red-500 text-center font-semibold">Select your name from the dropdown above to claim.</p>
                      )}
                      {currentStaffId && staffList.find(s => s.id === Number(currentStaffId))?.role !== viewShift.role && (
                        <p className="text-xs text-red-500 text-center font-semibold">You cannot claim this. Only {viewShift.role}s can cover this shift.</p>
                      )}
                    </>
                  )}

                  {viewShift.status === 'Pending' && (
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

                  {viewShift.status === 'Approved' && (
                    viewShift.claimedBy === Number(currentStaffId) ? (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                        <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-bold text-emerald-800">You are covering this shift.</p>
                      </div>
                    ) : (
                      <p className="text-center text-sm font-bold text-slate-500 p-3 bg-slate-50 rounded-xl">Shift has been covered by another team member.</p>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POST SHIFT MODAL */}
      {isPostModalOpen && viewMode === 'lead' && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[400px] max-w-[95vw] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-black text-slate-800">Post Open Shift</h3>
              <button onClick={() => setIsPostModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
                <input 
                  type="date" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 bg-slate-50 font-medium" 
                  value={newShift.date}
                  onChange={e => setNewShift({...newShift, date: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Role Required</label>
                <select 
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 font-medium bg-white"
                  value={newShift.role}
                  onChange={e => setNewShift({...newShift, role: e.target.value})}
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                  {newShift.role && !roles.some(r => r.name === newShift.role) && (
                    <option value={newShift.role}>{newShift.role} (Legacy)</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Start Time</label>
                  <input 
                    type="time" 
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 font-medium" 
                    value={newShift.start}
                    onChange={e => setNewShift({...newShift, start: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">End Time</label>
                  <input 
                    type="time" 
                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 font-medium" 
                    value={newShift.end}
                    onChange={e => setNewShift({...newShift, end: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes (Optional)</label>
                <textarea 
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-pink-500 text-sm" 
                  rows="2"
                  placeholder="e.g. Needs to run the flu clinic..."
                  value={newShift.notes}
                  onChange={e => setNewShift({...newShift, notes: e.target.value})}
                ></textarea>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button onClick={() => setIsPostModalOpen(false)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-bold hover:bg-slate-50 transition-colors">Cancel</button>
              <button 
                onClick={handlePostShift} 
                disabled={!newShift.date || !newShift.start || !newShift.end || !newShift.role}
                className="flex-1 bg-slate-900 text-white py-2.5 rounded-lg font-bold hover:bg-slate-800 transition-colors disabled:opacity-50 shadow-sm"
              >
                Post Shift
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
