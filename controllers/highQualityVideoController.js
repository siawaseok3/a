const axios = require('axios');

async function handleHighQuoRequest(req, res) {
  const videoId = req.params.id;
  const apiBase = req.protocol + '://' + req.get('host');
  try {
    const response = await axios.get(`${apiBase}/api/${videoId}?token=wakameoishi`);
    const videoData = response.data;
    res.render('highquo', { videoData, videoId });
  } catch (error) {
    res.status(500).render('matte', {
      videoId,
      error: '動画を取得できません',
      details: error.message
    });
  }
}

module.exports = { handleHighQuoRequest };

