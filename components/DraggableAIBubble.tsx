import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Check } from 'lucide-react';

interface DraggableAIBubbleProps {
  isGenerating: boolean;
  onComplete: () => void;
}

export const DraggableAIBubble: React.FC<DraggableAIBubbleProps> = ({ isGenerating, onComplete }) => {
  const [position, setPosition] = useState({ x: window.innerWidth - 100, y: window.innerHeight - 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const bubbleRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  return (
    <div
      ref={bubbleRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        e.stopPropagation();
        if (!isDragging && !isGenerating) {
          onComplete();
        }
      }}
      className={`fixed z-[999] ${isDragging ? 'cursor-grabbing' : isGenerating ? 'cursor-default' : 'cursor-pointer'} ${!isGenerating && 'animate-bounce'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none'
      }}
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
        isGenerating
          ? 'bg-gradient-to-br from-accent-blue to-purple-600 animate-pulse'
          : 'bg-gradient-to-br from-green-500 to-emerald-600'
      }`}>
        {isGenerating ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : (
          <Check className="w-8 h-8 text-white" strokeWidth={3} />
        )}
      </div>

      {/* Pulsringar när den genererar */}
      {isGenerating && (
        <>
          <div className="absolute inset-0 rounded-full bg-accent-blue opacity-20 animate-ping" />
          <div className="absolute inset-0 rounded-full bg-purple-600 opacity-20 animate-ping" style={{ animationDelay: '0.5s' }} />
        </>
      )}
    </div>
  );
};
