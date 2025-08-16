//
//  resolve.ts
//  
//
//  Created by ChatGPT-5 on 8/15/25.
//


// pages/api/resolve.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import * as cheerio from "cheerio";
import LRU from "lru-cache";

// --- cache ---
const cache = new LRU<string, any>({ max: 500, ttl: 1000 * 60 * 5 }); // 5 min

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_4) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Safari/605.1.15";

// --- helpers ---
function isHttpUrl(u: string) {
  try {
    const x = new URL(u);
    return x.protocol === "http:" || x.protocol === "https:";
  } catch {
    return false;
  }
}

function isDirectVideoPath(path: string) {
  return [".mp4", ".webm", ".ogg", ".mov", ".m4v"].some(ext =>
    path.toLowerCase().endsWith(ext)
  );
}

function extractYouTubeId(url: string) {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  ];
  for (const rx of patterns) {
    const m = url.match(rx);
    if (m && m[1]) return m[1];
  }
  try {
    const u = new URL(url);
    return u.searchParams.get("v") || null;
  } catch {
    return null;
  }
}

function buildYouTubeEmbed(id: string) {
  return `https://www.youtube.com/embed/${id}?autoplay=1&enablejsapi=1`;
}

async function fetchHtml(url: string) {
  const cached = cache.get(`html:${url}`);
  if (cached) return cached;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
    maxRedirects: 5,
    timeout: 10000,
  });
  cache.set(`html:${url}`, data);
  return data;
}

async function fetchJson(url: string) {
  const cached = cache.get(`json:${url}`);
  if (cached) return cached;
  const { data } = await axios.get(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json,*/*" },
    maxRedirects: 5,
    timeout: 10000,
  });
  cache.set(`json:${url}`, data);
  return data;
}

// Known oEmbed endpoints
function knownOEmbed(url: string) {
  const h = new URL(url).hostname.toLowerCase();
  if (h.includes("youtube.com") || h === "youtu.be")
    return `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
  if (h.includes("vimeo.com"))
    return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  if (h.includes("dailymotion.com"))
    return `https://www.dailymotion.com/services/oembed?url=${encodeURIComponent(url)}`;
  if (h.includes("soundcloud.com"))
    return `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  if (h.includes("tiktok.com"))
    return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  if (h.includes("twitter.com") || h.includes("x.com"))
    return `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`;
  return null;
}

// Parse page for fallback
function parseForEmbeds($: cheerio.CheerioAPI, baseUrl: string) {
  const meta = (p: string) =>
    $(`meta[property="${p}"]`).attr("content") ||
    $(`meta[name="${p}"]`).attr("content");

  const ogVideo = meta("og:video") || meta("og:video:url");
  const twitterPlayer = meta("twitter:player");
  const title = meta("og:title") || $("title").text().trim();
  const description = meta("og:description") || null;
  const thumbnail =
    meta("og:image") ||
    $('meta[property="og:image:url"]').attr("content") ||
    null;

  const iframes: string[] = [];
  $("iframe").each((_, el) => {
    const src = $(el).attr("src");
    if (src) try { iframes.push(new URL(src, baseUrl).toString()); } catch {}
  });

  const videos: string[] = [];
  $("video, video source").each((_, el) => {
    const src = $(el).attr("src");
    if (src) {
      try {
        const abs = new URL(src, baseUrl).toString();
        if (isDirectVideoPath(abs)) videos.push(abs);
      } catch {}
    }
  });

  return {
    title,
    description,
    thumbnail,
    embedUrl: ogVideo || twitterPlayer || iframes[0] || null,
    videos,
  };
}

// Shape result
function resultShape(input: any) {
  return {
    ok: true,
    url: input.url || null,
    provider: input.provider || null,
    title: input.title || null,
    description: input.description || null,
    thumbnail: input.thumbnail || null,
    embed: {
      url: input.embedUrl || null,
      html: input.html || null,
      allow:
        input.allow ||
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
    },
    media: input.media || [],
  };
}

// --- handler ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const target = (req.query.url || "").toString().trim();
  if (!isHttpUrl(target)) {
    return res.status(400).json({ ok: false, error: "Invalid or missing ?url=" });
  }

  try {
    const u = new URL(target);

    // 1. Direct file
    if (isDirectVideoPath(u.pathname)) {
      return res.json(
        resultShape({
          url: target,
          provider: "direct",
          title: u.pathname.split("/").pop(),
          embedUrl: null,
          media: [target],
        })
      );
    }

    // 2. YouTube
    const ytId = extractYouTubeId(target);
    if (ytId) {
      return res.json(
        resultShape({
          url: target,
          provider: "youtube",
          embedUrl: buildYouTubeEmbed(ytId),
          title: `YouTube Video (${ytId})`,
          thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        })
      );
    }

    // 3. Known oEmbed
    let oembedUrl = knownOEmbed(target);
    if (oembedUrl) {
      try {
        const data = await fetchJson(oembedUrl);
        const $ = cheerio.load(data.html || "");
        const src = $("iframe").attr("src");

        return res.json(
          resultShape({
            url: target,
            provider: data.provider_name || "oembed",
            title: data.title,
            thumbnail: data.thumbnail_url,
            embedUrl: src || null,
            html: data.html || null,
          })
        );
      } catch {
        // ignore, fall through
      }
    }

    // 4. Fallback parse
    const html = await fetchHtml(target);
    const $ = cheerio.load(html);
    const parsed = parseForEmbeds($, target);

    if (!parsed.embedUrl && parsed.videos.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "No embeddable media found",
      });
    }

    return res.json(
      resultShape({
        url: target,
        provider: "parsed",
        title: parsed.title,
        description: parsed.description,
        thumbnail: parsed.thumbnail,
        embedUrl: parsed.embedUrl,
        media: parsed.videos,
      })
    );
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: e.message });
  }
}
