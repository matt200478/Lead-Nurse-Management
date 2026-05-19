export const INITIAL_ROOMS = [
  { id: 1, name: 'Room 1', color: '#3b82f6' },
  { id: 2, name: 'Room 2', color: '#14b8a6' },
  { id: 3, name: 'Room 3', color: '#ef4444' },
  { id: 4, name: 'Treatment Room', color: '#a855f7' }
];

export const INITIAL_TARGETS = {
  'Minor Illness': 4,
  'Chronic Disease': 2,
  'Bloods': 6,
  'Smears': 2,
  'Immunisations': 3
};

export const INITIAL_CLINIC_COLORS = {
  'Minor Illness': '#c084fc',
  'Chronic Disease': '#fb923c',
  'Bloods': '#f87171',
  'Smears': '#f472b6',
  'Immunisations': '#2dd4bf'
};

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
export const WEEKENDS = ['Saturday', 'Sunday'];

export const INITIAL_UNIFIED_STAFF = [
  { 
    id: 1, 
    name: 'Michelle Scotney', 
    role: 'Nurse', 
    status: 'Active', 
    skills: ['Minor Illness', 'Chronic Disease', 'Bloods', 'Smears', 'Immunisations'], 
    records: {}, 
    remarks: '',
    contractedHours: 37.5,
    requiresWeekends: false,
    schedule: {
      'Monday': { start: '08:00', end: '16:00' },
      'Tuesday': { start: '08:00', end: '16:00' },
      'Wednesday': { start: '08:00', end: '16:00' },
      'Thursday': { start: '08:00', end: '16:00' },
      'Friday': { start: '08:00', end: '15:30' }
    }
  },
  { 
    id: 2, 
    name: 'Sarah (RN)', 
    role: 'Nurse', 
    status: 'Active', 
    skills: ['Bloods', 'Smears', 'Immunisations'], 
    records: {}, 
    remarks: '',
    contractedHours: 20,
    requiresWeekends: true,
    schedule: {
      'Monday': { start: '08:00', end: '18:30' }, // Will trigger EA badge
      'Wednesday': { start: '08:00', end: '18:30' }
    }
  }
];

export const INITIAL_TRAINING_COURSES = [
  { name: 'Independent Prescriber', freq: 12 },
  { name: 'Acute illness', freq: null },
  { name: 'Imms and Vacs', freq: 12 },
  { name: 'Cytology', freq: 36 },
  { name: 'Dressings', freq: null },
  { name: 'COPD', freq: 12 },
  { name: 'Asthma', freq: 12 },
  { name: 'HTN', freq: 12 },
  { name: 'CHD', freq: 12 },
  { name: 'CKD', freq: 12 },
  { name: 'HF', freq: 12 },
  { name: 'Diabetes', freq: 12 },
  { name: 'Vaginal Pessary', freq: null },
  { name: 'CHC', freq: 12 },
  { name: 'POP', freq: 12 },
  { name: 'Phlebotomy', freq: null },
  { name: 'Revalidation', freq: 36 },
  { name: 'Mentor', freq: 12 }
];
