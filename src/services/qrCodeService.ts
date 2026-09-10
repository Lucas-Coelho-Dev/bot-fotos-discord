import QRCode from 'qrcode';

export async function generateQrCodeBuffer(url: string): Promise<Buffer> {
  return await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    width: 400,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}
