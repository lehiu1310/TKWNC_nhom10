import { useState } from 'react';
import { giftCardShareUrl } from './giftShare.js';

export default function GiftQrPanel({ payload }) {
  const [qr, setQr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function createQr() {
    if (busy) return;
    setBusy(true);
    setStatus('');
    setError('');
    try {
      const url = giftCardShareUrl(payload);
      const { createQrSvg } = await import('./qrCode.js');
      const svg = createQrSvg(url);
      setQr({ url, svg, image: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` });
    } catch (failure) {
      setError(failure?.message || 'Chưa tạo được mã QR. Hãy rút ngắn lời nhắn rồi thử lại.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!qr) return;
    try {
      await navigator.clipboard.writeText(qr.url);
      setStatus('Đã chép liên kết thiệp.');
    } catch {
      setStatus('Hãy chọn và sao chép liên kết trong ô bên dưới.');
    }
  }

  function downloadQr() {
    if (!qr) return;
    const url = URL.createObjectURL(new Blob([qr.svg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ma-qr-thiep-hoa.svg';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="gift-qr-panel"><button type="button" className="gift-qr-trigger" onClick={qr ? () => setQr(null) : createQr} disabled={busy}>{busy ? 'Đang tạo mã…' : qr ? 'Ẩn mã QR' : 'Tạo thiệp QR ↗'}</button>{error && <p className="gift-share-error" role="alert">{error}</p>}{qr && <div className="gift-qr-content"><img src={qr.image} alt="Mã QR mở thiệp hoa và lời nhắn"/><div><b>Quét để mở thiệp</b><p>Thiệp lưu lời nhắn trong mã QR; không tải nội dung lên dịch vụ tạo QR.</p><a href={qr.url} target="_blank" rel="noreferrer">Xem thử trang thiệp ↗</a><label>Liên kết thiệp<input readOnly value={qr.url} aria-label="Liên kết chia sẻ thiệp" onFocus={(event) => event.target.select()}/></label><div className="gift-qr-actions"><button type="button" className="button" onClick={copyLink}>Chép liên kết</button><button type="button" className="button" onClick={downloadQr}>Tải mã SVG</button></div>{status && <small role="status">{status}</small>}</div></div>}</div>;
}
