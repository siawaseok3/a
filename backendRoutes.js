const express = require('express');
const router = express.Router();
const {
  handleDataRequest,
  handleRefreshRequest,
  handleApiVideoRequest
} = require('./controllers/backendController.js');

router.get('/data', handleDataRequest);
router.get('/refresh', handleRefreshRequest);
router.get(['/api/:id', '/api/login/:id'], handleApiVideoRequest);

module.exports = router;
