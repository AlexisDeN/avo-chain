// src/domain/entities/QRGeneratorSingleton.ts
import QRCode from "qrcode";

export class QRGeneratorSingleton {
  private static instance: QRGeneratorSingleton;

  private constructor() {}

  public static getInstance(): QRGeneratorSingleton {
    if (!QRGeneratorSingleton.instance) {
      QRGeneratorSingleton.instance = new QRGeneratorSingleton();
    }
    return QRGeneratorSingleton.instance;
  }

  async generarQRBase64(idLote: string): Promise<string> {
    // Generamos el QR asegurando un lienzo cuadrado de 256x256
    return QRCode.toDataURL(idLote, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
      color: {
        dark: "#000000",
        light: "#FFFFFF"
      }
    });
  }
}