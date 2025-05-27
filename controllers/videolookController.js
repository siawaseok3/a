"use strict";

const axios = require('axios');

// 元のfetchVideoData関数をそのまま使う
const fetchVideoData = async (videoId, baseUrl) => {
  try {
    const { data } = await axios.get(`/api/${videoId}`);
    return data;
  } catch (error) {
    throw new Error(error.message);
  }
};

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
  const server = req.query.server || '0';

  const serverUrls = {
    '0': [
      'https://ink-boatneck-purchase.glitch.me',
      'https://lacy-neon-ptarmigan.glitch.me',
      'https://jewel-witty-spectrum.glitch.me',
    ],
    '1': 'https://lavender-nasal-magic.glitch.me',
    '2': 'https://panoramic-power-repair.glitch.me',
    '3': 'https://distinct-coherent-utahraptor.glitch.me',
    '4': '',
    '5': '',
  };

  console.log(`[INFO] Incoming request for videoId=${videoId}, server=${server}`);

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('videoIDが正しくありません');
  }

  const baseUrl = (server === '0')
    ? serverUrls['0'][Math.floor(Math.random() * serverUrls['0'].length)]
    : serverUrls[server] || serverUrls['5'];

  if (parseCookies(req).wakametubeumekomi === 'true') {
    return res.redirect(`/umekomi/${videoId}`);
  }

  try {
    const videoData = await fetchVideoData(videoId, baseUrl);

    const recommendedVideos = videoData.recommendedVideos?.filter(v => v?.videoId) || [];

    if (req.path.startsWith('/w/')) {
      return res.render('infowatch', { videoData, videoId, baseUrl, recommendedVideos });
    } else {
      return res.render('resvideo.ejs', { videoData, videoId, baseUrl, recommendedVideos });
    }
  } catch (error) {
    console.error(`[ERROR] Failed to fetch from ${baseUrl}: ${error.message}`);
    return res.status(500).render(req.path.startsWith('/w/') ? 'mattev' : 'error', {
      videoId, baseUrl: '', error: '動画を取得できません', details: error.message
    });
  }
}

module.exports = {
  handleVideoRequest,
};
