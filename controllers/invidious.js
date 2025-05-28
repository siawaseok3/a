const axios = require('axios');

const MAX_API_WAIT_TIME = 3000;
let apis = null;

async function getApis() {
  if (apis) return apis;
  try {
    const response = await axios.get('https://wtserver.glitch.me/apis');
    apis = response.data;
    console.log('✅ APIリスト取得:', apis.length, '件');
    return apis;
  } catch (error) {
    console.error('❌ API取得失敗:', error.message);
    throw error;
  }
}

const handleRawApiVideoRequest = async (req, res) => {
  const videoId = req.params.id;

  try {
    const apisList = await getApis();

    for (const instance of apisList) {
      try {
        const response = await axios.get(`${instance}/api/v1/videos/${videoId}?hl=ja`, { timeout: MAX_API_WAIT_TIME });
        if (response.data) {
          return res.json(response.data);
        }
      } catch (err) {
        console.error(`[失敗] ${instance}: ${err.message}`);
      }
    }
    return res.status(404).json({ error: "動画情報が見つかりません" });
  } catch (error) {
    console.error(`動画取得失敗: ${error.message}`);
    return res.status(500).json({ error: '動画を取得できません', details: error.message });
  }
};

module.exports = {
  handleRawApiVideoRequest
};
