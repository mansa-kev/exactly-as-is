import React from 'react';
import { toProxyUrl } from '../../utils/assetUrl';

export function PdfViewer({ url, className = '', style = {} }: { url: string, className?: string, style?: React.CSSProperties }) {
  if (!url) {
    return (
      <div className={`flex flex-col items-center justify-center bg-muted/10 ${className}`} style={style}>
        <p className="text-sm font-bold text-foreground">No document URL provided</p>
      </div>
    );
  }

  // Hides the Supabase URL completely and bypasses frame-src CSP blocks
  const proxiedUrl = toProxyUrl(url) || url;

  return (
    <iframe
      src={proxiedUrl}
      className={className}
      style={style}
      title="Document Preview"
    />
  );
}
