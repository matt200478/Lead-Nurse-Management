import React from 'react';
import { CalendarDays, Users, GraduationCap, Calculator, Stethoscope, Palmtree, ArrowRight } from 'lucide-react';

export default function DashboardHome({ setView, isAdmin }) {
  const allModules = [
    { 
      id: 'rota', 
      title: 'Clinic Rota', 
      desc: 'Manage weekly schedules, assign clinic rooms, and track daily targets.', 
      icon: CalendarDays, 
      color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', hover: 'hover:border-blue-400 hover:shadow-blue-100',
      adminOnly: true
    },
    { 
      id: 'cover', 
      title: 'Cover Board', 
      desc: 'Post open shifts and allow staff to proactively claim extra hours.', 
      icon: Stethoscope, 
      color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', hover: 'hover:border-pink-400 hover:shadow-pink-100',
      adminOnly: false
    },
    { 
      id: 'staff', 
      title: 'Staff Directory', 
      desc: 'Manage personnel details, contracted hours, and weekly compliance.', 
      icon: Users, 
      color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', hover: 'hover:border-violet-400 hover:shadow-violet-100',
      adminOnly: true
    },
    { 
      id: 'training', 
      title: 'Training Matrix', 
      desc: 'Track statutory training compliance and upcoming course renewals.', 
      icon: GraduationCap, 
      color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', hover: 'hover:border-indigo-400 hover:shadow-indigo-100',
      adminOnly: true
    },
    { 
      id: 'leave', 
      title: 'Leave Calculator', 
      desc: 'Calculate pro-rata annual leave and bank holiday entitlements.', 
      icon: Calculator, 
      color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', hover: 'hover:border-emerald-400 hover:shadow-emerald-100',
      adminOnly: true
    },
    { 
      id: 'leave_requests', 
      title: 'Peak Leave Requests', 
      desc: 'Manage historical-aware holiday allocations for the team.', 
      icon: Palmtree, 
      color: 'text-teal-600', bg: 'bg-teal-50', border: 'border-teal-200', hover: 'hover:border-teal-400 hover:shadow-teal-100',
      adminOnly: false
    }
  ];

  const visibleModules = allModules.filter(m => isAdmin || !m.adminOnly);

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-full flex flex-col justify-center">
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mb-3">Practice Management System</h1>
        <p className="text-slate-500 font-medium max-w-2xl mx-auto">Select a module below to manage schedules, track staff compliance, and oversee operations.</p>
      </div>

      <div className={`grid grid-cols-1 md:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3' : 'max-w-3xl mx-auto'} gap-6`}>
        {visibleModules.map((mod) => (
          <div 
            key={mod.id}
            onClick={() => setView(mod.id)}
            className={`bg-white p-6 rounded-2xl border ${mod.border} shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${mod.hover} group flex flex-col h-full`}
          >
            <div className={`w-14 h-14 rounded-xl ${mod.bg} ${mod.color} flex items-center justify-center mb-5 shrink-0 group-hover:scale-110 transition-transform`}>
              <mod.icon className="w-7 h-7" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">{mod.title}</h3>
            <p className="text-sm text-slate-500 font-medium mb-6 flex-1">{mod.desc}</p>
            <div className={`mt-auto flex items-center gap-2 text-sm font-bold ${mod.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
              Open Module <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
