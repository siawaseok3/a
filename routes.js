const express = require('express');
const router = express.Router();

const { handleVideoRequest, handleListenRequest, handleEmbedRequest } = require('./controllers/videolookController.js');
const { handleHighQuoRequest } = require('./controllers/highQualityVideoController.js');
const { handleCommentRequest } = require('./controllers/comment.js'); 

router.get(['/w/:id', '/videores/:id'], handleVideoRequest);
router.get('/www/:id', handleHighQuoRequest);
router.get('/ll/:id', handleListenRequest);
router.get('/umekomi/:id', handleEmbedRequest);
router.get('/api/comments/:id', handleCommentRequest); 

module.exports = router;
