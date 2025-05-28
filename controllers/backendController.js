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
      const response = await axios.get(`${instance}/api/v1/videos/${videoId}?hl=ja`, { timeout: MAX_API_WAIT_TIME });
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

// 数字を「万」や「億」でフォーマット
const formatCount = count => count >= 100000000
  ? (count / 100000000).toFixed(1) + '億'
  : count >= 10000
    ? (count / 10000).toFixed(1) + '万'
    : count.toLocaleString('ja-JP');

// 秒を hh:mm:ss に変換
const formatDuration = seconds => {
  if (!seconds) return '情報なし';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].filter((v, i) => v > 0 || i > 0).map(v => String(v).padStart(2, '0')).join(':');
};

const handleApiVideoRequest = async (req, res) => {
  const videoId = req.params.id;

  try {
    const videoInfo = await ggvideo(videoId);
    if (!videoInfo) {
      return res.status(404).json({ error: '動画情報が見つかりません' });
    }

    // adaptiveFormats から音声ストリームと高画質ストリームを抽出
    const adaptiveFormats = videoInfo.adaptiveFormats || [];

    const audioFormats = adaptiveFormats.filter(f => f.type && f.type.includes('audio/web'));
    const bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    const audioUrl = bestAudio?.url || null;


    // 高互換性のmp4動画から最も高ビットレートのものを選ぶ
    const videoFormats = adaptiveFormats.filter(f => f.type?.includes('video/mp4') && f.url);
    let highstreamUrl = null;
    if (videoFormats.length > 0) {
      videoFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      highstreamUrl = videoFormats[0].url;
    }


    const responseJson = {
      title: videoInfo.title,
      viewCount: videoInfo.viewCount,
      viewCountText: formatCount(videoInfo.viewCount) + '回',
      likeCount: videoInfo.likeCount,
      likeCountText: formatCount(videoInfo.likeCount),
      description: videoInfo.descriptionHtml,
      videoId: videoInfo.videoId,
      channelName: videoInfo.author,
      channelId: videoInfo.authorId,
      channelThumbnails: videoInfo.authorThumbnails?.find(t => t.width === 176)?.url || null,
      videoStreamUrl: videoInfo.formatStreams?.[0]?.url || null,
      audioUrl,       // 追加
      highstreamUrl,  // 追加
      duration: formatDuration(videoInfo.lengthSeconds),
      recommendedVideos: videoInfo.recommendedVideos?.map(v => ({
        videoId: v.videoId,
        title: v.title,
        viewCount: v.viewCount,
        viewCountText: formatCount(v.viewCount) + '回',
        publishedText: v.publishedText,
        author: v.author,
        authorId: v.authorId,
        thumbnailUrl: `https://img.youtube.com/vi/${v.videoId}/default.jpg`,
        duration: formatDuration(v.lengthSeconds)
      })) || []
    };

    return res.json(responseJson);

  } catch (error) {
    console.error(`動画取得失敗: ${error.message}`);
    res.status(500).json({ error: '動画を取得できません', details: error.message });
  }
};

module.exports = {
  getApis,
  handleDataRequest,
  handleRefreshRequest,
  handleApiVideoRequest,
  ggvideo
};
