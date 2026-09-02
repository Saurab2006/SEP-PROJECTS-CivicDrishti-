const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { randomAvatarHue } = require('../utils/avatarHue');


const wardValidator = {
  validator: function (v) {
    if (v === '' || v === null || v === undefined) return true; 
    return /^[1-9]\d*$/.test(v);
  },
  message: 'Ward must be a positive whole number',
};

const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['admin', 'researcher', 'ward_rep', 'municipality_head'], default: 'researcher' },
  organization: { type: String, default: 'Independent' },
  jobTitle:     { type: String, default: 'Citizen' },
  avatarHue:    { type: Number, default: randomAvatarHue },
  status:       { type: String, enum: ['active', 'suspended'], default: 'active' },
  emailVerified: { type: Boolean, default: false },
  emailOtpHash: { type: String, default: '' },
  emailOtpExpires: { type: Date, default: null },
  resetPasswordHash: { type: String, default: '' },
  resetPasswordExpires: { type: Date, default: null },

 
  phone:        { type: String, default: '', trim: true },

  civicLocation: {
    province: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    municipality: { type: String, default: '', trim: true },
    municipalityType: { type: String, enum: ['', 'municipality', 'rural_municipality', 'metropolitan', 'sub_metropolitan'], default: '' },
    ward: { type: String, default: '', trim: true, validate: wardValidator },
    address: { type: String, default: '', trim: true },
  },


  lastAddressChangeAt: { type: Date, default: null },

  // Identity verification (required at signup for researcher/citizen accounts).
  // Lets admins/analysts trace a report back to a verified identity if it's
  // ever flagged as fake.
  citizenshipDoc:     { type: String, default: '' }, 
  citizenshipNumber:  { type: String, default: '' }, 
  selfiePhoto:        { type: String, default: '' }, 
  selfiePhotoName:    { type: String, default: '' },
  faceMatchScore: { type: Number, default: null },  
  faceVerifiedAt: { type: Date, default: null },
  faceDescriptor:     { type: [Number], default: undefined }, 
  citizenshipDocName: { type: String, default: '' },
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected', 'n/a'], default: 'n/a' },
  municipalityHeadProfile: {
    province: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    municipality: { type: String, default: '', trim: true },
    municipalityType: { type: String, enum: ['', 'municipality', 'rural_municipality', 'metropolitan', 'sub_metropolitan'], default: '' },
    officePhone: { type: String, default: '', trim: true },
    officeAddress: { type: String, default: '', trim: true },
    assignedAt: { type: Date, default: null },
  },
  wardRepresentativeApplication: {
    requested: { type: Boolean, default: false },
    status: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    province: { type: String, default: '' },
    district: { type: String, default: '' },
    municipality: { type: String, default: '' },
    ward: { type: String, default: '', validate: wardValidator },
    details: { type: String, default: '' },
    document: { type: String, default: '' },
    documentName: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
  },
}, { timestamps: true });

userSchema.index({ role: 1, status: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ 'civicLocation.province': 1, 'civicLocation.district': 1, 'civicLocation.municipality': 1, 'civicLocation.ward': 1 });
userSchema.index({ 'municipalityHeadProfile.district': 1, 'municipalityHeadProfile.municipality': 1 });
userSchema.index({ citizenshipNumber: 1 }, { unique: true, partialFilterExpression: { citizenshipNumber: { $type: 'string', $ne: '' } } });

userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    organization: this.organization,
    jobTitle: this.jobTitle,
    avatarHue: this.avatarHue,
    status: this.status,
    emailVerified: this.emailVerified,
    phone: this.phone,
    civicLocation: this.civicLocation,
    lastAddressChangeAt: this.lastAddressChangeAt,
    municipalityHeadProfile: this.municipalityHeadProfile,
    verificationStatus: this.verificationStatus,
    hasCitizenshipDoc: !!this.citizenshipDoc,
    hasCitizenshipNumber: !!this.citizenshipNumber,
    faceMatchScore: this.faceMatchScore,
    faceVerifiedAt: this.faceVerifiedAt,
    wardRepresentativeApplication: this.wardRepresentativeApplication,
    createdAt: this.createdAt,
  };
};

userSchema.methods.toPublicSelf = function () {
  return { ...this.toPublic(), selfiePhoto: this.selfiePhoto || '' };
};

userSchema.methods.toAdminList = function () {
  return { ...this.toPublic(), selfiePhoto: this.selfiePhoto || '' };
};
module.exports = mongoose.model('User', userSchema);