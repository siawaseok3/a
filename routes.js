const express = require('express');
const router = express.Router();
const { handleVideoRequest } = require('./controllers/videolookController.js');

router.get(['/w/:id', '/videores/:id'], handleVideoRequest);

module.exports = router;
