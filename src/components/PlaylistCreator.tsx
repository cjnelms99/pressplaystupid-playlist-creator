import React, { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2, GripVertical, Play, Pause, SkipForward, SkipBack, Download, Copy } from "lucide-react";

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
  const playerRef = useRef<HTMLIFrameElement>(null);

  // Extract video ID and create embed URL based on platform
  const getEmbedUrl = (url: string): string => {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    const hostname = urlObj.hostname.toLowerCase();

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

    // Default: try to embed directly
    return url;
  };

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
              <iframe
                ref={playerRef}
                src={getEmbedUrl(currentVideo.url)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={currentVideo.title}
              />
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
          <div className="flex space-x-2">
            <Input
              placeholder="Enter video URL (YouTube, Vimeo, Instagram, TikTok, etc.)"
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
              Add Video
            </Button>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Bulk Add (one URL per line)</label>
            <Textarea
              placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/...&#10;https://instagram.com/..."
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              rows={4}
            />
            <Button onClick={addBulkVideos} disabled={!bulkUrls.trim()}>
              Add All Videos
            </Button>
          </div>
        </div>
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