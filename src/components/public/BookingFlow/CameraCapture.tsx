import React, { useRef, useState, useCallback, useEffect } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  defaultFacing?: 'user' | 'environment';
}

export function CameraCapture({ onCapture, onClose, defaultFacing = 'environment' }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(defaultFacing);

  const startCamera = useCallback(async () => {
    try {
      setCapturedImage(null);
      setError(null);
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setError('Camera access denied. Please allow camera permissions or use file upload instead.');
    }
  }, [facingMode]);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

  const capture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    setCapturedImage(canvas.toDataURL('image/jpeg', 0.85));
  };

  const confirm = () => {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        if (stream) stream.getTracks().forEach(track => track.stop());
        onCapture(file);
      }
    }, 'image/jpeg', 0.85);
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      <div className="flex items-center justify-between p-4">
        <button type="button" onClick={() => { if (stream) stream.getTracks().forEach(t => t.stop()); onClose(); }} className="text-white p-2">
          <X size={24} />
        </button>
        <span className="text-white text-xs font-bold uppercase tracking-widest">Take Photo</span>
        <button
          type="button"
          onClick={switchCamera}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 text-white text-xs font-bold"
        >
          <RotateCcw size={13} />
          {facingMode === 'user' ? 'Front' : 'Rear'}
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {error ? (
          <p className="text-white/60 text-sm text-center px-8">{error}</p>
        ) : capturedImage ? (
          <img src={capturedImage} alt="Captured" className="max-w-full max-h-full object-contain" />
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className="max-w-full max-h-full object-contain" />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="p-6 flex items-center justify-center gap-6">
        {capturedImage ? (
          <>
            <button type="button" onClick={() => { setCapturedImage(null); startCamera(); }} className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white">
              <RotateCcw size={24} />
            </button>
            <button type="button" onClick={confirm} className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-black">
              <Check size={28} />
            </button>
          </>
        ) : (
          <button type="button" onClick={capture} disabled={!!error} className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-30">
            <div className="w-12 h-12 rounded-full bg-white" />
          </button>
        )}
      </div>
    </div>
  );
}
