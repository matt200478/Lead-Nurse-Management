import React, { useState, useEffect, useMemo } from 'react';
import { 
  GraduationCap, Search, Download, Printer, BookOpen, Activity, 
  UserCheck, AlertTriangle, AlertCircle, Archive, CheckCircle, XCircle, 
  Clock, X, Plus, Trash2, Edit2, ClipboardList, Layers, FileText, Check,
  CheckSquare, CalendarDays, Hourglass
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef, getTrainingDocRef } from '../firebase';
import { INITIAL_TRAINING_COURSES } from '../constants';

export default function TrainingMatrix() {
    const [user, setUser] = useState(null);
    const [isDbLoaded, setIsDbLoaded] = useState(false);

    // Core Data States
    const [courses, setCourses] = useState(INITIAL_TRAINING_COURSES);
    const [staffList, setStaffList] = useState([]); 

    // Layout Navigation & Search Filter States
    const [activeTab, setActiveTab] = useState('matrix'); 
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [showArchived, setShowArchived] = useState(false);
    
    // Manage Course State
    const [isManagingCourses, setIsManagingCourses] = useState(false);
    const [newCourseName, setNewCourseName] = useState('');
    const [newCourseFreq, setNewCourseFreq] = useState('12');
    const [courseToDelete, setCourseToDelete] = useState(null);
    const [editingCourseName, setEditingCourseName] = useState(null);
    const [editFormName, setEditFormName] = useState('');
    const [editFormFreq, setEditFormFreq] = useState('12');

    // Individual Manual Grid Click Update State
    const [selectedCell, setSelectedCell] = useState(null);
    const [cellForm, setCellForm] = useState({ date: '', override: 'Completed' });

    // Forms State
    const [singleLog, setSingleLog] = useState({ staffId: '', courseName: '', date: '' });
    const [scheduleLog, setScheduleLog] = useState({ staffId: '', courseName: '', date: '' });
    const [bulkLog, setBulkLog] = useState({ courseName: '', date: '', selectedStaffIds: [] });
    const [selectedRemarksStaffId, setSelectedRemarksStaffId] = useState('');
    const [remarksText, setRemarksText] = useState('');

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
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const eventDate = new Date(record.date);
        eventDate.setHours(0,0,0,0);

        if (record.override === 'Booked') {
            if (eventDate > today) {
                return { status: 'Booked', date: record.date };
            } else {
                return { status: 'Awaiting Approval', date: record.date };
            }
        }

        if (courseFreq === null) return { status: 'Valid', date: record.date, expiry: 'Never' };

        const expiryDate = new Date(record.date);
        expiryDate.setMonth(expiryDate.getMonth() + courseFreq);
        expiryDate.setHours(0,0,0,0);
        
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));

        let status = 'Valid';
        if (diffDays < 0) status = 'Expired/Missing';
        else if (diffDays <= 30) status = 'Expiring Soon';

        return { status, date: record.date, expiry: expiryDate.toISOString().split('T')[0] };
    };

    // Calculate items needing approval
    const approvalRequiredItems = useMemo(() => {
        const items = [];
        staffList.filter(s => s.status !== 'Archived').forEach(staff => {
            Object.keys(staff.records || {}).forEach(cName => {
                const record = staff.records[cName];
                if (record && record.override === 'Booked') {
                    const eventDate = new Date(record.date);
                    eventDate.setHours(0,0,0,0);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    if (eventDate <= today) {
                        items.push({
                            staffId: staff.id,
                            staffName: staff.name,
                            courseName: cName,
                            date: record.date
                        });
                    }
                }
            });
        });
        return items;
    }, [staffList]);

    const handleApproveTraining = async (staffId, courseName, passedDate) => {
        const newStaffList = staffList.map(staff => {
            if (staff.id === staffId) {
                return {
                    ...staff,
                    records: {
                        ...(staff.records || {}),
                        [courseName]: { date: passedDate, override: 'Completed' }
                    }
                };
            }
            return staff;
        });
        await updateSharedStaff(newStaffList);
    };

    const handleSingleLogSubmit = async (e) => {
        e.preventDefault();
        if (!singleLog.staffId || !singleLog.courseName || !singleLog.date) return;
        
        const newStaffList = staffList.map(staff => {
            if (staff.id === parseInt(singleLog.staffId)) {
                return {
                    ...staff,
                    records: {
                        ...(staff.records || {}),
                        [singleLog.courseName]: { date: singleLog.date, override: 'Completed' }
                    }
                };
            }
            return staff;
        });
        await updateSharedStaff(newStaffList);
        setSingleLog({ staffId: '', courseName: '', date: '' });
        setActiveTab('matrix');
    };

    const handleScheduleSubmit = async (e) => {
        e.preventDefault();
        if (!scheduleLog.staffId || !scheduleLog.courseName || !scheduleLog.date) return;

        const newStaffList = staffList.map(staff => {
            if (staff.id === parseInt(scheduleLog.staffId)) {
                return {
                    ...staff,
                    records: {
                        ...(staff.records || {}),
                        [scheduleLog.courseName]: { date: scheduleLog.date, override: 'Booked' }
                    }
                };
            }
            return staff;
        });
        await updateSharedStaff(newStaffList);
        setScheduleLog({ staffId: '', courseName: '', date: '' });
        setActiveTab('matrix');
    };

    const handleBulkLogSubmit = async (e) => {
        e.preventDefault();
        if (!bulkLog.courseName || !bulkLog.date || bulkLog.selectedStaffIds.length === 0) return;

        const newStaffList = staffList.map(staff => {
            if (bulkLog.selectedStaffIds.includes(staff.id)) {
                return {
                    ...staff,
                    records: {
                        ...(staff.records || {}),
                        [bulkLog.courseName]: { date: bulkLog.date, override: 'Completed' }
                    }
                };
            }
            return staff;
        });
        await updateSharedStaff(newStaffList);
        setBulkLog({ courseName: '', date: '', selectedStaffIds: [] });
        setActiveTab('matrix');
    };

    const toggleBulkStaffSelection = (id) => {
        setBulkLog(prev => {
            const current = prev.selectedStaffIds;
            const updated = current.includes(id) ? current.filter(item => item !== id) : [...current, id];
            return { ...prev, selectedStaffIds: updated };
        });
    };

    const handleSaveRemarks = async () => {
        if (!selectedRemarksStaffId) return;
        const newStaffList = staffList.map(staff => {
            if (staff.id === parseInt(selectedRemarksStaffId)) {
                return { ...staff, remarks: remarksText };
            }
            return staff;
        });
        await updateSharedStaff(newStaffList);
        setSelectedRemarksStaffId('');
        setRemarksText('');
        setActiveTab('matrix');
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
                    if (detail.status === 'Awaiting Approval') return `"Awaiting Approval: ${detail.date}"`;
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
      if (editFormName.trim().toLowerCase() !== editingCourseName.toLowerCase() && 
          courses.some(c => c.name.toLowerCase() === editFormName.trim().toLowerCase())) {
        return;
      }

      const updatedCourses = courses.map(c => {
        if (c.name === editingCourseName) {
          return { name: editFormName.trim(), freq: editFormFreq === 'Never' ? null : parseInt(editFormFreq) };
        }
        return c;
      });

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
            case 'Awaiting Approval': return 'bg-purple-100 text-purple-800 border-purple-200 animate-pulse';
            default: return 'bg-slate-100 text-slate-600 border-slate-200';
        }
    };

    const getStatusIcon = (status) => {
        switch(status) {
            case 'Valid': return <CheckCircle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Expiring Soon': return <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Expired/Missing': return <XCircle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Booked': return <Clock className="w-3.5 h-3.5 mr-1 shrink-0" />;
            case 'Awaiting Approval': return <AlertCircle className="w-3.5 h-3.5 mr-1 shrink-0" />;
            default: return null;
        }
    };

    const TABS = [
        { id: 'matrix', label: 'Matrix Grid', icon: ClipboardList },
        { id: 'log', label: 'Log Completion', icon: CheckSquare },
        { id: 'bulk', label: 'Bulk Log', icon: Layers },
        { id: 'schedule', label: 'Schedule Course', icon: CalendarDays },
        { id: 'progress', label: 'In Progress', icon: Hourglass, badge: approvalRequiredItems.length },
        { id: 'remarks', label: 'Remarks', icon: FileText }
    ];

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
                else if (detail.status === 'Expired/Missing' || detail.status === 'Awaiting Approval') totalMissing++;
            }
        });
    });
    const complianceRate = totalApplicable > 0 ? Math.round((totalValid / totalApplicable) * 100) : 100;
    const assignableStaff = staffList.filter(s => s.status !== 'Archived');

    return (
        <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 print:bg-white print:p-0">
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 shadow-sm print:hidden">
                <div className="max-w-7xl mx-auto">
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2 mb-4">
                        <GraduationCap className="w-7 h-7 text-[#5c4ce5]" />
                        Training Requirements Matrix
                    </h1>
                    
                    {/* Horizontal Workflow Toolbar Navigation Menu */}
                    <div className="bg-[#f0f2f5] p-2 rounded-xl flex flex-wrap gap-1 border border-slate-200">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg transition-all ${activeTab === tab.id ? 'bg-white text-[#5c4ce5] shadow-sm ring-1 ring-slate-200/60' : 'text-slate-600 hover:bg-slate-200/50'}`}
                            >
                                <tab.icon className="w-4 h-4" /> {tab.label}
                                {tab.badge > 0 && (
                                    <span className="ml-1 bg-rose-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="p-6 max-w-7xl mx-auto print:p-0 print:max-w-full">

                {/* LOG COMPLETED COURSE TAB */}
                {activeTab === 'log' && (
                    <div className="max-w-3xl bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800 mb-1">Log Completed Course</h2>
                        <p className="text-sm text-slate-500 mb-8">Instantly update a staff member's record. This automatically clears any pending bookings for this course.</p>
                        
                        <form onSubmit={handleSingleLogSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Staff Member</label>
                                    <select required className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={singleLog.staffId} onChange={e => setSingleLog({...singleLog, staffId: e.target.value})}>
                                        <option value="">Select staff...</option>
                                        {assignableStaff.map(s => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Course Name</label>
                                    <select required className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={singleLog.courseName} onChange={e => setSingleLog({...singleLog, courseName: e.target.value})}>
                                        <option value="">Select course...</option>
                                        {courses.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="w-1/2 pr-3">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Date Completed</label>
                                <input required type="date" className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={singleLog.date} onChange={e => setSingleLog({...singleLog, date: e.target.value})} />
                            </div>
                            
                            <div className="pt-4">
                                <button type="submit" className="flex items-center gap-2 bg-[#5c4ce5] hover:bg-[#4a3bc2] text-white font-bold py-2.5 px-6 rounded-lg transition-colors">
                                    <CheckSquare className="w-4 h-4" /> Log Completion
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* SCHEDULE COURSE TAB */}
                {activeTab === 'schedule' && (
                    <div className="max-w-3xl bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800 mb-1">Schedule Course</h2>
                        <p className="text-sm text-slate-500 mb-8">Plan an upcoming training booking. This displays as 'Booked' until the date passes, then moves to 'In Progress'.</p>
                        
                        <form onSubmit={handleScheduleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Staff Member</label>
                                    <select required className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={scheduleLog.staffId} onChange={e => setScheduleLog({...scheduleLog, staffId: e.target.value})}>
                                        <option value="">Select staff...</option>
                                        {assignableStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Course Name</label>
                                    <select required className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={scheduleLog.courseName} onChange={e => setScheduleLog({...scheduleLog, courseName: e.target.value})}>
                                        <option value="">Select course...</option>
                                        {courses.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="w-1/2 pr-3">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Booking Date</label>
                                <input required type="date" className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={scheduleLog.date} onChange={e => setScheduleLog({...scheduleLog, date: e.target.value})} />
                            </div>
                            <div className="pt-4">
                                <button type="submit" className="flex items-center gap-2 bg-[#5c4ce5] hover:bg-[#4a3bc2] text-white font-bold py-2.5 px-6 rounded-lg transition-colors">
                                    <CalendarDays className="w-4 h-4" /> Schedule Course
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* BULK LOG MULTI-STAFF TAB */}
                {activeTab === 'bulk' && (
                    <div className="max-w-3xl bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800 mb-1">Bulk Log Completion</h2>
                        <p className="text-sm text-slate-500 mb-8">Apply a course completion date to multiple staff members simultaneously to save time.</p>
                        
                        <form onSubmit={handleBulkLogSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Course Name</label>
                                    <select required className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={bulkLog.courseName} onChange={e => setBulkLog({...bulkLog, courseName: e.target.value})}>
                                        <option value="">Select course...</option>
                                        {courses.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Date Completed</label>
                                    <input required type="date" className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm" value={bulkLog.date} onChange={e => setBulkLog({...bulkLog, date: e.target.value})} />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Attending Team Members</label>
                                <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50">
                                    {assignableStaff.map(staff => (
                                        <label key={staff.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-md bg-white cursor-pointer hover:border-indigo-300 transition-colors shadow-sm">
                                            <input 
                                                type="checkbox" 
                                                className="rounded text-[#5c4ce5] w-4 h-4 focus:ring-[#5c4ce5]" 
                                                checked={bulkLog.selectedStaffIds.includes(staff.id)}
                                                onChange={() => toggleBulkStaffSelection(staff.id)}
                                            />
                                            <span className="text-sm font-bold text-slate-800">{staff.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-4">
                                <button type="submit" disabled={bulkLog.selectedStaffIds.length === 0} className="flex items-center gap-2 bg-[#5c4ce5] hover:bg-[#4a3bc2] text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50">
                                    <Layers className="w-4 h-4" /> Log Bulk Compliances
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* REMARKS & NOTES TAB */}
                {activeTab === 'remarks' && (
                    <div className="max-w-3xl bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800 mb-1">Personnel Training Remarks</h2>
                        <p className="text-sm text-slate-500 mb-8">Review or modify specific notes for each individual's deployment requirements.</p>
                        
                        <div className="space-y-6">
                            <div className="w-1/2">
                                <label className="block text-sm font-bold text-slate-700 mb-2">Select Staff Member</label>
                                <select 
                                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                    value={selectedRemarksStaffId}
                                    onChange={e => {
                                        setSelectedRemarksStaffId(e.target.value);
                                        const found = staffList.find(s => s.id === parseInt(e.target.value));
                                        setRemarksText(found ? found.remarks || '' : '');
                                    }}
                                >
                                    <option value="">Choose team member...</option>
                                    {assignableStaff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>

                            {selectedRemarksStaffId && (
                                <div className="animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-sm font-bold text-slate-700 mb-2">Remarks / Notes</label>
                                    <textarea 
                                        rows={5}
                                        className="w-full p-3 bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-inner"
                                        placeholder="Add special context details here (e.g., 'Requires special certification review next month')"
                                        value={remarksText}
                                        onChange={e => setRemarksText(e.target.value)}
                                    />
                                    <div className="pt-4 flex gap-3">
                                        <button onClick={handleSaveRemarks} className="bg-[#5c4ce5] hover:bg-[#4a3bc2] text-white font-bold py-2.5 px-6 rounded-lg transition-colors">
                                            Save Notes
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* IN PROGRESS TAB */}
                {activeTab === 'progress' && (
                    <div className="max-w-3xl bg-white p-8 border border-slate-200 rounded-xl shadow-sm">
                        <h2 className="text-xl font-bold text-slate-800 mb-1">In Progress (Awaiting Authorisation)</h2>
                        <p className="text-sm text-slate-500 mb-8">These scheduled courses have passed their booking date. Verify completion to update the matrix.</p>
                        
                        {approvalRequiredItems.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
                                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-emerald-400" />
                                <p className="text-lg font-bold text-slate-700">All caught up!</p>
                                <p className="text-sm">No courses are currently awaiting authorisation.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {approvalRequiredItems.map((item, idx) => (
                                    <div key={idx} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-purple-300 transition-colors">
                                        <div className="mb-4 sm:mb-0">
                                            <div className="font-black text-lg text-slate-900">{item.staffName}</div>
                                            <div className="text-sm text-slate-600 font-medium mt-1">{item.courseName}</div>
                                            <div className="text-xs text-purple-600 font-bold mt-2 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded-md w-fit">
                                                <Clock className="w-3.5 h-3.5" /> Scheduled Date: {new Date(item.date).toLocaleDateString('en-GB')}
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleApproveTraining(item.staffId, item.courseName, item.date)}
                                            className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
                                        >
                                            <Check className="w-4 h-4" /> Authorise Completion
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* MATRIX VIEW TAB */}
                {activeTab === 'matrix' && (
                    <div className="animate-in fade-in">
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
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Expiring Soon</p>
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
                                    <button key={role} onClick={() => setFilter(role)} className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${filter === role ? 'bg-[#5c4ce5] text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
                                        {role}s
                                    </button>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                    <input type="text" placeholder="Find staff member..." className="pl-9 pr-4 py-1.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                                </div>
                                <button onClick={() => setShowArchived(!showArchived)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${showArchived ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-50'}`}>
                                    <Archive className="w-4 h-4" /> {showArchived ? 'Hide Archived' : 'Show Archived'}
                                </button>
                                <button onClick={exportToCSV} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 rounded-lg font-medium shadow-sm transition-all"><Download className="w-4 h-4" /> Export</button>
                                <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 rounded-lg font-medium shadow-sm transition-all"><Printer className="w-4 h-4" /> Print</button>
                                <button onClick={() => setIsManagingCourses(true)} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:text-indigo-600 rounded-lg font-medium shadow-sm transition-all"><BookOpen className="w-4 h-4" /> Manage Courses</button>
                            </div>
                        </div>

                        <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-x-auto print:border-none print:shadow-none">
                            <table className="w-full text-left border-collapse text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 print:bg-white">
                                        <th className="p-3 font-bold text-slate-700 uppercase tracking-wider cursor-pointer hover:bg-slate-100 sticky left-0 z-10 bg-slate-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] print:shadow-none print:bg-white min-w-[160px]" onClick={() => handleSort('name')}>
                                            Staff Member
                                        </th>
                                        {courses.map(course => (
                                            <th key={course.name} className="p-3 font-bold text-slate-700 cursor-pointer hover:bg-slate-100 border-l border-slate-200 whitespace-nowrap align-bottom group" onClick={() => handleSort(course.name)}>
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
                                                    <td key={course.name} onClick={() => { setSelectedCell({staffId: staff.id, courseName: course.name}); setCellForm(records[course.name] || { date: '', override: 'Completed' }); }} className="p-2 border-l border-slate-100 align-top min-w-[120px] cursor-pointer hover:bg-slate-50 transition-colors">
                                                        <div className={`p-2 rounded-lg border ${getStatusStyle(detail.status)} flex flex-col justify-center h-full print:border-slate-400 print:text-black print:bg-white transition-transform hover:scale-[1.02]`}>
                                                            <div className="font-bold text-[11px] uppercase tracking-wider flex items-center truncate">
                                                                {getStatusIcon(detail.status)}
                                                                <span className="truncate">{detail.status}</span>
                                                            </div>
                                                            {detail.date && <div className="text-[10px] mt-1 opacity-80 font-medium">Date: {new Date(detail.date).toLocaleDateString('en-GB')}</div>}
                                                            {detail.expiry && <div className="text-[10px] opacity-80 font-bold mt-0.5">Exp: {detail.expiry === 'Never' ? 'Never' : new Date(detail.expiry).toLocaleDateString('en-GB')}</div>}
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Individual Grid Cell Update Modal Pop-up */}
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
                      <select className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={cellForm.override} onChange={(e) => setCellForm({...cellForm, override: e.target.value})}>
                        <option value="Completed">Completed</option>
                        <option value="Booked">Booked (Upcoming / Pending)</option>
                        <option value="N/A">Not Applicable</option>
                      </select>
                    </div>

                    {cellForm.override !== 'N/A' && (
                      <div>
                        <label className="block text-sm font-medium mb-1">{cellForm.override === 'Booked' ? 'Scheduled Booking Date' : 'Date Completed'}</label>
                        <input type="date" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" value={cellForm.date || ''} onChange={(e) => setCellForm({...cellForm, date: e.target.value})} />
                      </div>
                    )}

                    <div className="flex gap-2 pt-4">
                      <button onClick={handleSaveCell} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors">Save</button>
                      <button onClick={handleClearCell} className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors border border-red-200" title="Clear Record"><Trash2 className="w-5 h-5" /></button>
                      <button onClick={() => setSelectedCell(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-medium transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Course Requirement Configurations Settings Modal Panel */}
            {isManagingCourses && (
              <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 print:hidden">
                <div className="bg-white rounded-xl shadow-xl w-[540px] max-w-[90vw] max-h-[90vh] flex flex-col relative">
                  <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-lg font-bold">Manage Training Requirements</h3>
                    <button onClick={() => { setIsManagingCourses(false); setCourseToDelete(null); setEditingCourseName(null); }} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                  </div>
                  
                  <div className="p-6 overflow-y-auto space-y-3 mb-4 flex-1">
                    {courses.map(course => (
                      <div key={course.name} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                        {editingCourseName === course.name ? (
                          <div className="space-y-3 p-1">
                            <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Editing Requirement</div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <input type="text" className="flex-1 p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" value={editFormName} onChange={(e) => setEditFormName(e.target.value)} />
                              <select className="w-32 p-2 border border-slate-300 rounded-lg text-sm bg-white outline-none focus:border-indigo-500" value={editFormFreq} onChange={(e) => setEditFormFreq(e.target.value)}>
                                <option value="12">12 Months</option>
                                <option value="24">24 Months</option>
                                <option value="36">36 Months</option>
                                <option value="Never">Never Expires</option>
                              </select>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => setEditingCourseName(null)} className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg">Cancel</button>
                              <button type="button" onClick={handleSaveCourseEdit} disabled={!editFormName.trim()} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg">Save</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium text-sm flex-1 truncate">{course.name}</span>
                            <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded shrink-0">
                              {course.freq ? `Every ${course.freq}m` : 'Never Expires'}
                            </span>
                            <div className="flex gap-1 shrink-0 ml-2">
                              <button onClick={() => handleStartEditCourse(course)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded bg-white border border-slate-200 shadow-xs"><Edit2 className="w-3.5 h-3.5" /></button>
                              <button onClick={() => setCourseToDelete(course.name)} className="p-1.5 text-slate-400 hover:text-red-600 rounded bg-white border border-slate-200 shadow-xs"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

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
                        <button onClick={handleAddCourse} disabled={!newCourseName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-lg transition-colors"><Plus className="w-5 h-5" /></button>
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
