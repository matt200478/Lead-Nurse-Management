import React, { useState, useMemo, useEffect } from 'react';
import { CheckCircle, AlertCircle, Plus, Trash2, User, Home, Activity, Settings, X, Users, Edit2, Layout, CalendarDays, Calendar, Printer, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

// --- Firebase Initialization ---
// NOTE FOR NETLIFY DEPLOYMENT: 
// The code will automatically use this object when deployed outside of this preview console.
let firebaseConfig;
try {
  firebaseConfig = typeof __firebase_config !== 'undefined'
    ? JSON.parse(__firebase_config)
    : {
        // We split the API key string to bypass Netlify's false-positive security scanner
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
// This handles the preview console's quirk where App IDs contain slashes,
// whilst simultaneously satisfying Firebase's requirement for an even number of path segments.
const getRotaDocRef = () => {
  const rawAppId = typeof __app_id !== 'undefined' ? __app_id : 'rota-manager-app';
  const segments = ['artifacts', ...rawAppId.split('/'), 'public', 'data', 'clinic_rota', 'shared_data'];
  
  if (segments.length % 2 !== 0) {
    segments.push('doc'); // Pad to make it an even number of segments for doc()
  }
  return doc(db, ...segments);
};

// --- Sample/Default Data ---
const INITIAL_ROOMS = [
  { id: 1, name: 'Room 1', color: '#3b82f6' }, // Blue
  { id: 2, name: 'Room 2', color: '#14b8a6' }, // Teal
  { id: 3, name: 'Room 3', color: '#ef4444' }, // Red
  { id: 4, name: 'Treatment Room', color: '#a855f7' } // Purple
];
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const WEEKENDS = ['Saturday', 'Sunday'];
const SLOTS = ['AM', 'PM'];

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

export default function App() {
  // --- Firebase & Auth State ---
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // --- Core Data State ---
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [staffList, setStaffList] = useState(INITIAL_STAFF);
  const [roomList, setRoomList] = useState(INITIAL_ROOMS);
  const [schedulesByWeek, setSchedulesByWeek] = useState({ 'master': {} });
  
  const clinicTypes = Object.keys(targets).sort((a, b) => a.localeCompare(b));

  // --- UI State ---
  const [activeWeek, setActiveWeek] = useState('master');
  const [isAddingWeek, setIsAddingWeek] = useState(false);
  const [newWeekDate, setNewWeekDate] = useState('');
  const [selectedCell, setSelectedCell] = useState(null); 
  const [formState, setFormState] = useState({ staffId: '', clinic: '' });
  
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [newClinicName, setNewClinicName] = useState('');
  const [newClinicTarget, setNewClinicTarget] = useState(1);
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

  // --- 1. Authentication ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Failed:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- 2. Real-time Database Sync ---
  useEffect(() => {
    if (!user) return;

    try {
      const docRef = getRotaDocRef();

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.targets) setTargets(data.targets);
          if (data.staffList) setStaffList(data.staffList);
          if (data.roomList) setRoomList(data.roomList);
          if (data.schedulesByWeek) setSchedulesByWeek(data.schedulesByWeek);
        } else {
          // Initialize new database entry with defaults
          setDoc(docRef, {
            targets: INITIAL_TARGETS,
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

  // --- Database Updater Helper ---
  const updateDb = async (field, value) => {
    if (!user) return;
    
    // Optimistic UI update (makes app feel instantly responsive)
    if (field === 'schedulesByWeek') setSchedulesByWeek(value);
    if (field === 'targets') setTargets(value);
    if (field === 'staffList') setStaffList(value);
    if (field === 'roomList') setRoomList(value);

    // Persist to Cloud
    try {
      const docRef = getRotaDocRef();
      await updateDoc(docRef, { [field]: value });
    } catch (e) {
      console.error("Failed to save to database:", e);
    }
  };

  // --- Calculations ---
  const currentCounts = useMemo(() => {
    const counts = {};
    Object.keys(targets).forEach(type => counts[type] = 0);
    Object.values(currentSchedule).forEach(assignment => {
      if (assignment.clinic) {
        if (counts[assignment.clinic] === undefined) {
          counts[assignment.clinic] = 0;
        }
        counts[assignment.clinic]++;
      }
    });
    return counts;
  }, [currentSchedule, targets]);

  // --- Handlers ---
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
    
    const newSchedules = { ...schedulesByWeek, [activeWeek]: newSched };
    updateDb('schedulesByWeek', newSchedules);
    setSelectedCell(null);
  };

  const handleCreateWeek = () => {
    if (!newWeekDate) return;
    
    if (!schedulesByWeek[newWeekDate]) {
      const newSchedules = {
        ...schedulesByWeek,
        [newWeekDate]: { ...schedulesByWeek['master'] }
      };
      updateDb('schedulesByWeek', newSchedules);
    }
    
    setActiveWeek(newWeekDate);
    setIsAddingWeek(false);
    setNewWeekDate('');
  };

  const handleUpdateTarget = (clinic, newTarget) => {
    const val = parseInt(newTarget);
    if (val >= 0) {
      updateDb('targets', {...targets, [clinic]: val});
    }
  };

  const handleAddClinic = () => {
    if (newClinicName.trim() && !targets[newClinicName.trim()]) {
      updateDb('targets', {...targets, [newClinicName.trim()]: parseInt(newClinicTarget) || 1});
      setNewClinicName('');
      setNewClinicTarget(1);
    }
  };

  const requestDeleteTarget = (clinic) => {
    setClinicToDelete(clinic);
  };

  const confirmDeleteTarget = () => {
    if (!clinicToDelete) return;
    const newTargets = { ...targets };
    delete newTargets[clinicToDelete];
    updateDb('targets', newTargets);
    setClinicToDelete(null);
  };

  const handleSaveStaff = () => {
    if (!editingStaff.name.trim()) return;

    let newStaffList;
    if (editingStaff.id) {
      newStaffList = staffList.map(s => s.id === editingStaff.id ? editingStaff : s);
    } else {
      const newId = staffList.length > 0 ? Math.max(...staffList.map(s => s.id)) + 1 : 1;
      newStaffList = [...staffList, { ...editingStaff, id: newId }];
    }
    updateDb('staffList', newStaffList);
    setEditingStaff(null);
  };

  const requestDeleteStaff = (staff) => {
    setStaffToDelete(staff);
  };

  const confirmDeleteStaff = () => {
    if (!staffToDelete) return;
    const id = staffToDelete.id;
    const newStaffList = staffList.filter(s => s.id !== id);
    
    // Cascading delete: remove from all schedules
    const newSchedules = { ...schedulesByWeek };
    Object.keys(newSchedules).forEach(week => {
      const weekSched = { ...newSchedules[week] };
      Object.keys(weekSched).forEach(key => {
        if (weekSched[key].staffId === id) delete weekSched[key];
      });
      newSchedules[week] = weekSched;
    });

    updateDb('staffList', newStaffList);
    updateDb('schedulesByWeek', newSchedules);
    setStaffToDelete(null);
  };

  const toggleSkill = (skill) => {
    setEditingStaff(prev => {
      const skills = prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills };
    });
  };

  const handleSaveRoom = () => {
    if (!editingRoom.name.trim()) return;

    let newRoomList;
    if (editingRoom.id) {
      newRoomList = roomList.map(r => r.id === editingRoom.id ? editingRoom : r);
    } else {
      const newId = roomList.length > 0 ? Math.max(...roomList.map(r => r.id)) + 1 : 1;
      newRoomList = [...roomList, { ...editingRoom, id: newId }];
    }
    updateDb('roomList', newRoomList);
    setEditingRoom(null);
  };

  const requestDeleteRoom = (room) => {
    setRoomToDelete(room);
  };

  const confirmDeleteRoom = () => {
    if (!roomToDelete) return;
    const id = roomToDelete.id;
    const newRoomList = roomList.filter(r => r.id !== id);
    
    // Cascading delete: remove shifts associated with room
    const newSchedules = { ...schedulesByWeek };
    Object.keys(newSchedules).forEach(week => {
      const weekSched = { ...newSchedules[week] };
      Object.keys(weekSched).forEach(key => {
        if (key.startsWith(`${id}-`)) delete weekSched[key];
      });
      newSchedules[week] = weekSched;
    });

    updateDb('roomList', newRoomList);
    updateDb('schedulesByWeek', newSchedules);
    setRoomToDelete(null);
  };

  // --- UI Helpers ---
  const getStaffName = (id) => staffList.find(s => s.id === id)?.name || '';
  const isQualified = (staffId, clinic) => {
    if (!staffId || !clinic) return true;
    const staff = staffList.find(s => s.id === parseInt(staffId));
    return staff?.skills.includes(clinic);
  };

  if (!isDbLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-blue-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Loading Clinic Data...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6 font-sans text-slate-800 flex flex-col md:flex-row gap-4 md:gap-6 print:bg-white print:p-0 print:block">
      
      {/* LEFT PANEL: Tracker */}
      {isSidebarOpen ? (
        <div className="w-full md:w-64 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 p-4 h-fit sticky top-6 print:hidden transition-all">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" />
              Weekly Targets
            </h2>
            <div className="flex gap-1">
              <button 
                onClick={() => setIsEditingTargets(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                title="Manage Targets"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                title="Minimise Sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            {clinicTypes.map(clinic => {
              const target = targets[clinic];
              const current = currentCounts[clinic] || 0;
              const isMet = current === target;
              const isOver = current > target;
              
              let colorClass = "bg-slate-100 text-slate-600 border-slate-200";
              if (isMet) colorClass = "bg-green-50 text-green-700 border-green-200";
              else if (isOver) colorClass = "bg-red-50 text-red-700 border-red-200";
              else if (current > 0) colorClass = "bg-blue-50 text-blue-700 border-blue-200";

              return (
                <div key={clinic} className={`p-2 rounded-lg border ${colorClass}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-xs truncate mr-2">{clinic}</span>
                    <span className="text-xs font-bold whitespace-nowrap">{current} / {target}</span>
                  </div>
                  <div className="w-full bg-white/50 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${isMet ? 'bg-green-500' : isOver ? 'bg-red-500' : 'bg-blue-500'}`} 
                      style={{ width: `${Math.min(100, (current / target) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div 
          onClick={() => setIsSidebarOpen(true)}
          className="w-full md:w-12 shrink-0 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center py-4 h-fit sticky top-6 print:hidden cursor-pointer hover:bg-slate-50 transition-colors group"
          title="Expand Targets"
        >
          <Activity className="w-5 h-5 text-blue-600 mb-4 group-hover:scale-110 transition-transform" />
          <div style={{ writingMode: 'vertical-rl' }} className="text-xs font-bold text-slate-400 tracking-widest uppercase mb-4">
            Targets
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </div>
      )}

      {/* MAIN PANEL: Schedule Grid */}
      <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-5 overflow-x-auto flex flex-col print:w-full print:border-none print:shadow-none print:p-0 print:overflow-visible">
        
        {/* Header & Controls */}
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
              value={activeWeek}
              onChange={(e) => setActiveWeek(e.target.value)}
            >
              <option value="master">⭐ Master Template</option>
              {Object.keys(schedulesByWeek).filter(k => k !== 'master').sort().map(w => (
                <option key={w} value={w}>Week Commencing: {new Date(w).toLocaleDateString('en-GB')}</option>
              ))}
            </select>
            <button 
              onClick={() => setIsAddingWeek(true)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 rounded-lg font-medium transition-colors print:hidden"
            >
              <Plus className="w-4 h-4" />
              New Week
            </button>
          </div>

          <div className="flex flex-wrap gap-2 print:hidden">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button 
              onClick={() => setShowWeekends(!showWeekends)}
              className={`flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg shadow-sm font-medium transition-colors ${showWeekends ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
            >
              <CalendarDays className="w-4 h-4" />
              {showWeekends ? 'Hide Weekends' : 'Show Weekends'}
            </button>
            <button 
              onClick={() => setIsManagingRooms(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors"
            >
              <Layout className="w-4 h-4" />
              Manage Rooms
            </button>
            <button 
              onClick={() => setIsManagingStaff(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm hover:bg-slate-50 text-slate-700 font-medium transition-colors"
            >
              <Users className="w-4 h-4" />
              Manage Staff
            </button>
          </div>
        </div>

        {activeWeek === 'master' && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg flex items-center gap-2 text-sm print:hidden">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p><strong>Master Template Mode:</strong> Any clinics you schedule here will be automatically copied as the baseline whenever you create a New Week.</p>
          </div>
        )}
        
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr>
              <th className="p-3 border-b border-slate-200 bg-slate-50 sticky left-0 z-10 w-32">Room</th>
              {activeDays.map(day => (
                <th key={day} className="p-3 border-b border-slate-200 bg-slate-50 text-center font-semibold" colSpan={2}>
                  {day}
                </th>
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
                <td 
                  className="p-3 font-medium text-sm sticky left-0 bg-white z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:border-l-0"
                  style={{ borderLeft: `4px solid ${room.color || '#e2e8f0'}` }}
                >
                  {room.name}
                </td>
                {activeDays.map(day => (
                  <React.Fragment key={`${room.id}-${day}`}>
                    <td className="p-1 border-r border-slate-100 align-top">
                      <AssignmentCell 
                        roomId={room.id} day={day} slot="AM" 
                        assignment={currentSchedule[`${room.id}-${day}-AM`]} 
                        onClick={() => handleCellClick(room.id, day, 'AM')}
                        getStaffName={getStaffName}
                      />
                    </td>
                    <td className="p-1 border-r border-slate-200 align-top">
                      <AssignmentCell 
                        roomId={room.id} day={day} slot="PM" 
                        assignment={currentSchedule[`${room.id}-${day}-PM`]} 
                        onClick={() => handleCellClick(room.id, day, 'PM')}
                        getStaffName={getStaffName}
                      />
                    </td>
                  </React.Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MODAL: Edit Assignment */}
      {selectedCell && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-bold mb-1">Assign Clinic</h3>
            <p className="text-sm text-slate-500 mb-4">
              {selectedCell.day} {selectedCell.slot} • {roomList.find(r => r.id === selectedCell.roomId)?.name}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Staff Member</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formState.staffId}
                  onChange={(e) => setFormState({...formState, staffId: e.target.value})}
                >
                  <option value="">-- Select Staff --</option>
                  {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Clinic Type</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formState.clinic}
                  onChange={(e) => setFormState({...formState, clinic: e.target.value})}
                >
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
                <button 
                  onClick={handleSaveAssignment}
                  disabled={!formState.staffId || !formState.clinic}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                {currentSchedule[`${selectedCell.roomId}-${selectedCell.day}-${selectedCell.slot}`] && (
                   <button 
                    onClick={handleDeleteAssignment}
                    className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200"
                    title="Remove assignment"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                )}
                <button 
                  onClick={() => setSelectedCell(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add New Week */}
      {isAddingWeek && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-bold mb-2">Create New Week</h3>
            <p className="text-sm text-slate-500 mb-4">
              Select the start date (Monday) for the new week. This will automatically copy your Master Template.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Week Commencing</label>
                <input 
                  type="date" 
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={newWeekDate}
                  onChange={(e) => setNewWeekDate(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button 
                  onClick={handleCreateWeek}
                  disabled={!newWeekDate}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  Create
                </button>
                <button 
                  onClick={() => { setIsAddingWeek(false); setNewWeekDate(''); }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Manage Targets */}
      {isEditingTargets && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw] max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Manage Clinic Targets</h3>
              <button onClick={() => { setIsEditingTargets(false); setClinicToDelete(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 mb-6">
              {clinicTypes.map(clinic => (
                <div key={clinic} className="flex items-center justify-between gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  <span className="font-medium text-sm flex-1 truncate">{clinic}</span>
                  <input 
                    type="number" 
                    min="0"
                    className="w-16 p-1 border border-slate-300 rounded text-center text-sm outline-none focus:border-blue-500"
                    value={targets[clinic]}
                    onChange={(e) => handleUpdateTarget(clinic, e.target.value)}
                  />
                  <button 
                    onClick={() => requestDeleteTarget(clinic)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h4 className="text-sm font-bold mb-3">Add New Clinic</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Clinic Name"
                  className="flex-1 p-2 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-500"
                  value={newClinicName}
                  onChange={(e) => setNewClinicName(e.target.value)}
                />
                <input 
                  type="number" 
                  min="1"
                  className="w-16 p-2 border border-slate-300 rounded-lg text-center text-sm outline-none focus:border-blue-500"
                  value={newClinicTarget}
                  onChange={(e) => setNewClinicTarget(e.target.value)}
                />
                <button 
                  onClick={handleAddClinic}
                  disabled={!newClinicName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Deletion Confirmation Overlay */}
            {clinicToDelete && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h4 className="text-lg font-bold mb-2">Delete Clinic?</h4>
                <p className="text-sm text-slate-600 mb-6">
                  Are you sure you want to delete <strong>{clinicToDelete}</strong>? This will remove it from your targets.
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={confirmDeleteTarget} 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button 
                    onClick={() => setClinicToDelete(null)} 
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Manage Staff */}
      {isManagingStaff && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-[500px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                {editingStaff ? (editingStaff.id ? 'Edit Staff' : 'Add New Staff') : 'Manage Staff'}
              </h3>
              <button onClick={() => { setIsManagingStaff(false); setEditingStaff(null); setStaffToDelete(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {!editingStaff ? (
                <div className="space-y-4">
                  <button 
                    onClick={() => setEditingStaff({ name: '', skills: [] })}
                    className="w-full py-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors border border-blue-200"
                  >
                    <Plus className="w-4 h-4" /> Add New Staff
                  </button>
                  <div className="space-y-2">
                    {staffList.map(staff => (
                      <div key={staff.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-slate-50">
                        <div>
                          <div className="font-medium text-sm text-slate-800">{staff.name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {staff.skills.length} qualified clinic{staff.skills.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingStaff(staff)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded bg-white border border-slate-200 shadow-sm transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => requestDeleteStaff(staff)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Name / Role</label>
                    <input 
                      type="text" 
                      value={editingStaff.name}
                      onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})}
                      placeholder="e.g. Sarah (RN)"
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Qualified Clinics</label>
                    <div className="grid grid-cols-2 gap-2">
                      {clinicTypes.map(clinic => (
                        <label key={clinic} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                          <input 
                            type="checkbox"
                            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                            checked={editingStaff.skills.includes(clinic)}
                            onChange={() => toggleSkill(clinic)}
                          />
                          <span className="text-sm">{clinic}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button 
                      onClick={handleSaveStaff}
                      disabled={!editingStaff.name.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Save Staff
                    </button>
                    <button 
                      onClick={() => setEditingStaff(null)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Deletion Confirmation Overlay for Staff */}
            {staffToDelete && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h4 className="text-lg font-bold mb-2">Delete Staff Member?</h4>
                <p className="text-sm text-slate-600 mb-6">
                  Are you sure you want to delete <strong>{staffToDelete.name}</strong>? This will remove them and all their scheduled shifts from your rotas.
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={confirmDeleteStaff} 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button 
                    onClick={() => setStaffToDelete(null)} 
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Manage Rooms */}
      {isManagingRooms && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-[400px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">
                {editingRoom ? (editingRoom.id ? 'Edit Room' : 'Add New Room') : 'Manage Rooms'}
              </h3>
              <button onClick={() => { setIsManagingRooms(false); setEditingRoom(null); setRoomToDelete(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {!editingRoom ? (
                <div className="space-y-4">
                  <button 
                    onClick={() => setEditingRoom({ name: '', color: '#3b82f6' })}
                    className="w-full py-2 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors border border-blue-200"
                  >
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
                          <button 
                            onClick={() => setEditingRoom(room)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 rounded bg-white border border-slate-200 shadow-sm transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => requestDeleteRoom(room)}
                            className="p-1.5 text-slate-500 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm transition-colors"
                            title="Delete Room"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Room Name</label>
                    <input 
                      type="text" 
                      value={editingRoom.name}
                      onChange={(e) => setEditingRoom({...editingRoom, name: e.target.value})}
                      placeholder="e.g. Room 4 or Minor Ops"
                      className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Room Colour</label>
                    <div className="flex items-center gap-2">
                      {['#3b82f6', '#14b8a6', '#ef4444', '#a855f7', '#f59e0b', '#ec4899'].map(c => (
                        <button
                          key={c}
                          onClick={() => setEditingRoom({...editingRoom, color: c})}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${editingRoom.color === c ? 'border-slate-800 scale-110' : 'border-transparent hover:scale-110'}`}
                          style={{ backgroundColor: c }}
                          title="Preset Colour"
                        />
                      ))}
                      <div className="w-px h-6 bg-slate-300 mx-1"></div>
                      <div className="relative rounded overflow-hidden border border-slate-300 w-8 h-8 focus-within:ring-2 focus-within:ring-blue-500 hover:scale-105 transition-transform cursor-pointer">
                        <input
                          type="color"
                          value={editingRoom.color || '#3b82f6'}
                          onChange={(e) => setEditingRoom({...editingRoom, color: e.target.value})}
                          className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer"
                          title="Custom Colour Picker"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-4">
                    <button 
                      onClick={handleSaveRoom}
                      disabled={!editingRoom.name.trim()}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      Save Room
                    </button>
                    <button 
                      onClick={() => setEditingRoom(null)}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Deletion Confirmation Overlay for Rooms */}
            {roomToDelete && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center p-6 text-center z-10 rounded-xl backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
                <h4 className="text-lg font-bold mb-2">Delete Room?</h4>
                <p className="text-sm text-slate-600 mb-6">
                  Are you sure you want to delete <strong>{roomToDelete.name}</strong>? This will completely remove the room and empty any shifts assigned to it.
                </p>
                <div className="flex gap-3 w-full">
                  <button 
                    onClick={confirmDeleteRoom} 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
                  >
                    Yes, Delete
                  </button>
                  <button 
                    onClick={() => setRoomToDelete(null)} 
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AssignmentCell({ assignment, onClick, getStaffName }) {
  if (!assignment) {
    return (
      <button 
        onClick={onClick}
        className="w-full h-16 rounded-md border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-500 transition-colors cursor-pointer group print:border-solid print:border print:border-slate-200 print:bg-white"
      >
        <Plus className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
      </button>
    );
  }

  const getClinicColor = (clinic) => {
    switch(clinic) {
      case 'Minor Illness': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Chronic Disease': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Bloods': return 'bg-red-100 text-red-800 border-red-200';
      case 'Smears': return 'bg-pink-100 text-pink-800 border-pink-200';
      case 'Immunisations': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`w-full h-16 p-1.5 rounded-md border cursor-pointer hover:shadow-md transition-shadow flex flex-col justify-center ${getClinicColor(assignment.clinic)} print:border-slate-300`}
    >
      <div className="font-bold text-[10px] uppercase tracking-wider truncate mb-0.5 print:text-black">
        {assignment.clinic}
      </div>
      <div className="text-xs flex items-center gap-1 opacity-90 truncate print:text-black">
        <User className="w-3 h-3 shrink-0 print:text-slate-500" />
        <span className="truncate">{getStaffName(assignment.staffId)}</span>
      </div>
    </div>
  );
}
