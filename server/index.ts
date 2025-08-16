//
//  index.ts
//  
//
//  Created by Cameron Nelms on 8/16/25.
//

import express from "express";
import cors from "cors";
import axios from "axios";
import * as cheerio from "cheerio";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const YT_API_KEY = process.env.YOUTUBE_API_KEY;

// --- /api/search/youtube ---
app.get("/api/search/youtube", async (req, res) => {
  const q = req.query.q as string;
  if (!q) return res.status(400).json({ ok: false, error: "Missing ?q=" });
  if (!YT_API_KEY) return res.status(500).json({ ok: false, error: "Missing YOUTUBE_API_KEY" });

  try {
    const { data } = await axios.get("https://www.googleapis.com/youtube/v3/search", {
      params: {
        part: "snippet",
        type: "video",
        maxResults: 10,
        q,
        key: YT_API_KEY,
      },
    });

    const results = data.items.map((item: any) => ({
      id: item.id.videoId,
      title: item.snippet.title,
      thumbnail: item.snippet.thumbnails?.medium?.url,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    }));

    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// --- /api/videoresolver ---
app.get("/api/videoresolver", async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ ok: false, error: "Missing ?url=" });

  try {
    // Direct file check
    if (url.match(/\.(mp4|webm|ogg|mov|m4v)$/)) {
      return res.json({
        ok: true,
        url,
        provider: "direct",
        embed: { url },
        media: [url],
      });
    }

    // YouTube
    const ytMatch = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{6,})/);
    if (ytMatch) {
      const id = ytMatch[1];
      return res.json({
        ok: true,
        url,
        provider: "youtube",
        title: "YouTube Video",
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        embed: { url: `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1` },
      });
    }

    // Fallback: scrape metadata
    const { data } = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const $ = cheerio.load(data);

    const title = $("title").text() || null;
    const thumbnail = $('meta[property="og:image"]').attr("content") || null;
    const ogVideo = $('meta[property="og:video"]').attr("content");

    res.json({
      ok: true,
      url,
      provider: "parsed",
      title,
      thumbnail,
      embed: { url: ogVideo || null },
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
