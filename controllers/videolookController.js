"use strict";

const { ggvideo } = require('../controllers/backendController.js'); // 適切なパスに変更

// Cookie解析関数
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;

  rc && rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
  });

  return list;
}

async function handleVideoRequest(req, res) {
  const { id: videoId } = req.params;

  console.log(`[INFO] Incoming request for videoId=${videoId}`);

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('videoIDが正しくありません');
  }

  if (parseCookies(req).wakametubeumekomi === 'true') {
    return res.redirect(`/umekomi/${videoId}`);
  }

  try {
    const videoData = await ggvideo(videoId);

    const recommendedVideos = videoData.recommendedVideos?.filter(v => v?.videoId) || [];

    if (req.path.startsWith('/w/')) {
      return res.render('infowatch', { videoData, videoId, recommendedVideos });
    } else {
      return res.render('resvideo.ejs', { videoData, videoId, recommendedVideos });
    }
  } catch (error) {
    console.error(`[ERROR] 動画取得失敗: ${error.message}`);
    return res.status(500).render(req.path.startsWith('/w/') ? 'mattev' : 'error', {
      videoId, error: '動画を取得できません', details: error.message
    });
  }
}

module.exports = {
  handleVideoRequest,
};
