// Client-side video resolver utility
interface ResolveResult {
  ok: boolean;
  url?: string;
  provider?: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  embed?: {
    url?: string;
    html?: string;
  };
  media?: string[];
  error?: string;
}

// YouTube API functions
export async function searchYouTube(query: string): Promise<{ ok: boolean; results?: any[]; error?: string }> {
  // For development/demo purposes, return mock data
  // In production, you would need to set up a backend API or use CORS-enabled YouTube API
  
  if (!query.trim()) {
    return { ok: false, error: "Empty query" };
  }

  // Mock YouTube search results for demo
  const mockResults = [
    {
      id: "dQw4w9WgXcQ",
      title: `${query} - Sample Video 1`,
      thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    },
    {
      id: "jNQXAC9IVRw",
      title: `${query} - Sample Video 2`, 
      thumbnail: "https://i.ytimg.com/vi/jNQXAC9IVRw/hqdefault.jpg",
      url: "https://www.youtube.com/watch?v=jNQXAC9IVRw"
    },
    {
      id: "9bZkp7q19f0",
      title: `${query} - Sample Video 3`,
      thumbnail: "https://i.ytimg.com/vi/9bZkp7q19f0/hqdefault.jpg", 
      url: "https://www.youtube.com/watch?v=9bZkp7q19f0"
    }
  ].map(video => ({
    ...video,
    title: video.title.replace('Sample Video', `Result for "${query}"`)
  }));

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return { ok: true, results: mockResults };
}

// Video resolution functions
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/,
    /youtu\.be\/([a-zA-Z0-9_-]+)/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) return match[1];
  }
  
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get("v") || null;
  } catch {
    return null;
  }
}

function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:channels\/[^\/]+\/|groups\/[^\/]+\/videos\/|album\/[^\/]+\/video\/|video\/|)(\d+)/);
  return match ? match[1] : null;
}

function isDirectVideoPath(url: string): boolean {
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
  const urlPath = new URL(url).pathname.toLowerCase();
  return videoExtensions.some(ext => urlPath.endsWith(ext));
}

export async function resolveVideoUrl(url: string): Promise<ResolveResult> {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();

    // Direct video files
    if (isDirectVideoPath(url)) {
      return {
        ok: true,
        url,
        provider: 'direct',
        title: urlObj.pathname.split('/').pop() || 'Direct Video',
        embed: { url: url },
        media: [url]
      };
    }

    // YouTube
    const youtubeId = extractYouTubeId(url);
    if (youtubeId) {
      return {
        ok: true,
        url,
        provider: 'youtube',
        title: `YouTube Video`,
        thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
        embed: { 
          url: `https://www.youtube.com/embed/${youtubeId}?autoplay=1&enablejsapi=1` 
        }
      };
    }

    // Vimeo
    const vimeoId = extractVimeoId(url);
    if (vimeoId) {
      return {
        ok: true,
        url,
        provider: 'vimeo',
        title: `Vimeo Video`,
        embed: { 
          url: `https://player.vimeo.com/video/${vimeoId}?autoplay=1` 
        }
      };
    }

    // Instagram
    if (hostname.includes('instagram.com')) {
      return {
        ok: true,
        url,
        provider: 'instagram',
        title: 'Instagram Video',
        embed: { url: `${url}/embed` }
      };
    }

    // TikTok
    if (hostname.includes('tiktok.com')) {
      return {
        ok: true,
        url,
        provider: 'tiktok',
        title: 'TikTok Video',
        embed: { url: `https://www.tiktok.com/embed/v2/${url}` }
      };
    }

    // Twitch
    if (hostname.includes('twitch.tv')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (urlObj.pathname.includes('/videos/') && videoId) {
        return {
          ok: true,
          url,
          provider: 'twitch',
          title: 'Twitch Video',
          embed: { 
            url: `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}` 
          }
        };
      }
    }

    // Dailymotion
    if (hostname.includes('dailymotion.com')) {
      const videoId = urlObj.pathname.split('/video/')[1]?.split('_')[0];
      if (videoId) {
        return {
          ok: true,
          url,
          provider: 'dailymotion',
          title: 'Dailymotion Video',
          embed: { 
            url: `https://www.dailymotion.com/embed/video/${videoId}` 
          }
        };
      }
    }

    // Fallback - try to use URL directly
    return {
      ok: true,
      url,
      provider: 'unknown',
      title: `Video from ${hostname}`,
      embed: { url }
    };

  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to resolve video URL'
    };
  }
}