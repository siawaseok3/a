const { Innertube, UniversalCache } = require("youtubei.js");

let client;

// 初期化（アプリ起動時に1回だけ呼ばれることを想定）
(async () => {
  client = await Innertube.create({
    location: "JP",
    cache: new UniversalCache(true, "./.cache")
  });
})();

function validateID(id) {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

// Express用コメント取得ハンドラ
const handleCommentRequest = async (req, res) => {
  const id = req.params.id;
  if (!validateID(id)) {
    return res.status(400).json({ error: "Invalid video ID" });
  }

  try {
    const comments = await client.getComments(id);
    res.json({ id, comments });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

module.exports = { handleCommentRequest };
