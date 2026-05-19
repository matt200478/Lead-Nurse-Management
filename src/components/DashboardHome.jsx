import React from 'react';
import { CalendarDays, Contact, GraduationCap, Calculator, ChevronRight } from 'lucide-react';

export default function DashboardHome({ setView }) {
  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-black text-slate-800">Welcome back, Michelle.</h1>
        <p className="text-slate-500 mt-2 text-lg">Practice Management Suite • Bourne Galletly</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div onClick={() => setView('rota')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-blue-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 z-0"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-4 shadow-inner"><CalendarDays className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Clinic Rota</h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">Manage weekly room allocations, monitor target compliance, and prevent staff qualification conflicts.</p>
            <div className="flex items-center text-blue-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">Open Rota <ChevronRight className="w-4 h-4 ml-1" /></div>
          </div>
        </div>

        <div onClick={() => setView('staff')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-violet-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 z-0"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-xl flex items-center justify-center mb-4 shadow-inner"><Contact className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Staff Directory</h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">Centralised database of personnel. Add, edit, or archive staff to instantly update the Rota and Matrix.</p>
            <div className="flex items-center text-violet-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">Manage Staff <ChevronRight className="w-4 h-4 ml-1" /></div>
          </div>
        </div>

        <div onClick={() => setView('training')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 z-0"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4 shadow-inner"><GraduationCap className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Training Matrix</h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">Monitor staff qualifications, log completed courses, and visually track upcoming compliance expiries.</p>
            <div className="flex items-center text-indigo-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">Open Matrix <ChevronRight className="w-4 h-4 ml-1" /></div>
          </div>
        </div>

        <div onClick={() => setView('leave')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 cursor-pointer hover:shadow-md hover:border-emerald-300 transition-all group relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 z-0"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4 shadow-inner"><Calculator className="w-6 h-6" /></div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">Leave Calculator</h2>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">Calculate pro-rata annual leave entitlement and automatically deduct Bank Holiday allowances.</p>
            <div className="flex items-center text-emerald-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">Open Calculator <ChevronRight className="w-4 h-4 ml-1" /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
