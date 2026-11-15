import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { VOIP_BRIDGE_BASE_URL, voipBridgeHtml } from '../../services/voipBridgeHtml';
import { BridgeCommand, webVoipService } from '../../services/webVoipService';

/** The parts of the WebView instance this bridge uses. */
interface BridgeHandle {
  injectJavaScript(script: string): void;
  reload(): void;
}

// react-native-webview declares `WebView<P = undefined>` with props
// `WebViewProps & P`, which TypeScript 6 reduces to `never`. Re-type it.
const BridgeWebView = WebView as unknown as React.ComponentType<
  WebViewProps & React.RefAttributes<BridgeHandle>
>;

/**
 * Invisible WebView hosting the Telnyx browser SDK, so business-line calls
 * work inside Expo Go (which has no native WebRTC). Mounted once in the root
 * layout while signed in; webVoipService talks to it.
 */
export function VoipWebBridge() {
  const ref = useRef<BridgeHandle>(null);

  const send = useCallback((command: BridgeCommand) => {
    ref.current?.injectJavaScript(
      `window.__callpilot && window.__callpilot(${JSON.stringify(command)}); true;`,
    );
  }, []);

  useEffect(() => {
    webVoipService.attachBridge(send);
    return () => webVoipService.attachBridge(null);
  }, [send]);

  const onMessage = useCallback((event: WebViewMessageEvent) => {
    webVoipService.handleBridgeMessage(event.nativeEvent.data);
  }, []);

  return (
    <View pointerEvents="none" style={styles.host}>
      <BridgeWebView
        ref={ref}
        source={{ html: voipBridgeHtml, baseUrl: VOIP_BRIDGE_BASE_URL }}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        // Audio-only WebRTC: mic capture + inline, auto-playing remote audio.
        mediaCapturePermissionGrantType="grant"
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // If the OS kills the web process, reload; the page re-registers.
        onContentProcessDidTerminate={() => ref.current?.reload()}
        onRenderProcessGone={() => {
          ref.current?.reload();
          return true;
        }}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Kept on-screen at 1px (not display:none) so the OS keeps it running.
  host: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  webview: {
    width: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
});
