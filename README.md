# AURA

A high-end web dashboard for real-time music visualization. It connects to Last.fm and Lanyard to display your current listening status with advanced aesthetics.

---

## Core Features

### Real-Time Monitoring
- **Data Sources**: Integrated with **Lanyard** (Discord Presence) and **Last.fm API**.
- **Dynamic Updates**: Tracks progress, pauses, and song changes with millisecond precision.
- **Bilingual**: Full support for English and French via `i18n.js`.

### Visual Engine
- **Glassmorphism UI**: Modern interface with customizable blurs, saturation, and brightness.
- **Adaptive Themes**: Colors automatically sync with the current album art.
- **Visualizers**: Multiple modes including "Apple Music" style animated gradients and fluid flows.
- **Typography**: Support for multiple font presets (Instrument Sans, Bebas Neue, etc.).

### Remote Control (P2P)
- **Direct Link**: Control your "TV" or "Desktop" display from a mobile device.
- **Technology**: Uses **PeerJS (WebRTC)** for direct peer-to-peer communication.
- **Zero-Server**: No backend required; handles data synchronization locally or via P2P.

---

## Technical Stack

- **Framework**: Vanilla JavaScript (ES6+).
- **Styling**: CSS3 with advanced variables and `color-mix` for dynamic theming.
- **Animations**: GSAP for UI transitions and custom hardware-accelerated CSS animations.
- **Networking**: PeerJS for WebRTC signaling.
- **Analytics**: Integrated with Umami.

---

## Configuration

The application state is managed via `aura_config.json`, allowing deep customization of:
- Background modes (Album art, gradients, or solid).
- Visualizer FPS and intensity.
- Layout alignment (Standard, focused, or minimal).
- Lyrics auto-scroll and timing offsets.
