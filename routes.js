const express = require('express');
const router = express.Router();
const { handleVideoRequest } = require('./controllers/videolookController.js');
const { handleHighQuoRequest } = require('./controllers/highQualityVideoController.js');


router.get(['/w/:id', '/videores/:id'], handleVideoRequest);
router.get('/www/:id', handleHighQuoRequest);


module.exports = router;
