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
  { id: 1, name: 'Michelle Scotney', role: 'Nurse', status: 'Active', skills: ['Minor Illness', 'Chronic Disease', 'Bloods', 'Smears', 'Immunisations'], records: {}, remarks: '' },
  { id: 2, name: 'Sarah (RN)', role: 'Nurse', status: 'Active', skills: ['Bloods', 'Smears', 'Immunisations'], records: {}, remarks: '' },
  { id: 3, name: 'John (ANP)', role: 'ANP', status: 'Active', skills: ['Minor Illness', 'Chronic Disease'], records: {}, remarks: '' },
  { id: 4, name: 'Emma (HCA)', role: 'HCA', status: 'Active', skills: ['Bloods'], records: {}, remarks: '' },
];
