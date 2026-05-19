import React, { useState, useEffect } from 'react';
import { Contact, Search, Plus, Edit2, Trash2, X, AlertCircle, Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef } from '../firebase';
import { INITIAL_UNIFIED_STAFF, INITIAL_TARGETS, INITIAL_CLINIC_COLORS, INITIAL_ROOMS } from '../constants';

export default function StaffDirectory() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  const [staffList, setStaffList] = useState(INITIAL_UNIFIED_STAFF);
  const [targets, setTargets] = useState(INITIAL_TARGETS);
  const [clinicColors, setClinicColors] = useState(INITIAL_CLINIC_COLORS);
  const [schedulesByWeek, setSchedulesByWeek] = useState({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffToDelete, setStaffToDelete] = useState(null);

  const clinicTypes = Object.keys(targets).sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const unsubscribe = onSnapshot(getRotaDocRef(), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.staffList) setStaffList(data.staffList);
          if (data.targets) setTargets(data.targets);
          if (data.clinicColors) setClinicColors(data.clinicColors);
          if (data.schedulesByWeek) setSchedulesByWeek(data.schedulesByWeek);
        } else {
          setDoc(getRotaDocRef(), {
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
    try {
      await updateDoc(getRotaDocRef(), { [field]: value });
    } catch (e) { console.error("Database save failed:", e); }
  };

  const handleSaveStaff = () => {
    if (!editingStaff.name.trim()) return;
    
    const staffToSave = {
      ...editingStaff,
      records: editingStaff.records || {},
      skills: editingStaff.skills || [],
      role: editingStaff.role || 'Nurse',
      status: editingStaff.status || 'Active',
      remarks: editingStaff.remarks || ''
    };

    let newStaffList = editingStaff.id 
      ? staffList.map(s => s.id === editingStaff.id ? staffToSave : s)
      : [...staffList, { ...staffToSave, id: Math.max(0, ...staffList.map(s => s.id)) + 1 }];
    
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

    const newStaffList = staffList.filter(s => s.id !== id);
    
    updateDb('staffList', newStaffList);
    updateDb('schedulesByWeek', newSchedules);
    setStaffToDelete(null);
  };

  const toggleSkill = (skill) => {
    setEditingStaff(prev => ({
      ...prev, 
      skills: prev.skills.includes(skill) ? prev.skills.filter(s => s !== skill) : [...prev.skills, skill]
    }));
  };

  const filteredStaff = staffList.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center text-indigo-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Contact className="w-7 h-7 text-indigo-600" />
              Staff Directory
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Centralised personnel database for Rotas and Training.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search staff..." 
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button 
              onClick={() => setEditingStaff({ name: '', role: 'Nurse', status: 'Active', skills: [], records: {}, remarks: '' })} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow-sm hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-bold text-slate-700">Staff Member</th>
                <th className="p-4 font-bold text-slate-700">Role</th>
                <th className="p-4 font-bold text-slate-700 w-1/3">Qualified Clinics</th>
                <th className="p-4 font-bold text-slate-700">Remarks</th>
                <th className="p-4 font-bold text-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length > 0 ? filteredStaff.map(staff => (
                <tr key={staff.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${staff.status === 'Archived' ? 'bg-slate-50/50' : ''}`}>
                  <td className="p-4">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      {staff.name}
                      {staff.status === 'Archived' && <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded uppercase tracking-wider font-bold">Archived</span>}
                    </div>
                  </td>
                  <td className="p-4 font-medium text-slate-600">{staff.role || 'Nurse'}</td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {staff.skills && staff.skills.length > 0 ? staff.skills.map(skill => (
                        <span key={skill} className="text-[10px] font-bold px-2 py-1 rounded-md bg-opacity-10 border" style={{ backgroundColor: `${clinicColors[skill] || '#3b82f6'}22`, color: clinicColors[skill] || '#3b82f6', borderColor: `${clinicColors[skill] || '#3b82f6'}44` }}>
                          {skill}
                        </span>
                      )) : <span className="text-xs text-slate-400 italic">No clinics assigned</span>}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-slate-500 italic max-w-xs truncate">{staff.remarks || '-'}</td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setEditingStaff(staff)} className="p-1.5 text-slate-500 hover:text-indigo-600 rounded bg-white border border-slate-200 shadow-sm"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => setStaffToDelete(staff)} className="p-1.5 text-slate-500 hover:text-red-600 rounded bg-white border border-slate-200 shadow-sm"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="5" className="p-8 text-center text-slate-500">No staff found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editingStaff && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
            <div className="bg-white rounded-xl shadow-xl w-[600px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold">{editingStaff.id ? 'Edit Staff Profile' : 'Add New Staff'}</h3>
                <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium mb-1">Full Name</label>
                    <input type="text" value={editingStaff.name} onChange={(e) => setEditingStaff({...editingStaff, name: e.target.value})} placeholder="e.g. Sarah Jones" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Role</label>
                    <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.role} onChange={(e) => setEditingStaff({...editingStaff, role: e.target.value})}>
                      <option value="Nurse">Nurse</option>
                      <option value="HCA">HCA</option>
                      <option value="ANP">ANP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">System Status</label>
                    <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.status || 'Active'} onChange={(e) => setEditingStaff({...editingStaff, status: e.target.value})}>
                      <option value="Active">Active Employee</option>
                      <option value="Archived">Archived (Left Practice)</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium mb-2">Qualified Clinics (For Rota Manager)</label>
                  <div className="grid grid-cols-2 gap-2">
                    {clinicTypes.map(clinic => (
                      <label key={clinic} className="flex items-center gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" className="rounded text-indigo-600 w-4 h-4" checked={editingStaff.skills?.includes(clinic)} onChange={() => toggleSkill(clinic)} />
                        <span className="text-sm font-medium" style={{ color: clinicColors[clinic] || '#333' }}>{clinic}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <label className="block text-sm font-medium mb-1">General Remarks (Optional)</label>
                  <input type="text" value={editingStaff.remarks || ''} onChange={(e) => setEditingStaff({...editingStaff, remarks: e.target.value})} placeholder="e.g. Requires updated bloods certificate" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 rounded-b-xl">
                <button onClick={() => setEditingStaff(null)} className="flex-1 bg-white border border-slate-300 text-slate-700 py-2 rounded-lg font-bold transition-colors hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveStaff} disabled={!editingStaff.name.trim()} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold transition-colors disabled:opacity-50 shadow-sm">Save Profile</button>
              </div>
            </div>
          </div>
        )}

        {staffToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
            <div className="bg-white rounded-xl shadow-xl p-6 w-96 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h4 className="text-lg font-bold mb-2">Wipe Staff Data?</h4>
              <p className="text-sm text-slate-600 mb-6">Are you sure you want to completely delete <strong>{staffToDelete.name}</strong> from the database? <br/><br/>(Tip: Edit them and set their status to "Archived" instead if you want to keep their training history!)</p>
              <div className="flex gap-3 w-full">
                <button onClick={confirmDeleteStaff} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-bold transition-colors">Yes, Wipe Data</button>
                <button onClick={() => setStaffToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
