import { useEffect, useState } from 'react';
import { getAccount, loginAccount, logoutAccount, registerAccount } from './api.js';
import { syncAccountCollections } from './accountSync.js';
import './AccountPanel.css';

export default function AccountPanel({ onClose }) {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    getAccount().then(({ user: account }) => setUser(account)).catch(() => setError('Chưa kết nối được máy chủ tài khoản.')).finally(() => setBusy(false));
  }, []);

  async function syncCollections() {
    setNotice('Đang đồng bộ Sổ hoa và Cây của tôi…');
    await syncAccountCollections();
    setNotice('Đã đồng bộ dữ liệu với tài khoản này.');
  }

  async function submit(event) {
    event.preventDefault(); setError(''); setNotice(''); setBusy(true);
    try {
      const result = mode === 'register'
        ? await registerAccount({ email, display_name: name, password })
        : await loginAccount({ email, password });
      setUser(result.user); setPassword('');
      window.dispatchEvent(new CustomEvent('garden:account-session-changed', { detail: { user: result.user } }));
      setNotice('Đăng nhập thành công. Dữ liệu Sổ hoa và Cây của tôi đang được đồng bộ.');
    } catch (reason) { setError(reason.message || 'Không thể đăng nhập.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    setBusy(true); setError('');
    try { await logoutAccount(); setUser(null); window.dispatchEvent(new CustomEvent('garden:account-session-changed', { detail: { user: null } })); setNotice('Đã đăng xuất. Dữ liệu trên thiết bị vẫn được giữ.'); }
    catch (reason) { setError(reason.message || 'Không thể đăng xuất.'); }
    finally { setBusy(false); }
  }

  return <div className="account-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="account-dialog" role="dialog" aria-modal="true" aria-labelledby="account-title">
      <button className="account-close" type="button" onClick={onClose} aria-label="Đóng">×</button>
      <span className="eyebrow">VƯỜN HOA · TÀI KHOẢN</span>
      {busy && !user ? <p role="status">Đang kiểm tra phiên đăng nhập…</p> : user ? <>
        <h2 id="account-title">Chào {user.display_name}</h2>
        <p className="account-subtitle">{user.email}</p>
        <div className="account-sync-card"><b>Dữ liệu khu vườn</b><span>Sổ hoa và danh sách cây được lưu trong SQLite khi đăng nhập.</span></div>
        <button className="account-primary" type="button" disabled={busy} onClick={() => syncCollections().catch((reason) => setError(reason.message))}>{busy ? 'Đang đồng bộ…' : 'Đồng bộ dữ liệu'}</button>
        <button className="account-secondary" type="button" disabled={busy} onClick={logout}>Đăng xuất</button>
      </> : <>
        <h2 id="account-title">{mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}</h2>
        <p className="account-subtitle">Lưu Sổ hoa và cây bạn đang chăm trên CSDL của ứng dụng.</p>
        <div className="account-tabs"><button type="button" className={mode === 'login' ? 'selected' : ''} onClick={() => { setMode('login'); setError(''); }}>Đăng nhập</button><button type="button" className={mode === 'register' ? 'selected' : ''} onClick={() => { setMode('register'); setError(''); }}>Tạo tài khoản</button></div>
        <form onSubmit={submit} className="account-form">
          {mode === 'register' && <label>Tên hiển thị<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80}/></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254}/></label>
          <label>Mật khẩu<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === 'register' ? 8 : 1} maxLength={128}/>{mode === 'register' && <small>Tối thiểu 8 ký tự.</small>}</label>
          <button className="account-primary" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
        </form>
      </>}
      {error && <p className="account-message error" role="alert">{error}</p>}
      {notice && <p className="account-message" role="status">{notice}</p>}
      <small className="account-note">Không cần thanh toán. Mật khẩu được băm trước khi lưu. Trên Render Free, CSDL có thể bị xoá khi máy chủ khởi động lại.</small>
    </section>
  </div>;
}
