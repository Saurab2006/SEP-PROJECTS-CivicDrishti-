'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Camera, Loader2 } from 'lucide-react';

// A popup that opens the webcam, lets the user take a photo, and hands
// that photo back to whoever opened it (via onCapture).
export default function SelfieCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          setReady(true);
        }
      })
      .catch(() => setError('Could not access your camera. Please allow camera permission.'));

    // Stop the camera when the popup closes, so it's not left running.
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(dataUrl);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'white', borderRadius: 12, padding: 20, width: 420, maxWidth: '92vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontWeight: 800, fontSize: 16 }}>Take a live selfie</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X className="h-5 w-5" /></button>
        </div>

        {error ? (
          <p style={{ color: '#b91c1c', fontSize: 14 }}>{error}</p>
        ) : (
          <>
            <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#111' }}>
              {!ready && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}><Loader2 className="h-6 w-6 animate-spin" /></div>}
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', transform: 'scaleX(-1)' }} />
            </div>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <button
              type="button"
              onClick={capture}
              disabled={!ready}
              style={{ marginTop: 14, width: '100%', height: 44, borderRadius: 10, background: '#0f3d3e', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer' }}
            >
              <Camera className="h-4 w-4" /> Capture photo
            </button>
          </>
        )}
      </div>
    </div>
  );
}