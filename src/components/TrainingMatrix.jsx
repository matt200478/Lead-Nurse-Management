import React, { useState, useEffect } from 'react';
import { GraduationCap, Search, Download, Printer, BookOpen, Users, Activity, UserCheck, AlertTriangle, AlertCircle, Archive, CheckCircle, XCircle, Clock, X, Plus, Trash2, Edit2, Loader2 } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef, getTrainingDocRef } from '../firebase';
import { INITIAL_TRAINING_COURSES } from '../constants';

export default function TrainingMatrix() {
    const [user, setUser] = useState(null);
    const [isDbLoaded, setIsDbLoaded] = useState(false);

    const [courses, setCourses] = useState(INITIAL_TRAINING_COURSES);
    const [staffList, setStaffList] = useState([]); 

    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [showArchived, setShowArchived] = useState(false);
    
    const [isManagingCourses, setIsManagingCourses] = useState(false);
    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseFreq, setNewCourseFreq] = useState('12');
    const [courseToDelete, setCourseToDelete] = useState(null);
    
    // States for editing an existing course requirement
    const [editingCourseName, setEditingCourseName] = useState(null);
    const [editFormName, setEditFormName] = useState('');
    const [editFormFreq, setEditFormFreq] = useState('12');

    const [selectedCell, setSelectedCell] = useState(null);
    const [cellForm, setCellForm] = useState({ date: '', override: 'Completed' });

    useEffect(() => {
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;
        try {
            const unsubTraining = onSnapshot(getTrainingDocRef(), (docSnap) => {
                if (docSnap.exists() && docSnap.data().courses) {
                    setCourses(docSnap.data().courses);
                } else {
                    setDoc(getTrainingDocRef(), { courses: INITIAL_TRAINING_COURSES }, { merge: true });
                }
            });

            const unsubShared = onSnapshot(getRotaDocRef(), (docSnap) => {
                if (docSnap.exists() && docSnap.data().staffList) {
                    setStaffList(docSnap.data().staffList);
                }
                setIsDbLoaded(true);
            });

            return () => { unsubTraining(); unsubShared(); };
        } catch (e) {
            console.error("Sync error:", e);
            setIsDbLoaded(true);
        }
    }, [user]);

    const updateSharedStaff = async (newStaffList) => {
        if (!user) return;
        setStaffList(newStaffList);
        try { await updateDoc(getRotaDocRef(), { staffList: newStaffList }); } 
        catch (e) { console.error("Database save failed:", e); }
    };

    const updateCourses = async (newCourses) => {
        if (!user) return;
        setCourses(newCourses);
        try { await updateDoc(getTrainingDocRef(), { courses: newCourses }); } 
        catch (e) { console.error("Database save failed:", e); }
    };

    const calculateCellStatus = (record, courseFreq) => {
        if (!record || (!record.date && record.override !== 'N/A')) return { status: 'Expired/Missing' };
        if (record.override === 'N/A') return { status: 'N/A' };
        if (record.override === 'Booked') return { status: 'Booked', date: record.date };
        if (courseFreq === null) return { status: 'Valid', date: record.date, expiry: 'Never' };

        const compDate = new Date(record.date);
        const expiryDate = new Date(compDate);
        expiryDate.setMonth(expiryDate.getMonth() + courseFreq);
        
        const today = new Date();
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        let status = 'Valid';
        if (diffDays < 0) status = 'Expired/Missing';
        else if (diffDays <= 30) status = 'Expiring Soon';

        return { status, date: record.date, expiry: expiryDate.toISOString().split('T')[0] };
    };

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
        setSortConfig({ key, direction });
    };

    const exportToCSV = () => {
        const headers = ['Staff Member', 'Role', 'Status', ...courses.map(c => c.name), 'Remarks'];
        const rows = filteredData.map(staff => {
            return [
                `"${staff.name}"`, `"${staff.role}"`, `"${staff.status || 'Active'}"`,
                ...courses.map(c => {
                    const records = staff.records || {};
                    const detail = calculateCellStatus(records[c.name], c.freq);
                    if (detail.status === 'N/A') return '"N/A"';
                    if (detail.status === 'Booked') return `"Booked: ${detail.date}"`;
                    if (!detail.date) return '""';
                    return `"${detail.date}"`;
                }),
                `"${staff.remarks || ''}"`
            ].join(',');
        });

        const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Training_Matrix_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSaveCell = () => {
        const { staffId, courseName } = selectedCell;
        const newStaffList = staffList.map(staff => {
            if (staff.id === staffId) {
                return {
                    ...staff,
                    records: {
                        ...(staff.records || {}),
                        [courseName]: { date: cellForm.date, override: cellForm.override }
                    }
                };
            }
            return staff;
        });
        updateSharedStaff(newStaffList);
        setSelectedCell(null);
    };

    const handleClearCell = () => {
        const { staffId, courseName } = selectedCell;
        const newStaffList = staffList.map(staff => {
            if (staff.id === staffId) {
                const newRecords = { ...(staff.records || {}) };
                delete newRecords[courseName];
                return { ...staff, records: newRecords };
            }
            return staff;
        });
        updateSharedStaff(newStaffList);
        setSelectedCell(null);
    };

    const handleAddCourse = () => {
      if (!newCourseName.trim() || courses.some(c => c.name.toLowerCase() === newCourseName.trim().toLowerCase())) return; 
      updateCourses([...courses, { name: newCourseName.trim(), freq: newCourseFreq === 'Never' ? null : parseInt(newCourseFreq) }]);
      setNewCourseName('');
    };

    const handleStartEditCourse = (course) => {
      setEditingCourseName(course.name);
      setEditFormName(course.name);
      setEditFormFreq(course.freq === null ? 'Never' : course.freq.toString());
    };

    const handleSaveCourseEdit = () => {
      if (!editFormName.trim()) return;

      // Check for renaming conflicts with other courses
      if (editFormName.trim().toLowerCase() !== editingCourseName.toLowerCase() && 
          courses.some(c => c.name.toLowerCase() === editFormName.trim().toLowerCase())) {
        return;
      }

      const updatedCourses = courses.map(c => {
        if (c.name === editingCourseName) {
          return {
            name: editFormName.trim(),
            freq: editFormFreq === 'Never' ? null : parseInt(editFormFreq)
          };
        }
        return c;
      });

      // If the requirement name changed, migrate existing records in staff profiles automatically
      let updatedStaffList = [...staffList];
      if (editFormName.trim() !== editingCourseName) {
        updatedStaffList = staffList.map(staff => {
          if (staff.records && staff.records[editingCourseName]) {
            const newRecords = { ...staff.records };
            newRecords[editFormName.trim()] = newRecords[editingCourseName];
            delete newRecords[editingCourseName];
            return { ...staff, records: newRecords };
          }
          return staff;
        });
      }

      updateCourses(updatedCourses);
      if (editFormName.trim() !== editingCourseName) {
        updateSharedStaff(updatedStaffList);
      }

      setEditingCourseName(null);
    };

    const confirmDeleteCourse = () => {
      if (!courseToDelete) return;
      updateCourses(courses.filter(c => c.name !== courseToDelete));
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
            <div className="flex-1 bg-slate-50 flex items-center justify-center text-indigo-600">
                <Loader2 className="w-10 h-10 animate-spin mb-4" />
            </div>
        );
    }

    let filteredData = [...staffList];
    if (!showArchived) filteredData = filteredData.filter(item => item.status !== 'Archived');
    if (filter !== 'All') filteredData = filteredData.filter(item => item.role && item.role.includes(filter));
    if (searchQuery) filteredData = filteredData.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (sortConfig.key) {
        filteredData.sort((a, b) => {
            let aVal, bVal;
            if (sortConfig.key === 'name') {
                aVal = a.name; bVal = b.name;
            } else {
                const cFreq = courses.find(c => c.name === sortConfig.key)?.freq;
                aVal = calculateCellStatus((a.records || {})[sortConfig.key], cFreq).status;
                bVal = calculateCellStatus((b.records || {})[sortConfig.key], cFreq).status;
            }
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    let totalValid = 0, totalExpiring = 0, totalMissing = 0, totalApplicable = 0;
    filteredData.forEach(staff => {
        const records = staff.records || {};
        courses.forEach(c => {
            const detail = calculateCellStatus(records[c.name], c.freq);
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
                        <button onClick={() => setIsManagingCourses(true)} className="flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg font-medium shadow-sm transition-all" title="Manage Courses">
                            <BookOpen className="w-4 h-4" /> Requirements
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-[1600px] mx-auto print:p-0 print:max-w-full">
                
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
                        <Archive className="w-4 h-4" /> {showArchived ? 'Hide Archived' : 'Show Archived'}
                    </button>
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
                            {filteredData.map((staff, idx) => {
                                const records = staff.records || {};
                                return (
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
                                        const detail = calculateCellStatus(records[course.name], course.freq);
                                        
                                        if (detail.status === 'N/A') {
                                            return (
                                              <td key={course.name} onClick={() => { setSelectedCell({staffId: staff.id, courseName: course.name}); setCellForm(records[course.name] || { date: '', override: 'Completed' }); }} className="p-3 border-l border-slate-100 text-center bg-slate-50/30 print:bg-white cursor-pointer hover:bg-slate-100 group">
                                                <span className="text-slate-300 font-medium text-xs group-hover:text-indigo-500">N/A</span>
                                              </td>
                                            );
                                        }
                                        return (
                                            <td 
                                              key={course.name} 
                                              onClick={() => { setSelectedCell({staffId: staff.id, courseName: course.name}); setCellForm(records[course.name] || { date: '', override: 'Completed' }); }}
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
                            )})}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            No staff members found matching your criteria. Visit the "Staff Directory" to add team members.
                        </div>
                    )}
                </div>
            </div>

            {selectedCell && (
              <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
                <div className="bg-white rounded-xl shadow-xl p-6 w-96 max-w-[90vw]">
                  <h3 className="text-lg font-bold mb-1">Update Training Record</h3>
                  <p className="text-sm text-slate-500 mb-4">
                    {staffList.find(s => s.id === selectedCell.staffId)?.name} • {selectedCell.courseName}
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
                <div className="bg-white rounded-xl shadow-xl w-[520px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Manage Training Requirements</h3>
                    <button onClick={() => { setIsManagingCourses(false); setCourseToDelete(null); setEditingCourseName(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-3 mb-4 flex-1">
                    {courses.map(course => (
                      <div key={course.name} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        {editingCourseName === course.name ? (
                          /* Inline Editing Form */
                          <div className="space-y-3 p-1">
                            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Editing Requirement</div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input 
                                type="text" 
                                className="flex-1 p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" 
                                value={editFormName} 
                                onChange={(e) => setEditFormName(e.target.value)} 
                              />
                              <select 
                                className="w-32 p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" 
                                value={editFormFreq} 
                                onChange={(e) => setEditFormFreq(e.target.value)}
                              >
                                <option value="12">12 Months</option>
                                <option value="24">24 Months</option>
                                <option value="36">36 Months</option>
                                <option value="Never">Never Expires</option>
                              </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditingCourseName(null)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50">Cancel</button>
                              <button onClick={handleSaveCourseEdit} disabled={!editFormName.trim()} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-50">Save Changes</button>
                            </div>
                          </div>
                        ) : (
                          /* Standard Row Display */
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm flex-1 truncate">{course.name}</span>
                            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded shrink-0">
                              {course.freq ? `Every ${course.freq}m` : 'Never Expires'}
                            </span>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button onClick={() => handleStartEditCourse(course)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all" title="Edit Requirement"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setCourseToDelete(course.name)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded border border-transparent hover:border-slate-200 transition-all" title="Delete Requirement"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add New Requirement Footer Area */}
                  {!editingCourseName && (
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
                  )}

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
        </div>
    );
}
