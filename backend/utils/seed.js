const User = require('../models/User');
const Document = require('../models/Document');
const BudgetItem = require('../models/BudgetItem');
const Project = require('../models/Project');
const Activity = require('../models/Activity');

const SECTORS = ['Roads & Transport', 'Health', 'Education', 'Drinking Water', 'Agriculture', 'Energy', 'Urban Development', 'Disaster Management'];
const DEPTS = ['Municipal Executive', 'Department of Roads', 'Ministry of Health', 'Ministry of Education', 'Water Supply Dept', 'Agriculture Dept', 'Energy Dept', 'Urban Development Dept'];
const DISTRICTS = ['Kathmandu', 'Kaski', 'Chitwan', 'Rupandehi', 'Sunsari', 'Kailali'];
const MUNIS = ['Kathmandu Metro', 'Pokhara Metro', 'Bharatpur Metro', 'Butwal Sub-Metro', 'Dharan Sub-Metro', 'Dhangadhi Sub-Metro'];
const FYS = ['2079/80', '2080/81', '2081/82'];
const STATUSES = ['planned', 'ongoing', 'completed', 'delayed'];

const DOCS = [
  { title: 'Kathmandu Metropolitan City — Annual Budget', docType: 'budget', fiscalYear: '2081/82', district: 'Kathmandu', municipality: 'Kathmandu Metro' },
  { title: 'Pokhara Metropolitan City — Annual Budget', docType: 'budget', fiscalYear: '2080/81', district: 'Kaski', municipality: 'Pokhara Metro' },
  { title: 'Office of Auditor General — Audit Report', docType: 'audit', fiscalYear: '2080/81', district: 'Chitwan', municipality: 'Bharatpur Metro' },
  { title: 'Butwal Sub-Metro — Development Plan', docType: 'development-plan', fiscalYear: '2081/82', district: 'Rupandehi', municipality: 'Butwal Sub-Metro' },
  { title: 'Dept of Roads — Procurement Notice', docType: 'procurement', fiscalYear: '2081/82', district: 'Sunsari', municipality: 'Dharan Sub-Metro' },
  { title: 'Dhangadhi Sub-Metro — Annual Report', docType: 'annual-report', fiscalYear: '2079/80', district: 'Kailali', municipality: 'Dhangadhi Sub-Metro' },
];

const PROJ_NAMES = [
  'Ring Road Section B Upgrade', 'Ward 12 Health Post Construction', 'Seti River Bridge', 'Water Supply Network Extension',
  'Kalika School Block', 'Solar Street Lighting Grid', 'Sanitary Landfill Site', 'Bus Park Transit Hub',
  'Flood Embankment Riverside', 'Municipal Data Centre', 'Agriculture Collection Centre', 'Heritage Walkway Restoration',
];

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

async function seedForUser(userId) {
  const existing = await Document.countDocuments({ user: userId });
  if (existing >= 6) return 0;

  const r = rng(Date.now());
  let created = 0;

  for (const spec of DOCS) {
    const totalBudget = (1 + r() * 8) * 1e9;
    const doc = await Document.create({
      user: userId, ...spec,
      fileName: spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.pdf',
      fileSize: 800000 + Math.floor(r() * 2000000),
      organization: spec.municipality,
      totalBudget,
      summary: `This ${spec.docType} for FY ${spec.fiscalYear} from ${spec.municipality} contains extracted budget lines worth Rs ${(totalBudget / 1e9).toFixed(2)} Arab across multiple sectors and departments.`,
      highlights: [
        `Total allocation: Rs ${(totalBudget / 1e9).toFixed(2)} Arab`,
        `${6 + Math.floor(r() * 12)} departments mapped`,
        `${8 + Math.floor(r() * 20)} projects detected`,
      ],
      keywords: ['budget', 'allocation', spec.district.toLowerCase(), spec.municipality.toLowerCase().split(' ')[0]],
    });

    const numItems = 12 + Math.floor(r() * 18);
    const items = [];
    for (let i = 0; i < numItems; i++) {
      const sector = pick(r, SECTORS);
      items.push({
        user: userId, document: doc._id,
        title: `${pick(r, ['Construction of', 'Upgrading of', 'Rehabilitation of', 'Expansion of'])} ${pick(r, ['Ward Office', 'Road Section', 'Health Post', 'School Block', 'Water Tank', 'Bridge', 'Street Lights', 'Market Centre'])} — ${spec.municipality}`,
        department: pick(r, DEPTS),
        sector,
        amount: (0.2 + r() * 12) * 1e7,
        fiscalYear: spec.fiscalYear,
        district: spec.district,
        page: 1 + Math.floor(r() * 8),
        confidence: 0.82 + r() * 0.16,
      });
    }
    await BudgetItem.insertMany(items);

    const numProjects = 4 + Math.floor(r() * 8);
    const projects = [];
    for (let i = 0; i < numProjects; i++) {
      projects.push({
        user: userId, document: doc._id,
        name: pick(r, PROJ_NAMES),
        sector: pick(r, SECTORS),
        status: pick(r, STATUSES),
        budget: (0.5 + r() * 18) * 1e7,
        district: spec.district,
        fiscalYear: spec.fiscalYear,
      });
    }
    await Project.insertMany(projects);
    created++;
  }

  await Activity.create({ user: userId, type: 'account', message: 'Workspace seeded with 6 sample documents' });
  return created;
}

module.exports = { seedForUser };
