import { Helmet } from "react-helmet-async";
import PlaylistCreator from "@/components/PlaylistCreator";
const Index = () => {
  return <main className="min-h-screen bg-gradient-to-b from-primary/5 via-accent/10 to-background">
      <Helmet>
        <title>Video Playlist Creator | Play Multiple Videos Sequentially</title>
        <meta name="description" content="Create and manage video playlists from YouTube, Vimeo, Instagram, TikTok and other platforms. Auto-play videos sequentially with playlist management." />
        <link rel="canonical" href={window.location.origin + "/"} />
      </Helmet>

      <header className="container mx-auto py-14 text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          <span>Video Playlist Creator</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto text-xl">Create playlists from video URLs and watch them sequentially. Supports YouTube, Vimeo, Instagram, TikTok, and much more.

Tip: For xhamster.com, replace /videos/ in the URL with /embed/.
Then, remove the title at the end of the url, except for the last identifier characters of the video.

Example: "https://xhamster.com/videos/this-is-an-example-title-k2Tgh7e" should become "https://xhamster.com/embed/k2Tgh7e"
      </p>
      </header>

      <PlaylistCreator />

      <section aria-label="Supported platforms" className="container mx-auto mt-10 pb-10">
        <div className="rounded-lg border border-border bg-card/60 p-4 text-sm text-muted-foreground">
          <p className="mb-2">
            Supports videos from YouTube, Vimeo, Instagram, TikTok, and other embeddable video platforms.
          </p>
          <p className="text-xs">
            Built with React, TypeScript, Tailwind CSS, and shadcn/ui components for a modern, responsive experience.
          </p>
        </div>
      </section>
    </main>;
};
export default Index;