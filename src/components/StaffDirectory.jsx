import React, { useState, useEffect } from 'react';
import { Contact, Search, Plus, Trash2, X, AlertCircle, Loader2, CalendarDays, CheckCircle, Moon, Clock, Printer } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef } from '../firebase';
import { INITIAL_UNIFIED_STAFF, INITIAL_TARGETS, INITIAL_CLINIC_COLORS, INITIAL_ROOMS, WEEKDAYS, WEEKENDS } from '../constants';

export default function StaffDirectory() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  
  const [staffList, setStaffList] = useState(INITIAL_UNIFIED_STAFF);
  const [schedulesByWeek, setSchedulesByWeek] = useState({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [editingStaff, setEditingStaff] = useState(null);
  const [staffToDelete, setStaffToDelete] = useState(null);
  const [showWeekends, setShowWeekends] = useState(false);

  const activeDays = showWeekends ? [...WEEKDAYS, ...WEEKENDS] : WEEKDAYS;

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
      contractedHours: parseFloat(editingStaff.contractedHours) || 0,
      requiresWeekends: editingStaff.requiresWeekends || false,
      schedule: editingStaff.schedule || {}
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

  const updateSchedule = (day, field, value) => {
    setEditingStaff(prev => ({
      ...prev,
      schedule: {
        ...(prev.schedule || {}),
        [day]: {
          ...(prev.schedule?.[day] || {}),
          [field]: value
        }
      }
    }));
  };

  const calculateHours = (start, end) => {
    if (!start || !end) return { gross: 0, net: 0, isEA: false };
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    
    let gross = (endH + endM / 60) - (startH + startM / 60);
    if (gross < 0) gross += 24; 
    
    const net = gross > 6 ? gross - 1 : gross;
    const isEA = endH >= 18 && (endH > 18 || endM > 0); 
    
    return { gross, net, isEA };
  };

  const calculateWeeklyCompliance = (staff) => {
    let totalNet = 0;
    [...WEEKDAYS, ...WEEKENDS].forEach(day => {
      const daySched = staff.schedule?.[day];
      if (daySched?.start && daySched?.end) {
        totalNet += calculateHours(daySched.start, daySched.end).net;
      }
    });
    const target = staff.contractedHours || 0;
    const diff = totalNet - target;
    return { totalNet, target, diff, isMet: totalNet >= target };
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
    <div className="flex-1 bg-gray-50 min-h-full font-sans text-slate-800 p-4 md:p-8 overflow-x-auto print:bg-white print:p-0 print:overflow-visible">
      
      {/* Injecting Aggressive CSS specifically for ultra-compact A4 Landscape PDF Printing */}
      <style>
        {`
          @media print {
            @page { size: A4 landscape; margin: 4mm; }
            body { 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 2px 4px !important; }
            * { line-height: 1.1 !important; }
          }
        `}
      </style>

      <div className="min-w-[1000px] print:min-w-full print:w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 print:mb-2 print:flex-row print:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 print:text-base print:leading-none">
              <Contact className="w-7 h-7 text-indigo-600 print:hidden" />
              Staff Directory & Hours
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1 print:text-[9px] print:mt-1 print:leading-none">Manage personnel, view weekly working hours, and track compliance.</p>
          </div>
          
          {/* Action Buttons (Hidden on Print) */}
          <div className="flex items-center gap-3 w-full md:w-auto print:hidden flex-wrap">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-300 rounded-lg font-medium shadow-sm transition-all"
              title="Save as PDF or Print"
            >
              <Printer className="w-4 h-4" /> Export PDF
            </button>
            <button 
              onClick={() => setShowWeekends(!showWeekends)} 
              className={`flex items-center gap-2 px-3 py-2 text-sm border rounded-lg shadow-sm font-medium transition-colors ${showWeekends ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}`}
            >
              <CalendarDays className="w-4 h-4" /> {showWeekends ? 'Hide Weekends' : 'Show Weekends'}
            </button>
            <div className="relative flex-1 md:w-64 min-w-[200px]">
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
              onClick={() => setEditingStaff({ name: '', role: 'Nurse', status: 'Active', contractedHours: 37.5, requiresWeekends: false, schedule: {} })} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold shadow-sm hover:bg-indigo-700 transition-all whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> Add Staff
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden print:border-none print:shadow-none print:overflow-visible">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 print:bg-white print:border-slate-300">
                <th className="p-4 font-bold text-slate-700 sticky left-0 bg-slate-50 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] w-48 print:shadow-none print:bg-white print:static print:w-auto print:p-1 print:text-[10px]">Staff Member</th>
                {activeDays.map(day => (
                  <th key={day} className="p-4 font-bold text-slate-700 text-center border-l border-slate-200 min-w-[120px] print:min-w-0 print:border-slate-300 print:p-1 print:text-[10px]">{day}</th>
                ))}
                <th className="p-4 font-bold text-slate-700 text-center border-l border-slate-200 w-32 print:border-slate-300 print:p-1 print:text-[10px]">Compliance</th>
                <th className="p-4 font-bold text-slate-700 text-right w-16 print:hidden"></th>
              </tr>
            </thead>
            <tbody>
              {filteredStaff.length > 0 ? filteredStaff.map(staff => {
                const compliance = calculateWeeklyCompliance(staff);
                return (
                  <tr key={staff.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors print:break-inside-avoid print:border-slate-300 ${staff.status === 'Archived' ? 'bg-slate-50/50 opacity-60' : ''}`}>
                    
                    {/* Staff Name Cell */}
                    <td 
                      className="p-4 sticky left-0 bg-white z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] cursor-pointer group print:shadow-none print:static print:align-middle print:p-1"
                      onClick={() => setEditingStaff(staff)}
                      title="Click to edit staff details"
                    >
                      <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors print:text-[10px] print:leading-tight flex items-center flex-wrap gap-1">
                        {staff.name} 
                        <span className="text-[10px] text-slate-500 font-normal hidden print:inline">({staff.role})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 print:hidden">{staff.role}</div>
                      
                      {(staff.requiresWeekends || staff.status === 'Archived') && (
                        <div className="flex flex-wrap gap-1 mt-1.5 print:mt-0.5">
                          {staff.requiresWeekends && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider print:border print:border-amber-300 print:text-[7px] print:py-0 print:px-1 print:leading-tight">Weekend</span>}
                          {staff.status === 'Archived' && <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider print:border print:border-slate-300 print:text-[7px] print:py-0 print:px-1 print:leading-tight">Archived</span>}
                        </div>
                      )}
                    </td>
                    
                    {/* Schedule Cells */}
                    {activeDays.map(day => {
                      const sched = staff.schedule?.[day];
                      if (!sched?.start || !sched?.end) {
                        return <td key={day} className="p-2 border-l border-slate-100 align-middle text-center print:border-slate-300 print:p-1"><span className="text-slate-300 text-xs font-medium print:text-[9px] print:leading-none">Off</span></td>;
                      }
                      
                      const { gross, net, isEA } = calculateHours(sched.start, sched.end);
                      return (
                        <td key={day} className="p-2 border-l border-slate-100 align-middle print:border-slate-300 print:p-1">
                          <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 h-full relative group hover:border-indigo-200 transition-colors print:bg-transparent print:border-none print:p-0 text-center">
                            
                            <div className="font-bold text-slate-800 mb-1 print:text-[10px] print:mb-0 print:leading-tight">{sched.start} - {sched.end}</div>
                            
                            <div className="text-[10px] text-slate-500 print:text-[9px] print:leading-tight">
                              <span className="print:hidden flex justify-between px-1">
                                <span>Gross: {gross.toFixed(1)}h</span>
                                <span className="font-bold text-indigo-600">Net: {net.toFixed(1)}h</span>
                              </span>
                              <span className="hidden print:block font-bold text-slate-800 print:font-medium">
                                Net: {net.toFixed(1)}h {isEA && <span className="font-bold text-indigo-600 ml-0.5 print:text-[8px]">(EA)</span>}
                              </span>
                            </div>

                            {isEA && (
                              <div className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm print:hidden" title="Evening Access">
                                <Moon className="w-2.5 h-2.5" /> EA
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Compliance Cell */}
                    <td className="p-3 border-l border-slate-100 align-middle print:border-slate-300 print:p-1">
                      <div className={`p-2 rounded-lg border flex flex-col items-center justify-center text-center print:bg-transparent print:border-none print:p-0 ${compliance.isMet ? 'bg-emerald-50 border-emerald-200 text-emerald-800 print:text-slate-800' : 'bg-rose-50 border-rose-200 text-rose-800 print:text-slate-800'}`}>
                        <div className="flex items-baseline gap-1 print:gap-0.5">
                          <span className="text-lg font-black print:text-[11px] print:leading-tight">{compliance.totalNet.toFixed(1)}</span>
                          <span className="text-xs opacity-70 print:text-[9px] print:leading-tight">/ {compliance.target}h</span>
                        </div>
                        {compliance.isMet ? (
                          <span className="text-[10px] font-bold mt-1 flex items-center gap-1 text-emerald-600 print:text-slate-600 print:text-[9px] print:mt-0 print:leading-tight"><CheckCircle className="w-3 h-3 print:hidden" /> Met</span>
                        ) : (
                          <span className="text-[10px] font-bold mt-1 flex items-center gap-1 text-rose-600 print:text-slate-600 print:text-[9px] print:mt-0 print:leading-tight"><AlertCircle className="w-3 h-3 print:hidden" /> {Math.abs(compliance.diff).toFixed(1)}h short</span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-right align-middle print:hidden">
                      <button onClick={() => setStaffToDelete(staff)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                );
              }) : (
                <tr><td colSpan={activeDays.length + 3} className="p-8 text-center text-slate-500">No staff found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* MODALS REMAIN UNCHANGED AND ARE HIDDEN DURING PRINT AUTOMATICALLY VIA tailwind print:hidden */}
        {editingStaff && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
            <div className="bg-white rounded-xl shadow-xl w-[700px] max-w-[95vw] max-h-[90vh] flex flex-col relative">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold">{editingStaff.id ? 'Edit Staff & Hours' : 'Add New Staff'}</h3>
                <button onClick={() => setEditingStaff(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
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
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Contracted Hours</label>
                    <input type="number" step="0.5" value={editingStaff.contractedHours || 0} onChange={(e) => setEditingStaff({...editingStaff, contractedHours: e.target.value})} className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">System Status</label>
                    <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" value={editingStaff.status || 'Active'} onChange={(e) => setEditingStaff({...editingStaff, status: e.target.value})}>
                      <option value="Active">Active Employee</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                  <div className="flex items-center md:mt-6">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-700">
                      <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded" checked={editingStaff.requiresWeekends || false} onChange={(e) => setEditingStaff({...editingStaff, requiresWeekends: e.target.checked})} />
                      Contract includes Weekends
                    </label>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2 border-b border-slate-100 pb-2"><Clock className="w-4 h-4 text-indigo-600" /> Standard Working Hours</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                    {[...WEEKDAYS, ...WEEKENDS].map(day => (
                      <div key={day} className="flex items-center gap-2">
                        <span className="w-24 text-sm font-medium text-slate-600">{day}</span>
                        <input 
                          type="time" 
                          className="flex-1 p-1.5 border border-slate-300 rounded outline-none focus:border-indigo-500 text-sm"
                          value={editingStaff.schedule?.[day]?.start || ''} 
                          onChange={(e) => updateSchedule(day, 'start', e.target.value)} 
                        />
                        <span className="text-slate-400 text-sm">-</span>
                        <input 
                          type="time" 
                          className="flex-1 p-1.5 border border-slate-300 rounded outline-none focus:border-indigo-500 text-sm"
                          value={editingStaff.schedule?.[day]?.end || ''} 
                          onChange={(e) => updateSchedule(day, 'end', e.target.value)} 
                        />
                        <button 
                          onClick={() => { updateSchedule(day, 'start', ''); updateSchedule(day, 'end', ''); }}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                          title="Clear Day"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-4 italic">* Note: 1 hour is automatically deducted for break time on shifts over 6 hours long.</p>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
                <button onClick={() => setEditingStaff(null)} className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold transition-colors hover:bg-slate-50">Cancel</button>
                <button onClick={handleSaveStaff} disabled={!editingStaff.name.trim()} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-colors disabled:opacity-50 shadow-sm">Save Profile & Hours</button>
              </div>
            </div>
          </div>
        )}

        {staffToDelete && (
          <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
            <div className="bg-white rounded-xl shadow-xl p-6 w-96 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h4 className="text-lg font-bold mb-2">Wipe Staff Data?</h4>
              <p className="text-sm text-slate-600 mb-6">Are you sure you want to completely delete <strong>{staffToDelete.name}</strong> from the database?</p>
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
