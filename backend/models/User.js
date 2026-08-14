const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { randomAvatarHue } = require('../utils/avatarHue');

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

  // Phone number, normalized to digits only (e.g. "9779812345678").
  // Used to identify citizens reporting issues over SMS, since a text
  // message can't carry a JWT ” the phone number is the identity.
  phone:        { type: String, default: '', trim: true },

  civicLocation: {
    province: { type: String, default: '', trim: true },
    district: { type: String, default: '', trim: true },
    municipality: { type: String, default: '', trim: true },
    municipalityType: { type: String, enum: ['', 'municipality', 'rural_municipality', 'metropolitan', 'sub_metropolitan'], default: '' },
    ward: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
  },

  // Identity verification (required at signup for researcher/citizen accounts).
  // Lets admins/analysts trace a report back to a verified identity if it's
  // ever flagged as fake.
  citizenshipDoc:     { type: String, default: '' }, // base64 data URL of the uploaded ID image/PDF
  selfiePhoto:        { type: String, default: '' }, // base64 selfie image for face match
  selfiePhotoName:    { type: String, default: '' },
  faceMatchScore: { type: Number, default: null }, // similarity score, 0 to 1 
  faceVerifiedAt: { type: Date, default: null },
  faceDescriptor:     { type: [Number], default: undefined }, // face fingerprint, ~128 numbers, used to detect duplicate signups
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
    ward: { type: String, default: '' },
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
    municipalityHeadProfile: this.municipalityHeadProfile,
    verificationStatus: this.verificationStatus,
    hasCitizenshipDoc: !!this.citizenshipDoc,
    faceMatchScore: this.faceMatchScore,
    faceVerifiedAt: this.faceVerifiedAt,
    wardRepresentativeApplication: this.wardRepresentativeApplication,
    createdAt: this.createdAt,
  };
};
module.exports = mongoose.model('User', userSchema);
