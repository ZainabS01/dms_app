const Subject = require('../models/Subject');
const path = require('path');
const fs = require('fs');

// Helper to auto-migrate legacy categories to folders if empty
const migrateSubjectCategories = async (subject) => {
  let changed = false;
  if (!subject.folders) {
    subject.folders = [];
    changed = true;
  }
  
  // If folders are empty but categories exist, migrate them
  if (subject.folders.length === 0 && subject.categories && subject.categories.length > 0) {
    subject.folders = subject.categories.map(cat => ({
      name: cat.name,
      parentId: null,
      files: cat.files || []
    }));
    changed = true;
  }
  
  // If both folders and categories are empty, initialize default folders
  if (subject.folders.length === 0) {
    subject.folders = [
      { name: 'Books', parentId: null, files: [] },
      { name: 'Lecture Notes', parentId: null, files: [] },
      { name: 'Assignments', parentId: null, files: [] },
      { name: 'Past Papers', parentId: null, files: [] }
    ];
    changed = true;
  }
  
  if (changed) {
    await subject.save();
  }
  return subject;
};

// GET /api/subjects/:department/:semester
exports.getDeptSubjects = async (req, res) => {
  try {
    const { department, semester } = req.params;
    const subjects = await Subject.find({
      department: new RegExp('^' + department + '$', 'i'),
      semester: new RegExp('^' + semester + '$', 'i')
    });
    
    // Auto-migrate on retrieval
    for (let i = 0; i < subjects.length; i++) {
      subjects[i] = await migrateSubjectCategories(subjects[i]);
    }
    
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/subjects
exports.getAllSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ createdAt: -1 });
    
    // Auto-migrate on retrieval
    for (let i = 0; i < subjects.length; i++) {
      subjects[i] = await migrateSubjectCategories(subjects[i]);
    }
    
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/subjects/add
exports.addSubject = async (req, res) => {
  const debugPath = path.join(__dirname, '../debug.log');
  fs.appendFileSync(debugPath, `[REQUEST] ${new Date().toISOString()} - ${JSON.stringify(req.body)}\n`);
  try {
    const { department, semester, code, title, cr } = req.body;
    
    if (!department || !semester || !code || !title || !cr) {
      fs.appendFileSync(debugPath, `[VALIDATION FAILED] Missing fields: ${JSON.stringify({ department, semester, code, title, cr })}\n`);
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const newSubject = new Subject({
      department,
      semester,
      code,
      title,
      cr,
      folders: [
        { name: 'Books', parentId: null, files: [] },
        { name: 'Lecture Notes', parentId: null, files: [] },
        { name: 'Assignments', parentId: null, files: [] },
        { name: 'Past Papers', parentId: null, files: [] }
      ]
    });

    await newSubject.save();
    fs.appendFileSync(debugPath, `[SUCCESS] Subject saved: ${newSubject._id}\n`);
    res.json({ message: 'Subject added successfully', subject: newSubject });
  } catch (err) {
    fs.appendFileSync(debugPath, `[ERROR] ${new Date().toISOString()} - ${err.stack}\n`);
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Course code already exists' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/subjects/:id
exports.updateSubject = async (req, res) => {
  try {
    const { title, code, cr, semester, department } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    if (title) subject.title = title;
    if (code) subject.code = code;
    if (cr) subject.cr = cr;
    if (semester) subject.semester = semester;
    if (department) subject.department = department;

    await subject.save();
    res.json({ message: 'Subject updated successfully', subject });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Course code already exists' });
    }
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/subjects/:id
exports.deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });
    
    await Subject.deleteOne({ _id: req.params.id });
    res.json({ message: 'Subject deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/subjects/:id/folders/add
exports.addFolder = async (req, res) => {
  try {
    const { name, parentId } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name is required' });

    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    subject.folders.push({
      name,
      parentId: parentId || null,
      files: []
    });

    await subject.save();
    res.json({ message: 'Folder created successfully', folders: subject.folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/subjects/:id/folders/:folderId
exports.renameFolder = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Folder name is required' });

    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const folder = subject.folders.id(req.params.folderId);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    folder.name = name;
    await subject.save();

    res.json({ message: 'Folder renamed successfully', folders: subject.folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/subjects/:id/folders/:folderId
exports.deleteFolder = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const targetId = req.params.folderId;
    
    // BFS to find all children folder IDs recursively
    let idsToDelete = [targetId];
    let checkList = [targetId];

    while (checkList.length > 0) {
      const currentId = checkList.shift();
      const children = subject.folders.filter(f => f.parentId === currentId.toString());
      children.forEach(child => {
        idsToDelete.push(child._id.toString());
        checkList.push(child._id.toString());
      });
    }

    // Filter out all matched folders
    subject.folders = subject.folders.filter(f => !idsToDelete.includes(f._id.toString()));
    
    await subject.save();
    res.json({ message: 'Folder and subcontents deleted successfully', folders: subject.folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// POST /api/subjects/:id/folders/:folderId/upload
exports.uploadFileToFolder = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const folder = subject.folders.id(req.params.folderId);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    folder.files.push({
      fileName: req.file.originalname,
      fileUrl: fileUrl,
      uploadedAt: Date.now()
    });

    await subject.save();
    res.json({ message: 'File uploaded successfully', folders: subject.folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/subjects/:id/folders/:folderId/files/:fileId
exports.deleteFileFromFolder = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ message: 'Subject not found' });

    const folder = subject.folders.id(req.params.folderId);
    if (!folder) return res.status(404).json({ message: 'Folder not found' });

    // Filter out the file
    folder.files = folder.files.filter(f => f._id.toString() !== req.params.fileId);

    await subject.save();
    res.json({ message: 'File deleted successfully', folders: subject.folders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server Error' });
  }
};
