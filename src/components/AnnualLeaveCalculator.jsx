import React, { useState, useMemo } from 'react';
import { Calculator, CalendarDays, Clock, Activity } from 'lucide-react';

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

export default function AnnualLeaveCalculator() {
  const currentYear = new Date().getFullYear();
  const [leaveYearStart, setLeaveYearStart] = useState(`${currentYear}-04-01`);
  const [leaveYearEnd, setLeaveYearEnd] = useState(`${currentYear + 1}-03-31`);
  const [empStart, setEmpStart] = useState(`${currentYear}-04-01`);
  const [empEnd, setEmpEnd] = useState(`${currentYear + 1}-03-31`);
  
  const [contractedHours, setContractedHours] = useState(37.5);
  const [standardFTEHours, setStandardFTEHours] = useState(37.5);
  const [baseEntitlementDays, setBaseEntitlementDays] = useState(27);
  
  const [workingDays, setWorkingDays] = useState({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 0: false });
  const [useOverrideG, setUseOverrideG] = useState(false);
  const [manualBHDeduction, setManualBHDeduction] = useState(0);

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
    const wte = contractedHours / standardFTEHours;

    const daysInLeaveYear = Math.ceil((leaveEndObj - leaveStartObj) / (1000 * 60 * 60 * 24)) + 1;
    const effectiveStart = startObj > leaveStartObj ? startObj : leaveStartObj;
    const effectiveEnd = endObj < leaveEndObj ? endObj : leaveEndObj;
    const daysEmployed = Math.max(0, Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1);
    
    const proRataMultiplier = daysEmployed / daysInLeaveYear;

    const standardDailyHours = standardFTEHours / 5;
    const fullYearBaseHours = baseEntitlementDays * standardDailyHours * wte;
    const proRataBaseHours = fullYearBaseHours * proRataMultiplier;

    const allBHs = [
      ...getUKBankHolidays(leaveStartObj.getFullYear()),
      ...getUKBankHolidays(leaveEndObj.getFullYear())
    ];
    
    const bhInLeaveYear = allBHs.filter((h, index, self) => {
      const d = h.date.getTime();
      return d >= leaveStartObj.getTime() && d <= leaveEndObj.getTime() && index === self.findIndex(t => t.date.getTime() === d);
    });

    const fullYearBHHours = bhInLeaveYear.length * standardDailyHours * wte;
    const proRataBHHours = fullYearBHHours * proRataMultiplier;

    const grossEntitlement = proRataBaseHours + proRataBHHours;

    const bhInEmployment = allBHs.filter((h, index, self) => {
      const d = h.date.getTime();
      return d >= effectiveStart.getTime() && d <= effectiveEnd.getTime() && index === self.findIndex(t => t.date.getTime() === d);
    });

    const relevantBankHolidays = bhInEmployment.map(h => ({
      ...h,
      isWorkingDay: workingDays[h.date.getDay()],
      deduction: workingDays[h.date.getDay()] ? hoursPerWorkingDay : 0
    }));

    const autoBHDeduction = relevantBankHolidays.reduce((sum, h) => sum + h.deduction, 0);
    const finalBHDeduction = useOverrideG ? Number(manualBHDeduction) : autoBHDeduction;

    const netLeave = grossEntitlement - finalBHDeduction;

    return {
      wte,
      proRataMultiplier,
      daysEmployed,
      daysInLeaveYear,
      grossEntitlement,
      proRataBaseHours,
      proRataBHHours,
      finalBHDeduction,
      netLeave,
      relevantBankHolidays,
      hoursPerWorkingDay
    };
  }, [leaveYearStart, leaveYearEnd, empStart, empEnd, contractedHours, standardFTEHours, baseEntitlementDays, workingDays, useOverrideG, manualBHDeduction]);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto font-sans text-slate-800 print:p-0 print:max-w-full">
      <div className="flex items-center gap-3 mb-6 print:hidden">
         <Calculator className="w-8 h-8 text-emerald-600" />
         <h1 className="text-2xl font-black tracking-tight text-slate-900">Leave Calculator</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6 print:hidden">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold border-b border-slate-100 pb-2 text-slate-800">Employment Details</h3>
            
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Contracted Hours</label>
              <input type="number" step="0.5" className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" value={contractedHours} onChange={e => setContractedHours(e.target.value)} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Base Entitlement (FTE Days)</label>
              <select className="w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50" value={baseEntitlementDays} onChange={e => setBaseEntitlementDays(e.target.value)}>
                <option value="27">27 Days (0-5 Years)</option>
                <option value="29">29 Days (5-10 Years)</option>
                <option value="33">33 Days (10+ Years)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Standard Working Days</label>
              <div className="flex gap-1 justify-between">
                {['M','T','W','T','F','S','S'].map((day, idx) => {
                  const dayIdx = idx === 6 ? 0 : idx + 1; 
                  return (
                    <button 
                      key={idx} 
                      onClick={() => toggleDay(dayIdx)}
                      className={`w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center transition-colors ${workingDays[dayIdx] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Emp. Start</label>
                <input type="date" className="w-full p-1.5 text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-emerald-500" value={empStart} onChange={e => setEmpStart(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Emp. End</label>
                <input type="date" className="w-full p-1.5 text-sm border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-emerald-500" value={empEnd} onChange={e => setEmpEnd(e.target.value)} />
              </div>
            </div>
            
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
                  <span className="font-medium text-sm">Less: Bank Holidays Taken (Row G)</span>
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
              <h3 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wider flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Pro-Rata Stats</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex justify-between"><span>WTE:</span> <span className="font-bold text-slate-900">{calculations.wte.toFixed(4)}</span></li>
                <li className="flex justify-between"><span>Days in Period:</span> <span className="font-bold text-slate-900">{calculations.daysEmployed} / {calculations.daysInLeaveYear}</span></li>
                <li className="flex justify-between border-t border-slate-100 pt-2"><span>Pro-Rata Base Hrs:</span> <span className="font-bold text-slate-900">{calculations.proRataBaseHours.toFixed(2)}</span></li>
                <li className="flex justify-between"><span>Pro-Rata BH Hrs:</span> <span className="font-bold text-slate-900">{calculations.proRataBHHours.toFixed(2)}</span></li>
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
