import React, { useState, useEffect } from 'react';
import { Settings, Plus, Edit2, Trash2, X, AlertCircle, Loader2, ShieldCheck, Palette } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { setDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, getRotaDocRef } from '../firebase';

const PRESET_COLORS = [
  { name: 'Blue', class: 'bg-blue-500' },
  { name: 'Emerald', class: 'bg-emerald-500' },
  { name: 'Purple', class: 'bg-purple-500' },
  { name: 'Pink', class: 'bg-pink-500' },
  { name: 'Amber', class: 'bg-amber-500' },
  { name: 'Rose', class: 'bg-rose-500' },
  { name: 'Cyan', class: 'bg-cyan-500' },
  { name: 'Indigo', class: 'bg-indigo-500' },
  { name: 'Teal', class: 'bg-teal-500' },
  { name: 'Orange', class: 'bg-orange-500' }
];

const DEFAULT_ROLES = [
  { id: 'nurse', name: 'Nurse', color: 'bg-blue-500' },
  { id: 'hca', name: 'HCA', color: 'bg-emerald-500' },
  { id: 'anp', name: 'ANP', color: 'bg-purple-500' }
];

export default function PracticeSettings() {
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [roles, setRoles] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [roleForm, setRoleForm] = useState({ name: '', color: 'bg-slate-500' });
  const [roleToDelete, setRoleToDelete] = useState(null);

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
          if (data.roles && data.roles.length > 0) {
            setRoles(data.roles);
          } else {
            // Initialize default roles if they don't exist
            setDoc(getRotaDocRef(), { roles: DEFAULT_ROLES }, { merge: true });
          }
        }
        setIsDbLoaded(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error setting up snapshot:", e);
      setIsDbLoaded(true);
    }
  }, [user]);

  const updateDbRoles = async (newRoles) => {
    if (!user) return;
    try {
      await updateDoc(getRotaDocRef(), { roles: newRoles });
    } catch (e) { console.error("Database save failed:", e); }
  };

  const handleOpenModal = (role = null) => {
    if (role) {
      setEditingRole(role);
      setRoleForm({ name: role.name, color: role.color });
    } else {
      setEditingRole(null);
      setRoleForm({ name: '', color: PRESET_COLORS[0].class });
    }
    setIsModalOpen(true);
  };

  const handleSaveRole = () => {
    if (!roleForm.name.trim()) return;

    let newRoles;
    if (editingRole) {
      // Update existing
      newRoles = roles.map(r => 
        r.id === editingRole.id ? { ...r, name: roleForm.name.trim(), color: roleForm.color } : r
      );
    } else {
      // Add new
      const newId = roleForm.name.trim().toLowerCase().replace(/\s+/g, '-');
      // Prevent duplicates
      if (roles.some(r => r.id === newId)) return alert("A role with this name already exists.");
      newRoles = [...roles, { id: newId, name: roleForm.name.trim(), color: roleForm.color }];
    }

    updateDbRoles(newRoles);
    setIsModalOpen(false);
  };

  const confirmDeleteRole = () => {
    if (!roleToDelete) return;
    const newRoles = roles.filter(r => r.id !== roleToDelete.id);
    updateDbRoles(newRoles);
    setRoleToDelete(null);
  };

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-slate-50 flex items-center justify-center text-indigo-600">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-50 min-h-full font-sans text-slate-800 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Settings className="w-7 h-7 text-indigo-600" />
              Practice Settings
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">Manage global system configurations and data parameters.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" /> System Roles
              </h2>
              <p className="text-xs text-slate-500 mt-1">These roles determine staff filtering, training requirements, and Cover Board badges.</p>
            </div>
            <button 
              onClick={() => handleOpenModal()} 
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-sm hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" /> Add Role
            </button>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roles.map(role => (
                <div key={role.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-all group">
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full ${role.color} shadow-sm ring-2 ring-white`}></div>
                    <span className="font-bold text-slate-700">{role.name}</span>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(role)} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded transition-colors"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => setRoleToDelete(role)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[400px] max-w-[95vw]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold">{editingRole ? 'Edit Role' : 'Add New Role'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">Role Title</label>
                <input 
                  type="text" 
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" 
                  placeholder="e.g. Receptionist"
                  value={roleForm.name}
                  onChange={e => setRoleForm({...roleForm, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-slate-400" /> UI Badge Colour
                </label>
                <div className="flex flex-wrap gap-3">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c.name}
                      onClick={() => setRoleForm({...roleForm, color: c.class})}
                      className={`w-8 h-8 rounded-full ${c.class} shadow-sm transition-transform ${roleForm.color === c.class ? 'ring-4 ring-slate-200 scale-110' : 'hover:scale-110'}`}
                      title={c.name}
                    ></button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 rounded-b-xl">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50">Cancel</button>
              <button onClick={handleSaveRole} disabled={!roleForm.name.trim()} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">Save Role</button>
            </div>
          </div>
        </div>
      )}

      {roleToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-[400px] text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h4 className="text-lg font-bold mb-2">Delete Role?</h4>
            <p className="text-sm text-slate-600 mb-6">Are you sure you want to remove <strong>{roleToDelete.name}</strong>? Make sure no staff members are currently assigned to this role before deleting.</p>
            <div className="flex gap-3">
              <button onClick={confirmDeleteRole} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-bold">Yes, Delete</button>
              <button onClick={() => setRoleToDelete(null)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg font-bold">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
