//
//  youtube.ts
//
//
//  Created by ChatGPT-5 + Cameron J Nelms on 8/16/25.
//

import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

const YT_API_KEY = process.env.YOUTUBE_API_KEY; // set in .env.local

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const q = (req.query.q as string) || "";
  if (!q) return res.status(400).json({ ok: false, error: "Missing ?q=" });

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
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
}
