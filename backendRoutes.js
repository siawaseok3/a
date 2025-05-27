// routes/backendRoutes.js
const express = require('express');
const router = express.Router();
const { handleApiVideoRequest } = require('../controllers/backendController');

router.get('/api/:id', handleApiVideoRequest);

module.exports = router;
