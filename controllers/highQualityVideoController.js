const axios = require('axios');

async function handleHighQuoRequest(req, res) {
  const videoId = req.params.id;
  try {
    const response = await axios.get(`/api/${videoId}?token=wakameoishi`);
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
