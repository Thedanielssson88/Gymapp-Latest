import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, Loader2 } from 'lucide-react';
import { compressImage } from '../utils/image';

interface ImageUploadProps {
  onImageSaved: (base64: string) => void;
  currentImage?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSaved, currentImage }) => {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPreview(currentImage || null);
  }, [currentImage]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      
      const base64String = await compressImage(file);
      setPreview(base64String);
      onImageSaved(base64String);
      
    } catch (error) {
      alert("Kunde inte spara bilden.");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onImageSaved('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="w-full">
      <input 
        type="file" 
        ref={inputRef} 
        onChange={handleFile} 
        accept="image/*" 
        className="hidden" 
      />

      {preview ? (
        <div className="relative w-full h-48 rounded-2xl overflow-hidden border border-white/10 group bg-black/20">
          <img src={preview} className="w-full h-full object-contain" alt="Preview" />
          <button 
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-2 bg-black/50 rounded-full text-white hover:bg-red-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button 
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 text-text-dim hover:border-accent-blue hover:text-accent-blue transition-all active:scale-95"
        >
          {isUploading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            <>
              <Camera size={24} />
              <span className="text-[10px] font-black uppercase tracking-widest">Lägg till bild</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};