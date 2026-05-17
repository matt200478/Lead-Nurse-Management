import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle, AlertCircle, Plus, Trash2, User, Home, Activity, Settings, 
  X, Users, Edit2, Layout, CalendarDays, Calendar, Printer, Loader2, 
  ChevronLeft, ChevronRight, LayoutDashboard, GraduationCap, RefreshCw, 
  Search, AlertTriangle, Clock, ShieldCheck, XCircle, UserCheck, Save, Star,
  Download, Archive, BookOpen
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// ============================================================================
// 1. FIREBASE CONFIGURATION
// ============================================================================
let firebaseConfig;
try {
  firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        apiKey: "AIzaSy" + "Bmh_DbR07Lga_oc2hAoMKnCYfBhE2C3FU",
        authDomain: "lead-nurse-management.firebaseapp.com",
        projectId: "lead-nurse-management",
        storageBucket: "lead-nurse-management.firebasestorage.app",
        messagingSenderId: "442233471706",
        appId: "1:442233471706:web:ebc5301c40a54180279be3"
      };
} catch (e) {
  console.error("Config error:", e);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper to construct a valid Document Reference dynamically.
const getRotaDocRef = () => {
  const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...rawAppId.split('/'), 'public', 'data', 'clinic_rota', 'shared_data'];
  if (segments.length % 2 !== 0) segments.push('doc');
  return doc(db, ...segments);
};

const getTrainingDocRef = () => {
  const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...rawAppId.split('/'), 'public', 'data', 'clinic_rota', 'training_data'];
  if (segments.length % 2 !== 0) segments.push('doc');
  return doc(db, ...segments);
};

// ============================================================================
// 2. CLINIC ROTA COMPONENT
// ============================================================================
const INITIAL_ROOMS = [
  { id: 1, name: 'Room 1', color: '#3b82f6' },
  { id: 2, name: 'Room 2', color: '#14b8a6' },
  { id: 3, name: 'Room 3', color: '#ef4444' },
  { id: 4, name: 'Treatment Room', color: '#a855f7' }
];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEKENDS = ['Saturday', 'Sunday'];

const INITIAL_STAFF = [
  { id: 1, name: 'Michelle (Lead)', skills: ['Minor Illness', 'Chronic Disease', 'Bloods', 'Smears', 'Immunisations'] },
  { id: 2, name: 'Sarah (RN)', skills: ['Bloods', 'Smears', 'Immunisations'] },
  { id: 3, name: 'John (ANP)', skills: ['Minor Illness', 'Chronic Disease'] },
  { id: 4, name: 'Emma (HCA)', skills: ['Bloods'] },
];

const INITIAL_TARGETS = {
  'Minor Illness': 4,
  'Chronic Disease': 2,
  'Bloods': 6,
  'Smears': 2,
  'Immunisations': 3
};

const INITIAL_CLINIC_COLORS = {
  'Minor Illness': '#c084fc',
  'Chronic Disease': '#fb923c',
  'Bloods': '#f87171',
  'Smears': '#f472b6',
  'Immunisations': '#2dd4bf'
};

function ClinicRota() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [clinicColors, setClinicColors] = useState(INITIAL_CLINIC_COLORS);
  const [staffList, setStaffList] = useState(INITIAL_STAFF);
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
  
  const [isManagingStaff, setIsManagingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [isManagingRooms, setIsManagingRooms] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [showWeekends, setShowWeekends] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const activeDays = showWeekends ? [...WEEKDAYS, ...WEEKENDS] : WEEKDAYS;
  const currentSchedule = schedulesByWeek[activeWeek] || {};

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth Failed:", err); }
    };
    initAuth();
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
            staffList: INITIAL_STAFF,
            roomList: INITIAL_ROOMS,
            schedulesByWeek: { 'master': {} }
          }, { merge: true });
        }
        setIsDbLoaded(true);
      }, (error) => {
        console.error("Sync error:", error);
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
    if (field === 'staffList') setStaffList(value);
    if (field === 'roomList') setRoomList(value);

    try {
      const docRef = getRotaDocRef();
      await updateDoc(docRef, { [field]: value });
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
    if (val >= 0) {
      setTargets(prev => ({...prev, [clinic]: val}));
    }
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

  const handleSaveStaff = () => {
    if (!editingStaff.name.trim()) return;
    let newStaffList = editingStaff.id 
      ? staffList.map(s => s.id === editingStaff.id ? editingStaff : s)
      : [...staffList, { ...editingStaff, id: Math.max(0, ...staffList.map(s => s.id)) + 1 }];
    updateDb('staffList', newStaffList);
    setEditingStaff(null);
  };

  const confirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const id = staffToDelete.id;
    const newSchedules = { ...schedulesByWeek };
    Object.keys(newSchedules).forEach(week => {
      const weekSched = { ...newSchedules[week] };
      Object.keys(weekSched).forEach(key => { if (weekSched[key].staffId === id) delete weekSched[key]; });
      newSchedules[week] = weekSched;
    });
    updateDb('staffList', staffList.filter(s => s.id !== id));
    updateDb('schedulesByWeek', newSchedules);
    setStaffToDelete(null);
  };

  const toggleSkill = (skill) => {
    setEditingStaff(prev => ({
      ...prev, 
      skills: prev.skills.includes(skill) ? prev.skills.filter(s => s !== skill) : [...prev.skills, skill]
    }));
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
    return staffList.find(s => s.id === parseInt(staffId))?.skills.includes(clinic);
  };

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-gray-50 flex flex-col items-center justify-center text-indigo-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Loading Rota Data...</h2>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-50 p-4 md:p-6 font-sans text-slate-800 flex flex-col md:flex-row gap-4 md:gap-6 print:bg-white print:p-0 print:block">
      {/* LEFT PANEL: Tracker */}
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
              
              let colorClass = "bg-rose-50 text-rose-700 border-rose-200"; // Default: Unmet
              if (isOver) {
                  colorClass = "bg-emerald-50 text-emerald-800 border-emerald-200"; // Exceeded
              } else if (isMet) {
                  colorClass = "bg-green-50 text-green-700 border-green-200"; // Met exactly
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

      {/* MAIN PANEL: Schedule Grid */}
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
            <button onClick={() => setIsManagingStaff(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors">
              <Users className="w-4 h-4" /> Manage Staff
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

      {/* --- MODALS FOR ROTA --- */}
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
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
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
                  <p>Warning: This staff member is not officially qualified for this clinic type.</p>
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
                    <input 
                      type="color" 
                      value={clinicColors[clinic] || '#3b82f6'} 
                      onChange={(e) => handleUpdateTargetColor(clinic, e.target.value)} 
                      onBlur={() => updateDb('clinicColors', clinicColors)}
                      className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" 
                    />
                  </div>
                  <input 
                    type="number" 
                    min="0" 
                    className="w-16 p-1 border border-slate-300 rounded text-center text-sm outline-none focus:border-blue-500" 
                    value={targets[clinic]} 
                    onChange={(e) => handleUpdateTarget(clinic, e.target.value)} 
                    onBlur={() => updateDb('targets', targets)}
                  />
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

      {isManagingStaff && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingStaff ? (editingStaff.id ? 'Edit Staff' : 'Add New Staff') : 'Manage Staff'}</h3>
              <button onClick={() => { setIsManagingStaff(false); setEditingStaff(null); setStaffToDelete(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto">
              {!editingStaff ? (
                <div className="space-y-4">
                  <button onClick={() => setEditingStaff({ name: '', skills: [] })} className="w-full py-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors border border-blue-200">
                    <Plus className="w-4 h-4" /> Add New Staff
                  </button>
                  <div className="space-y-2">
                    {staffList.map(staff => (
                      <div key={staff.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                        <div>
                          <div className="font-medium text-sm text-slate-800">{staff.name}</div>
                          <div className="text-xs text-slate-500 mt-1">{staff.skills.length} qualified clinics</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingStaff(staff)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded bg-white border border-slate-200 shadow-sm"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => setStaffToDelete(staff)} className="p-1.5 text-slate-500 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name / Role</label>
                    <input type="text" value={editingStaff.name} onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})} placeholder="e.g. Sarah (RN)" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Qualified Clinics</label>
                    <div className="grid grid-cols-2 gap-2">
                      {clinicTypes.map(clinic => (
                        <label key={clinic} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                          <input type="checkbox" className="rounded text-blue-600 w-4 h-4" checked={editingStaff.skills.includes(clinic)} onChange={() => toggleSkill(clinic)} />
                          <span className="text-sm">{clinic}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button onClick={handleSaveStaff} disabled={!editingStaff.name.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50">Save Staff</button>
                    <button onClick={() => setEditingStaff(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                  </div>
                </div>
              )}
            </div>
            {staffToDelete && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h4 className="text-lg font-bold mb-2">Delete Staff Member?</h4>
                <p className="text-sm text-slate-600 mb-6">Are you sure you want to delete <strong>{staffToDelete.name}</strong>? This removes them from all rotas.</p>
                <div className="flex gap-3 w-full">
                  <button onClick={confirmDeleteStaff} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors">Yes, Delete</button>
                  <button onClick={() => setStaffToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
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


// ============================================================================
// 3. TRAINING MATRIX COMPONENT (Native Firestore Edition)
// ============================================================================

const INITIAL_TRAINING_COURSES = [
  { name: 'Independent Prescriber', freq: 12 },
  { name: 'Acute illness', freq: null },
  { name: 'Imms and Vacs', freq: 12 },
  { name: 'Cytology', freq: 36 },
  { name: 'Dressings', freq: null },
  { name: 'COPD', freq: 12 },
  { name: 'Asthma', freq: 12 },
  { name: 'HTN', freq: 12 },
  { name: 'CHD', freq: 12 },
  { name: 'CKD', freq: 12 },
  { name: 'HF', freq: 12 },
  { name: 'Diabetes', freq: 12 },
  { name: 'Vaginal Pessary', freq: null },
  { name: 'CHC', freq: 12 },
  { name: 'POP', freq: 12 },
  { name: 'Phlebotomy', freq: null },
  { name: 'Revalidation', freq: 36 },
  { name: 'Mentor', freq: 12 }
];

const INITIAL_TRAINING_STAFF = [
  { id: 1, name: 'Michelle Scotney', role: 'Nurse', records: {}, remarks: '', status: 'Active' }
];

function TrainingMatrix() {
    const [user, setUser] = useState(null);
    const [isDbLoaded, setIsDbLoaded] = useState(false);

    // Matrix State
    const [courses, setCourses] = useState(INITIAL_TRAINING_COURSES);
    const [matrixStaff, setMatrixStaff] = useState(INITIAL_TRAINING_STAFF);

    // UI State
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [showArchived, setShowArchived] = useState(false);
    
    // Editor State
    const [isManagingStaff, setIsManagingStaff] = useState(false);
    const [editingStaff, setEditingStaff] = useState(null);
    const [staffToDelete, setStaffToDelete] = useState(null);

    const [isManagingCourses, setIsManagingCourses] = useState(false);
    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseFreq, setNewCourseFreq] = useState('12');
    const [courseToDelete, setCourseToDelete] = useState(null);

    const [selectedCell, setSelectedCell] = useState(null);
    const [cellForm, setCellForm] = useState({ date: '', override: 'Completed' });

    // Authentication Setup
    useEffect(() => {
      const initAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (err) { console.error("Auth Failed:", err); }
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
    }, []);

    // Database Sync
    useEffect(() => {
        if (!user) return;
        try {
            const docRef = getTrainingDocRef();
            const unsubscribe = onSnapshot(docRef, (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.courses) setCourses(data.courses);
                    if (data.matrixStaff) setMatrixStaff(data.matrixStaff);
                } else {
                    setDoc(docRef, { courses: INITIAL_TRAINING_COURSES, matrixStaff: INITIAL_TRAINING_STAFF }, { merge: true });
                }
                setIsDbLoaded(true);
            });
            return () => unsubscribe();
        } catch (e) {
            console.error("Sync error:", e);
            setIsDbLoaded(true);
        }
    }, [user]);

    const updateDb = async (field, value) => {
        if (!user) return;
        if (field === 'courses') setCourses(value);
        if (field === 'matrixStaff') setMatrixStaff(value);
        try {
            await updateDoc(getTrainingDocRef(), { [field]: value });
        } catch (e) { console.error("Database save failed:", e); }
    };

    // --- Dynamic Status Calculation Engine ---
    const calculateCellStatus = (record, courseFreq) => {
        if (!record || (!record.date && record.override !== 'N/A')) return { status: 'Expired/Missing' };
        
        if (record.override === 'N/A') return { status: 'N/A' };
        if (record.override === 'Booked') return { status: 'Booked', date: record.date };

        if (courseFreq === null) return { status: 'Valid', date: record.date, expiry: 'Never' };

        const compDate = new Date(record.date);
        const expiryDate = new Date(compDate);
        expiryDate.setMonth(expiryDate.getMonth() + courseFreq);
        
        const today = new Date();
        const diffTime = expiryDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        let status = 'Valid';
        if (diffDays < 0) status = 'Expired/Missing';
        else if (diffDays <= 30) status = 'Expiring Soon';

        return {
            status,
            date: record.date,
            expiry: expiryDate.toISOString().split('T')[0]
        };
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    // CSV Export Function
    const exportToCSV = () => {
        const headers = ['Staff Member', 'Role', 'Status', ...courses.map(c => c.name), 'Remarks'];
        
        const rows = filteredData.map(staff => {
            return [
                `"${staff.name}"`,
                `"${staff.role}"`,
                `"${staff.status || 'Active'}"`,
                ...courses.map(c => {
                    const detail = calculateCellStatus(staff.records[c.name], c.freq);
                    if (detail.status === 'N/A') return '"N/A"';
                    if (detail.status === 'Booked') return `"Booked: ${detail.date}"`;
                    if (!detail.date) return '""';
                    return `"${detail.date}"`;
                }),
                `"${staff.remarks || ''}"`
            ].join(',');
        });

        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `Training_Matrix_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // --- Cell Editor Functions ---
    const handleSaveCell = () => {
        const { staffId, courseName } = selectedCell;
        const newStaffList = matrixStaff.map(staff => {
            if (staff.id === staffId) {
                return {
                    ...staff,
                    records: {
                        ...staff.records,
                        [courseName]: { date: cellForm.date, override: cellForm.override }
                    }
                };
            }
            return staff;
        });
        updateDb('matrixStaff', newStaffList);
        setSelectedCell(null);
    };

    const handleClearCell = () => {
        const { staffId, courseName } = selectedCell;
        const newStaffList = matrixStaff.map(staff => {
            if (staff.id === staffId) {
                const newRecords = { ...staff.records };
                delete newRecords[courseName];
                return { ...staff, records: newRecords };
            }
            return staff;
        });
        updateDb('matrixStaff', newStaffList);
        setSelectedCell(null);
    };

    // --- Staff Management Functions ---
    const handleSaveStaff = () => {
        if (!editingStaff.name.trim()) return;
        let newStaffList = editingStaff.id 
          ? matrixStaff.map(s => s.id === editingStaff.id ? editingStaff : s)
          : [...matrixStaff, { ...editingStaff, id: Math.max(0, ...matrixStaff.map(s => s.id)) + 1 }];
        updateDb('matrixStaff', newStaffList);
        setEditingStaff(null);
    };

    const confirmDeleteStaff = () => {
        if (!staffToDelete) return;
        updateDb('matrixStaff', matrixStaff.filter(s => s.id !== staffToDelete.id));
        setStaffToDelete(null);
    };

    // --- Course Management Functions ---
    const handleAddCourse = () => {
      if (!newCourseName.trim()) return;
      if (courses.some(c => c.name.toLowerCase() === newCourseName.trim().toLowerCase())) return; // Prevent duplicates
      
      const freqValue = newCourseFreq === 'Never' ? null : parseInt(newCourseFreq);
      const newCourses = [...courses, { name: newCourseName.trim(), freq: freqValue }];
      updateDb('courses', newCourses);
      setNewCourseName('');
    };

    const confirmDeleteCourse = () => {
      if (!courseToDelete) return;
      const newCourses = courses.filter(c => c.name !== courseToDelete);
      updateDb('courses', newCourses);
      setCourseToDelete(null);
    };

    const getStatusStyle = (status) => {
        switch(status) {
            case 'Valid': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Expiring Soon': return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Expired/Missing': return 'bg-rose-100 text-rose-800 border-rose-200';
            case 'Booked': return 'bg-blue-100 text-blue-800 border-blue-200';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'Valid': return <CheckCircle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Expiring Soon': return <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Expired/Missing': return <XCircle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Booked': return <Clock className="w-3.5 h-3.5 mr-1 shrink-0" />;
            default: return null;
        }
    };

    if (!isDbLoaded) {
        return (
            <div className="flex-1 bg-slate-50 flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                    <p className="text-slate-600 font-medium">Loading Database...</p>
                </div>
            </div>
        );
    }

    // Filter Logic
    let filteredData = [...matrixStaff];
    
    // Default to hiding archived staff unless toggle is checked
    if (!showArchived) {
      filteredData = filteredData.filter(item => item.status !== 'Archived');
    }

    if (filter !== 'All') {
        filteredData = filteredData.filter(item => item.role && item.role.includes(filter));
    }
    if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        filteredData = filteredData.filter(item => item.name.toLowerCase().includes(lowerQuery));
    }

    if (sortConfig.key) {
        filteredData.sort((a, b) => {
            let aVal, bVal;
            if (sortConfig.key === 'name') {
                aVal = a.name; bVal = b.name;
            } else {
                const cFreq = courses.find(c => c.name === sortConfig.key)?.freq;
                aVal = calculateCellStatus(a.records[sortConfig.key], cFreq).status;
                bVal = calculateCellStatus(b.records[sortConfig.key], cFreq).status;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Derived stats
    let totalValid = 0, totalExpiring = 0, totalMissing = 0, totalApplicable = 0;
    filteredData.forEach(staff => {
        courses.forEach(c => {
            const detail = calculateCellStatus(staff.records[c.name], c.freq);
            if (detail.status !== 'N/A') {
                totalApplicable++;
                if (detail.status === 'Valid') totalValid++;
                else if (detail.status === 'Expiring Soon') totalExpiring++;
                else if (detail.status === 'Expired/Missing') totalMissing++;
            }
        });
    });
    const complianceRate = totalApplicable > 0 ? Math.round((totalValid / totalApplicable) * 100) : 100;

    return (
        <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 print:bg-white print:p-0">
            {/* Header Area */}
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm print:hidden">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 max-w-7xl mx-auto">
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                            <GraduationCap className="w-7 h-7 text-indigo-600" />
                            Training & Compliance Matrix
                        </h1>
                        <p className="text-sm text-slate-500 font-medium mt-1">Live Database Sync Active</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
                        <div className="relative flex-1 min-w-[200px] xl:w-64">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Find staff member..." 
                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 rounded-lg font-medium shadow-sm transition-all" title="Download CSV">
                            <Download className="w-4 h-4" /> Export
                        </button>
                        <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 rounded-lg font-medium shadow-sm transition-all" title="Print Matrix">
                            <Printer className="w-4 h-4" /> Print
                        </button>
                        <button onClick={() => setIsManagingCourses(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 rounded-lg font-medium shadow-sm transition-all" title="Manage Courses">
                            <BookOpen className="w-4 h-4" /> Requirements
                        </button>
                        <button onClick={() => setIsManagingStaff(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg font-medium shadow-sm hover:bg-indigo-700 transition-all">
                            <Users className="w-4 h-4" /> Manage Staff
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-[1600px] mx-auto print:p-0 print:max-w-full">
                
                {/* Stats Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 print:hidden">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Compliance Rate</p>
                            <p className="text-3xl font-black text-slate-800">{complianceRate}%</p>
                        </div>
                        <div className={`p-3 rounded-full ${complianceRate >= 90 ? 'bg-emerald-100 text-emerald-600' : complianceRate >= 75 ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'}`}>
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Active Staff</p>
                            <p className="text-3xl font-black text-slate-800">{filteredData.length}</p>
                        </div>
                        <div className="p-3 rounded-full bg-blue-100 text-blue-600"><UserCheck className="w-6 h-6" /></div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Expiring Soon (30d)</p>
                            <p className="text-3xl font-black text-amber-600">{totalExpiring}</p>
                        </div>
                        <div className="p-3 rounded-full bg-amber-100 text-amber-600"><AlertTriangle className="w-6 h-6" /></div>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Missing / Expired</p>
                            <p className="text-3xl font-black text-rose-600">{totalMissing}</p>
                        </div>
                        <div className="p-3 rounded-full bg-rose-100 text-rose-600"><AlertCircle className="w-6 h-6" /></div>
                    </div>
                </div>

                {/* Filters */}
                <div className="mb-4 flex flex-wrap gap-2 pb-2 print:hidden justify-between items-center">
                    <div className="flex gap-2">
                        {['All', 'Nurse', 'HCA', 'ANP'].map(role => (
                            <button 
                                key={role}
                                onClick={() => setFilter(role)}
                                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === role ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
                            >
                                {role}s
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={() => setShowArchived(!showArchived)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors ${showArchived ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}
                    >
                        <Archive className="w-4 h-4" /> {showArchived ? 'Hide Archived Staff' : 'Show Archived Staff'}
                    </button>
                </div>

                {/* Print Title */}
                <div className="hidden print:block mb-4">
                    <h1 className="text-2xl font-bold">Bourne Galletly Training Matrix</h1>
                    <p className="text-sm text-slate-500">Printed: {new Date().toLocaleDateString('en-GB')} | Filter: {filter}s</p>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto print:border-none print:shadow-none">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 print:bg-white">
                                <th 
                                    className="p-3 font-bold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 sticky left-0 z-10 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:bg-white min-w-[150px]"
                                    onClick={() => handleSort('name')}
                                >
                                    Staff Member
                                </th>
                                {courses.map(course => (
                                    <th 
                                        key={course.name} 
                                        className="p-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 border-l border-slate-200 whitespace-nowrap align-bottom group"
                                        onClick={() => handleSort(course.name)}
                                    >
                                        <div className="w-[110px] text-xs leading-tight mb-1 opacity-70">
                                            {course.freq ? `Every ${course.freq}m` : 'Once'}
                                        </div>
                                        <div className="whitespace-normal leading-tight">{course.name}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredData.map((staff, idx) => (
                                <tr key={idx} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors print:border-slate-300 ${staff.status === 'Archived' ? 'opacity-50 grayscale' : ''}`}>
                                    <td className="p-3 sticky left-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none border-r border-slate-100 align-top">
                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                          {staff.name} 
                                          {staff.status === 'Archived' && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-wider">Archived</span>}
                                        </div>
                                        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">{staff.role}</div>
                                        {staff.remarks && (
                                            <div className="text-[10px] text-slate-400 mt-1 italic leading-tight w-full whitespace-normal print:hidden">"{staff.remarks}"</div>
                                        )}
                                    </td>
                                    {courses.map(course => {
                                        const detail = calculateCellStatus(staff.records[course.name], course.freq);
                                        
                                        if (detail.status === 'N/A') {
                                            return (
                                              <td key={course.name} onClick={() => { setSelectedCell({staffId: staff.id, courseName: course.name}); setCellForm(staff.records[course.name] || { date: '', override: 'Completed' }); }} className="p-3 border-l border-slate-100 text-center bg-slate-50/30 print:bg-white cursor-pointer hover:bg-slate-100 group">
                                                <span className="text-slate-300 font-medium text-xs group-hover:text-indigo-500">N/A</span>
                                              </td>
                                            );
                                        }
                                        return (
                                            <td 
                                              key={course.name} 
                                              onClick={() => { setSelectedCell({staffId: staff.id, courseName: course.name}); setCellForm(staff.records[course.name] || { date: '', override: 'Completed' }); }}
                                              className="p-2 border-l border-slate-100 align-top min-w-[120px] cursor-pointer hover:bg-slate-50 transition-colors"
                                            >
                                                <div className={`p-2 rounded-lg border ${getStatusStyle(detail.status)} flex flex-col justify-center h-full print:border-slate-400 print:text-black print:bg-white transition-transform hover:scale-[1.02]`}>
                                                    <div className="font-bold text-[11px] uppercase tracking-wider flex items-center truncate">
                                                        {getStatusIcon(detail.status)}
                                                        <span className="truncate">{detail.status}</span>
                                                    </div>
                                                    {detail.date && <div className="text-[10px] mt-1 opacity-80 font-medium">Done: {new Date(detail.date).toLocaleDateString('en-GB')}</div>}
                                                    {detail.expiry && <div className="text-[10px] opacity-80 font-bold mt-0.5">Exp: {detail.expiry === 'Never' ? 'Never' : new Date(detail.expiry).toLocaleDateString('en-GB')}</div>}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            No staff members found matching your criteria.
                        </div>
                    )}
                </div>
            </div>

            {/* MODALS */}
            {selectedCell && (
              <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
                <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
                  <h3 className="text-lg font-bold mb-1">Update Training Record</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {matrixStaff.find(s => s.id === selectedCell.staffId)?.name} • {selectedCell.courseName}
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Status</label>
                      <select className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={cellForm.override} onChange={(e) => setCellForm({...cellForm, override: e.target.value})}>
                        <option value="Completed">Completed</option>
                        <option value="Booked">Booked (Upcoming)</option>
                        <option value="N/A">Not Applicable</option>
                      </select>
                    </div>

                    {cellForm.override !== 'N/A' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">{cellForm.override === 'Booked' ? 'Booking Date' : 'Date Completed'}</label>
                        <input type="date" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={cellForm.date} onChange={(e) => setCellForm({...cellForm, date: e.target.value})} />
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <button onClick={handleSaveCell} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50">Save</button>
                      <button onClick={handleClearCell} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200" title="Clear Record"><Trash2 className="w-5 h-5" /></button>
                      <button onClick={() => setSelectedCell(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isManagingCourses && (
              <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
                <div className="bg-white rounded-xl shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Manage Training Requirements</h3>
                    <button onClick={() => { setIsManagingCourses(false); setCourseToDelete(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-3 mb-4">
                    {courses.map(course => (
                      <div key={course.name} className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <span className="font-medium text-sm flex-1 truncate">{course.name}</span>
                        <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">
                          {course.freq ? `Every ${course.freq}m` : 'Never Expires'}
                        </span>
                        <button onClick={() => setCourseToDelete(course.name)} className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>

                  <div className="p-6 border-t border-slate-200 bg-slate-50 rounded-b-xl">
                    <h4 className="text-sm font-bold mb-3">Add New Requirement</h4>
                    <div className="flex gap-2">
                      <input type="text" placeholder="Course Name" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 min-w-0" value={newCourseName} onChange={(e) => setNewCourseName(e.target.value)} />
                      <select className="w-32 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-indigo-500 shrink-0" value={newCourseFreq} onChange={(e) => setNewCourseFreq(e.target.value)}>
                        <option value="12">12 Months</option>
                        <option value="24">24 Months</option>
                        <option value="36">36 Months</option>
                        <option value="Never">Never Expires</option>
                      </select>
                      <button onClick={handleAddCourse} disabled={!newCourseName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"><Plus className="w-5 h-5" /></button>
                    </div>
                  </div>

                  {/* Course Deletion Overlay */}
                  {courseToDelete && (
                    <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                      <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                      <h4 className="text-lg font-bold mb-2">Delete Requirement?</h4>
                      <p className="text-sm text-slate-600 mb-6">Are you sure you want to completely remove <strong>{courseToDelete}</strong> from the matrix?</p>
                      <div className="flex gap-3 w-full">
                        <button onClick={confirmDeleteCourse} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors">Yes, Delete</button>
                        <button onClick={() => setCourseToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {isManagingStaff && (
              <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
                <div className="bg-white rounded-xl shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold">{editingStaff ? (editingStaff.id ? 'Edit Staff Details' : 'Add New Staff') : 'Manage Matrix Staff'}</h3>
                    <button onClick={() => { setIsManagingStaff(false); setEditingStaff(null); setStaffToDelete(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                    {!editingStaff ? (
                      <div className="space-y-4">
                        <button onClick={() => setEditingStaff({ name: '', role: 'Nurse', records: {}, remarks: '', status: 'Active' })} className="w-full py-2 flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 font-medium transition-colors border border-indigo-200">
                          <Plus className="w-4 h-4" /> Add New Staff Member
                        </button>
                        <div className="space-y-2">
                          {matrixStaff.map(staff => (
                            <div key={staff.id} className={`flex items-center justify-between p-3 border border-slate-200 rounded-lg ${staff.status === 'Archived' ? 'bg-slate-100 opacity-60' : 'bg-slate-50'}`}>
                              <div>
                                <div className="font-medium text-sm text-slate-800">
                                  {staff.name} {staff.status === 'Archived' && <span className="text-[10px] ml-2 text-slate-500 uppercase tracking-wider">(Archived)</span>}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{staff.role}</div>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => setEditingStaff(staff)} className="p-1.5 text-slate-500 hover:text-indigo-600 rounded bg-white border border-slate-200 shadow-sm"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => setStaffToDelete(staff)} className="p-1.5 text-slate-500 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Staff Name</label>
                          <input type="text" value={editingStaff.name} onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})} placeholder="e.g. Sarah Jones" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">Role</label>
                            <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.role} onChange={(e) => setEditingStaff({...editingStaff, role: e.target.value})}>
                              <option value="Nurse">Nurse</option>
                              <option value="HCA">HCA</option>
                              <option value="ANP">ANP</option>
                            </select>
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium mb-1">Status</label>
                            <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.status || 'Active'} onChange={(e) => setEditingStaff({...editingStaff, status: e.target.value})}>
                              <option value="Active">Active Employee</option>
                              <option value="Archived">Archived (Left Practice)</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Remarks (Optional)</label>
                          <input type="text" value={editingStaff.remarks || ''} onChange={(e) => setEditingStaff({...editingStaff, remarks: e.target.value})} placeholder="e.g. Needs updated bloods cert" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div className="flex gap-2 pt-4">
                          <button onClick={handleSaveStaff} disabled={!editingStaff.name.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50">Save Staff</button>
                          <button onClick={() => setEditingStaff(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {staffToDelete && (
                  <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                    <h4 className="text-lg font-bold mb-2">Delete Staff Member?</h4>
                    <p className="text-sm text-slate-600 mb-6">Are you sure you want to completely wipe <strong>{staffToDelete.name}</strong> from the database? <br/><br/>(Tip: Edit them and set their status to "Archived" instead if you want to keep their training history!)</p>
                    <div className="flex gap-3 w-full">
                      <button onClick={confirmDeleteStaff} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors">Yes, Wipe Data</button>
                      <button onClick={() => setStaffToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
    );
}

// ============================================================================
// 4. MAIN APPLICATION SHELL & DASHBOARD
// ============================================================================
function DashboardHome({ setView }) {
  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-800">Welcome back, Michelle.</h1>
        <p className="text-slate-500 mt-2 text-lg">Practice Management Suite • Bourne Galletly</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rota Card */}
        <div onClick={() => setView('rota')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 z-0"></div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-6 shadow-inner"><CalendarDays className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Clinic Rota Manager</h2>
            <p className="text-slate-500 mb-6 leading-relaxed">Manage weekly room allocations, monitor target compliance, and prevent staff qualification conflicts.</p>
            <div className="flex items-center text-blue-600 font-semibold group-hover:translate-x-1 transition-transform">Open Rota Manager <ChevronRight className="w-5 h-5 ml-1" /></div>
          </div>
        </div>

        {/* Training Card */}
        <div onClick={() => setView('training')} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 z-0"></div>
          <div className="relative z-10">
            <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6 shadow-inner"><GraduationCap className="w-7 h-7" /></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Training Matrix</h2>
            <p className="text-slate-500 mb-6 leading-relaxed">Central database to monitor staff qualifications, update completion dates, and track upcoming expiries.</p>
            <div className="flex items-center text-indigo-600 font-semibold group-hover:translate-x-1 transition-transform">Open Training Matrix <ChevronRight className="w-5 h-5 ml-1" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'rota', 'training'
  const [isGlobalSidebarOpen, setIsGlobalSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      {/* Global Sidebar */}
      <div className={`${isGlobalSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out bg-slate-900 text-white shrink-0 flex flex-col print:hidden shadow-xl z-50 relative`}>
        
        {/* Sidebar Toggle Button */}
        <button 
          onClick={() => setIsGlobalSidebarOpen(!isGlobalSidebarOpen)}
          className="absolute -right-3 top-8 bg-indigo-600 text-white p-1 rounded-full shadow-md hover:bg-indigo-700 z-50 border border-slate-800"
          title={isGlobalSidebarOpen ? "Minimise Menu" : "Expand Menu"}
        >
          {isGlobalSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className={`p-6 border-b border-slate-800 flex items-center ${isGlobalSidebarOpen ? 'gap-3' : 'justify-center px-0'}`}>
          <ShieldCheck className="w-8 h-8 text-indigo-400 shrink-0" />
          {isGlobalSidebarOpen && (
            <h1 className="text-xl font-black tracking-tight text-white whitespace-nowrap overflow-hidden">Practice<br/>Manager</h1>
          )}
        </div>
        
        <div className="flex-1 py-6 flex flex-col gap-2 px-4 overflow-hidden">
          <button 
            onClick={() => setCurrentView('dashboard')} 
            title="Home"
            className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {isGlobalSidebarOpen && <span className="whitespace-nowrap">Home</span>}
          </button>
          <button 
            onClick={() => setCurrentView('rota')} 
            title="Clinic Rota"
            className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'rota' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <CalendarDays className="w-5 h-5 shrink-0" />
            {isGlobalSidebarOpen && <span className="whitespace-nowrap">Clinic Rota</span>}
          </button>
          <button 
            onClick={() => setCurrentView('training')} 
            title="Training Matrix"
            className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'training' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <GraduationCap className="w-5 h-5 shrink-0" />
            {isGlobalSidebarOpen && <span className="whitespace-nowrap">Training Matrix</span>}
          </button>
        </div>

        {isGlobalSidebarOpen && (
          <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center whitespace-nowrap">
            Bourne Galletly Internal Tools
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-slate-100 relative">
        {currentView === 'dashboard' && <DashboardHome setView={setCurrentView} />}
        {currentView === 'rota' && <ClinicRota />}
        {currentView === 'training' && <TrainingMatrix />}
      </div>
      
    </div>
  );
}
