const express = require('express');
const router = express.Router();
const departmentsController = require('../controllers/departmentsController');

// POST /api/departments/add
router.post('/add', departmentsController.addDepartment);

// GET /api/departments
router.get('/', departmentsController.getDepartments);

// GET /api/departments/:code/users
router.get('/:code/users', departmentsController.getDeptUsers);

// PUT /api/departments/:code
router.put('/:code', departmentsController.updateDepartment);

// DELETE /api/departments/:code
router.delete('/:code', departmentsController.deleteDepartment);

module.exports = router;
