const mongoose = require('mongoose');

const timelineEntrySchema = new mongoose.Schema({
  action:  { type: String, required: true },
  note:    { type: String, default: '' },
  by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at:      { type: Date, default: Date.now },
}, { _id: false });

const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 1000 },
  createdAt: { type: Date, default: Date.now },
}, { _id: true });

const incidentReportSchema = new mongoose.Schema({
  title:       { type: String, required: true, trim: true },
  category:    { type: String, required: true, enum: ['flood', 'road-damage', 'tunnel-blockage', 'bridge-damage', 'landslide', 'drainage', 'electrical', 'water-supply', 'other'] },
  description: { type: String, required: true, trim: true },
  severity:    { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },

  location: {
    address:      { type: String, trim: true },
    province:     { type: String, trim: true },
    district:     { type: String, trim: true },
    municipality: { type: String, trim: true },
    ward:         { type: String, trim: true },
    lat:          { type: Number },
    lng:          { type: Number },
  },

  reportedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reporterContact: { type: String, trim: true, default: '' },
  photo:           { type: String, default: '' },
  photoName:       { type: String, trim: true, default: '' },
  viaSms:          { type: Boolean, default: false },
  upvotes:         [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  supportCount:    { type: Number, default: 0 },
  priorityScore:   { type: Number, default: 0 },
  priorityLevel:   { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' },
  priorityReason:  { type: String, trim: true, default: '' },
  escalationState: { type: String, enum: ['none', 'ward-notified', 'municipality-notified'], default: 'none' },
  supportThresholdReachedAt: { type: Date, default: null },
  comments:        [commentSchema],

  // AI enrichment — populated best-effort at creation time. Never required,
  // so the app behaves identically whether or not GEMINI_API_KEY is set.
  embedding:            { type: [Number], default: undefined },
  language:             { type: String, trim: true, default: '' },
  translatedDescription: { type: String, trim: true, default: '' },

  status: {
    type: String,
    enum: ['pending', 'verified', 'assigned', 'in-progress', 'completed', 'closed', 'rejected', 'duplicate'],
    default: 'pending',
  },

  estimatedDays: { type: Number, default: 3 },
  dueDate:       { type: Date },
  completedAt:   { type: Date },

  // Set when the citizen confirms the completed work actually fixed the
  // problem — the last step before an issue is considered fully closed.
  citizenConfirmedAt: { type: Date },

  // Proof-of-resolution photo, captured separately from the intake photo so
  // "completed" comes with visible before/after evidence, not just a status flip.
  resolutionPhoto:     { type: String, default: '' },
  resolutionPhotoName: { type: String, trim: true, default: '' },

  // Lets the original reporter reopen a report that was marked complete but
  // wasn't actually fixed, within a limited window after completion.
  reopenCount: { type: Number, default: 0 },
  reopenedAt:  { type: Date },

    assignedDepartment: { type: String, trim: true, default: '' },
  assignedContact:    { type: String, trim: true, default: '' },
  assignedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Links this issue to the government project responsible for the area/
  // work it concerns, so citizens can see Issue -> Ward -> Project -> Budget.
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  isFake:     { type: Boolean, default: false },
  fakeReason: { type: String, trim: true, default: '' },

  // Distinct from isFake/fakeReason — this is a genuine "not actionable"
  // rejection by staff (e.g. outside jurisdiction), not a fraud flag.
  rejectionReason: { type: String, trim: true, default: '' },

  // An issue can be escalated (marked urgent) without changing its
  // underlying status — it's a flag layered on top, like isFake.
  escalated:        { type: Boolean, default: false },
  escalatedAt:      { type: Date },
  escalationReason: { type: String, trim: true, default: '' },
  escalatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  duplicateOf:        { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentReport', default: null },
  duplicateSimilarity: { type: Number, default: null },
  confirmations:      { type: Number, default: 1 },

  // A weaker semantic match than duplicateOf — surfaced to officers as a
  // suggestion ("Possible duplicate — 91% similarity") rather than being
  // auto-linked. Officers choose Merge (promotes this to duplicateOf) or
  // Not Duplicate (dismisses it).
  possibleDuplicateOf:        { type: mongoose.Schema.Types.ObjectId, ref: 'IncidentReport', default: null },
  possibleDuplicateSimilarity: { type: Number, default: null },
  duplicateReviewedAt:        { type: Date, default: null },
  duplicateReviewedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  timeline: [timelineEntrySchema],
}, { timestamps: true });

incidentReportSchema.index({ status: 1, createdAt: -1 });
incidentReportSchema.index({ category: 1, 'location.district': 1 });
incidentReportSchema.index({ reportedBy: 1, createdAt: -1 });
incidentReportSchema.index({ duplicateOf: 1 });
incidentReportSchema.index({ 'location.province': 1, 'location.district': 1, 'location.municipality': 1, 'location.ward': 1 });
incidentReportSchema.index({ priorityLevel: 1, priorityScore: -1 });

module.exports = mongoose.model('IncidentReport', incidentReportSchema);