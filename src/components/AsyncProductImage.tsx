import React, { useState, useEffect } from 'react';
import { ClothItem } from '../types';
import { getListImage } from '../utils/imageUtils';
import { imageStore } from '../utils/imageStore';
import { thumbStore } from '../utils/thumbStore';
import { Loader2 } from 'lucide-react';

interface AsyncProductImageProps {
  item: ClothItem;
  alt?: string;
  className?: string;
  imageDisplayMode?: 'fill' | 'cover' | 'contain';
  mode?: 'thumb' | 'full';
}

export const AsyncProductImage: React.FC<AsyncProductImageProps> = ({
  item,
  alt = '',
  className = '',
  imageDisplayMode = 'contain',
  mode = 'full'
}) => {
  const fallbackThumb = getListImage(item);
  const [thumbSrc, setThumbSrc] = useState<string | null>(() => {
    return thumbStore.getThumbSync(item.id) || fallbackThumb || item.imageUrl || null;
  });
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState<boolean>(false);

  // Load thumbnail if not already present
  useEffect(() => {
    let isMounted = true;
    const syncVal = thumbStore.getThumbSync(item.id);
    if (syncVal) {
      setThumbSrc(syncVal);
    } else if (item.id) {
      thumbStore.getThumb(item.id, fallbackThumb).then(res => {
        if (isMounted && res) {
          setThumbSrc(res);
        }
      });
    } else {
      setThumbSrc(fallbackThumb || item.imageUrl || null);
    }
    return () => {
      isMounted = false;
    };
  }, [item.id, item.thumbUrl, item.imageUrl, item.updatedAt]);

  // Load full image if mode === 'full'
  useEffect(() => {
    let isMounted = true;

    if (mode === 'full' && item.hasFullImage && item.id) {
      setIsLoadingFull(true);
      imageStore.loadFull(item.id).then(loaded => {
        if (isMounted) {
          if (loaded) {
            setFullSrc(loaded);
          }
          setIsLoadingFull(false);
        }
      }).catch(() => {
        if (isMounted) setIsLoadingFull(false);
      });
    } else {
      setFullSrc(null);
      setIsLoadingFull(false);
    }

    return () => {
      isMounted = false;
    };
  }, [item.id, item.hasFullImage, item.updatedAt, mode]);

  const activeSrc = mode === 'thumb' 
    ? (thumbSrc || fallbackThumb || item.imageUrl) 
    : (fullSrc || thumbSrc || item.imageUrl || fallbackThumb);
  const fitClass = imageDisplayMode === 'fill' ? 'object-fill' : imageDisplayMode === 'cover' ? 'object-cover' : 'object-contain';

  return (
    <div className={`relative overflow-hidden flex items-center justify-center ${className}`}>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={alt || item.name}
          decoding="async"
          className={`w-full h-full ${fitClass} transition-opacity duration-200`}
        />
      ) : null}

      {mode === 'full' && isLoadingFull && (
        <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-xs">
          <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
          <span>جاري تحميل الجودة العالية...</span>
        </div>
      )}
    </div>
  );
};
