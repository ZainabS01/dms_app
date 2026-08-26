const Notice = require('../models/Notice');
const Notification = require('../models/Notification');
const User = require('../models/User');
const Department = require('../models/Department');

// POST /api/notices/add
exports.addNotice = async (req, res) => {
  try {
    const { title, content, targetRole, department } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const notice = new Notice({
      title,
      content,
      targetRole: targetRole || 'all',
      department: department || 'All'
    });

    await notice.save();

    // Notify users matching targetRole and department
    try {
      const targetQuery = {};
      if (targetRole && targetRole !== 'all') {
        targetQuery.role = new RegExp('^' + targetRole + '$', 'i');
      }
      if (department && department !== 'All') {
        // Clean "BS " prefix from the input department parameter
        const cleanParam = department.replace(/^(BS\s+|BS)/i, '').trim();

        // Resolve department code/name counterparts allowing optional BS prefix
        const deptDoc = await Department.findOne({
          $or: [
            { code: new RegExp('^' + cleanParam.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
            { name: new RegExp('^(BS\\s+|BS)?' + cleanParam.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
          ]
        });

        const searchTerms = [department];
        if (deptDoc) {
          searchTerms.push(deptDoc.code);
          searchTerms.push(deptDoc.name);
          const cleanName = deptDoc.name.replace(/^(BS\s+|BS)/i, '').trim();
          searchTerms.push(cleanName);
        } else {
          searchTerms.push(cleanParam);
        }

        const searchRegexes = searchTerms.map(t => new RegExp('^' + t.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i'));
        targetQuery.department = { $in: searchRegexes };
      }
      const usersToNotify = await User.find(targetQuery);
      for (let u of usersToNotify) {
        const notif = new Notification({
          userId: u._id.toString(),
          role: u.role.toLowerCase(),
          title: `New Notice: ${title}`,
          message: content.substring(0, 100),
          type: 'notice',
          targetScreen: `notice:${notice._id.toString()}`
        });
        await notif.save();
      }
    } catch (e) {
      console.error('Failed to generate notice notifications:', e);
    }

    res.json({ message: 'Notice posted successfully', notice });
  } catch (err) {
    console.error('Add Notice Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/notices/admin
exports.getAdminNotices = async (req, res) => {
  try {
    const notices = await Notice.find().sort({ createdAt: -1 });
    res.json(notices);
  } catch (err) {
    console.error('Get Admin Notices Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE /api/notices/:id
exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }
    await Notice.deleteOne({ _id: req.params.id });
    res.json({ message: 'Notice deleted successfully' });
  } catch (err) {
    console.error('Delete Notice Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// PUT /api/notices/:id
exports.updateNotice = async (req, res) => {
  try {
    const { title, content, targetRole, department } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const notice = await Notice.findById(req.params.id);
    if (!notice) {
      return res.status(404).json({ message: 'Notice not found' });
    }

    notice.title = title;
    notice.content = content;
    notice.targetRole = targetRole || 'all';
    notice.department = department || 'All';

    await notice.save();
    res.json({ message: 'Notice updated successfully', notice });
  } catch (err) {
    console.error('Update Notice Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/notices/view/:role/:department
exports.getUserNotices = async (req, res) => {
  try {
    const { role, department } = req.params;
    const targetRoles = [role.toLowerCase(), 'all'];
    const deptTerms = new Set(['All', 'all']);

    if (department) {
      deptTerms.add(department);

      // Clean "BS " prefix from the input department parameter
      const cleanParam = department.replace(/^(BS\s+|BS)/i, '').trim();
      
      const deptDoc = await Department.findOne({
        $or: [
          { code: new RegExp('^' + cleanParam.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') },
          { name: new RegExp('^(BS\\s+|BS)?' + cleanParam.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i') }
        ]
      });

      if (deptDoc) {
        deptTerms.add(deptDoc.code);
        deptTerms.add(deptDoc.name);
        const cleanName = deptDoc.name.replace(/^(BS\s+|BS)/i, '').trim();
        deptTerms.add(cleanName);
      } else {
        deptTerms.add(cleanParam);
      }
    }

    const deptRegexes = Array.from(deptTerms).map(d => new RegExp('^' + d.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i'));

    const notices = await Notice.find({
      targetRole: { $in: targetRoles },
      department: { $in: deptRegexes }
    }).sort({ createdAt: -1 });

    res.json(notices);
  } catch (err) {
    console.error('View Notices Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};

// GET /api/notices/:id
exports.getNoticeById = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: 'Notice not found' });
    res.json(notice);
  } catch (err) {
    console.error('Get Notice Error:', err);
    res.status(500).json({ message: 'Server Error' });
  }
};
