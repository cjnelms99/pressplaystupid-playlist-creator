import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, GripVertical, Play, Pause, SkipForward, SkipBack, Download, Copy, Upload, Globe, Plus, Eye, EyeOff } from "lucide-react";

interface VideoItem {
  id: string;
  url: string;
  title?: string;
  thumbnail?: string;
}

export default function PlaylistCreator() {
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("https://www.example.com");
  const playerRef = useRef<HTMLIFrameElement>(null);
  const browserRef = useRef<HTMLIFrameElement>(null);

  // Enhanced URL parser that detects direct video files and various platforms
  const getEmbedUrl = (url: string): string => {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname.toLowerCase();

    // Check for direct video files first
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'];
    if (videoExtensions.some(ext => pathname.endsWith(ext))) {
      return url; // Return direct video URL for HTML5 video element
    }

    // Transform specific site pattern: /videos/ -> /embed/ and extract ID after last hyphen
    if (urlObj.pathname.includes('/videos/')) {
      const pathParts = urlObj.pathname.split('/');
      const videoPath = pathParts.find(part => part.includes('-'));
      if (videoPath) {
        const lastHyphenIndex = videoPath.lastIndexOf('-');
        if (lastHyphenIndex !== -1) {
          const videoId = videoPath.substring(lastHyphenIndex + 1);
          const newUrl = `${urlObj.origin}/embed/${videoId}`;
          return newUrl;
        }
      }
    }

    // Transform view_video.php?viewkey= pattern to /embed/
    if (urlObj.pathname.includes('/view_video.php') && urlObj.searchParams.has('viewkey')) {
      const viewkey = urlObj.searchParams.get('viewkey');
      if (viewkey) {
        return `${urlObj.origin}/embed/${viewkey}`;
      }
    }

    // YouTube
    if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
      let videoId = '';
      if (hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v') || '';
      }
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`;
    }

    // Vimeo
    if (hostname.includes('vimeo.com')) {
      const videoId = urlObj.pathname.split('/').pop();
      return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }

    // Instagram
    if (hostname.includes('instagram.com')) {
      return `${url}/embed`;
    }

    // TikTok
    if (hostname.includes('tiktok.com')) {
      return `https://www.tiktok.com/embed/v2/${url}`;
    }

    // Twitch
    if (hostname.includes('twitch.tv')) {
      const videoId = urlObj.pathname.split('/').pop();
      if (urlObj.pathname.includes('/videos/')) {
        return `https://player.twitch.tv/?video=${videoId}&parent=${window.location.hostname}`;
      }
    }

    // Dailymotion
    if (hostname.includes('dailymotion.com')) {
      const videoId = urlObj.pathname.split('/video/')[1]?.split('_')[0];
      if (videoId) {
        return `https://www.dailymotion.com/embed/video/${videoId}`;
      }
    }

    // Default: try to embed directly
    return url;
  };

  // Generate bookmarklet for users to add to their browser
  const generateBookmarklet = () => {
    const bookmarkletCode = `javascript:(function(){
      const currentUrl = window.location.href;
      const title = document.title;
      const appUrl = '${window.location.origin}';
      
      // Try to find and focus existing playlist window
      const existingWindows = [];
      try {
        // Store reference in sessionStorage for window detection
        const windowId = 'playlist_' + Date.now();
        const videoData = {url: currentUrl, title: title, timestamp: Date.now(), windowId: windowId};
        
        // Use localStorage to broadcast to all open windows
        localStorage.setItem('newVideoRequest', JSON.stringify(videoData));
        localStorage.removeItem('newVideoRequest'); // Trigger storage event
        
        // Check if any window responded within 1 second
        setTimeout(() => {
          const response = localStorage.getItem('windowResponse_' + windowId);
          if (!response) {
            // No existing window responded, open new one
            window.open(appUrl + '?video=' + encodeURIComponent(currentUrl) + '&title=' + encodeURIComponent(title), '_blank');
          }
          // Clean up
          localStorage.removeItem('windowResponse_' + windowId);
        }, 1000);
        
      } catch(e) {
        // Fallback: just open new window
        window.open(appUrl + '?video=' + encodeURIComponent(currentUrl) + '&title=' + encodeURIComponent(title), '_blank');
      }
    })();`;
    return bookmarkletCode;
  };

  // Multi-window coordination and bookmarklet handling
  useEffect(() => {
    // Generate unique window ID for this instance
    const windowId = 'window_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Check for URL parameters (direct video add)
    const urlParams = new URLSearchParams(window.location.search);
    const videoUrl = urlParams.get('video');
    const videoTitle = urlParams.get('title');
    
    if (videoUrl) {
      addVideo(videoUrl);
      toast.success(`Added "${videoTitle || 'Video'}" from bookmarklet`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Listen for storage events from other windows/bookmarklet
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'newVideoRequest' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          // Respond that this window exists and can handle the request
          localStorage.setItem('windowResponse_' + data.windowId, windowId);
          
          // Ask user if they want to add the video to this window
          const shouldAdd = window.confirm(
            `Add "${data.title}" to this playlist?\n\nURL: ${data.url}`
          );
          
          if (shouldAdd) {
            addVideo(data.url);
            toast.success(`Added "${data.title}" from bookmarklet`);
            // Focus this window
            window.focus();
          }
        } catch (e) {
          console.error('Error handling video request:', e);
        }
      }
    };
    
    // Also check localStorage on mount for missed requests
    const checkMissedRequests = () => {
      try {
        const keys = Object.keys(localStorage);
        const requestKeys = keys.filter(key => key.startsWith('newVideoRequest_'));
        
        requestKeys.forEach(key => {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (Date.now() - data.timestamp < 5000) { // Within last 5 seconds
            localStorage.setItem('windowResponse_' + data.windowId, windowId);
            const shouldAdd = window.confirm(
              `Add "${data.title}" to this playlist?\n\nURL: ${data.url}`
            );
            
            if (shouldAdd) {
              addVideo(data.url);
              toast.success(`Added "${data.title}" from bookmarklet`);
            }
          }
          localStorage.removeItem(key);
        });
      } catch (e) {
        console.error('Error checking missed requests:', e);
      }
    };
    
    window.addEventListener('storage', handleStorageEvent);
    checkMissedRequests();
    
    // Cleanup
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  const addVideo = (url: string) => {
    if (!url.trim()) return;

    const videoItem: VideoItem = {
      id: Date.now().toString(),
      url: url.trim(),
      title: `Video ${playlist.length + 1}`
    };

    setPlaylist(prev => [...prev, videoItem]);
    toast.success("Video added to playlist");
  };

  const addBulkVideos = () => {
    const urls = bulkUrls
      .split('\n')
      .map(url => url.trim())
      .filter(url => url.length > 0);

    if (urls.length === 0) {
      toast.error("Please enter at least one URL");
      return;
    }

    const newVideos: VideoItem[] = urls.map((url, index) => ({
      id: (Date.now() + index).toString(),
      url,
      title: `Video ${playlist.length + index + 1}`
    }));

    setPlaylist(prev => [...prev, ...newVideos]);
    setBulkUrls("");
    toast.success(`Added ${urls.length} videos to playlist`);
  };

  const removeVideo = (id: string) => {
    const index = playlist.findIndex(v => v.id === id);
    setPlaylist(prev => prev.filter(v => v.id !== id));
    
    if (index === currentVideoIndex && playlist.length > 1) {
      setCurrentVideoIndex(Math.min(currentVideoIndex, playlist.length - 2));
    } else if (index < currentVideoIndex) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
    
    toast.success("Video removed from playlist");
  };

  const moveVideo = (fromIndex: number, toIndex: number) => {
    const newPlaylist = [...playlist];
    const [movedVideo] = newPlaylist.splice(fromIndex, 1);
    newPlaylist.splice(toIndex, 0, movedVideo);
    setPlaylist(newPlaylist);

    // Update current video index if needed
    if (fromIndex === currentVideoIndex) {
      setCurrentVideoIndex(toIndex);
    } else if (fromIndex < currentVideoIndex && toIndex >= currentVideoIndex) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    } else if (fromIndex > currentVideoIndex && toIndex <= currentVideoIndex) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    }
  };

  const playVideo = (index: number) => {
    setCurrentVideoIndex(index);
    setIsPlaying(true);
  };

  const nextVideo = () => {
    if (currentVideoIndex < playlist.length - 1) {
      setCurrentVideoIndex(currentVideoIndex + 1);
    } else {
      setCurrentVideoIndex(0); // Loop back to first video
    }
  };

  const previousVideo = () => {
    if (currentVideoIndex > 0) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    } else {
      setCurrentVideoIndex(playlist.length - 1); // Loop to last video
    }
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
    // Note: This only updates UI state. Iframe videos cannot be controlled externally due to security restrictions.
  };

  // Browser functionality
  const addCurrentBrowserUrl = () => {
    if (browserUrl) {
      addVideo(browserUrl);
    }
  };

  const navigateBrowser = (url: string) => {
    // Add https:// prefix if no protocol is specified
    let formattedUrl = url.trim();
    if (formattedUrl && !formattedUrl.match(/^https?:\/\//)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    setBrowserUrl(formattedUrl);
  };

  const currentVideo = playlist[currentVideoIndex];

  // Export playlist functionality
  const exportPlaylistAsText = () => {
    const playlistText = playlist.map((video, index) => 
      `${index + 1}. ${video.title}\n   ${video.url}`
    ).join('\n\n');
    
    const blob = new Blob([playlistText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `playlist-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Playlist exported as text file");
  };

  const copyPlaylistToClipboard = async () => {
    const urls = playlist.map(video => video.url).join('\n');
    try {
      await navigator.clipboard.writeText(urls);
      toast.success("Playlist URLs copied to clipboard");
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  };

  // Import playlist functionality
  const importPlaylistFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const urls = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0 && (line.startsWith('http') || line.includes('.')))
        .map(line => {
          // Extract URL if line contains title format "1. Title\n   URL"
          const urlMatch = line.match(/https?:\/\/[^\s]+/) || line.match(/[^\s]+\.[a-z]{2,}/);
          return urlMatch ? urlMatch[0] : line;
        })
        .filter(url => url.length > 0);

      if (urls.length === 0) {
        toast.error("No valid URLs found in file");
        return;
      }

      const newVideos: VideoItem[] = urls.map((url, index) => ({
        id: (Date.now() + index).toString(),
        url,
        title: `Video ${playlist.length + index + 1}`
      }));

      setPlaylist(prev => [...prev, ...newVideos]);
      toast.success(`Imported ${urls.length} videos from file`);
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  // Listen for iframe messages to detect video end
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // YouTube iframe API messages
      if (event.origin === 'https://www.youtube.com' && event.data) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'video-progress' && data.info?.playerState === 0) {
            // Video ended (playerState 0 = ended)
            nextVideo();
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }
      
      // Vimeo iframe API messages
      if (event.origin === 'https://player.vimeo.com' && event.data) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'ended') {
            nextVideo();
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      // XPlayer iframe API messages
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'xplayer_event' && event.data.event === 'ended') {
          nextVideo();
        }
        // Also check for generic video end events
        if (event.data.event === 'video_ended' || event.data.type === 'video_ended') {
          nextVideo();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentVideoIndex, playlist.length]);

  // Update iframe src when video changes to enable proper event listening
  useEffect(() => {
    if (currentVideo && playerRef.current) {
      const embedUrl = getEmbedUrl(currentVideo.url);
      if (playerRef.current.src !== embedUrl) {
        playerRef.current.src = embedUrl;
      }
    }
  }, [currentVideoIndex, currentVideo]);

  return (
    <section className="container mx-auto py-8 space-y-8">
      {/* Video Player */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Video Player</h2>
        
        {currentVideo ? (
          <div className="space-y-4">
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              {/* Check if it's a direct video file */}
              {['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.m4v'].some(ext => 
                currentVideo.url.toLowerCase().includes(ext)
              ) ? (
                <video
                  controls
                  autoPlay
                  className="w-full h-full"
                  onEnded={nextVideo}
                >
                  <source src={currentVideo.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : (
                <iframe
                  ref={playerRef}
                  src={getEmbedUrl(currentVideo.url)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={currentVideo.title}
                />
              )}
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{currentVideo.title}</h3>
                <p className="text-sm text-muted-foreground">
                  Video {currentVideoIndex + 1} of {playlist.length}
                </p>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="outline" size="sm" onClick={previousVideo}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={togglePlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={nextVideo}>
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            <p className="text-muted-foreground">Add videos to your playlist to start watching</p>
          </div>
        )}
      </Card>

      {/* Add Videos */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Add Videos</h2>
        
        <div className="space-y-4">
          {/* Single URL Input */}
          <div className="flex space-x-2">
            <Input
              type="url"
              placeholder="Enter video URL (YouTube, Vimeo, direct .mp4, Instagram, TikTok...)"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addVideo(newUrl);
                  setNewUrl("");
                }
              }}
            />
            <Button onClick={() => { addVideo(newUrl); setNewUrl(""); }}>
              <Plus className="h-4 w-4 mr-2" />
              Add
            </Button>
          </div>

          {/* Bookmarklet Generator */}
          <div className="border rounded-lg p-4 bg-muted/50">
            <h3 className="font-semibold mb-2">Browser Bookmarklet</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Drag this link to your bookmarks bar to quickly add videos from any webpage:
            </p>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generateBookmarklet());
                  toast.success("Bookmarklet copied! Create a new bookmark and paste this as the URL.");
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Bookmarklet
              </Button>
              <a
                href={generateBookmarklet()}
                className="inline-flex items-center px-3 py-1 rounded-md bg-primary text-primary-foreground text-sm hover:bg-primary/90"
                draggable="true"
                onClick={(e) => e.preventDefault()}
              >
                Add to Playlist
              </a>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Note: Web Views are only available in mobile apps. In browsers, we're limited by X-Frame-Options security restrictions.
            </p>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Bulk Add (one URL per line)</label>
            <Textarea
              placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/...&#10;https://instagram.com/..."
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              rows={4}
            />
            <div className="flex space-x-2">
              <Button onClick={addBulkVideos} disabled={!bulkUrls.trim()}>
                Add All Videos
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".txt,.m3u,.m3u8"
                  onChange={importPlaylistFromFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="playlist-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="playlist-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Import File
                  </label>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Mini Browser */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Mini Browser</h2>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowBrowser(!showBrowser)}
          >
            {showBrowser ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showBrowser ? 'Hide Browser' : 'Show Browser'}
          </Button>
        </div>
        
        {showBrowser && (
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Enter website URL"
                value={browserUrl}
                onChange={(e) => setBrowserUrl(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    navigateBrowser(browserUrl);
                  }
                }}
              />
              <Button onClick={() => navigateBrowser(browserUrl)}>
                <Globe className="h-4 w-4 mr-2" />
                Go
              </Button>
              <Button variant="outline" onClick={addCurrentBrowserUrl}>
                <Plus className="h-4 w-4 mr-2" />
                Add to Playlist
              </Button>
            </div>
            
            <div className="aspect-video bg-muted rounded-lg overflow-hidden">
              <iframe
                ref={browserRef}
                src={browserUrl}
                className="w-full h-full"
                title="Mini Browser"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          </div>
        )}
        
        {!showBrowser && (
          <p className="text-muted-foreground text-center py-8">
            Click "Show Browser" to browse websites and add videos directly to your playlist.
          </p>
        )}
      </Card>

      {/* Playlist Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">Playlist ({playlist.length} videos)</h2>
          
          {playlist.length > 0 && (
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={copyPlaylistToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                Copy URLs
              </Button>
              <Button variant="outline" size="sm" onClick={exportPlaylistAsText}>
                <Download className="h-4 w-4 mr-2" />
                Export Playlist
              </Button>
            </div>
          )}
        </div>
        
        {playlist.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Your playlist is empty. Add some videos above to get started.
          </p>
        ) : (
          <div className="space-y-2">
            {playlist.map((video, index) => (
              <div
                key={video.id}
                className={`flex items-center space-x-3 p-3 rounded-lg border ${
                  index === currentVideoIndex ? 'bg-primary/10 border-primary' : 'bg-background'
                }`}
              >
                <div className="cursor-grab">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{video.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{video.url}</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => playVideo(index)}
                    disabled={index === currentVideoIndex}
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeVideo(video.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </section>
  );
}