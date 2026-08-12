import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LandingImage { url: string; alt?: string }
export interface LandingVideo { url: string; title?: string }
export interface LandingMedia {
  images: LandingImage[];
  videos: LandingVideo[];
}

export const LANDING_MEDIA_KEY = 'landing_media';

export function toEmbedUrl(raw: string): string {
  const url = (raw || '').trim();
  if (!url) return '';
  // YouTube
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Facebook (reel, video, plugin already formed)
  if (url.includes('facebook.com/plugins/video.php')) return url;
  if (url.includes('facebook.com')) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false&width=300&height=265`;
  }
  return url;
}

export function useLandingMedia() {
  return useQuery({
    queryKey: ['landing-media'],
    queryFn: async (): Promise<LandingMedia> => {
      const { data, error } = await supabase
        .from('parametres')
        .select('valeur')
        .eq('cle', LANDING_MEDIA_KEY)
        .maybeSingle();
      if (error) throw error;
      const val = (data?.valeur || {}) as any;
      return {
        images: Array.isArray(val.images) ? val.images : [],
        videos: Array.isArray(val.videos) ? val.videos : [],
      };
    },
  });
}
