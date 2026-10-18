import { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

class RootErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Lỗi khiến giao diện không thể hiển thị:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#fff8f0', color: '#2f4a2f', fontFamily: 'Nunito, sans-serif' }}>
      <section style={{ width: 'min(560px, 100%)', padding: 28, border: '1px solid #eadfce', borderRadius: 24, background: '#fffdfa', boxShadow: '0 16px 44px #354b3218' }}>
        <p style={{ margin: '0 0 8px', color: '#ff6f91', fontWeight: 900, letterSpacing: '.12em', fontSize: 11 }}>VƯỜN HOA · KHÔI PHỤC GIAO DIỆN</p>
        <h1 style={{ margin: '0 0 10px', font: '600 30px/1.15 Fraunces, Georgia, serif' }}>Trang gặp trục trặc</h1>
        <p style={{ margin: '0 0 18px', lineHeight: 1.65 }}>Một phần giao diện không tải được. Tải lại trang để thử khởi động lại.</p>
        {import.meta.env.DEV && <pre style={{ maxHeight: 180, overflow: 'auto', padding: 12, borderRadius: 12, background: '#fff1ee', color: '#8c4036', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{String(this.state.error?.stack || this.state.error)}</pre>}
        <button type="button" onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 999, padding: '12px 18px', background: '#2f4a2f', color: 'white', fontWeight: 800, cursor: 'pointer' }}>Tải lại trang</button>
      </section>
    </main>;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootErrorBoundary><App /></RootErrorBoundary>
  </StrictMode>,
);
