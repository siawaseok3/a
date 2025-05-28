"use strict";

const axios = require('axios');

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

// 通常動画ページ & /w/ 用ルート
async function handleVideoRequest(req, res) {
  const { id: videoId } = req.params;
  const apiBase = req.protocol + '://' + req.get('host');

  console.log(`[INFO] Incoming request for videoId=${videoId}`);

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).send('videoIDが正しくありません');
  }

  if (parseCookies(req).wakametubeumekomi === 'true') {
    return res.redirect(`/umekomi/${videoId}`);
  }

  try {
    const response = await axios.get(`${apiBase}/api/${videoId}`, { timeout: 5000 });
    const videoData = response.data;
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

// 音だけ再生（/ll/:id）
async function handleListenRequest(req, res) {
  const { id: videoId } = req.params;
  const apiBase = req.protocol + '://' + req.get('host');

  try {
    const response = await axios.get(`${apiBase}/api/${videoId}?token=wakameoishi`, { timeout: 5000 });
    const videoData = response.data;

    res.render('listen', { videoData, videoId });
  } catch (error) {
    res.status(500).render('matte', {
      videoId,
      error: '動画を取得できません',
      details: error.message
    });
  }
}

// 埋め込み再生（/umekomi/:id）
async function handleEmbedRequest(req, res) {
  const { id: videoId } = req.params;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const inforesponse = await axios.get(url);
    const html = inforesponse.data;

    const titleMatch = html.match(/"title":\{.*?"text":"(.*?)"/);
    const descriptionMatch = html.match(/"attributedDescriptionBodyText":\{.*?"content":"(.*?)","commandRuns/);
    const viewsMatch = html.match(/"views":\{.*?"simpleText":"(.*?)"/);
    const channelImageMatch = html.match(/"channelThumbnail":\{.*?"url":"(.*?)"/);
    const channelNameMatch = html.match(/"channel":\{.*?"simpleText":"(.*?)"/);
    const channnelIdMatch = html.match(/"browseEndpoint":\{.*?"browseId":"(.*?)"/);

    const videoTitle = titleMatch ? titleMatch[1] : 'タイトルを取得できませんでした';
    const videoDes = descriptionMatch ? descriptionMatch[1].replace(/\\n/g, '\n') : '概要を取得できませんでした';
    const videoViews = viewsMatch ? viewsMatch[1] : '再生回数を取得できませんでした';
    const channelImage = channelImageMatch ? channelImageMatch[1] : '取得できませんでした';
    const channelName = channelNameMatch ? channelNameMatch[1] : '取得できませんでした';
    const channelId = channnelIdMatch ? channnelIdMatch[1] : '取得できませんでした';

    res.render('umekomi.ejs', {
      videoId,
      videoTitle,
      videoDes,
      videoViews,
      channelImage,
      channelName,
      channelId
    });
  } catch (error) {
    console.error(error);
    res.status(500).render('matte', {
      videoId,
      error: '動画情報を取得できません',
      details: error.message
    });
  }
}

module.exports = {
  handleVideoRequest,
  handleListenRequest,
  handleEmbedRequest
};
