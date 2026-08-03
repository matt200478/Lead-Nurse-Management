import React, { useState, useMemo, useEffect } from 'react';
import { Calculator, CalendarDays, Clock, Activity, UserCheck, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { auth, getRotaDocRef } from '../firebase';

const getEasterDate = (year) => {
  const f = Math.floor, G = year % 19, C = f(year / 100),
    H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
    I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
    J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
    L = I - J, month = 3 + f((L + 40) / 44), day = L + 28 - 31 * f(month / 4);
  return new Date(year, month - 1, day);
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const getUKBankHolidays = (year) => {
  const holidays = [];
  const getDayOfMonth = (y, m, dow, week) => {
    const firstDay = new Date(y, m, 1);
    let offset = dow - firstDay.getDay();
    if (offset < 0) offset += 7;
    const target = 1 + offset + (week - 1) * 7;
    if (week === 5) {
      const temp = new Date(y, m, target);
      if (temp.getMonth() !== m) return new Date(y, m, target - 7);
    }
    return new Date(y, m, target);
  };

  const adjustForWeekend = (date) => {
    const d = new Date(date);
    if (d.getDay() === 6) d.setDate(d.getDate() + 2);
    else if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return d;
  };

  const adjustXmasBoxing = (y) => {
    let xmas = new Date(y, 11, 25), boxing = new Date(y, 11, 26);
    if (xmas.getDay() === 6) { xmas = new Date(y, 11, 27); boxing = new Date(y, 11, 28); }
    else if (xmas.getDay() === 0) { xmas = new Date(y, 11, 26); boxing = new Date(y, 11, 27); }
    return { xmas, boxing };
  };

  const easter = getEasterDate(year);
  holidays.push({ name: "New Year's Day", date: adjustForWeekend(new Date(year, 0, 1)) });
  holidays.push({ name: "Good Friday", date: addDays(easter, -2) });
  holidays.push({ name: "Easter Monday", date: addDays(easter, 1) });
  holidays.push({ name: "Early May Bank Holiday", date: getDayOfMonth(year, 4, 1, 1) });
  holidays.push({ name: "Spring Bank Holiday", date: getDayOfMonth(year, 4, 1, 5) });
  holidays.push({ name: "Summer Bank Holiday", date: getDayOfMonth(year, 7, 1, 5) });
  
  const { xmas, boxing } = adjustXmasBoxing(year);
  holidays.push({ name: "Christmas Day", date: xmas });
  holidays.push({ name: "Boxing Day", date: boxing });

  return holidays;
};

const calculateHours = (start, end) => {
  if (!start || !end) return { gross: 0, net: 0 };
  const [startH, startM] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  
  let gross = (endH + endM / 60) - (startH + startM / 60);
  if (gross < 0) gross += 24; 
  
  const net = gross > 6 ? gross - 1 : gross;
  return { gross, net };
};

export default function AnnualLeaveCalculator() {
  const today = new Date();
  const currentFinancialYear = today.getMonth() < 3 ? today.getFullYear() - 1 : today.getFullYear();
  
  const [user, setUser] = useState(null);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const [staffList, setStaffList] = useState([]);
  
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [importAlerts, setImportAlerts] = useState([]);

  const [selectedLeaveYear, setSelectedLeaveYear] = useState(currentFinancialYear);
  const [leaveYearStart, setLeaveYearStart] = useState(`${currentFinancialYear}-04-01`);
  const [leaveYearEnd, setLeaveYearEnd] = useState(`${currentFinancialYear + 1}-03-31`);
  
  const [draftEmpStart, setDraftEmpStart] = useState(`${currentFinancialYear}-04-01`);
  const [draftEmpEnd, setDraftEmpEnd] = useState(`${currentFinancialYear + 1}-03-31`);

  const [empStart, setEmpStart] = useState(`${currentFinancialYear}-04-01`);
  const [empEnd, setEmpEnd] = useState(`${currentFinancialYear + 1}-03-31`);
  
  const [contractedHours, setContractedHours] = useState(37.5);
  const [baseEntitlementDays, setBaseEntitlementDays] = useState(32); 
  
  const [workingDays, setWorkingDays] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false });
  const [dailyNetHours, setDailyNetHours] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 });

  const [useOverrideG, setUseOverrideG] = useState(false);
  const [manualBHDeduction, setManualBHDeduction] = useState(0);

  const leaveYearOptions = [];
  for (let i = -1; i <= 3; i++) {
    const y = currentFinancialYear + i;
    leaveYearOptions.push({
      label: `Apr ${y.toString().slice(-2)} / Mar ${(y + 1).toString().slice(-2)}`,
      value: y
    });
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const unsubscribe = onSnapshot(getRotaDocRef(), (docSnap) => {
        if (docSnap.exists() && docSnap.data().staffList) {
          setStaffList(docSnap.data().staffList);
        }
        setIsDbLoaded(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Error setting up snapshot:", e);
      setIsDbLoaded(true);
    }
  }, [user]);

  const handleStaffSelect = (e) => {
    const id = e.target.value;
    setSelectedStaffId(id);
    setImportAlerts([]);

    if (!id) {
      setDailyNetHours({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 });
      return;
    }

    const staff = staffList.find(s => s.id === parseInt(id));
    if (!staff) return;

    let alerts = [];

    if (staff.contractedHours && staff.contractedHours > 0) {
      setContractedHours(staff.contractedHours);
    } else {
      alerts.push("Contracted hours missing in profile. Please input manually.");
    }

    if (staff.schedule && Object.keys(staff.schedule).length > 0) {
      const dayMap = { 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6, 'Sunday': 0 };
      const newWorkingDays = { 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 0: false };
      const newDailyNetHours = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 0: 0 };
      let hasShifts = false;

      Object.keys(staff.schedule).forEach(dayName => {
        const shift = staff.schedule[dayName];
        if (shift && shift.start && shift.end) {
          newWorkingDays[dayMap[dayName]] = true;
          hasShifts = true;
          newDailyNetHours[dayMap[dayName]] = calculateHours(shift.start, shift.end).net;
        }
      });

      if (hasShifts) {
        setWorkingDays(newWorkingDays);
        setDailyNetHours(newDailyNetHours);
      } else {
        alerts.push("Schedule is empty. Please select standard working days manually.");
      }
    } else {
      alerts.push("No weekly schedule found. Please select standard working days manually.");
    }

    setImportAlerts(alerts);
  };

  const handleLeaveYearChange = (e) => {
    const year = parseInt(e.target.value);
    setSelectedLeaveYear(year);
    
    const newStart = `${year}-04-01`;
    const newEnd = `${year + 1}-03-31`;
    
    setLeaveYearStart(newStart);
    setLeaveYearEnd(newEnd);
    
    setDraftEmpStart(newStart);
    setDraftEmpEnd(newEnd);
    setEmpStart(newStart);
    setEmpEnd(newEnd);
  };

  const handleCalculateLeave = () => {
    setEmpStart(draftEmpStart);
    setEmpEnd(draftEmpEnd);
  };

  const toggleDay = (dayIndex) => {
    setWorkingDays(prev => ({ ...prev, [dayIndex]: !prev[dayIndex] }));
  };

  const calculations = useMemo(() => {
    const startObj = new Date(empStart);
    const endObj = new Date(empEnd);
    const leaveStartObj = new Date(leaveYearStart);
    const leaveEndObj = new Date(leaveYearEnd);
    
    const activeDaysPerWeek = Object.values(workingDays).filter(Boolean).length || 1;
    const hoursPerWorkingDay = contractedHours / activeDaysPerWeek;

    const daysInLeaveYear = Math.ceil((leaveEndObj - leaveStartObj) / (1000 * 60 * 60 * 24)) + 1;
    const effectiveStart = startObj > leaveStartObj ? startObj : leaveStartObj;
    const effectiveEnd = endObj < leaveEndObj ? endObj : leaveEndObj;
    const daysEmployed = Math.max(0, Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1);
    
    const proRataMultiplier = daysEmployed / daysInLeaveYear;

    const allBHs = [
      ...getUKBankHolidays(leaveStartObj.getFullYear()),
      ...getUKBankHolidays(leaveEndObj.getFullYear())
    ];
    
    const bhInLeaveYear = allBHs.filter((h, index, self) => {
      const d = h.date.getTime();
      return d >= leaveStartObj.getTime() && d <= leaveEndObj.getTime() && index === self.findIndex(t => t.date.getTime() === d);
    });

    const A = Number(baseEntitlementDays);
    const B = bhInLeaveYear.length; 
    const C = A + B;
    const D = C / 5;
    const E = Number(contractedHours);
    const F = D * E;

    const grossEntitlement = F * proRataMultiplier;

    const bhInEmployment = allBHs.filter((h, index, self) => {
      const d = h.date.getTime();
      return d >= effectiveStart.getTime() && d <= effectiveEnd.getTime() && index === self.findIndex(t => t.date.getTime() === d);
    });

    const relevantBankHolidays = bhInEmployment.map(h => {
      const dayOfWeek = h.date.getDay();
      const isWorkingDay = workingDays[dayOfWeek];
      
      let deduction = 0;
      if (isWorkingDay) {
         // Use the specific daily net hours if available, otherwise fallback to the average
         deduction = dailyNetHours[dayOfWeek] > 0 ? dailyNetHours[dayOfWeek] : hoursPerWorkingDay;
      }

      return {
        ...h,
        isWorkingDay,
        deduction
      };
    });

    const autoBHDeduction = relevantBankHolidays.reduce((sum, h) => sum + h.deduction, 0);
    const finalBHDeduction = useOverrideG ? Number(manualBHDeduction) : autoBHDeduction;

    const rawNetLeave = grossEntitlement - finalBHDeduction;
    const netLeave = Math.round(rawNetLeave * 2) / 2;

    return {
      proRataMultiplier,
      daysEmployed,
      daysInLeaveYear,
      A, B, C, D, E, F,
      grossEntitlement,
      finalBHDeduction,
      netLeave,
      relevantBankHolidays,
      hoursPerWorkingDay
    };
  }, [leaveYearStart, leaveYearEnd, empStart, empEnd, contractedHours, baseEntitlementDays, workingDays, dailyNetHours, useOverrideG, manualBHDeduction]);

  if (!isDbLoaded) {
    return (
      <div className="flex-1 bg-gray-50 flex items-center justify-center text-emerald-600 h-full">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
      </div>
    );
  }

  const activeStaff = staffList.filter(s => s.status !== 'Archived');

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto font-sans text-slate-800 print:p-0 print:max-w-full overflow-y-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 print:hidden">
         <div className="flex items-center gap-3">
           <Calculator className="w-8 h-8 text-emerald-600" />
           <h1 className="text-2xl font-black tracking-tight text-slate-900">Leave Calculator</h1>
         </div>
         
         <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex items-center gap-2">
           <UserCheck className="w-5 h-5 text-emerald-600 ml-2" />
           <select 
             className="bg-transparent font-medium outline-none text-sm p-1 cursor-pointer w-48 text-slate-700"
             value={selectedStaffId}
             onChange={handleStaffSelect}
           >
             <option value="">-- Manual Calculation --</option>
             {activeStaff.map(staff => (
               <option key={staff.id} value={staff.id}>{staff.name} - {staff.role}</option>
             ))}
           </select>
         </div>
      </div>

      {importAlerts.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 print:hidden">
          <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
            <AlertTriangle className="w-5 h-5" />
            Missing Profile Data
          </div>
          <ul className="list-disc pl-5 text-sm text-amber-700 space-y-1">
            {importAlerts.map((alert, idx) => (
              <li key={idx}>{alert}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6 print:hidden">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold border-b border-slate-100 pb-2 text-slate-800">Employment Details</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contracted Hours</label>
              <input type="number" step="0.5" className={`w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 ${importAlerts.some(a => a.includes('Contracted hours')) ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-300'}`} value={contractedHours} onChange={e => setContractedHours(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Base Entitlement (FTE Days)</label>
              <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" value={baseEntitlementDays} onChange={e => setBaseEntitlementDays(e.target.value)}>
                <option value="27">27 Days (0-5 Years)</option>
                <option value="29">29 Days (5-10 Years)</option>
                <option value="32">32 Days (Standard)</option>
                <option value="33">33 Days (10+ Years)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Standard Working Days</label>
              <div className={`flex gap-1 justify-between p-2 rounded-lg ${importAlerts.some(a => a.includes('Schedule is empty') || a.includes('No weekly schedule')) ? 'bg-amber-50 border border-amber-300' : ''}`}>
                {['M','T','W','T','F','S','S'].map((day, idx) => {
                  const dayIdx = idx === 6 ? 0 : idx + 1; 
                  return (
                    <button 
                      key={idx} 
                      onClick={() => toggleDay(dayIdx)}
                      className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${workingDays[dayIdx] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border border-slate-200'}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold border-b border-slate-100 pb-2 text-slate-800">Leave Period</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Financial Leave Year</label>
              <select 
                className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50 text-emerald-800 font-bold"
                value={selectedLeaveYear}
                onChange={handleLeaveYearChange}
              >
                {leaveYearOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Emp. Start</label>
                <input type="date" className="w-full p-1.5 text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-emerald-500" value={draftEmpStart} onChange={e => setDraftEmpStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Emp. End</label>
                <input type="date" className="w-full p-1.5 text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-emerald-500" value={draftEmpEnd} onChange={e => setDraftEmpEnd(e.target.value)} />
              </div>
            </div>

            <button 
              onClick={handleCalculateLeave}
              className="w-full py-2.5 mt-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Calculate Leave
            </button>
            
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-sm text-slate-600 font-medium cursor-pointer">
                <input type="checkbox" className="rounded text-emerald-500 w-4 h-4" checked={useOverrideG} onChange={() => setUseOverrideG(!useOverrideG)} />
                Manual BH Deduction Override
              </label>
              {useOverrideG && (
                <input type="number" step="0.5" className="w-full mt-2 p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Enter hours manually..." value={manualBHDeduction} onChange={e => setManualBHDeduction(e.target.value)} />
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden print:border print:border-slate-300 print:text-black print:bg-white print:shadow-none">
            <div className="absolute -right-10 -top-10 opacity-10 print:hidden"><Calculator className="w-48 h-48" /></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div className="space-y-4 w-full">
                <div>
                  <p className="text-emerald-400 font-bold tracking-widest text-sm uppercase mb-1 print:text-slate-500">Gross Leave Entitlement</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black">{calculations.grossEntitlement.toFixed(2)}</span>
                    <span className="text-lg text-slate-400 font-medium">hrs</span>
                  </div>
                </div>
                
                <div className="w-full h-px bg-slate-700 print:bg-slate-200"></div>
                
                <div className="flex justify-between items-center text-rose-400 print:text-rose-600">
                  <span className="font-medium text-sm">Less: Bank Holidays Taken</span>
                  <span className="font-bold text-lg">-{calculations.finalBHDeduction.toFixed(2)} hrs</span>
                </div>
              </div>

              <div className="bg-emerald-500 text-white p-5 rounded-xl w-full md:w-auto shrink-0 print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300">
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1 print:text-slate-500">Net Leave to Book</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-black">{calculations.netLeave.toFixed(2)}</span>
                  <span className="text-sm font-bold opacity-80">hrs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Calculation Formula</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex justify-between"><span>A (Base FT Leave):</span> <span className="font-bold text-slate-900">{calculations.A} Days</span></li>
                <li className="flex justify-between"><span>B (FT Bank Holidays):</span> <span className="font-bold text-slate-900">{calculations.B} Days</span></li>
                <li className="flex justify-between"><span>C (Total FT Days):</span> <span className="font-bold text-slate-900">{calculations.C} Days</span></li>
                <li className="flex justify-between"><span>D (Weeks per year):</span> <span className="font-bold text-slate-900">{calculations.D.toFixed(2)} Weeks</span></li>
                <li className="flex justify-between"><span>E (Worked hrs/week):</span> <span className="font-bold text-slate-900">{calculations.E} hrs</span></li>
                <li className="flex justify-between border-t border-slate-100 pt-1.5"><span>F (Total Hrs/Year):</span> <span className="font-bold text-slate-900">{calculations.F.toFixed(2)} hrs</span></li>
                <li className="flex justify-between border-t border-slate-100 pt-1.5 text-emerald-700"><span>Pro-Rata Adjustment:</span> <span className="font-bold">{calculations.daysEmployed} / {calculations.daysInLeaveYear} days</span></li>
              </ul>
            </div>

            {!useOverrideG && (
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-500" /> Auto BH Breakdown</h3>
                <div className="max-h-[150px] overflow-y-auto pr-2 space-y-2">
                  {calculations.relevantBankHolidays.filter(h => h.isWorkingDay).length > 0 ? (
                    calculations.relevantBankHolidays.filter(h => h.isWorkingDay).map((h, i) => (
                      <div key={i} className="flex justify-between items-center bg-slate-50 border border-slate-100 rounded p-2">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{h.name}</p>
                          <p className="text-[10px] text-slate-500">{h.date.toLocaleDateString('en-GB')}</p>
                        </div>
                        <span className="text-sm font-mono text-rose-600 font-bold">-{h.deduction.toFixed(2)}h</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-400 italic">No Bank Holidays fall on working days in this period.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
