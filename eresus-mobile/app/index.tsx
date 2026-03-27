import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, Platform, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import { useAssets } from 'expo-asset';

export default function App() {
  // To serve a full SPA locally in Expo efficiently without Ejected Android folder structures,
  // we can use a trick: require the HTML using useAssets or just using the local URI.
  // Wait, the best way in Expo is to use the Expo Asset bundle if we configure it, or require.
  // Let's use the local file system technique or just use the local Expo dev server for development.
  // Actually, require('./assets/www/index.html') works if metro bundler is configured to accept .html/.css.
  // But wait, since we haven't configured metro to bundle css/js chunks directly, 
  // they won't be resolved properly inside the WebView unless we serve them.

  return (
    <SafeAreaView style={styles.container}>
      <WebView 
        source={require('../assets/www/index.html')}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        onShouldStartLoadWithRequest={(request: any) => {
          if (request.url.startsWith('http')) {
            Linking.openURL(request.url);
            return false;
          }
          return true;
        }}
        style={styles.webview}
        bounces={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  }
});
