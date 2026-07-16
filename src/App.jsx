import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, LayoutDashboard, CalendarDays, Users, GraduationCap, 
  Calculator, ChevronLeft, ChevronRight, Stethoscope, Settings, Palmtree, LogOut
} from 'lucide-react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './firebase';

import LockScreen from './components/LockScreen';
import DashboardHome from './components/DashboardHome';
import ClinicRota from './components/ClinicRota';
import StaffDirectory from './components/StaffDirectory';
import TrainingMatrix from './components/TrainingMatrix';
import AnnualLeaveCalculator from './components/AnnualLeaveCalculator';
import CoverBoard from './components/CoverBoard';
import PracticeSettings from './components/PracticeSettings';
import PeakLeaveRequests from './components/PeakLeaveRequests';

export default function App() {
  const [activeUser, setActiveUser] = useState(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [isGlobalSidebarOpen, setIsGlobalSidebarOpen] = useState(true);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
  }, []);

  if (!activeUser) {
    return <LockScreen onLogin={(user) => { setActiveUser(user); setCurrentView('dashboard'); }} />;
  }

  // Determine if the logged-in user has Admin privileges
  const userRole = activeUser.role?.toLowerCase() || '';
  const isAdmin = userRole.includes('lead') || userRole.includes('manager') || activeUser.name.toLowerCase().includes('michelle');

  const handleLogout = () => {
    setActiveUser(null);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      {/* Global Sidebar */}
      <div className={`${isGlobalSidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300 ease-in-out bg-slate-900 text-white shrink-0 flex flex-col print:hidden shadow-xl z-50 relative`}>
        
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
        
        <div className="flex-1 py-6 flex flex-col gap-2 px-4 overflow-hidden overflow-y-auto custom-scrollbar">
          <button onClick={() => setCurrentView('dashboard')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard className="w-5 h-5 shrink-0" />
            {isGlobalSidebarOpen && <span className="whitespace-nowrap">Home</span>}
          </button>
          
          {isAdmin && (
            <button onClick={() => setCurrentView('rota')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'rota' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
              <CalendarDays className="w-5 h-5 shrink-0" />
              {isGlobalSidebarOpen && <span className="whitespace-nowrap">Clinic Rota</span>}
            </button>
          )}

          <button onClick={() => setCurrentView('cover')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'cover' ? 'bg-pink-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Stethoscope className="w-5 h-5 shrink-0" />
            {isGlobalSidebarOpen && <span className="whitespace-nowrap">Cover Board</span>}
          </button>

          {isAdmin && (
            <>
              <button onClick={() => setCurrentView('staff')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'staff' ? 'bg-violet-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Users className="w-5 h-5 shrink-0" />
                {isGlobalSidebarOpen && <span className="whitespace-nowrap">Staff Directory</span>}
              </button>

              <button onClick={() => setCurrentView('training')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'training' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <GraduationCap className="w-5 h-5 shrink-0" />
                {isGlobalSidebarOpen && <span className="whitespace-nowrap">Training Matrix</span>}
              </button>
              
              <button onClick={() => setCurrentView('leave')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'leave' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Calculator className="w-5 h-5 shrink-0" />
                {isGlobalSidebarOpen && <span className="whitespace-nowrap">Leave Calculator</span>}
              </button>
            </>
          )}

          <button onClick={() => setCurrentView('leave_requests')} className={`flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'leave_requests' ? 'bg-teal-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            <Palmtree className="w-5 h-5 shrink-0" />
            {isGlobalSidebarOpen && <span className="whitespace-nowrap">Leave Requests</span>}
          </button>

          <div className="mt-auto pt-4 space-y-2">
            {isAdmin && (
              <button onClick={() => setCurrentView('settings')} className={`w-full flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors ${currentView === 'settings' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Settings className="w-5 h-5 shrink-0" />
                {isGlobalSidebarOpen && <span className="whitespace-nowrap">Settings</span>}
              </button>
            )}
            <button onClick={handleLogout} className={`w-full flex items-center ${isGlobalSidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center p-3'} rounded-xl font-medium transition-colors text-rose-400 hover:bg-rose-500/10 hover:text-rose-300`}>
              <LogOut className="w-5 h-5 shrink-0" />
              {isGlobalSidebarOpen && <span className="whitespace-nowrap">Lock System</span>}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-slate-100 relative">
        {currentView === 'dashboard' && <DashboardHome setView={setCurrentView} isAdmin={isAdmin} />}
        {currentView === 'rota' && isAdmin && <ClinicRota />}
        {currentView === 'cover' && <CoverBoard activeUser={activeUser} isAdmin={isAdmin} />}
        {currentView === 'staff' && isAdmin && <StaffDirectory />}
        {currentView === 'training' && isAdmin && <TrainingMatrix />}
        {currentView === 'leave' && isAdmin && <AnnualLeaveCalculator />}
        {currentView === 'leave_requests' && <PeakLeaveRequests activeUser={activeUser} isAdmin={isAdmin} />}
        {currentView === 'settings' && isAdmin && <PracticeSettings />}
      </div>
    </div>
  );
}
