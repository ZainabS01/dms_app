const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileName: String,
  fileUrl: String,
  uploadedAt: { type: Date, default: Date.now }
});

const folderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  parentId: { type: String, default: null }, // ID of the parent folder, or null if it's a main folder directly under the subject
  files: [fileSchema]
});

const categorySchema = new mongoose.Schema({
  name: String,
  files: [fileSchema]
});

const subjectSchema = new mongoose.Schema({
  department: { type: String, required: true },
  semester: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  cr: { type: String, required: true },
  categories: [categorySchema], // Left for backward compatibility and auto-migration
  folders: { type: [folderSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
