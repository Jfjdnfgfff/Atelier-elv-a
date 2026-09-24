import React, { useState, useEffect } from 'react';
import { ClothItem } from '../types';
import { getListImage } from '../utils/imageUtils';
import { imageStore } from '../utils/imageStore';
import { Loader2 } from 'lucide-react';

interface AsyncProductImageProps {
  item: ClothItem;
  alt?: string;
  className?: string;
  imageDisplayMode?: 'fill' | 'cover' | 'contain';
}

export const AsyncProductImage: React.FC<AsyncProductImageProps> = ({
  item,
  alt = '',
  className = '',
  imageDisplayMode = 'contain'
}) => {
  const thumb = getListImage(item);
  const [fullSrc, setFullSrc] = useState<string | null>(null);
  const [isLoadingFull, setIsLoadingFull] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;

    if (item.hasFullImage && item.id) {
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
  }, [item.id, item.hasFullImage, item.updatedAt]);

  const activeSrc = fullSrc || item.imageUrl || thumb;
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

      {isLoadingFull && (
        <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-xs">
          <Loader2 className="w-3 h-3 animate-spin text-amber-300" />
          <span>جاري تحميل الجودة العالية...</span>
        </div>
      )}
    </div>
  );
};
