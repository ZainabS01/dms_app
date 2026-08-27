const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const path = require('path');
const User = require('../models/User');
const Notification = require('../models/Notification');

// --- Nodemailer Transporter Setup ---
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Utility to generate 4-digit OTP
const generateOTP = () => Math.floor(1000 + Math.random() * 9000).toString();

// Utility to normalize and standardize department names
const normalizeDepartment = (dept) => {
  if (!dept) return null;
  let d = dept.trim().toUpperCase();
  
  // Strip starting "BS " or "BS" prefix
  d = d.replace(/^(BS\s+|BS)/i, '').trim();
  
  // Standardize name variants
  if (d === 'CS' || d === 'COMP SCIENCE' || d === 'COMPUTERSCIENCE' || d === 'COMPUTER SCIENCE' || d === 'COMPUTER_SCIENCE') {
    return 'COMPUTER SCIENCE';
  }
  if (d === 'ENG' || d === 'ENGLISH') {
    return 'ENGLISH';
  }
  if (d === 'ECO' || d === 'ECONOMICS') {
    return 'ECONOMICS';
  }
  if (d === 'MATH' || d === 'MATHEMATICS' || d === 'MATHS') {
    return 'MATHEMATICS';
  }
  if (d === 'POL SCI' || d === 'POLITICAL SCIENCE' || d === 'POL SCI.' || d === 'POLITICAL_SCIENCE' || d === 'POLSCI') {
    return 'POLITICAL SCIENCE';
  }
  if (d === 'ZOO' || d === 'ZOOLOGY') {
    return 'ZOOLOGY';
  }
  if (d === 'URDU') {
    return 'URDU';
  }
  
  return d;
};

// Email helper for sending approval request emails to teachers/admins
const sendApprovalEmail = async (recipientEmail, recipientName, applicant, approveLink, rejectLink) => {
  const isStudent = applicant.role === 'student';
  const roleText = isStudent ? 'Student' : 'Teacher';
  
  const detailsHtml = `
    <table cellpadding="6" cellspacing="0" style="width: 100%; border-collapse: collapse; margin-top: 15px; font-family: sans-serif; font-size: 14px;">
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="font-weight: bold; padding: 10px; color: #475569; width: 130px;">Full Name:</td>
        <td style="padding: 10px; color: #0f172a;">${applicant.name}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="font-weight: bold; padding: 10px; color: #475569;">Email Address:</td>
        <td style="padding: 10px; color: #0f172a;">${applicant.email}</td>
      </tr>
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="font-weight: bold; padding: 10px; color: #475569;">Role:</td>
        <td style="padding: 10px; color: #0f172a; text-transform: capitalize;">${roleText}</td>
      </tr>
      ${applicant.department ? `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="font-weight: bold; padding: 10px; color: #475569;">Department:</td>
        <td style="padding: 10px; color: #0f172a;">${applicant.department}</td>
      </tr>
      ` : ''}
      ${isStudent && applicant.semester ? `
      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
        <td style="font-weight: bold; padding: 10px; color: #475569;">Semester:</td>
        <td style="padding: 10px; color: #0f172a;">${applicant.semester}</td>
      </tr>
      ` : ''}
      ${isStudent && (applicant.roll_no || applicant.rollNo) ? `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="font-weight: bold; padding: 10px; color: #475569;">Roll Number:</td>
        <td style="padding: 10px; color: #0f172a;">${applicant.roll_no || applicant.rollNo}</td>
      </tr>
      ` : ''}
    </table>
  `;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Approval Request - DMS</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table width="100%" bgcolor="#f1f5f9" cellpadding="0" cellspacing="0" border="0" style="padding: 30px 10px;">
        <tr>
          <td align="center">
            <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05);">
              <!-- Header -->
              <tr>
                <td bgcolor="#001b3a" align="center" style="padding: 30px 20px;">
                  <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 0.5px;">DMS Approval Request</h1>
                  <p style="color: #eab308; margin: 5px 0 0 0; font-size: 14px; font-weight: 500;">Department Management System</p>
                </td>
              </tr>
              <!-- Content -->
              <tr>
                <td style="padding: 30px 20px;">
                  <p style="margin: 0 0 15px 0; font-size: 16px; color: #334155; line-height: 1.5;">Hello ${recipientName},</p>
                  <p style="margin: 0 0 20px 0; font-size: 15px; color: #475569; line-height: 1.5;">A new ${roleText} registration request is pending your approval. Below are the user's registration details:</p>
                  
                  ${detailsHtml}
                  
                  <div style="margin-top: 30px; padding: 15px; background-color: #eff6ff; border-radius: 8px; font-size: 14px; color: #1e3a8a; line-height: 1.5;">
                    <strong>Decision Options:</strong> You can approve or reject this request directly using the links below, or you can open the DMS app and process it from your dashboard requests screen.
                  </div>

                  <!-- Actions -->
                  <table cellpadding="0" cellspacing="0" border="0" style="margin-top: 30px; width: 100%;">
                    <tr>
                      <td align="center" style="padding-bottom: 20px;">
                        <a href="${approveLink}" style="display: inline-block; width: 180px; padding: 14px 0; background-color: #10b981; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.2);">Approve</a>
                        &nbsp;&nbsp;&nbsp;&nbsp;
                        <a href="${rejectLink}" style="display: inline-block; width: 180px; padding: 14px 0; background-color: #ef4444; color: #ffffff; text-decoration: none; font-weight: bold; border-radius: 8px; text-align: center; box-shadow: 0 4px 6px -1px rgba(239,68,68,0.2);">Reject</a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td bgcolor="#f8fafc" align="center" style="padding: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8;">
                  This is an automated notification from the DMS Server. Please do not reply directly to this email.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"Department Management System" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `[Pending Approval] New ${roleText}: ${applicant.name}`,
    html: htmlContent
  });
};

// Render function for approval responses in browser
function renderResponsePage(success, message, user = null, alreadyDone = false, isReject = false) {
  const icon = success 
    ? (isReject 
      ? `<svg class="icon icon-warn" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>`
      : `<svg class="icon icon-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`
    )
    : `<svg class="icon icon-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;

  const userDetailsHtml = user ? `
    <div class="user-details">
      <h3>User Information</h3>
      <div class="detail-row"><span>Name:</span> <strong>${user.name}</strong></div>
      <div class="detail-row"><span>Email:</span> <strong>${user.email}</strong></div>
      <div class="detail-row"><span>Role:</span> <strong style="text-transform: capitalize;">${user.role}</strong></div>
      ${user.department ? `<div class="detail-row"><span>Department:</span> <strong>${user.department}</strong></div>` : ''}
      ${user.semester ? `<div class="detail-row"><span>Semester:</span> <strong>${user.semester}</strong></div>` : ''}
      ${user.roll_no || user.rollNo ? `<div class="detail-row"><span>Roll No:</span> <strong>${user.roll_no || user.rollNo}</strong></div>` : ''}
    </div>
  ` : '';

  const themeColor = success ? (isReject ? '#ef4444' : '#10b981') : '#ef4444';

  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DMS Request Approval</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
      body {
        margin: 0;
        padding: 0;
        font-family: 'Outfit', sans-serif;
        background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
        color: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .card {
        background: rgba(30, 41, 59, 0.7);
        backdrop-filter: blur(16px);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 24px;
        padding: 40px;
        max-width: 480px;
        width: 90%;
        box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        text-align: center;
        animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }
      @keyframes slideUp {
        from { transform: translateY(30px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .icon-container {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.03);
        margin-bottom: 24px;
      }
      .icon {
        width: 48px;
        height: 48px;
      }
      .icon-success { color: #10b981; }
      .icon-error { color: #ef4444; }
      .icon-warn { color: #f59e0b; }
      h1 {
        font-size: 24px;
        font-weight: 700;
        margin: 0 0 16px 0;
        color: #ffffff;
      }
      p {
        font-size: 16px;
        line-height: 1.6;
        color: #94a3b8;
        margin: 0 0 24px 0;
      }
      .user-details {
        background: rgba(15, 23, 42, 0.4);
        border-radius: 16px;
        padding: 20px;
        text-align: left;
        margin-bottom: 30px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .user-details h3 {
        margin: 0 0 12px 0;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #eab308;
      }
      .detail-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .detail-row:last-child {
        border-bottom: none;
      }
      .detail-row span {
        color: #64748b;
      }
      .detail-row strong {
        color: #cbd5e1;
      }
      .btn {
        display: inline-block;
        padding: 14px 28px;
        background: ${themeColor};
        color: #ffffff;
        text-decoration: none;
        font-weight: 600;
        border-radius: 12px;
        transition: all 0.3s ease;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
      }
      .btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
        opacity: 0.95;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon-container">
        ${icon}
      </div>
      <h1>${success ? (isReject ? 'Request Rejected' : 'Success!') : 'Verification Failed'}</h1>
      <p>${message}</p>
      ${userDetailsHtml}
      <a href="dmsapp://" class="btn">Open DMS App</a>
    </div>
  </body>
  </html>
  `;
}

// POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, department, semester, roll_no, isHOD, adminCreated } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'Please enter all required fields' });
    }

    let user = await User.findOne({ email });
    if (user) {
      if (user.isVerified === false) {
        // If the account exists but was never verified, delete it to allow re-registration
        await User.deleteOne({ _id: user._id });
      } else {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
    }

    if (role === 'student' && roll_no) {
      let existingRoll = await User.findOne({ $or: [{ roll_no }, { rollNo: roll_no }] });
      if (existingRoll) {
        return res.status(400).json({ message: 'A student with this Roll Number already exists' });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const otp = adminCreated ? undefined : generateOTP();
    const otpExpires = adminCreated ? undefined : Date.now() + 10 * 60 * 1000; // 10 minutes

    let normalizedDept = normalizeDepartment(department);

    let normalizedSem = semester ? semester.toString().trim() : null;
    if (normalizedSem) {
      const match = normalizedSem.match(/\d+/);
      if (match) {
        normalizedSem = match[0];
      }
    }

    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      role,
      department: normalizedDept,
      semester: normalizedSem,
      roll_no: role === 'student' ? roll_no : undefined,
      rollNo: role === 'student' ? roll_no : undefined,
      isVerified: adminCreated ? true : false,
      isApproved: adminCreated ? true : (role === 'admin'),
      status: adminCreated ? 'ACTIVE' : (role === 'admin' ? 'ACTIVE' : 'PENDING'),
      isHOD: role === 'teacher' ? (isHOD || false) : false,
      otp,
      otpExpires
    });

    await newUser.save();

    if (!adminCreated) {
      // Send OTP Email for self-registration
      transporter.sendMail({
        from: `"Department Management System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Verify your DMS Account',
        html: `<h3>Welcome to DMS!</h3><p>Your 4-digit OTP for account verification is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`,
      }).catch(err => console.error('Failed to send verification OTP email:', err));
    } else {
      // Send Welcome Email for admin-created users
      transporter.sendMail({
        from: `"Department Management System" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your DMS Account is Registered',
        html: `<h3>Welcome to DMS, ${name}!</h3><p>An administrator has created your account. You can now log in to the DMS App using your email and password.</p>`,
      }).catch(err => console.error('Welcome email sending failed:', err));
    }

    res.status(201).json({ message: adminCreated ? 'Account registered and activated successfully!' : 'Account created! Please check your email for the OTP.' });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

// POST /api/auth/verify-otp
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) return res.status(400).json({ message: 'Please provide email and OTP' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.isVerified) return res.status(400).json({ message: 'User is already verified' });

    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'OTP has expired. Please register again or request a new one.' });

    // Mark as verified
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Generate secure approval token
    const approvalToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET || 'dms_super_secret_key_123',
      { expiresIn: '7d' }
    );
    const baseUrl = process.env.BASE_URL || (req.protocol + '://' + req.get('host'));
    const approveLink = `${baseUrl}/api/auth/approve-request?token=${approvalToken}&action=approve`;
    const rejectLink = `${baseUrl}/api/auth/approve-request?token=${approvalToken}&action=reject`;

    if (user.role && user.role.toLowerCase() === 'teacher') {
      try {
        // App Notification
        const adminNotif = new Notification({
          userId: 'admin',
          role: 'admin',
          title: 'Teacher Approval Request',
          message: `Teacher ${user.name} verified their account and is pending admin approval.`,
          type: 'request',
          targetScreen: '/(admin)/teacher_requests'
        });
        await adminNotif.save();

        // Email Admins
        const admins = await User.find({ role: 'admin' });
        for (const admin of admins) {
          sendApprovalEmail(admin.email, admin.name, user, approveLink, rejectLink)
            .catch(mailErr => console.error(`Failed to send teacher approval email to admin ${admin.email}:`, mailErr));
        }
        // Fallback email to env user if no admins found
        if (admins.length === 0 && process.env.EMAIL_USER) {
          sendApprovalEmail(process.env.EMAIL_USER, 'Admin', user, approveLink, rejectLink)
            .catch(mailErr => console.error(`Failed to send teacher approval email to fallback admin:`, mailErr));
        }
      } catch (err) {
        console.error('Failed to process admin notification for teacher approval:', err);
      }
    } else if (user.role && user.role.toLowerCase() === 'student' && user.department) {
      try {
        // App Notification and Email to teachers of department
        const teachers = await User.find({ role: 'teacher', department: new RegExp('^' + user.department + '$', 'i') });
        for (const teacher of teachers) {
          new Notification({
            userId: teacher._id.toString(),
            role: 'teacher',
            title: 'Student Approval Request',
            message: `Student ${user.name} verified their account and is pending your approval.`,
            type: 'request',
            targetScreen: '/(teacher)/student_approval'
          }).save().catch(err => console.error('Notification save error:', err));

          sendApprovalEmail(teacher.email, teacher.name, user, approveLink, rejectLink)
            .catch(mailErr => console.error(`Failed to send student approval email to teacher ${teacher.email}:`, mailErr));
        }
      } catch (err) {
        console.error('Failed to process teacher notification for student approval:', err);
      }
    }

    res.status(200).json({ message: 'Account verified successfully! You can now login.' });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ message: 'Server error during verification' });
  }
};

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(`\n--- [Login Request Received] ---`);
    console.log(`Email Input: "${email}"`);
    console.log(`Password Provided: ${password ? 'Yes' : 'No'}`);

    if (!email) return res.status(400).json({ message: 'Please provide email' });

    const user = await User.findOne({ email });
    if (!user) {
      console.log(`[Login Failed] No user record found in DB for email: "${email}"`);
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    console.log(`[User Found] DB Name: "${user.name}" | DB Role: "${user.role}" | Verified: ${user.isVerified}`);

    // Verify OTP first
    if (!user.isVerified) {
      console.log(`[Login Failed] User "${user.email}" has not verified their email/OTP.`);
      return res.status(403).json({ message: 'Your account is not verified. Please verify your OTP.', notVerified: true });
    }

    if (user.role && user.role.toLowerCase() === 'teacher' && user.isApproved === false) {
      console.log(`[Login Failed] Teacher "${user.email}" is pending admin approval.`);
      return res.status(403).json({ message: 'Your account is pending admin approval. You will be able to login once approved.' });
    }

    if (user.role && user.role.toLowerCase() === 'student' && user.isApproved === false) {
      console.log(`[Login Failed] Student "${user.email}" is pending teacher approval.`);
      return res.status(403).json({ message: 'Your account is pending approval from your department teachers. You will be able to login once approved.' });
    }

    // Bypass password check for admin logins
    if (user.role && user.role.toLowerCase() !== 'admin') {
      if (!password) {
        console.log(`[Login Failed] Password required for role "${user.role}" but not provided.`);
        return res.status(400).json({ message: 'Please provide password' });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log(`[Login Failed] Password mismatch for email: "${email}"`);
        return res.status(400).json({ message: 'Invalid credentials' });
      }
    } else {
      console.log(`[Admin Login Bypass] Bypassing password verification for Admin user.`);
    }

    const payload = { user: { id: user.id, role: user.role } };
    const JWT_SECRET = process.env.JWT_SECRET || 'dms_super_secret_key_123';
    
    jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      console.log(`[Login Success] User "${user.email}" authenticated as "${user.role}".`);
      res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role.toLowerCase(), department: user.department, semester: user.semester, roll_no: user.roll_no || user.rollNo, isHOD: user.isHOD }
      });
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Please provide your email' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'This email does not exist' });

    const otp = generateOTP();
    user.otp = otp;
    user.otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    transporter.sendMail({
      from: `"Department Management System" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Reset your DMS Password',
      html: `<h3>Password Reset</h3><p>Your 4-digit OTP to reset your password is: <strong>${otp}</strong></p><p>It will expire in 10 minutes.</p>`,
    }).catch(err => console.error('Failed to send reset password OTP email:', err));

    res.status(200).json({ message: 'OTP sent to your email for password reset.' });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Server error during forgot password' });
  }
};

// POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Please provide email, OTP, and new password' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.otp !== otp) return res.status(400).json({ message: 'Invalid OTP' });
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: 'OTP has expired' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    
    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true; 

    await user.save();

    res.status(200).json({ message: 'Password reset successful! You can now login.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: 'Server error during reset password' });
  }
};

// GET /api/auth/teachers/:department
exports.getTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ 
      role: 'teacher', 
      department: new RegExp('^' + req.params.department + '$', 'i') 
    }).select('name _id');
    res.json(teachers);
  } catch (err) {
    console.error('Fetch Teachers Error:', err);
    res.status(500).json({ message: 'Server error fetching teachers' });
  }
};

// GET /api/auth/users
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('Fetch Users Error:', err);
    res.status(500).json({ message: 'Server error fetching users' });
  }
};

// DELETE /api/auth/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    await User.deleteOne({ _id: req.params.id });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ message: 'Server error deleting user' });
  }
};

// PUT /api/auth/users/:id
exports.updateUser = async (req, res) => {
  try {
    const { name, email, role, department, semester, roll_no, isHOD, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.name = name ? name.trim() : user.name;
    user.email = email ? email.trim().toLowerCase() : user.email;
    if (password && password.trim()) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password.trim(), salt);
    }
    user.isVerified = true;
    user.isApproved = true;
    user.status = 'ACTIVE';
    user.role = role ? role : user.role;
    let normalizedDept = department ? normalizeDepartment(department) : user.department;
    user.department = normalizedDept;
    user.semester = semester ? semester.trim() : user.semester;
    
    if (user.role === 'student') {
      user.roll_no = roll_no ? roll_no.trim().toUpperCase() : user.roll_no;
      user.rollNo = roll_no ? roll_no.trim().toUpperCase() : user.rollNo;
      user.isHOD = false;
    } else if (user.role === 'teacher') {
      user.roll_no = undefined;
      user.semester = undefined;
      if (isHOD !== undefined) user.isHOD = isHOD;
    } else {
      user.roll_no = undefined;
      user.semester = undefined;
      user.isHOD = false;
    }

    await user.save();
    res.json({ message: 'User updated successfully', user });
  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ message: 'Server error updating user' });
  }
};

// GET /api/auth/stats
exports.getStats = async (req, res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalTeachers = await User.countDocuments({ role: 'teacher' });
    
    const Subject = require('../models/Subject');
    const totalSubjects = await Subject.countDocuments();
    
    const Query = require('../models/Query');
    const pendingQueries = await Query.countDocuments({ recipient: 'admin', status: 'PENDING' });
    
    const Application = require('../models/Application');
    const pendingLeaves = await Application.countDocuments({ status: 'PENDING' });
    
    res.json({
      totalStudents,
      totalTeachers,
      totalSubjects,
      pendingQueries,
      pendingLeaves
    });
  } catch (err) {
    console.error('Get Stats Error:', err);
    res.status(500).json({ message: 'Server error getting dashboard stats' });
  }
};

// GET /api/auth/teachers-pending
exports.getTeachersPending = async (req, res) => {
  try {
    const teachers = await User.find({
      role: new RegExp('^teacher$', 'i'),
      isApproved: { $ne: true }
    }).select('-password').sort({ createdAt: -1 });
    res.json(teachers);
  } catch (err) {
    console.error('Fetch Pending Teachers Error:', err);
    res.status(500).json({ message: 'Server error fetching pending teachers' });
  }
};

// PUT /api/auth/teachers/:id/approve
exports.approveTeacher = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    if (teacher.role !== 'teacher') return res.status(400).json({ message: 'User is not a teacher' });

    teacher.isApproved = true;
    teacher.status = 'ACTIVE';
    await teacher.save();

    try {
      const notif = new Notification({
        userId: teacher._id.toString(),
        role: 'teacher',
        title: 'Registration Approved',
        message: 'Your registration request has been approved by the Admin! You can now login.',
        type: 'request',
        targetScreen: '/(teacher)/profile'
      });
      await notif.save();
    } catch (err) {
      console.error('Failed to notify approved teacher:', err);
    }

    res.json({ message: 'Teacher approved successfully', teacher });
  } catch (err) {
    console.error('Approve Teacher Error:', err);
    res.status(500).json({ message: 'Server error approving teacher' });
  }
};

// PUT /api/auth/teachers/:id/reject
exports.rejectTeacher = async (req, res) => {
  try {
    const teacher = await User.findById(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    if (teacher.role !== 'teacher') return res.status(400).json({ message: 'User is not a teacher' });

    await User.deleteOne({ _id: teacher._id });
    res.json({ message: 'Teacher request rejected/deleted successfully' });
  } catch (err) {
    console.error('Reject Teacher Error:', err);
    res.status(500).json({ message: 'Server error rejecting teacher' });
  }
};

// GET /api/auth/students-dept/:department
exports.getStudentsDept = async (req, res) => {
  try {
    console.log(`[GET /students-dept] Department parameter: "${req.params.department}"`);
    const students = await User.find({
      role: new RegExp('^student$', 'i'),
      department: new RegExp('^' + req.params.department + '$', 'i')
    }).select('-password').sort({ createdAt: -1 });
    console.log(`[GET /students-dept] Found ${students.length} students.`);
    res.json(students);
  } catch (err) {
    console.error('Fetch Dept Students Error:', err);
    res.status(500).json({ message: 'Server error fetching students' });
  }
};

// PUT /api/auth/students/:id/status
exports.updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'ACTIVE', 'PENDING', or 'REJECTED'
    const student = await User.findById(req.params.id);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    if (student.role && student.role.toLowerCase() !== 'student') return res.status(400).json({ message: 'User is not a student' });

    student.status = status;
    student.isApproved = (status === 'ACTIVE');
    await student.save();

    res.json({ message: `Student status updated to ${status}`, student });
  } catch (err) {
    console.error('Update Student Status Error:', err);
    res.status(500).json({ message: 'Server error updating student' });
  }
};

// GET /api/auth/approve-request
exports.approveRequest = async (req, res) => {
  try {
    const { token, action } = req.query;
    
    if (!token || !action) {
      return res.status(400).send(renderResponsePage(false, 'Missing token or action parameters.'));
    }

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).send(renderResponsePage(false, 'Invalid action. Only approve or reject are supported.'));
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'dms_super_secret_key_123';
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).send(renderResponsePage(false, 'The approval link has expired or is invalid.'));
    }

    const userId = decoded.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send(renderResponsePage(false, 'User request not found. It may have already been processed.'));
    }

    if (user.status === 'ACTIVE' && user.isApproved === true) {
      return res.status(200).send(renderResponsePage(true, `User <strong>${user.name}</strong> is already approved and active!`, user, true));
    }

    if (action === 'approve') {
      user.isApproved = true;
      user.status = 'ACTIVE';
      await user.save();

      try {
        const notif = new Notification({
          userId: user._id.toString(),
          role: user.role,
          title: 'Registration Approved',
          message: 'Your registration request has been approved! You can now login.',
          type: 'request',
          targetScreen: user.role === 'teacher' ? '/(teacher)/profile' : '/(student)/profile'
        });
        await notif.save();
      } catch (err) {
        console.error('Failed to notify approved user in app:', err);
      }

      transporter.sendMail({
        from: `"Department Management System" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'DMS Account Approved',
        html: `
          <h3>Congratulations, ${user.name}!</h3>
          <p>Your registration request has been approved.</p>
          <p>You can now open the DMS app and log in to access your dashboard.</p>
        `,
      }).catch(err => console.error('Failed to send approval confirmation email:', err));

      return res.status(200).send(renderResponsePage(true, `Successfully approved <strong>${user.name}</strong> (${user.role})! They can now log in.`, user));
    } else if (action === 'reject') {
      const userName = user.name;
      const userEmail = user.email;
      const userRole = user.role;

      await User.deleteOne({ _id: user._id });

      transporter.sendMail({
        from: `"Department Management System" <${process.env.EMAIL_USER}>`,
        to: userEmail,
        subject: 'DMS Registration Request Rejected',
        html: `
          <h3>Hello, ${userName}.</h3>
          <p>Your registration request for the Department Management System was rejected.</p>
          <p>You can try registering again with correct details if needed.</p>
        `,
      }).catch(err => console.error('Failed to send rejection email:', err));

      return res.status(200).send(renderResponsePage(true, `Successfully rejected and deleted registration request for <strong>${userName}</strong> (${userRole}).`, { name: userName, email: userEmail, role: userRole }, false, true));
    }

  } catch (error) {
    console.error('Approve Link Error:', error);
    res.status(500).send(renderResponsePage(false, 'An unexpected server error occurred while processing the request.'));
  }
};

// GET /api/auth/download
exports.downloadFile = (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ message: 'Filename is required' });
  
  const safeFilename = path.basename(file);
  const filePath = path.join(__dirname, '../uploads', safeFilename);
  
  res.download(filePath, safeFilename, (err) => {
    if (err) {
      console.error('File download error:', err);
      if (!res.headersSent) {
        res.status(404).json({ message: 'File not found' });
      }
    }
  });
};
