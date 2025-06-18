"use strict";
const m3u8stream = require('m3u8stream');
const ytsr = require("ytsr");
const ytpl = require("@distube/ytpl"); // ✅ フォーク版を使う
const miniget = require("miniget");
const express = require("express");
const ejs = require("ejs");
const app = express();
const axios = require('axios');
const fs = require('fs');
const { https } = require('follow-redirects');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jp = require('jsonpath');
const path = require('path');
const bodyParser = require('body-parser');
const { URL } = require('url');
const bcrypt = require('bcrypt');
const http = require('http');

const limit = process.env.LIMIT || 50;

const user_agent = process.env.USER_AGENT || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.198 Safari/537.36";

app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cors());

//ルーティング
const routes = require("./routes");
const backendRoutes = require('./backendRoutes'); 
app.use("/", routes);
app.use("/", backendRoutes);


const fetch = require('node-fetch');  // Assuming node-fetch is being used

// Log to file for debugging purposes
function logError(message, errorDetails) {
    const logMessage = `${new Date().toISOString()} - ERROR: ${message}\n${errorDetails}\n\n`;
    fs.appendFileSync(path.join(__dirname, 'error.log'), logMessage);
}


app.get('/comment/:id', async (req, res) => {
  const videoId = req.params.id;
  const apiBase = req.protocol + '://' + req.get('host');  //controllersのcomment.jsにある

  try {
    const response = await axios.get(`${apiBase}/api/comments/${videoId}`);
    const cm = response.data;

    res.render('comment', { cm });
  } catch (error) {
    res.status(500).render('error', { 
      videoId, 
      error: 'コメントを取得できません', 
      details: error.message 
    });
  }
});




app.get("/difserver/:id", async (req, res) => {
  let videoId = req.params.id || req.query.v;
  try {
    res.render("difserver.ejs", {
      videoId: videoId
    });
  } catch (error) {
    res.status(500).render('error');
  }
});

// 表示ページ

async function fetchVideosByCategory(category) {
  const url = "https://raw.githubusercontent.com/siawaseok3/wakame/refs/heads/master/trend.json";
  const res = await axios.get(url);
  const data = res.data;


  if (!data[category]) {
    throw new Error(`カテゴリ「${category}」が存在しません`);
  }

  const topVideos = data[category].map(video => [
    video.id,
    {
      videoTitle: video.title,
      channelName: video.channel,
      channelId: `@${video.channel}`, 
      publishedAt: video.publishedAt,
    }
  ]);

  return {
    updated: data.updated,
    topVideos,
  };
}

["trending", "music", "gaming"].forEach((category) => {
  const route = category === "trending" ? "/" : `/${category}`;
  app.get(route, async (req, res) => {
    try {
      const { topVideos, updated } = await fetchVideosByCategory(category);
      res.render("wakametube.ejs", {
        category,
        topVideos,
        updated
      });
    } catch (error) {
      console.error(`エラー（${category}）:`, error.message);
      res.render("wakametube.ejs", {
        category,
        topVideos: [],
        updated: null
      });
    }
  });
});

app.get("/api-videos/:category", async (req, res) => {
  const category = req.params.category;
  if (!["trending", "music", "gaming"].includes(category)) {
    return res.status(400).json({ error: "無効なカテゴリです" });
  }

  try {
    const { topVideos, updated } = await fetchVideosByCategory(category);
    res.json({ category, topVideos, updated });
  } catch (error) {
    console.error("APIエラー:", error.message);
    res.status(500).json({ topVideos: [], updated: null });
  }
});



app.get('/st', (req, res) => {
    res.sendStatus(200);
});

// サーチ
app.get("/s", async (req, res) => {
    let query = req.query.q;
    let page = Number(req.query.p || 2);
    let cookies = parseCookies(req);
    let wakames = cookies.wakames === 'true';

    try {
        const searchResult = await ytsr(query, {
            limit,
            pages: page,
            gl: 'JP',   
            hl: 'ja'    
        });
        console.log("=== ytsr result ===");
        console.dir(searchResult, { depth: null });

        if (wakames) {
            res.render("search2.ejs", {
                res: searchResult,
                query: query,
                page
            });
        } else {
            res.render("search.ejs", {
                res: searchResult,
                query: query,
                page
            });
        }
    } catch (error) {
        console.error(error);
        try {
            res.status(500).render("error.ejs", {
                title: "ytsr Error",
                content: error
            });
        } catch (error) {
            console.error(error);
        }
    }
});

//プレイリスト
app.get("/p/:id", async (req, res) => {
	if (!req.params.id) return res.redirect("/");
	let page = Number(req.query.p || 1);
	try {
		res.render("playlist.ejs", {
			playlist: await ytpl(req.params.id, { limit, pages: page }),
			page
		});
	} catch (error) {
		console.error(error);
		res.status(500).render("error.ejs", {
			title: "ytpl Error",
			content: error
		});
	}
});



const convertYtplToChannel = (playlist, items) => ({
  id: playlist.id,
  author: {
    name: playlist.author?.name || "",
    bestAvatar: {
      url: playlist.author?.avatars?.[0]?.url || "",
    },
  },
  description: playlist.description || "",
  descriptionShort: playlist.descriptionShort || "",
  items: items.map(item => ({
    id: item.id,
    title: item.title,
    duration: item.duration,
    bestThumbnail: {
      url: item.bestThumbnail?.url || "",
    },
    author: {
      name: item.author?.name || "",
    },
  })),
  totalItems: playlist.items.length,
});

app.get("/c/:id", async (req, res) => {
  const id = req.params.id;

  if (!id || typeof id !== "string" || id.trim() === "") {
    // バリデーションエラーはログなしでレスポンスだけ返す
    return res.status(400).render("error.ejs", {
      title: "Bad Request",
      content: "プレイリストIDまたはURLが指定されていません。",
    });
  }

  const page = Number(req.query.p || 1);

  if (isNaN(page) || page < 1) {
    return res.status(400).render("error.ejs", {
      title: "Bad Request",
      content: "ページ番号が不正です。",
    });
  }

  const perPage = 80;
  const limit = 500;

  try {
    const playlist = await ytpl(id, { limit });

    let cleanTitle = playlist.title;
    const prefix = "Uploads from ";
    if (cleanTitle.startsWith(prefix)) {
      cleanTitle = cleanTitle.slice(prefix.length);
    }

    const start = (page - 1) * perPage;
    const end = start + perPage;

    if (start >= playlist.items.length) {
      return res.status(404).render("error.ejs", {
        title: "Not Found",
        content: "指定されたページは存在しません。",
      });
    }

    const items = playlist.items.slice(start, end);

    const channel = convertYtplToChannel(playlist, items);
    channel.title = cleanTitle;

    res.render("channel.ejs", { channel, page });
  } catch (error) {
    // エラー発生時のみログ出力
    console.error("ytpl error:", error);
    res.status(500).render("error.ejs", {
      title: "ytpl Error",
      content:
        error.message || "プレイリストの取得に失敗しました。時間をおいて再度お試しください。",
    });
  }
});

// サムネ読み込み
app.get("/vi*", (req, res) => {
	const targetUrl = "https://i.ytimg.com" + req.path;

	miniget(targetUrl, {
		headers: { "user-agent": user_agent }
	})
		.on("error", (err) => {
			console.error("エラー:", err);
			res.status(500).send("画像の取得に失敗しました");
		})
		.pipe(res); // 取得した画像をそのまま返す
});

// チャンネル画像読み込み
app.get("/ytc/:id", (req, res) => {
    const channelId = req.params.id;
    const imageUrl = `https://yt3.ggpht.com/ytc/${channelId}=s900-c-k-c0xffffffff-no-rj-mo`;
    let stream = miniget(imageUrl, {
        headers: {
            "user-agent": user_agent
        }
    });
    stream.on('error', err => {
        console.log(err);
        res.status(500).send(err.toString());
    });
    stream.pipe(res);
});

//tool
app.get("/tool",(req, res) => {
  res.render("../tool/n/home.ejs")
})

app.get("/tool/n/comment/:id",(req, res) => {
  const id = req.params.id;
  res.render("../tool/n/comment.ejs", {id})
})

app.get('/tool/:id', (req, res) => {
  const id = req.params.id;
  res.render(`../tool/${id}.ejs`, { id: id });
});

//tst
app.get("/tst1234",(req, res) => {
  res.render("../tst.ejs")
})

//urlでYouTube動画を探す
app.get("/urls",(req, res) => {
  res.render("../views/url.ejs")
})

//blog
app.get("/blog",(req, res) => {
  res.render("../views/blog.ejs")
})
app.get('/blog/:id', (req, res) => {
  const id = req.params.id;
  res.render(`blog/${id}`, { id: id });
});

//ネタ
app.get("/neta",(req, res) => {
  res.render("../views/neta.ejs")
})
app.get('/neta/:id', (req, res) => {
  const id = req.params.id;
  res.render(`neta/${id}`, { id: id });
});

//お問い合わせ
app.get("/send",(req, res) => {
  res.render("../views/send.ejs")
})

//apps
app.get("/app",(req, res) => {
  res.render("../public/apps.ejs")
})

//game
app.get('/game/:id', (req, res) => {
  const id = req.params.id;
  res.render(`../game/${id}.ejs`, { id: id });
});

//proxy
app.get("/proxy/",(req, res) => {
  res.render("../read/proxy.ejs")
})

//設定
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

function parseCookies(request) {
    const list = {};
    const cookieHeader = request.headers.cookie;

    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            let parts = cookie.split('=');
            list[parts.shift().trim()] = decodeURI(parts.join('='));
        });
    }

    return list;
}

app.get('/setting', (req, res) => {
    const cookies = parseCookies(req);
    const wakames = cookies.wakames === 'true';
    const wakametubeumekomi = cookies.wakametubeumekomi === 'true';
    res.render('setting.ejs', { wakames, wakametubeumekomi });
});

app.post('/setting', (req, res) => {
    const wakames = req.body.wakames === 'on';
    const wakametubeumekomi = req.body.wakametubeumekomi === 'on';

    res.setHeader('Set-Cookie', [
        `wakames=${wakames}; HttpOnly; Max-Age=31536000`,
        `wakametubeumekomi=${wakametubeumekomi}; HttpOnly; Max-Age=31536000`
    ]);
    
    res.redirect('/setting');
});

//proxy
app.get('/proxy/:id', (req, res) => {
  const id = req.params.id;
  res.render(`../read/proxy/${id}.ejs`, { id: id });
});

//html取得
app.get('/gethtml/:encodedUrl', async (req, res) => {
  const { encodedUrl } = req.params;
  
  const replacedUrl = decodeURIComponent(encodedUrl);
  
  const url = replacedUrl.replace(/\.wakame02\./g, '.');

  if (!url) {
    return res.status(400).send('URLが入力されていません');
  }
  
  try {
    const response = await axios.get(url);
    const html = response.data;
    res.setHeader('Content-Type', 'text/plain');
    res.send(html);
  } catch (error) {
    res.status(500).send('URLの取得に失敗しました');
  }
});
app.get('/getinv/:encodedUrl', async (req, res) => {

  const { encodedUrl } = req.params;
  const replacedUrl = decodeURIComponent(encodedUrl);
  const invurl = replacedUrl.replace(/\.wakame02\./g, '.');
  const videoId = "H08YWE4CIFQ";
  
  try {
    const videoInfo = await axios.get(`${invurl}/api/v1/videos/H08YWE4CIFQ`);
    
    const formatStreams = videoInfo.formatStreams || [];
    const streamUrl = formatStreams.reverse().map(stream => stream.url)[0];
    
    const templateData = {
      stream_url: streamUrl,
      videoId: videoId,
      channelId: videoInfo.authorId,
      channelName: videoInfo.author,
      channelImage: videoInfo.authorThumbnails?.[videoInfo.authorThumbnails.length - 1]?.url || '',
      videoTitle: videoInfo.title,
      videoDes: videoInfo.descriptionHtml,
      videoViews: videoInfo.viewCount,
      likeCount: videoInfo.likeCount
    };

    res.render('infowatch', templateData);
  } catch (error) {
        res.status(500).render('matte', { 
      videoId, 
      error: '動画を取得できません', 
      details: error.message 
    });
  }
});
//わかめproxy
app.get('/getpage/:encodedUrl', async (req, res) => {
  const { encodedUrl } = req.params;
  
  const replacedUrl = decodeURIComponent(encodedUrl);
  
  const url = replacedUrl.replace(/\.wakame02\./g, '.');

  if (!url) {
    return res.status(400).send('URLが入力されていません');
  }
  
  try {
    const response = await axios.get(url);
    const html = response.data;
    res.send(html);
  } catch (error) {
    res.status(500).send('URLの取得に失敗しました');
  }
});

//強化版わかめproxy
app.get('/getwakame/:encodedUrl', async (req, res) => {
  const { encodedUrl } = req.params;
  if (!encodedUrl) {
    return res.status(400).send('URLが入力されていません');
  }

  const replacedUrl = decodeURIComponent(encodedUrl).replace(/\.wakame02\./g, '.');

  try {
    const response = await axios.get(replacedUrl);
    
    if (response.status !== 200) {
      return res.status(response.status).send('URLの取得に失敗しました');
    }

    let html = response.data;
    const baseUrl = new URL(replacedUrl);
    console.log(baseUrl)
//リンク
  html = html.replace(/<a\s+([\s\S]*?)href="([\s\S]*?)"([\s\S]*?)>([\s\S]*?)<\/a>/g, (match, beforeHref, url, afterHref, innerText) => {
  let absoluteUrl;

  try {
    if (url.startsWith('http') || url.startsWith('https')) {
      absoluteUrl = url;
    } else {
      absoluteUrl = new URL(url, baseUrl).href;
    }
  } catch (e) {
    console.error('Error parsing URL:', url, e);
    return match;
  }

  const replacedAbsoluteUrl = absoluteUrl.replace(/\./g, '.wakame02.');
  const encoded = encodeURIComponent(replacedAbsoluteUrl);

  return `<a ${beforeHref}href="/getwakame/${encoded}"${afterHref}>${innerText}</a>`;
});

//image
html = html.replace(/<img\s+([\s\S]*?src="([\s\S]*?)"[\s\S]*?)>/g, (match, fullTag, url) => {
  let absoluteUrl;
  if (url.startsWith('http') || url.startsWith('https')) {
    absoluteUrl = url;
  } else {
    absoluteUrl = new URL(url, baseUrl).href;
  }

  const encodedString = Buffer.from(absoluteUrl).toString('base64');
  const replacedAbsoluteUrl = encodedString.replace(/\./g, '.wakame02.');
  const encoded = encodeURIComponent(replacedAbsoluteUrl);

  return `<img ${fullTag.replace(url, `/getimage/${encoded}`)}>`;
});
//css
    const linkTags = html.match(/<link\s+[^>]*href="([^"]+)"[^>]*>/g);

    if (linkTags) {
      for (const match of linkTags) {
        const href = match.match(/href="([^"]+)"/)[1];
        let absoluteUrl;
        if (href.startsWith('http') || href.startsWith('https') || href.startsWith('//')) {
          absoluteUrl = href;
        } else {
            absoluteUrl = new URL(href, baseUrl).href;
        }

        try {
          const cssResponse = await axios.get(absoluteUrl);
          if (cssResponse.status === 200) {
            html = html.replace(match, `<style>${cssResponse.data}</style>`);
          }
        } catch (error) {
          console.error('CSSの取得に失敗しました:', error.message);
        }
      }
    }
    
    res.send(html);
  } catch (error) {
    console.error('Error fetching URL:', error.message);
    res.status(500).send('サーバーエラー：URLの取得に失敗しました');
  }
});

//画像取得
function decodeBase64Url(encodedUrl) {
    return Buffer.from(encodedUrl, 'base64').toString('ascii');
}
app.get('/getimage/:encodedUrl', (req, res) => {
  const encodedUrl = req.params.encodedUrl;
  const decodedUrl = decodeBase64Url(encodedUrl);
  const imageUrl = decodedUrl.replace(/\.wakame02\./g, '.');
    miniget(imageUrl)
        .on('error', (err) => {
            console.error('Error fetching image:', err);
            res.status(500).send('Error fetching image');
        })
        .pipe(res);
});

//わかめMusic
const scdl = require('soundcloud-downloader').default;

app.get('/wakams', (req, res) => {
    res.render('wakamusic', { tracks: [] , query: [] });
});

app.get('/wakamc', async (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).send('Search query is required');
    }

    try {
        const searchResults = await scdl.search({ query: query, resourceType: 'tracks' });

        const tracks = searchResults.collection.slice(0, 10).map(track => ({
            id: track.id,
            title: track.title,
            username: track.user.username,
            artwork_url: track.artwork_url ? track.artwork_url.replace('-large', '-t500x500') : 'https://via.placeholder.com/500'
        }));

        res.render('wakamusic', { tracks: tracks , query: query });
    } catch (error) {
        console.error('Error occurred while searching:', error);
        res.status(500).send('えらー。あらら');
    }
});

app.get('/okiniiri', (req, res) => {
    let favorites = [];

    const cookie = req.headers.cookie
        .split('; ')
        .find(row => row.startsWith('wakamemusicfavorites='));

    if (cookie) {
        try {
            favorites = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        } catch (error) {
            console.error('Error parsing cookie:', error);
        }
    }

    res.render('okiniiri', { tracks: favorites });
});

app.get('/wakamc/f', (req, res) => {
    let favorites = [];
　　　const charge = axios.get(`https://watawatawata.glitch.me/`);
    const cookie = req.headers.cookie
        .split('; ')
        .find(row => row.startsWith('wakamemusicfavorites='));

    if (cookie) {
        try {
            favorites = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        } catch (error) {
            console.error('Error parsing cookie:', error);
        }
    }

    res.render('wakamemusicf', { favorites: favorites });
});

//お気に入り
app.get('/wakameokini', (req, res) => {
    let favorites = [];
　　　const charge = axios.get(`https://watawatawata.glitch.me/`);
    const cookie = req.headers.cookie
        .split('; ')
        .find(row => row.startsWith('wakametubefavorites='));

    if (cookie) {
        try {
            favorites = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        } catch (error) {
            console.error('Error parsing cookie:', error);
        }
    }
    res.render('wakameokiniiri', { tracks: favorites });
});


//履歴
app.get('/wakamehistory', (req, res) => {
    let favorites = [];

    const cookie = req.headers.cookie
        .split('; ')
        .find(row => row.startsWith('wakametubehistory='));

    if (cookie) {
        try {
            favorites = JSON.parse(decodeURIComponent(cookie.split('=')[1]));
        } catch (error) {
            console.error('Error parsing cookie:', error);
        }
    }
    res.render('wakamehistory', { tracks: favorites });
});

//サジェスト
app.get('/suggest', (req, res) => {
    const keyword = req.query.keyword;
    const options = {
        hostname: 'www.google.com',
        path: `/complete/search?client=youtube&hl=ja&ds=yt&q=${encodeURIComponent(keyword)}`,
        method: 'GET',
        headers: {
            'User-Agent': 'Mozilla/5.0'
        }
    };
    const request = http.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => {
            data += chunk;
        });
        response.on('end', () => {
            const jsonString = data.substring(data.indexOf('['), data.lastIndexOf(']') + 1);

            try {
                const suggestionsArray = JSON.parse(jsonString);
                const suggestions = suggestionsArray[1].map(i => i[0]);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.json(suggestions);
            } catch (error) {
                console.error('JSON parse error:', error);
                res.status(500).send({ error: 'えらー。あらら' });
            }
        });
    });
    request.on('error', (error) => {
        console.error('Request error:', error);
        res.status(500).send({ error: 'えらー。あらら' });
    });
    request.end();
});

//概要欄用リダイレクト
app.get('/watch', (req, res) => {
  const videoId = req.query.v;
  if (videoId) {
    res.redirect(`/w/${videoId}`);
  } else {
    res.redirect(`/`);
  }
});
app.get('/channel/:id', (req, res) => {
  const id = req.params.id;
    res.redirect(`/c/${id}`);
});
app.get('/channel/:id/join', (req, res) => {
  const id = req.params.id;
  res.redirect(`/c/${id}`);
});
app.get('/hashtag/:des', (req, res) => {
  const des = req.params.des;
  res.redirect(`/s?q=${des}`);
});

//リダイレクト
app.get('/redirect', (req, res) => {
  const subp = req.query.p;
  const id= req.query.id;
  if (id) {
    res.redirect(`/${subp}/${id}`);
  } else {
    res.redirect(`/${subp}`);
  }
});

//偽エラー画面
app.get("/block/cc3q",(req, res) => {
    let referer = req.get('Referer') || 'No referer information';
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  res.render('../views/tst/2.ejs', { ip: ip });
})


//edu
app.get('/edu', (req, res) =>{
  res.render('edu/home');
})

app.get('/wk/:id', async(req, res) => {
  const { id } = req.params;
  try{
    const response = await axios.get(`https://wccreat.glitch.me/data/${id}`);
    const html = response.data.html;
    res.send(html);
  }catch(error){
    res.stat(500).send("ページが存在していません。");
  }
});

app.get('/wk/login/:id', async(req, res) => {
  const { id } = req.params;
  try{
    const response = await axios.get(`https://wccreat.glitch.me/data/${id}`);
    const html = response.data.html;
    res.send(html);
  }catch(error){
    res.stat(500).send("ページが存在していません。");
  }
});

app.get('/edu/create/:id', (req, res) => {
  const { id } = req.params;
  res.render('edu/create', { id });
});

app.get('/edu/edit/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.get(`https://wccreat.glitch.me/data/${id}`);
    const html = response.data.html;
    res.render('edu/edit', { id, html });
  } catch (error) {
    console.error('Error fetching HTML:', error.message);
    res.status(500).send('HTMLデータの取得中にエラーが発生しました。');
  }
});

app.get('/edu/f/:id', (req, res) => {
  const id = req.params.id;
  res.render(`edu/f/${id}`);
});

app.get('/edu/help/:id', (req, res) => {
  const id = req.params.id;
  res.render(`edu/help/${id}`);
});

app.get('/edu/site/:id', (req, res) => {
  const id = req.params.id;
  res.render(`edu/site/${id}`);
});

app.get('/edu/sitehtml/:id', (req, res) => {
  const id = req.params.id;
  res.render(`edu/sitehtml/${id}`);
});

app.get('/edu/site', (req, res) => {
  const id = req.params.id;
  res.render(`edu/site`);
});

app.all("/edu/request",async(req,res)=>{
  try{
    const path=req.query.path;
    const options={
      method:req.method,
      url:`https://wccreat.glitch.me${path}`,
      headers:{...req.headers,host:undefined},
      data:["POST","PUT","PATCH"].includes(req.method)? req.body: null
    };
    const {data:response}=await axios(options);
    res.set("Content-Type", "text/plain").send(response);
  }catch(e){
    console.error(e);
    res.send({message:"リクエストに失敗しました"});
  }
});


const { Innertube } = require("youtubei.js");

let youtubeInstance;

async function getYouTubeInstance() {
    if (!youtubeInstance) {
        youtubeInstance = await Innertube.create({
            config: {
                hl: "ja", 
                gl: "JP", 
            },
        });
    }
    return youtubeInstance;
}

function formatJapaneseNumber(text, suffix) {
    if (!text) return null;

    // 例: "7.18M subscribers" → ["7.18", "M"]
    const match = text.match(/([\d.,]+)\s*([KMB]?)/i);
    if (!match) return text + suffix;

    let [, numberStr, unit] = match;
    let number = parseFloat(numberStr.replace(/,/g, ""));

    switch (unit.toUpperCase()) {
        case "K":
            number *= 1000;
            break;
        case "M":
            number *= 1000000;
            break;
        case "B":
            number *= 1000000000;
            break;
    }

    if (number >= 100000000) {
        return `${Math.floor(number / 10000000) / 10}億${suffix}`;
    } else if (number >= 10000) {
        return `${Math.floor(number / 1000) / 10}万${suffix}`;
    } else {
        return `${Math.floor(number)}${suffix}`;
    }
}

// チャンネル情報を取得して JSON で返すルート
app.get("/acterinfo/:id", async (req, res) => {
    const channelId = req.params.id;

    if (!channelId) {
        return res.status(400).json({ error: "チャンネルIDが指定されていません。" });
    }

    try {
        const youtube = await getYouTubeInstance();
        const channel = await youtube.getChannel(channelId);

        if (!channel) {
            return res.status(404).json({ error: "チャンネルが見つかりませんでした。" });
        }

        const { metadata, header } = channel;

        const rawSubscribers =
            header?.content?.metadata?.metadata_rows?.[1]?.metadata_parts?.[0]?.text?.text || null;
      
        const atid =
            header?.content?.metadata?.metadata_rows?.[0]?.metadata_parts?.[0]?.text?.text || null;

        const rawVideos =
            header?.content?.metadata?.metadata_rows?.[1]?.metadata_parts?.[1]?.text?.text || null;

        const data = {
            title: metadata.title,
            description: metadata.description,
            channelId: metadata.external_id,
            channelhandle: atid,
            avatar: metadata.avatar?.[0]?.url || null,
            subscribers: formatJapaneseNumber(rawSubscribers, "人"),
            videos: formatJapaneseNumber(rawVideos, "本"),
            banner: header?.content?.banner?.image?.[0]?.url || null,
        };

        console.log(`✅ /acterinfo/${channelId} にアクセスされました`);
        res.json(data);
    } catch (error) {
        console.error(`❌ チャンネル情報取得エラー: ${error.message}`);
        res.status(500).json({ error: "チャンネル情報の取得に失敗しました。", detail: error.message });
    }
});

// エラー
app.use((req, res) => {
	res.status(404).render("error.ejs", {
		title: "404 Not found",
	});
});

const listener = app.listen(process.env.PORT || 3000, () => {
	console.log("Your app is now listening on port", listener.address().port);
});

process.on("unhandledRejection", console.error);

