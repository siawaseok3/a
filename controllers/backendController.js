const axios = require('axios');

let apis = null;
const MAX_API_WAIT_TIME = 3000;
const MAX_TIME = 10000;

async function getApis() {
  try {
    const response = await axios.get('https://wtserver.glitch.me/apis');
    apis = response.data;
    console.log('✅ APIリスト取得:', apis.length, '件');
  } catch (error) {
    console.error('❌ API取得失敗:', error.message);
  }
}

async function ggvideo(videoId) {
  const startTime = Date.now();
  if (!apis) await getApis();

  for (const instance of apis) {
    try {
      const response = await axios.get(`${instance}/api/v1/videos/${videoId}`, { timeout: MAX_API_WAIT_TIME });
      if (response.data?.formatStreams) return response.data;
    } catch (err) {
      console.error(`[失敗] ${instance}: ${err.message}`);
    }
    if (Date.now() - startTime >= MAX_TIME) {
      throw new Error("接続がタイムアウトしました");
    }
  }

  throw new Error("動画を取得できませんでした");
}

const handleDataRequest = (req, res) => {
  if (apis) {
    res.json(apis);
  } else {
    res.status(500).send('データを取得できていません');
  }
};

const handleRefreshRequest = async (req, res) => {
  await getApis();
  res.sendStatus(200);
};

const handleApiVideoRequest = async (req, res) => {
  const videoId = req.params.id;
  try {
    const videoInfo = await ggvideo(videoId);
    
    const formatStreams = videoInfo.formatStreams || [];
    const streamUrl = formatStreams.reverse().map(stream => stream.url)[0];

    const audioStreams = videoInfo.adaptiveFormats || [];
    const highstreamUrl = audioStreams
      .filter(stream => stream.container === 'webm' && stream.resolution === '1080p')
      .map(stream => stream.url)[0];
    const audioUrl = audioStreams
      .filter(stream => stream.container === 'm4a' && stream.audioQuality === 'AUDIO_QUALITY_MEDIUM')
      .map(stream => stream.url)[0];
    const streamUrls = audioStreams
      .filter(stream => stream.container === 'webm' && stream.resolution)
      .map(stream => ({
        url: stream.url,
        resolution: stream.resolution,
      }));

    const templateData = {
      stream_url: streamUrl,
      highstreamUrl,
      audioUrl,
      videoId,
      channelId: videoInfo.authorId,
      channelName: videoInfo.author,
      channelImage: videoInfo.authorThumbnails?.slice(-1)[0]?.url || '',
      videoTitle: videoInfo.title,
      videoDes: videoInfo.descriptionHtml,
      videoViews: videoInfo.viewCount,
      likeCount: videoInfo.likeCount,
      streamUrls
    };

    res.json(templateData);
  } catch (error) {
    res.status(500).render('matte', {
      videoId,
      error: '動画を取得できません',
      details: error.message
    });
  }
};

module.exports = {
  getApis,
  handleDataRequest,
  handleRefreshRequest,
  handleApiVideoRequest
};
