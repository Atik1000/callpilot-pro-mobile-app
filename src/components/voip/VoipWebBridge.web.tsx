import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { voipBridgeHtml } from '../../services/voipBridgeHtml';
import { BridgeCommand, webVoipService } from '../../services/webVoipService';

/** Tag on window messages so unrelated postMessage traffic is ignored. */
const MESSAGE_TAG = '__callpilotVoip';

/**
 * Web counterpart of the WebView bridge: runs the same Telnyx browser-SDK page
 * in a hidden same-origin iframe (srcdoc), so calls work in the browser build.
 * The page talks through `window.ReactNativeWebView.postMessage`, which is
 * shimmed here to forward to the parent window.
 */
export function VoipWebBridge() {
  const ref = useRef<HTMLIFrameElement | null>(null);

  const srcDoc = useMemo(() => {
    const shim = `<script>window.ReactNativeWebView={postMessage:function(m){parent.postMessage({${MESSAGE_TAG}:true,data:m},'*');}};</script>`;
    return voipBridgeHtml.replace('<head>', `<head>${shim}`);
  }, []);

  const send = useCallback((command: BridgeCommand) => {
    const win = ref.current?.contentWindow as (Window & { __callpilot?: (c: BridgeCommand) => void }) | null;
    win?.__callpilot?.(command);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== ref.current?.contentWindow) return;
      const payload = event.data as { [MESSAGE_TAG]?: boolean; data?: string } | null;
      if (payload?.[MESSAGE_TAG] && typeof payload.data === 'string') {
        webVoipService.handleBridgeMessage(payload.data);
      }
    };
    window.addEventListener('message', onMessage);
    webVoipService.attachBridge(send);
    return () => {
      window.removeEventListener('message', onMessage);
      webVoipService.attachBridge(null);
    };
  }, [send]);

  return React.createElement('iframe', {
    ref,
    title: 'CallPilot phone',
    srcDoc,
    // Microphone for calls, autoplay for the remote audio element.
    allow: 'microphone; autoplay',
    'aria-hidden': true,
    tabIndex: -1,
    style: {
      position: 'absolute',
      left: 0,
      bottom: 0,
      width: 1,
      height: 1,
      opacity: 0,
      border: 0,
      pointerEvents: 'none',
    },
  });
}
