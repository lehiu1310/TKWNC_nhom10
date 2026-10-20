import qrcode from 'qrcode-generator';

export function createQrSvg(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2_800) throw new Error('Liên kết không hợp lệ hoặc quá dài để tạo mã QR.');
  const code = qrcode(0, 'M');
  code.addData(value);
  code.make();
  return code.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
}
