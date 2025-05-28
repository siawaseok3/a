const express = require('express');
const router = express.Router();
const {
  handleDataRequest,
  handleRefreshRequest,
  handleApiVideoRequest
} = require('./controllers/backendController.js');
const { handleRawApiVideoRequest } = require('./controllers/invidious.js');


router.get('/data', handleDataRequest);
router.get('/refresh', handleRefreshRequest);
router.get(['/api/:id', '/api/login/:id'], handleApiVideoRequest);
router.get('/api/v1/videos/:id', handleRawApiVideoRequest);


module.exports = router;
