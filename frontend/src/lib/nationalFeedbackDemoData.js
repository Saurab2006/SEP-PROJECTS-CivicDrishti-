// Demo dataset for the national "Community Feedback" board on the Public
// Budget page. This is entirely synthetic/illustrative data (clearly
// labelled "Demo Data" wherever it is displayed) covering all 7 provinces
// of Nepal, cascading down to district / municipality / ward, so the
// search & filter UX can be demonstrated end-to-end without depending on
// a live nationwide feedback dataset.

export const NEPAL_LOCATIONS = {
  Koshi: {
    Morang: { 'Biratnagar Metropolitan City': [1, 3, 5, 7, 9], 'Rangeli Municipality': [1, 2, 4] },
    Sunsari: { 'Itahari Sub-Metropolitan City': [2, 4, 6, 8], 'Dharan Sub-Metropolitan City': [1, 5, 9] },
  },
  Madhesh: {
    Dhanusha: { 'Janakpur Sub-Metropolitan City': [1, 3, 6, 8], 'Mithila Municipality': [2, 4] },
    Bara: { 'Kalaiya Sub-Metropolitan City': [1, 4, 7], 'Simraungadh Municipality': [2, 5] },
  },
  Bagmati: {
    Kathmandu: { 'Kathmandu Metropolitan City': [3, 6, 9, 12, 15], 'Kirtipur Municipality': [1, 4] },
    Lalitpur: { 'Lalitpur Metropolitan City': [2, 5, 8], 'Godawari Municipality': [1, 3] },
  },
  Gandaki: {
    Kaski: { 'Pokhara Metropolitan City': [1, 4, 7, 10], 'Annapurna Rural Municipality': [2, 5] },
    Tanahun: { 'Byas Municipality': [1, 3, 6], 'Shuklagandaki Municipality': [2, 4] },
  },
  Lumbini: {
    Rupandehi: { 'Butwal Sub-Metropolitan City': [1, 5, 9, 11], 'Siddharthanagar Municipality': [2, 4] },
    Dang: { 'Ghorahi Sub-Metropolitan City': [1, 3, 6], 'Tulsipur Sub-Metropolitan City': [2, 5] },
  },
  Karnali: {
    Surkhet: { 'Birendranagar Municipality': [1, 3, 5, 7], 'Gurbhakot Municipality': [2, 4] },
    Jumla: { 'Chandannath Municipality': [1, 2, 4], 'Kanaka Sudan Rural Municipality': [1, 3] },
  },
  Sudurpashchim: {
    Kailali: { 'Dhangadhi Sub-Metropolitan City': [1, 4, 8, 10], 'Tikapur Municipality': [2, 5] },
    Kanchanpur: { 'Bhimdatta Municipality': [1, 3, 6, 9], 'Punarbas Municipality': [2, 4] },
  },
};

export const PROVINCES = Object.keys(NEPAL_LOCATIONS);

export function districtsOf(province) {
  return province && NEPAL_LOCATIONS[province] ? Object.keys(NEPAL_LOCATIONS[province]) : [];
}
export function municipalitiesOf(province, district) {
  return province && district && NEPAL_LOCATIONS[province]?.[district] ? Object.keys(NEPAL_LOCATIONS[province][district]) : [];
}
export function wardsOf(province, district, municipality) {
  return province && district && municipality ? (NEPAL_LOCATIONS[province]?.[district]?.[municipality] || []) : [];
}

export const SECTORS = ['Infrastructure', 'Education', 'Health', 'Water & Sanitation', 'Agriculture', 'Roads & Transport', 'Social Program'];
export const FISCAL_YEARS = ['2079/80', '2080/81', '2081/82', '2082/83'];
export const FEEDBACK_TYPES = [
  { value: 'yes', label: 'Yes' },
  { value: 'partially', label: 'Partially' },
  { value: 'no', label: 'No' },
];
export const VERIFICATION_STATUSES = ['Verified', 'Pending Review', 'Unverified'];

const PROJECT_TEMPLATES = [
  ['Infrastructure', 'Ward Road Blacktopping Project'],
  ['Infrastructure', 'Community Building Reconstruction'],
  ['Water & Sanitation', 'Drinking Water Supply Scheme'],
  ['Water & Sanitation', 'Public Toilet Construction'],
  ['Health', 'Community Health Post Upgrade'],
  ['Education', 'School Building Reconstruction'],
  ['Roads & Transport', 'Rural Road Gravel Upgrade'],
  ['Roads & Transport', 'Bridge Construction Project'],
  ['Agriculture', 'Irrigation Canal Rehabilitation'],
  ['Social Program', 'Street Light Installation'],
  ['Infrastructure', 'Flood Control Embankment'],
  ['Social Program', 'Public Park Development'],
];

const CITIZEN_NAMES = [
  'Sita Rai', 'Ram Bahadur Thapa', 'Anita Chaudhary', 'Bishnu Prasad Yadav', 'Kamala Gurung',
  'Suresh Tamang', 'Gita Sharma', 'Hari Prasad Poudel', 'Sunita Magar', 'Dipak Karki',
  'Manisha Shrestha', 'Krishna Bahadur Bista', 'Radha Devi Sah', 'Prakash Limbu', 'Anjali Basnet',
];

const COMMENTS = {
  yes: [
    'The work looks complete and matches what was promised to the ward.',
    'Good quality construction, the community is satisfied with the outcome.',
    'Project finished on time and is already being used by residents.',
    'Clear improvement over the previous condition, well executed.',
  ],
  partially: [
    'Work is progressing but quality of materials used is questionable in places.',
    'Only part of the project area has been completed so far.',
    'Some progress visible, but pace has slowed down in recent months.',
    'Structure is built but finishing and safety details are still pending.',
  ],
  no: [
    'No visible work at the site despite the budget being marked as released.',
    'Construction stalled for months with no update from the ward office.',
    'Quality of work is poor and already showing damage.',
    'Funds appear allocated but nothing has started on the ground yet.',
  ],
};

function pick(arr, i) { return arr[i % arr.length]; }

function buildFeedback() {
  const rows = [];
  let idx = 0;
  const baseDate = new Date('2026-08-01T00:00:00Z').getTime();

  for (const province of PROVINCES) {
    for (const district of districtsOf(province)) {
      for (const municipality of municipalitiesOf(province, district)) {
        for (const ward of wardsOf(province, district, municipality)) {
          const [sector, projectName] = pick(PROJECT_TEMPLATES, idx);
          const type = pick(FEEDBACK_TYPES, idx).value;
          const isAnonymous = idx % 3 === 0;
          const name = isAnonymous ? '' : pick(CITIZEN_NAMES, idx + 2);
          const verification = pick(VERIFICATION_STATUSES, idx + 1);
          const fiscalYear = pick(FISCAL_YEARS, idx + 3);
          const hasPhoto = idx % 2 === 0;
          const daysAgo = (idx * 7) % 420;

          rows.push({
            id: `demo-fb-${idx + 1}`,
            citizenName: name,
            isAnonymous,
            province,
            district,
            municipality,
            ward: String(ward),
            project: `${projectName} - Ward ${ward}`,
            sector,
            fiscalYear,
            feedbackType: type,
            comment: pick(COMMENTS[type], idx),
            date: new Date(baseDate - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
            hasPhoto,
            photoColor: ['#dcefe9', '#fbe9dc', '#e6e0f7', '#fde4e4', '#e2f0fb'][idx % 5],
            verificationStatus: verification,
            isDemo: true,
          });
          idx += 1;
        }
      }
    }
  }
  return rows;
}

export const DEMO_NATIONAL_FEEDBACK = buildFeedback();