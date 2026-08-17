require('dns').setServers(['8.8.8.8', '8.8.4.4']);
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Document = require('../models/Document');
const BudgetItem = require('../models/BudgetItem');
const WardUnit = require('../models/WardUnit');
const BudgetFeedback = require('../models/BudgetFeedback');
const IncidentReport = require('../models/IncidentReport');

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || undefined;

const PROVINCE = 'Koshi Province';
const FY = '2081/82';

const rows = [
  ['Morang','Biratnagar Metropolitan City','01','Biratnagar Ward 01 Drainage Upgrade','Urban Development Office','Sanitation & Waste Management','Capital Expenditure','Infrastructure',42000000,42000000,28000000,25000000,21000000,'ongoing',62],
  ['Morang','Biratnagar Metropolitan City','02','Keshaliya Road Blacktop and Footpath','Department of Roads','Roads & Transportation','Capital Expenditure','Infrastructure',65000000,72000000,43000000,41000000,33000000,'ongoing',58],
  ['Morang','Biratnagar Metropolitan City','03','Community Health Post Equipment Support','Health Section','Health','Capital Expenditure','Service Program',18000000,18000000,16000000,12000000,11000000,'completed',100],
  ['Morang','Biratnagar Metropolitan City','04','Ward School Digital Classroom Program','Education Section','Education','Capital Expenditure','Service Program',22000000,22000000,12000000,9000000,7000000,'ongoing',45],
  ['Morang','Biratnagar Metropolitan City','05','Ward 05 Road Improvement Project','Department of Roads','Roads & Transportation','Capital Expenditure','Infrastructure',80000000,100000000,64000000,59000000,51000000,'ongoing',67],
  ['Morang','Biratnagar Metropolitan City','06','Street Light Expansion - Main Market Belt','Electricity / Street Lighting Unit','Electricity / Street Lighting','Capital Expenditure','Infrastructure',15000000,15000000,9000000,8500000,6000000,'ongoing',55],
  ['Morang','Biratnagar Metropolitan City','07','Drinking Water Pipeline Replacement','Water Supply Office','Drinking Water','Capital Expenditure','Maintenance',36000000,36000000,26000000,24000000,18000000,'delayed',40],
  ['Morang','Biratnagar Metropolitan City','08','Ward Agriculture Collection Center','Agriculture Section','Agriculture','Capital Expenditure','Infrastructure',24000000,24000000,8000000,6000000,3500000,'planned',15],
  ['Morang','Biratnagar Metropolitan City','09','Urban Flood Early Response Store','Disaster Management Unit','Disaster Management','Recurrent Expenditure','Service Program',12000000,12000000,12000000,9000000,9000000,'completed',100],
  ['Morang','Biratnagar Metropolitan City','10','Public Toilet and Waste Transfer Point','Sanitation Unit','Sanitation & Waste Management','Capital Expenditure','Infrastructure',19000000,21000000,15000000,14000000,10000000,'ongoing',70],
  ['Morang','Biratnagar Metropolitan City','11','Ward Office Service Digitization','Municipal Executive','Public Buildings','Capital Expenditure','Service Program',9000000,9000000,7000000,6500000,6500000,'completed',100],
  ['Morang','Biratnagar Metropolitan City','12','Inner Lane Gravel and Culvert Works','Department of Roads','Roads & Transportation','Capital Expenditure','Maintenance',31000000,31000000,11000000,9000000,5000000,'ongoing',35],
  ['Morang','Biratnagar Metropolitan City','13','Primary School Boundary and Safety Wall','Education Section','Education','Capital Expenditure','Infrastructure',16000000,16000000,4000000,3000000,2000000,'planned',18],
  ['Morang','Biratnagar Metropolitan City','14','Community Park and Open Space Improvement','Urban Development Office','Environment','Capital Expenditure','Infrastructure',27000000,30000000,17000000,15000000,9000000,'delayed',32],
  ['Morang','Biratnagar Metropolitan City','15','Maternal Health Outreach Program','Health Section','Health','Recurrent Expenditure','Service Program',11000000,11000000,9000000,7000000,7000000,'completed',100],
  ['Morang','Biratnagar Metropolitan City','16','Ward Riverbank Protection Demo Project','Disaster Management Unit','Disaster Management','Capital Expenditure','Infrastructure',44000000,50000000,20000000,18000000,9000000,'delayed',22],
  ['Morang','Biratnagar Metropolitan City','17','Solar Street Light Pilot Corridor','Electricity / Street Lighting Unit','Electricity / Street Lighting','Capital Expenditure','Infrastructure',13000000,13000000,6000000,5500000,2500000,'ongoing',30],
  ['Morang','Biratnagar Metropolitan City','18','Community Library Repair and Reading Room','Education Section','Education','Capital Expenditure','Maintenance',8000000,8000000,6500000,6000000,5500000,'completed',100],
  ['Morang','Biratnagar Metropolitan City','19','Rural Link Road Drain Crossing','Department of Roads','Roads & Transportation','Capital Expenditure','Infrastructure',38000000,38000000,14000000,13000000,6000000,'ongoing',28],
  ['Morang','Sundarharaicha Municipality','04','Sundarharaicha Ward 04 Drinking Water Tank','Water Supply Office','Drinking Water','Capital Expenditure','Infrastructure',33000000,33000000,18000000,17000000,12000000,'ongoing',60],
  ['Morang','Belbari Municipality','07','Belbari Agriculture Irrigation Canal Repair','Agriculture Section','Agriculture','Capital Expenditure','Maintenance',26000000,28000000,14000000,12000000,9000000,'ongoing',48],
  ['Morang','Pathari-Shanishchare Municipality','03','Pathari Road Safety and Drainage Works','Department of Roads','Roads & Transportation','Capital Expenditure','Infrastructure',41000000,41000000,16000000,13000000,8000000,'delayed',25],
  ['Sunsari','Dharan Sub-Metropolitan City','08','Dharan Ward 08 Water Source Protection','Water Supply Office','Drinking Water','Capital Expenditure','Infrastructure',37000000,37000000,22000000,21000000,15000000,'ongoing',64],
  ['Sunsari','Itahari Sub-Metropolitan City','06','Itahari Bus Park Drain and Pavement','Urban Development Office','Roads & Transportation','Capital Expenditure','Infrastructure',58000000,62000000,39000000,36000000,30000000,'ongoing',72],
  ['Sunsari','Inaruwa Municipality','02','Inaruwa Ward Health Outreach Center','Health Section','Health','Capital Expenditure','Public Buildings',25000000,25000000,18000000,16000000,15000000,'completed',100],
  ['Jhapa','Bhadrapur Municipality','05','Bhadrapur Ward 05 School Sanitation Block','Education Section','Education','Capital Expenditure','Infrastructure',14000000,14000000,9000000,8500000,7000000,'ongoing',75],
  ['Jhapa','Mechinagar Municipality','09','Mechinagar Agriculture Market Shed','Agriculture Section','Agriculture','Capital Expenditure','Infrastructure',32000000,35000000,17000000,15000000,9000000,'ongoing',50],
  ['Ilam','Ilam Municipality','04','Ilam Tourism Foot Trail Safety Upgrade','Tourism Office','Tourism','Capital Expenditure','Infrastructure',21000000,21000000,10000000,8500000,4000000,'ongoing',38],
  ['Ilam','Suryodaya Municipality','07','Suryodaya Tea Road Maintenance Demo Project','Department of Roads','Roads & Transportation','Capital Expenditure','Maintenance',29000000,29000000,19000000,18000000,16000000,'completed',100],
  ['Dhankuta','Dhankuta Municipality','03','Dhankuta Hospital Access Road Repair','Department of Roads','Roads & Transportation','Capital Expenditure','Maintenance',23000000,23000000,13000000,12000000,8000000,'ongoing',56],
  ['Dhankuta','Pakhribas Municipality','06','Pakhribas Landslide Mitigation Wall','Disaster Management Unit','Disaster Management','Capital Expenditure','Infrastructure',34000000,39000000,14000000,12000000,6000000,'delayed',24],
];

async function main() {
  if (!uri) throw new Error('MONGODB_URI is required to seed showcase data');
  await mongoose.connect(uri, { dbName, serverSelectionTimeoutMS: 10000 });
  const demoPasswordHash = await bcrypt.hash('Showcase123!', 12);

  const admin = await User.findOneAndUpdate(
    { email: 'showcase.admin@civicdrishti.demo' },
    { name: 'Civicदृष्टि Showcase Admin', email: 'showcase.admin@civicdrishti.demo', password: demoPasswordHash, role: 'admin', organization: 'Civicदृष्टि Demo', jobTitle: 'Demo data owner', status: 'active', emailVerified: true, verificationStatus: 'verified' },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  const doc = await Document.findOneAndUpdate(
    { user: admin._id, title: 'Koshi Province Showcase Demo Budget Register 2081/82' },
    { user: admin._id, title: 'Koshi Province Showcase Demo Budget Register 2081/82', fileName: 'koshi-showcase-demo-budget.xlsx', docType: 'budget', fiscalYear: FY, district: 'Morang', municipality: 'Biratnagar Metropolitan City', totalBudget: rows.reduce((s, r) => s + r[9], 0), summary: 'Demo Data only. Showcase public budget records for Civicदृष्टि.' },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  let upserted = 0;
  for (const r of rows) {
    const [district, municipality, ward, title, department, sector, expenditureType, programType, amount, revisedBudget, releasedAmount, contractedAmount, paidAmount, status, completionOverride] = r;
    const wardUnit = await WardUnit.findOneAndUpdate(
      { province: PROVINCE, district, municipality, ward },
      { province: PROVINCE, district, municipality, ward, createdBy: admin._id },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    const item = await BudgetItem.findOneAndUpdate(
      { title, district, municipality, ward, fiscalYear: FY },
      {
        user: admin._id,
        wardUnit: wardUnit._id,
        document: doc._id,
        title,
        department,
        sector,
        expenditureType,
        programType,
        fundingSources: [
          { source: 'Federal Government Grant', amount: Math.round(revisedBudget * 0.45) },
          { source: 'Provincial Government Grant', amount: Math.round(revisedBudget * 0.25) },
          { source: 'Local Level Budget', amount: revisedBudget - Math.round(revisedBudget * 0.45) - Math.round(revisedBudget * 0.25) },
        ],
        amount,
        originalApprovedBudget: amount,
        revisedBudget,
        releasedAmount,
        contractedAmount,
        paidAmount,
        spent: paidAmount,
        status,
        completionOverride,
        fiscalYear: FY,
        province: PROVINCE,
        district,
        municipality,
        ward,
        page: 1,
        confidence: 1,
        isDemo: true,
        demoLabel: 'Demo Data / Sample Project',
        responsibleAuthority: department,
        evidenceDocuments: [{ title: 'Demo budget evidence placeholder', url: '#', uploadedAt: new Date() }],
        progressPhotos: [],
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    upserted += 1;
  }

  console.log(`Seeded ${upserted} Koshi showcase budget records with demo labels.`);
  await mongoose.disconnect();
}

main().catch(async err => { console.error(err); try { await mongoose.disconnect(); } catch {} process.exit(1); });