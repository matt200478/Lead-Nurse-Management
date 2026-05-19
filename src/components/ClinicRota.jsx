import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle, AlertCircle, Plus, Trash2, User, Settings, X, ChevronLeft, ChevronRight, Calendar, Printer, CalendarDays, Layout, Loader2, Star, Activity } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef } from '../firebase';
import { INITIAL_TARGETS, INITIAL_CLINIC_COLORS, INITIAL_UNIFIED_STAFF, INITIAL_ROOMS, WEEKDAYS, WEEKENDS } from '../constants';

export default function ClinicRota() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [clinicColors, setClinicColors] = useState(INITIAL_CLINIC_COLORS);
  const [staffList, setStaffList] = useState(INITIAL_UNIFIED_STAFF);
  const [roomList, setRoomList] = useState(INITIAL_ROOMS);
  const [schedulesByWeek, setSchedulesByWeek] = useState({ 'master': {} });
  
  const clinicTypes = Object.keys(targets).sort((a, b) => a.localeCompare(b));

  const [activeWeek, setActiveWeek] = useState('master');
  const [isAddingWeek, setIsAddingWeek] = useState(false);
  const [newWeekDate, setNewWeekDate] = useState('');
  const [selectedCell, setSelectedCell] = useState(null); 
  const [formState, setFormState] = useState({ staffId: '', clinic: '' });
  
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicTarget, setNewClinicTarget] = useState(1);
  const [newClinicColor, setNewClinicColor] = useState('#3b82f6');
  const [clinicToDelete, setClinicToDelete] = useState(null);
  
  const [isManagingRooms, setIsManagingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [showWeekends, setShowWeekends] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeDays = showWeekends ? [...WEEKDAYS, ...WEEKENDS] : WEEKDAYS;
  const currentSchedule = schedulesByWeek[activeWeek] || {};

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const docRef = getRotaDocRef();
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.targets) setTargets(data.targets);
          if (data.clinicColors) setClinicColors(data.clinicColors);
          if (data.staffList) setStaffList(data.staffList);
          if (data.roomList) setRoomList(data.roomList);
          if (data.schedulesByWeek) setSchedulesByWeek(data.schedulesByWeek);
        } else {
          setDoc(docRef, {
            targets: INITIAL_TARGETS,
            clinicColors: INITIAL_CLINIC_COLORS,
            staffList: INITIAL_UNIFIED_STAFF,
            roomList: INITIAL_ROOMS,
            schedulesByWeek: { 'master': {} }
          }, { merge: true });
        }
        setIsDbLoaded(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error setting up snapshot:", e);
      setIsDbLoaded(true);
    }
  }, [user]);

  const updateDb = async (field, value) => {
    if (!user) return;
    if (field === 'schedulesByWeek') setSchedulesByWeek(value);
    if (field === 'targets') setTargets(value);
    if (field === 'clinicColors') setClinicColors(value);
    if (field === 'roomList') setRoomList(value);
    try {
      await updateDoc(getRotaDocRef(), { [field]: value });
    } catch (e) { console.error("Failed to save to database:", e); }
  };

  const currentCounts = useMemo(() => {
    const counts = {};
    Object.keys(targets).forEach(type => counts[type] = 0);
    Object.values(currentSchedule).forEach(assignment => {
      if (assignment.clinic) {
        if (counts[assignment.clinic] === undefined) counts[assignment.clinic] = 0;
        counts[assignment.clinic]++;
      }
    });
    return counts;
  }, [currentSchedule, targets]);

  const handleCellClick = (roomId, day, slot) => {
    const key = `${roomId}-${day}-${slot}`;
    const existing = currentSchedule[key];
    setSelectedCell({ roomId, day, slot });
    setFormState({
      staffId: existing ? existing.staffId : '',
      clinic: existing ? existing.clinic : ''
    });
  };

  const handleSaveAssignment = () => {
    if (!formState.staffId || !formState.clinic) return;
    const key = `${selectedCell.roomId}-${selectedCell.day}-${selectedCell.slot}`;
    const newSchedules = {
      ...schedulesByWeek,
      [activeWeek]: {
        ...(schedulesByWeek[activeWeek] || {}),
        [key]: { ...formState, staffId: parseInt(formState.staffId) }
      }
    };
    updateDb('schedulesByWeek', newSchedules);
    setSelectedCell(null);
  };

  const handleDeleteAssignment = () => {
    const key = `${selectedCell.roomId}-${selectedCell.day}-${selectedCell.slot}`;
    const newSched = { ...schedulesByWeek[activeWeek] };
    delete newSched[key];
    updateDb('schedulesByWeek', { ...schedulesByWeek, [activeWeek]: newSched });
    setSelectedCell(null);
  };

  const handleCreateWeek = () => {
    if (!newWeekDate) return;
    if (!schedulesByWeek[newWeekDate]) {
      updateDb('schedulesByWeek', {
        ...schedulesByWeek,
        [newWeekDate]: { ...schedulesByWeek['master'] }
      });
    }
    setActiveWeek(newWeekDate);
    setIsAddingWeek(false);
    setNewWeekDate('');
  };

  const handleUpdateTarget = (clinic, newTarget) => {
    const val = parseInt(newTarget);
    if (val >= 0) setTargets(prev => ({...prev, [clinic]: val}));
  };

  const handleUpdateTargetColor = (clinic, newColor) => {
    setClinicColors(prev => ({...prev, [clinic]: newColor}));
  };

  const handleAddClinic = () => {
    if (newClinicName.trim() && !targets[newClinicName.trim()]) {
      const name = newClinicName.trim();
      updateDb('targets', {...targets, [name]: parseInt(newClinicTarget) || 1});
      updateDb('clinicColors', {...clinicColors, [name]: newClinicColor});
      setNewClinicName('');
      setNewClinicTarget(1);
      setNewClinicColor('#3b82f6');
    }
  };

  const confirmDeleteTarget = () => {
    if (!clinicToDelete) return;
    const newTargets = { ...targets }; delete newTargets[clinicToDelete];
    const newColors = { ...clinicColors }; delete newColors[clinicToDelete];
    updateDb('targets', newTargets);
    updateDb('clinicColors', newColors);
    setClinicToDelete(null);
  };

  const handleSaveRoom = () => {
    if (!editingRoom.name.trim()) return;
    let newRoomList = editingRoom.id
      ? roomList.map(r => r.id === editingRoom.id ? editingRoom : r)
      : [...roomList, { ...editingRoom, id: Math.max(0, ...roomList.map(r => r.id)) + 1 }];
    updateDb('roomList', newRoomList);
    setEditingRoom(null);
  };

  const confirmDeleteRoom = () => {
    if (!roomToDelete) return;
    const id = roomToDelete.id;
    const newSchedules = { ...schedulesByWeek };
    Object.keys(newSchedules).forEach(week => {
      const weekSched = { ...newSchedules[week] };
      Object.keys(weekSched).forEach(key => { if (key.startsWith(`${id}-`)) delete weekSched[key]; });
      newSchedules[week] = weekSched;
    });
    updateDb('roomList', roomList.filter(r => r.id !== id));
    updateDb('schedulesByWeek', newSchedules);
    setRoomToDelete(null);
  };

  const getStaffName = (id) => staffList.find(s => s.id === id)?.name || '';
  const isQualified = (staffId, clinic) => {
    if (!staffId || !clinic) return true;
    return staffList.find(s => s.id === parseInt(staffId))?.skills?.includes(clinic);
  };

  const assignableStaff = staffList.filter(s => s.status !== 'Archived');

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center text-blue-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 p-4 md:p-6 font-sans text-slate-800 flex flex-col md:flex-row gap-4 md:gap-6 print:bg-white print:p-0 print:block">
      {isSidebarOpen ? (
        <div className="w-full md:w-64 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit sticky top-6 print:hidden transition-all">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Weekly Targets
            </h2>
            <div className="flex gap-1">
              <button onClick={() => setIsEditingTargets(true)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Manage Targets">
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors" title="Minimise Sidebar">
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
            {clinicTypes.map(clinic => {
              const target = targets[clinic];
              const current = currentCounts[clinic] || 0;
              const isMet = current === target;
              const isOver = current > target;
              
              let colorClass = "bg-rose-50 text-rose-700 border-rose-200"; 
              if (isOver) {
                  colorClass = "bg-emerald-50 text-emerald-800 border-emerald-200"; 
              } else if (isMet) {
                  colorClass = "bg-green-50 text-green-700 border-green-200"; 
              }

              return (
                <div key={clinic} className={`p-2 rounded-lg border ${colorClass}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-xs truncate mr-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: clinicColors[clinic] || '#3b82f6' }}></span>
                      {clinic}
                    </span>
                    <span className="text-xs font-bold whitespace-nowrap">{current} / {target}</span>
                  </div>
                  <div className="w-full bg-white/50 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${isOver ? 'bg-emerald-500' : isMet ? 'bg-green-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, (current / target) * 100)}%` }}></div>
                  </div>
                  {isMet && <p className="text-[10px] mt-1 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Target met</p>}
                  {isOver && <p className="text-[10px] mt-1 flex items-center gap-1"><Star className="w-3 h-3"/> Exceeded!</p>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div onClick={() => setIsSidebarOpen(true)} className="w-full md:w-12 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center py-4 h-fit sticky top-6 print:hidden cursor-pointer hover:bg-slate-50 transition-colors group" title="Expand Targets">
          <Activity className="w-5 h-5 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
          <div style={{ writingMode: 'vertical-rl' }} className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-4">Targets</div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>
      )}

      <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 overflow-x-auto flex flex-col print:w-full print:border-none print:shadow-none print:p-0 print:overflow-visible">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600 print:hidden" />
              <span className="print:hidden">Rota:</span>
              <span className="hidden print:block text-2xl font-black text-black">
                Clinic Rota: {activeWeek === 'master' ? 'Master Template' : `W/C ${new Date(activeWeek).toLocaleDateString('en-GB')}`}
              </span>
            </h2>
            <select 
              className="p-1.5 border border-slate-300 rounded-lg font-medium text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 min-w-[200px] print:hidden"
              value={activeWeek} onChange={(e) => setActiveWeek(e.target.value)}
            >
              <option value="master">⭐ Master Template</option>
              {Object.keys(schedulesByWeek).filter(k => k !== 'master').sort().map(w => (
                <option key={w} value={w}>Week Commencing: {new Date(w).toLocaleDateString('en-GB')}</option>
              ))}
            </select>
            <button onClick={() => setIsAddingWeek(true)} className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors print:hidden">
              <Plus className="w-4 h-4" /> New Week
            </button>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={() => setShowWeekends(!showWeekends)} className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg shadow-sm font-medium transition-colors ${showWeekends ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}>
              <CalendarDays className="w-4 h-4" /> {showWeekends ? 'Hide Weekends' : 'Show Weekends'}
            </button>
            <button onClick={() => setIsManagingRooms(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors">
              <Layout className="w-4 h-4" /> Manage Rooms
            </button>
          </div>
        </div>

        {activeWeek === 'master' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center gap-2 text-sm print:hidden">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p><strong>Master Template Mode:</strong> Clinics scheduled here are automatically copied when you create a New Week.</p>
          </div>
        )}
        
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr>
              <th className="p-3 border-b border-slate-200 bg-slate-50 sticky left-0 z-10 w-32">Room</th>
              {activeDays.map(day => (
                <th key={day} className="p-3 border-b border-slate-200 bg-slate-50 text-center font-semibold" colSpan={2}>{day}</th>
              ))}
            </tr>
            <tr>
              <th className="p-2 border-b border-slate-200 sticky left-0 bg-white z-10"></th>
              {activeDays.map(day => (
                <React.Fragment key={`${day}-slots`}>
                  <th className="p-2 border-b border-slate-200 text-xs text-center text-slate-500">AM</th>
                  <th className="p-2 border-b border-slate-200 text-xs text-center text-slate-500 border-r border-slate-200">PM</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {roomList.map(room => (
              <tr key={room.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-3 font-medium text-sm sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:border-l-0" style={{ borderLeft: `4px solid ${room.color || '#e2e8f0'}` }}>
                  {room.name}
                </td>
                {activeDays.map(day => (
                  <React.Fragment key={`${room.id}-${day}`}>
                    <td className="p-1 border-r border-slate-100 align-top">
                      <AssignmentCell 
                        assignment={currentSchedule[`${room.id}-${day}-AM`]} 
                        onClick={() => handleCellClick(room.id, day, 'AM')}
                        getStaffName={getStaffName}
                        clinicColor={currentSchedule[`${room.id}-${day}-AM`] ? clinicColors[currentSchedule[`${room.id}-${day}-AM`].clinic] : null}
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 align-top">
                      <AssignmentCell 
                        assignment={currentSchedule[`${room.id}-${day}-PM`]} 
                        onClick={() => handleCellClick(room.id, day, 'PM')}
                        getStaffName={getStaffName}
                        clinicColor={currentSchedule[`${room.id}-${day}-PM`] ? clinicColors[currentSchedule[`${room.id}-${day}-PM`].clinic] : null}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedCell && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-bold mb-1">Assign Clinic</h3>
            <p className="text-sm text-slate-500 mb-4">{selectedCell.day} {selectedCell.slot} • {roomList.find(r => r.id === selectedCell.roomId)?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff Member</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formState.staffId} onChange={(e) => setFormState({...formState, staffId: e.target.value})}>
                  <option value="">-- Select Staff --</option>
                  {assignableStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {assignableStaff.length === 0 && <p className="text-xs text-red-500 mt-1">No active staff available in the Directory.</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Clinic Type</label>
                <select className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={formState.clinic} onChange={(e) => setFormState({...formState, clinic: e.target.value})}>
                  <option value="">-- Select Clinic --</option>
                  {clinicTypes.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {!isQualified(formState.staffId, formState.clinic) && (
                <div className="p-3 bg-orange-50 text-orange-800 border border-orange-200 rounded-lg flex items-start gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>Warning: This staff member is not officially qualified for this clinic type according to the Staff Directory.</p>
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <button onClick={handleSaveAssignment} disabled={!formState.staffId || !formState.clinic} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50">Save</button>
                {currentSchedule[`${selectedCell.roomId}-${selectedCell.day}-${selectedCell.slot}`] && (
                   <button onClick={handleDeleteAssignment} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200"><Trash2 className="w-5 h-5" /></button>
                )}
                <button onClick={() => setSelectedCell(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddingWeek && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-bold mb-2">Create New Week</h3>
            <p className="text-sm text-slate-500 mb-4">Select the start date (Monday) for the new week.</p>
            <div className="space-y-4">
              <input type="date" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" value={newWeekDate} onChange={(e) => setNewWeekDate(e.target.value)} />
              <div className="flex gap-2 pt-2">
                <button onClick={handleCreateWeek} disabled={!newWeekDate} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50">Create</button>
                <button onClick={() => { setIsAddingWeek(false); setNewWeekDate(''); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isEditingTargets && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[500px] max-w-[90vw] max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Manage Clinic Targets</h3>
              <button 
                onClick={() => { 
                  updateDb('targets', targets);
                  updateDb('clinicColors', clinicColors);
                  setIsEditingTargets(false); 
                  setClinicToDelete(null); 
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 mb-6">
              {clinicTypes.map(clinic => (
                <div key={clinic} className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="font-medium text-sm flex-1 truncate">{clinic}</span>
                  <div className="relative rounded overflow-hidden border border-slate-300 w-7 h-7 shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 hover:scale-105 transition-transform">
                    <input type="color" value={clinicColors[clinic] || '#3b82f6'} onChange={(e) => handleUpdateTargetColor(clinic, e.target.value)} onBlur={() => updateDb('clinicColors', clinicColors)} className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" />
                  </div>
                  <input type="number" min="0" className="w-16 p-1 border border-slate-300 rounded text-center text-sm outline-none focus:border-blue-500" value={targets[clinic]} onChange={(e) => handleUpdateTarget(clinic, e.target.value)} onBlur={() => updateDb('targets', targets)} />
                  <button onClick={() => setClinicToDelete(clinic)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-bold mb-3">Add New Clinic</h4>
              <div className="flex gap-2">
                <input type="text" placeholder="Clinic Name" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500 min-w-0" value={newClinicName} onChange={(e) => setNewClinicName(e.target.value)} />
                <div className="relative rounded-lg overflow-hidden border border-slate-300 w-10 h-10 shrink-0 cursor-pointer focus-within:ring-2 focus-within:ring-blue-500 hover:scale-105 transition-transform">
                  <input type="color" value={newClinicColor} onChange={(e) => setNewClinicColor(e.target.value)} className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" />
                </div>
                <input type="number" min="1" className="w-16 p-2 border border-slate-300 rounded-lg text-center text-sm outline-none focus:border-blue-500 shrink-0" value={newClinicTarget} onChange={(e) => setNewClinicTarget(e.target.value)} />
                <button onClick={handleAddClinic} disabled={!newClinicName.trim()} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"><Plus className="w-5 h-5" /></button>
              </div>
            </div>
            {clinicToDelete && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h4 className="text-lg font-bold mb-2">Delete Clinic?</h4>
                <p className="text-sm text-slate-600 mb-6">Are you sure you want to delete <strong>{clinicToDelete}</strong>?</p>
                <div className="flex gap-3 w-full">
                  <button onClick={confirmDeleteTarget} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors">Yes, Delete</button>
                  <button onClick={() => setClinicToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isManagingRooms && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-[400px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingRoom ? (editingRoom.id ? 'Edit Room' : 'Add New Room') : 'Manage Rooms'}</h3>
              <button onClick={() => { setIsManagingRooms(false); setEditingRoom(null); setRoomToDelete(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {!editingRoom ? (
                <div className="space-y-4">
                  <button onClick={() => setEditingRoom({ name: '', color: '#3b82f6' })} className="w-full py-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors border border-blue-200">
                    <Plus className="w-4 h-4" /> Add New Room
                  </button>
                  <div className="space-y-2">
                    {roomList.map(room => (
                      <div key={room.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="font-medium text-sm text-slate-800 flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: room.color || '#e2e8f0' }}></span>
                          {room.name}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingRoom(room)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded bg-white border border-slate-200 shadow-sm"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setRoomToDelete(room)} className="p-1.5 text-slate-500 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Room Name</label>
                    <input type="text" value={editingRoom.name} onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Room Colour</label>
                    <div className="flex items-center gap-2">
                      {['#3b82f6', '#14b8a6', '#ef4444', '#a855f7', '#f59e0b', '#ec4899'].map(c => (
                        <button key={c} onClick={() => setEditingRoom({...editingRoom, color: c})} className={`w-6 h-6 rounded-full border-2 transition-all ${editingRoom.color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'}`} style={{ backgroundColor: c }} />
                      ))}
                      <div className="w-px h-6 bg-slate-300 mx-1"></div>
                      <div className="relative rounded overflow-hidden border border-slate-300 w-8 h-8 focus-within:ring-2 focus-within:ring-blue-500 hover:scale-105 transition-transform cursor-pointer">
                        <input type="color" value={editingRoom.color || '#3b82f6'} onChange={(e) => setEditingRoom({...editingRoom, color: e.target.value})} className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button onClick={handleSaveRoom} disabled={!editingRoom.name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50">Save Room</button>
                    <button onClick={() => setEditingRoom(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
            {roomToDelete && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h4 className="text-lg font-bold mb-2">Delete Room?</h4>
                <p className="text-sm text-slate-600 mb-6">Are you sure you want to delete <strong>{roomToDelete.name}</strong>?</p>
                <div className="flex gap-3 w-full">
                  <button onClick={confirmDeleteRoom} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors">Yes, Delete</button>
                  <button onClick={() => setRoomToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentCell({ assignment, onClick, getStaffName, clinicColor }) {
  if (!assignment) {
    return (
      <button onClick={onClick} className="w-full h-16 rounded-md border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer group print:border-solid print:border print:border-slate-200 print:bg-white">
        <Plus className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
      </button>
    );
  }
  const safeColor = clinicColor || '#3b82f6';
  return (
    <div onClick={onClick} className="w-full h-16 p-1.5 rounded-md border cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-center print:border-slate-300" style={{ backgroundColor: `${safeColor}33`, borderColor: safeColor }}>
      <div className="font-bold text-[10px] uppercase tracking-wider truncate mb-0.5 text-slate-900 print:text-black">{assignment.clinic}</div>
      <div className="text-xs flex items-center gap-1 opacity-90 truncate text-slate-700 print:text-black">
        <User className="w-3 h-3 shrink-0 print:text-slate-500" />
        <span className="truncate">{getStaffName(assignment.staffId)}</span>
      </div>
    </div>
  );
}
