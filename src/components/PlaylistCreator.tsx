import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  Trash2, 
  GripVertical, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Download, 
  Copy, 
  Upload, 
  Globe, 
  Plus, 
  Eye, 
  EyeOff,
  Save,
  FolderOpen,
  Search,
  Layout,
  PictureInPicture,
  X
} from "lucide-react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface VideoItem {
  id: string;
  url: string;
  title?: string;
  thumbnail?: string;
}

interface SavedPlaylist {
  id: string;
  name: string;
  videos: VideoItem[];
  created: string;
  modified: string;
}

// Sortable Video Item Component
function SortableVideoItem({ 
  video, 
  index, 
  currentVideoIndex, 
  onPlay, 
  onRemove 
}: {
  video: VideoItem;
  index: number;
  currentVideoIndex: number;
  onPlay: (index: number) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: video.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center space-x-2 p-2 rounded border text-sm ${
        index === currentVideoIndex ? 'bg-primary/10 border-primary' : 'bg-background hover:bg-muted/50'
      }`}
    >
      <div 
        className="cursor-grab active:cursor-grabbing flex-shrink-0"
        {...attributes} 
        {...listeners}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      
      {video.thumbnail && (
        <img 
          src={video.thumbnail} 
          alt={video.title} 
          className="w-12 h-8 object-cover rounded flex-shrink-0"
        />
      )}
      
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-xs">{video.title}</p>
        <p className="text-xs text-muted-foreground truncate">{new URL(video.url).hostname}</p>
      </div>
      
      <div className="flex items-center space-x-1 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPlay(index)}
          disabled={index === currentVideoIndex}
          className="h-6 w-6 p-0"
        >
          <Play className="h-3 w-3" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRemove(video.id)}
          className="h-6 w-6 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export default function PlaylistCreator() {
  const [playlist, setPlaylist] = useState<VideoItem[]>([]);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [bulkUrls, setBulkUrls] = useState("");
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserUrl, setBrowserUrl] = useState("https://www.example.com");
  
  // Layout and PiP settings
  const [layout, setLayout] = useState<'left' | 'right' | 'top' | 'compact'>('left');
  const [isPiPMode, setIsPiPMode] = useState(false);
  const [isVideoInView, setIsVideoInView] = useState(true);
  
  // YouTube Search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Playlist Management
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>([]);
  const [currentPlaylistName, setCurrentPlaylistName] = useState("");
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>("");
  
  const playerRef = useRef<HTMLIFrameElement>(null);
  const browserRef = useRef<HTMLIFrameElement>(null);
  const videoSectionRef = useRef<HTMLDivElement>(null);

  // Current video reference
  const currentVideo = playlist[currentVideoIndex];

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Load saved playlists from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('playlist-creator-playlists');
    if (saved) {
      try {
        setSavedPlaylists(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved playlists:', e);
      }
    }

    // Load current playlist from localStorage
    const currentPlaylist = localStorage.getItem('playlist-creator-current');
    if (currentPlaylist) {
      try {
        const parsed = JSON.parse(currentPlaylist);
        setPlaylist(parsed.videos || []);
        setCurrentPlaylistName(parsed.name || "");
      } catch (e) {
        console.error('Failed to load current playlist:', e);
      }
    }
  }, []);

  // Auto-save current playlist to localStorage
  useEffect(() => {
    const currentPlaylist = {
      name: currentPlaylistName,
      videos: playlist
    };
    localStorage.setItem('playlist-creator-current', JSON.stringify(currentPlaylist));
  }, [playlist, currentPlaylistName]);

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
      
      try {
        const windowId = 'playlist_' + Date.now();
        const videoData = {url: currentUrl, title: title, timestamp: Date.now(), windowId: windowId};
        
        localStorage.setItem('newVideoRequest', JSON.stringify(videoData));
        localStorage.removeItem('newVideoRequest');
        
        setTimeout(function() {
          const response = localStorage.getItem('windowResponse_' + windowId);
          if (!response) {
            window.open(appUrl + '?video=' + encodeURIComponent(currentUrl) + '&title=' + encodeURIComponent(title), '_blank');
          }
          localStorage.removeItem('windowResponse_' + windowId);
        }, 1000);
        
      } catch(e) {
        window.open(appUrl + '?video=' + encodeURIComponent(currentUrl) + '&title=' + encodeURIComponent(title), '_blank');
      }
    })();`;
    return bookmarkletCode;
  };

  // Multi-window coordination and bookmarklet handling
  useEffect(() => {
    const windowId = 'window_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Check for URL parameters (direct video add)
    const urlParams = new URLSearchParams(window.location.search);
    const videoUrl = urlParams.get('video');
    const videoTitle = urlParams.get('title');
    
    if (videoUrl) {
      resolveAndAdd(videoUrl, videoTitle || undefined);
      toast.success(`Added "${videoTitle || 'Video'}" from bookmarklet`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Listen for storage events from other windows/bookmarklet
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'newVideoRequest' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          localStorage.setItem('windowResponse_' + data.windowId, windowId);
          
          const shouldAdd = window.confirm(
            `Add "${data.title}" to this playlist?\n\nURL: ${data.url}`
          );
          
          if (shouldAdd) {
            resolveAndAdd(data.url, data.title);
            toast.success(`Added "${data.title}" from bookmarklet`);
            window.focus();
          }
        } catch (e) {
          console.error('Error handling video request:', e);
        }
      }
    };
    
    window.addEventListener('storage', handleStorageEvent);
    
    return () => {
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // YouTube Search  
  async function searchYouTube(query: string) {
    if (!query.trim()) return;
    
    setIsSearching(true);
    try {
      const { searchYouTube: searchYouTubeAPI } = await import('../lib/video-resolver');
      const result = await searchYouTubeAPI(query);
      
      if (result.ok && result.results) {
        setSearchResults(result.results);
      } else {
        toast.error(result.error || "Search failed");
        setSearchResults([]);
      }
    } catch (error) {
      toast.error("Search failed");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }

  // Resolve video metadata and add to playlist
  async function resolveAndAdd(url: string, overrideTitle?: string) {
    if (!url.trim()) return;

    try {
      const { resolveVideoUrl } = await import('../lib/video-resolver');
      const result = await resolveVideoUrl(url);

      if (!result.ok) {
        toast.error(result.error || "Could not resolve media");
        return;
      }

      const usableUrl = result.embed?.url || result.media?.[0] || url;

      const videoItem: VideoItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: usableUrl,
        title: overrideTitle || result.title || `Video ${playlist.length + 1}`,
        thumbnail: result.thumbnail || undefined,
      };

      setPlaylist(prev => [...prev, videoItem]);
      toast.success(`Added "${videoItem.title}" to playlist`);
    } catch (err: any) {
      // Fallback: add without metadata
      const videoItem: VideoItem = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        url: url,
        title: overrideTitle || `Video ${playlist.length + 1}`,
      };
      
      setPlaylist(prev => [...prev, videoItem]);
      toast.success(`Added "${videoItem.title}" to playlist`);
    }
  }

  const addVideo = (url: string) => {
    resolveAndAdd(url);
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

    // Process URLs one by one to get metadata
    urls.forEach((url, index) => {
      setTimeout(() => resolveAndAdd(url), index * 500); // Stagger requests
    });

    setBulkUrls("");
    toast.success(`Adding ${urls.length} videos to playlist...`);
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

  // Handle drag end for reordering
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setPlaylist((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over?.id);
        
        // Update current video index if needed
        if (oldIndex === currentVideoIndex) {
          setCurrentVideoIndex(newIndex);
        } else if (oldIndex < currentVideoIndex && newIndex >= currentVideoIndex) {
          setCurrentVideoIndex(currentVideoIndex - 1);
        } else if (oldIndex > currentVideoIndex && newIndex <= currentVideoIndex) {
          setCurrentVideoIndex(currentVideoIndex + 1);
        }
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

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

  // Picture-in-Picture functionality
  const togglePiP = useCallback(() => {
    setIsPiPMode(!isPiPMode);
  }, [isPiPMode]);

  // Clear playlist functionality
  const clearPlaylist = () => {
    setPlaylist([]);
    setCurrentVideoIndex(0);
    setCurrentPlaylistName("");
    toast.success("Playlist cleared");
  };

  // Scroll detection for auto PiP
  useEffect(() => {
    const handleScroll = () => {
      if (videoSectionRef.current) {
        const rect = videoSectionRef.current.getBoundingClientRect();
        const isMoreThanHalfwayOffScreen = rect.bottom < window.innerHeight / 2;
        setIsVideoInView(rect.top < window.innerHeight && rect.bottom > 0);
        
        if (isMoreThanHalfwayOffScreen && !isPiPMode && currentVideo) {
          setIsPiPMode(true);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isPiPMode, currentVideo]);

  // Playlist Management Functions
  const savePlaylist = () => {
    if (!currentPlaylistName.trim()) {
      toast.error("Please enter a playlist name");
      return;
    }

    const newPlaylist: SavedPlaylist = {
      id: Date.now().toString(),
      name: currentPlaylistName,
      videos: [...playlist],
      created: new Date().toISOString(),
      modified: new Date().toISOString()
    };

    const updatedPlaylists = [...savedPlaylists, newPlaylist];
    setSavedPlaylists(updatedPlaylists);
    localStorage.setItem('playlist-creator-playlists', JSON.stringify(updatedPlaylists));
    toast.success(`Playlist "${currentPlaylistName}" saved`);
  };

  const loadPlaylist = (playlistId: string) => {
    const playlist = savedPlaylists.find(p => p.id === playlistId);
    if (playlist) {
      setPlaylist(playlist.videos);
      setCurrentPlaylistName(playlist.name);
      setCurrentVideoIndex(0);
      toast.success(`Loaded playlist "${playlist.name}"`);
    }
  };

  const deletePlaylist = (playlistId: string) => {
    const updatedPlaylists = savedPlaylists.filter(p => p.id !== playlistId);
    setSavedPlaylists(updatedPlaylists);
    localStorage.setItem('playlist-creator-playlists', JSON.stringify(updatedPlaylists));
    toast.success("Playlist deleted");
  };

  // Export Functions
  const exportPlaylistAsText = () => {
    const playlistText = playlist.map((video, index) => 
      `${index + 1}. ${video.title}\n   ${video.url}`
    ).join('\n\n');
    
    downloadFile(playlistText, `playlist-${new Date().toISOString().split('T')[0]}.txt`, 'text/plain');
    toast.success("Playlist exported as text file");
  };

  const exportPlaylistAsJSON = () => {
    const playlistData = {
      name: currentPlaylistName || 'Untitled Playlist',
      created: new Date().toISOString(),
      videos: playlist
    };
    
    downloadFile(JSON.stringify(playlistData, null, 2), `playlist-${new Date().toISOString().split('T')[0]}.json`, 'application/json');
    toast.success("Playlist exported as JSON file");
  };

  const exportPlaylistAsM3U8 = () => {
    let m3u8Content = '#EXTM3U\n';
    playlist.forEach(video => {
      m3u8Content += `#EXTINF:-1,${video.title}\n${video.url}\n`;
    });
    
    downloadFile(m3u8Content, `playlist-${new Date().toISOString().split('T')[0]}.m3u8`, 'application/vnd.apple.mpegurl');
    toast.success("Playlist exported as M3U8 file");
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // Import playlist functionality - Fixed to parse URLs only
  const importPlaylistFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      
      try {
        // Try to parse as JSON first
        if (file.name.endsWith('.json')) {
          const jsonData = JSON.parse(content);
          if (jsonData.videos && Array.isArray(jsonData.videos)) {
            // Process each video to resolve metadata
            jsonData.videos.forEach((video: any, index: number) => {
              if (video.url) {
                setTimeout(() => resolveAndAdd(video.url, video.title), index * 200);
              }
            });
            if (jsonData.name) setCurrentPlaylistName(jsonData.name);
            toast.success(`Processing ${jsonData.videos.length} videos from JSON...`);
            return;
          }
        }
      } catch (e) {
        // Fall through to text parsing
      }

      // Parse as text/M3U8 - Extract URLs only and resolve metadata
      const lines = content.split('\n').map(line => line.trim());
      const urls = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.startsWith('#EXTINF:')) {
          // M3U8 format - get URL from next line
          const url = lines[i + 1];
          if (url && !url.startsWith('#') && isValidUrl(url)) {
            urls.push(url);
            i++; // Skip next line as it's the URL
          }
        } else if (isValidUrl(line)) {
          // Plain URL or mixed content - extract URLs only
          urls.push(line);
        } else if (line.includes('http')) {
          // Extract URLs from lines that contain them
          const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
          if (urlMatch) {
            urls.push(urlMatch[1]);
          }
        }
      }

      if (urls.length === 0) {
        toast.error("No valid URLs found in file");
        return;
      }

      // Process URLs one by one to get proper metadata
      urls.forEach((url, index) => {
        setTimeout(() => resolveAndAdd(url), index * 200);
      });
      
      toast.success(`Processing ${urls.length} videos from file...`);
    };

    reader.readAsText(file);
    event.target.value = ''; // Reset file input
  };

  // Helper function to validate URLs
  const isValidUrl = (string: string) => {
    try {
      new URL(string.startsWith('http') ? string : `https://${string}`);
      return string.includes('.') || string.includes('http');
    } catch (_) {
      return false;
    }
  };

  // Browser functionality
  const addCurrentBrowserUrl = () => {
    if (browserUrl) {
      resolveAndAdd(browserUrl);
    }
  };

  const navigateBrowser = (url: string) => {
    let formattedUrl = url.trim();
    if (formattedUrl && !formattedUrl.match(/^https?:\/\//)) {
      formattedUrl = `https://${formattedUrl}`;
    }
    setBrowserUrl(formattedUrl);
  };

  // Listen for iframe messages to detect video end
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // YouTube iframe API messages
      if (event.origin === 'https://www.youtube.com' && event.data) {
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'video-progress' && data.info?.playerState === 0) {
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

      // Generic video end events
      if (event.data && typeof event.data === 'object') {
        if (event.data.type === 'xplayer_event' && event.data.event === 'ended') {
          nextVideo();
        }
        if (event.data.event === 'video_ended' || event.data.type === 'video_ended') {
          nextVideo();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [currentVideoIndex, playlist.length]);

  // Update iframe src when video changes
  useEffect(() => {
    if (currentVideo && playerRef.current) {
      const embedUrl = getEmbedUrl(currentVideo.url);
      if (playerRef.current.src !== embedUrl) {
        playerRef.current.src = embedUrl;
      }
    }
  }, [currentVideoIndex, currentVideo]);

  const getLayoutClasses = () => {
    switch (layout) {
      case 'right':
        return 'flex-row-reverse';
      case 'top':
        return 'flex-col';
      case 'compact':
        return 'flex-col lg:flex-row';
      default: // 'left'
        return 'flex-row';
    }
  };

  return (
    <div className="relative">
      {/* Bookmarklet - Top Corner */}
      <div className="fixed top-4 right-4 z-50">
        <Card className="p-3 bg-background/95 backdrop-blur-sm border-2">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(generateBookmarklet());
                toast.success("Bookmarklet copied! Create a new bookmark and paste this as the URL.");
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Bookmarklet
            </Button>
            <a
              href={generateBookmarklet()}
              className="inline-flex items-center px-2 py-1 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90"
              draggable="true"
              onClick={(e) => e.preventDefault()}
            >
              Add to Playlist
            </a>
          </div>
        </Card>
      </div>

      {/* Picture-in-Picture Video */}
      {isPiPMode && currentVideo && (
        <div className="fixed bottom-4 right-4 z-40 w-80 bg-background border-2 rounded-lg shadow-2xl">
          <div className="flex items-center justify-between p-2 border-b">
            <span className="text-sm font-medium truncate">{currentVideo.title}</span>
            <Button variant="ghost" size="sm" onClick={() => setIsPiPMode(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="aspect-video">
            <iframe
              src={getEmbedUrl(currentVideo.url)}
              className="w-full h-full"
              title={currentVideo.title}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="flex items-center justify-center space-x-2 p-2">
            <Button variant="outline" size="sm" onClick={previousVideo}>
              <SkipBack className="h-3 w-3" />
            </Button>
            <Button variant="outline" size="sm" onClick={togglePlayPause}>
              {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            </Button>
            <Button variant="outline" size="sm" onClick={nextVideo}>
              <SkipForward className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      <section className="container mx-auto py-8 space-y-8">
        {/* Layout Controls */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Video Playlist Creator</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Layout className="h-4 w-4" />
                <Select value={layout} onValueChange={(value: any) => setLayout(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Video Left</SelectItem>
                    <SelectItem value="right">Video Right</SelectItem>
                    <SelectItem value="top">Video Top</SelectItem>
                    <SelectItem value="compact">Compact</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="sm" onClick={togglePiP}>
                <PictureInPicture className="h-4 w-4 mr-2" />
                {isPiPMode ? 'Exit PiP' : 'Picture-in-Picture'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Main Content Area */}
        <div className={`flex gap-8 ${getLayoutClasses()} ${layout === 'top' ? '' : 'items-start'}`}>
          {/* Video Player Section */}
          <div 
            ref={videoSectionRef}
            className={`${layout === 'top' ? 'w-full' : layout === 'compact' ? 'w-full lg:w-[60%]' : 'w-[60%]'} ${isPiPMode ? 'opacity-30' : ''}`}
          >
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Video Player</h2>
              
              {currentVideo ? (
                <div className="space-y-4">
                  <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                    <iframe
                      ref={playerRef}
                      src={getEmbedUrl(currentVideo.url)}
                      className="w-full h-full"
                      title={currentVideo.title}
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{currentVideo.title}</h3>
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
          </div>

          {/* Sidebar - Playlist Management */}
          <div className={`${layout === 'top' ? 'w-full' : layout === 'compact' ? 'w-full lg:w-[40%]' : 'w-[40%]'} space-y-6`}>
            {/* Playlist Management */}
            <Card className="p-4">
              <h3 className="text-lg font-bold mb-3">Playlist Management</h3>
              
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <Input
                    placeholder="Enter playlist name"
                    value={currentPlaylistName}
                    onChange={(e) => setCurrentPlaylistName(e.target.value)}
                    className="text-sm"
                  />
                  <Button size="sm" onClick={savePlaylist} disabled={!currentPlaylistName.trim() || playlist.length === 0}>
                    <Save className="h-3 w-3 mr-1" />
                    Save
                  </Button>
                </div>
                
                {savedPlaylists.length > 0 && (
                  <div className="flex space-x-2">
                    <Select value={selectedPlaylistId} onValueChange={setSelectedPlaylistId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Select saved playlist" />
                      </SelectTrigger>
                      <SelectContent>
                        {savedPlaylists.map(playlist => (
                          <SelectItem key={playlist.id} value={playlist.id}>
                            {playlist.name} ({playlist.videos.length})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => loadPlaylist(selectedPlaylistId)} disabled={!selectedPlaylistId}>
                      <FolderOpen className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => deletePlaylist(selectedPlaylistId)} disabled={!selectedPlaylistId}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>

            {/* Add Single Video */}
            <Card className="p-4">
              <h3 className="text-lg font-bold mb-3">Add Single Video</h3>
              <div className="flex space-x-2">
                <Input
                  type="url"
                  placeholder="Enter video URL..."
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      resolveAndAdd(newUrl);
                      setNewUrl("");
                    }
                  }}
                  className="text-sm"
                />
                <Button size="sm" onClick={() => { resolveAndAdd(newUrl); setNewUrl(""); }}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </Card>

            {/* Current Playlist */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold">Current Playlist ({playlist.length})</h3>
                
                <div className="flex items-center space-x-1">
                  {playlist.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={clearPlaylist}>
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear
                      </Button>
                      <Button variant="outline" size="sm" onClick={copyPlaylistToClipboard}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportPlaylistAsJSON}>
                        <Download className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              
              {playlist.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  Your playlist is empty. Add some videos to get started.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-1">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                      items={playlist.map(video => video.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {playlist.map((video, index) => (
                        <SortableVideoItem
                          key={video.id}
                          video={video}
                          index={index}
                          currentVideoIndex={currentVideoIndex}
                          onPlay={playVideo}
                          onRemove={removeVideo}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              )}

              {/* Export Options */}
              {playlist.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <div className="flex flex-wrap gap-1">
                    <Button variant="outline" size="sm" onClick={exportPlaylistAsText}>
                      TXT
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPlaylistAsJSON}>
                      JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportPlaylistAsM3U8}>
                      M3U8
                    </Button>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".txt,.json,.m3u,.m3u8"
                        onChange={importPlaylistFromFile}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        id="playlist-import"
                      />
                      <Button variant="outline" size="sm" asChild>
                        <label htmlFor="playlist-import" className="cursor-pointer">
                          <Upload className="h-3 w-3 mr-1" />
                          Import
                        </label>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Bulk Add Videos */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Bulk Add Videos</h2>
          <div className="space-y-4">
            <Textarea
              placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/...&#10;https://instagram.com/..."
              value={bulkUrls}
              onChange={(e) => setBulkUrls(e.target.value)}
              rows={4}
            />
            <div className="flex space-x-2">
              <Button onClick={addBulkVideos} disabled={!bulkUrls.trim()}>
                <Plus className="h-4 w-4 mr-2" />
                Add All Videos
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".txt,.json,.m3u,.m3u8"
                  onChange={importPlaylistFromFile}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  id="bulk-upload"
                />
                <Button variant="outline" asChild>
                  <label htmlFor="bulk-upload" className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Import File
                  </label>
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* YouTube Search */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">Search YouTube</h2>
          <div className="space-y-4">
            <div className="flex space-x-2">
              <Input
                placeholder="Search YouTube videos..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter") searchYouTube(searchQuery);
                }}
              />
              <Button onClick={() => searchYouTube(searchQuery)} disabled={isSearching}>
                <Search className="h-4 w-4 mr-2" />
                {isSearching ? "Searching..." : "Search"}
              </Button>
            </div>
            
            {searchResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((result) => (
                  <div key={result.id} className="border rounded-lg p-3 space-y-2">
                    <img 
                      src={result.thumbnail} 
                      alt={result.title} 
                      className="w-full aspect-video object-cover rounded"
                    />
                    <h4 className="font-medium text-sm line-clamp-2">{result.title}</h4>
                    <Button
                      size="sm"
                      onClick={() => resolveAndAdd(result.url, result.title)}
                      className="w-full"
                    >
                      Add to Playlist
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Mini Browser */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Mini Browser</h2>
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
                  sandbox="allow-scripts allow-popups allow-forms"
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
      </section>
    </div>
  );
}