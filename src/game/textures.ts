import * as THREE from 'three';

export interface ProceduralTextureSet {
  roadTexture: THREE.CanvasTexture;
  crosswalkTexture: THREE.CanvasTexture;
  grassTexture: THREE.CanvasTexture;
  sidewalkTexture: THREE.CanvasTexture;
  contactShadowTexture: THREE.CanvasTexture;
  dispose: () => void;
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(
  maxAnisotropy: number,
): ProceduralTextureSet {
  // 1. Crisp, high-contrast neighborhood asphalt road texture
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 512;
  roadCanvas.height = 512;
  const rCtx = roadCanvas.getContext('2d')!;
  rCtx.fillStyle = '#333A4D';
  rCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    rCtx.fillStyle = Math.random() > 0.5 ? '#3F485E' : '#293040';
    rCtx.fillRect(x, y, 2, 2);
  }

  // Bright crisp outer shoulder lines
  rCtx.fillStyle = '#FFFFFF';
  rCtx.fillRect(16, 0, 14, 512);
  rCtx.fillRect(482, 0, 14, 512);

  // Vivid sunshine-gold lane dividers
  rCtx.fillStyle = '#FFE100';
  const laneX1 = 172;
  const laneX2 = 330;
  for (let y = 16; y < 512; y += 64) {
    rCtx.fillRect(laneX1, y, 10, 38);
    rCtx.fillRect(laneX2, y, 10, 38);
  }

  const roadTexture = finalizeColorTexture(roadCanvas, maxAnisotropy, 1, 2);

  // 2. Crisp zebra crosswalk texture
  const cwCanvas = document.createElement('canvas');
  cwCanvas.width = 512;
  cwCanvas.height = 256;
  const cwCtx = cwCanvas.getContext('2d')!;
  cwCtx.clearRect(0, 0, 512, 256);

  cwCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  cwCtx.fillRect(24, 10, 464, 236);

  // Bright yellow safety borders
  cwCtx.fillStyle = '#FFE100';
  cwCtx.fillRect(24, 14, 464, 16);
  cwCtx.fillRect(24, 226, 464, 16);

  // Bold white zebra stripes
  cwCtx.fillStyle = '#FFFFFF';
  const stripeCount = 7;
  const startX = 46;
  const stepX = 62;
  for (let i = 0; i < stripeCount; i++) {
    cwCtx.fillRect(startX + i * stepX, 44, 38, 168);
  }

  const crosswalkTexture = finalizeColorTexture(cwCanvas, maxAnisotropy, 1, 1);
  crosswalkTexture.wrapS = THREE.ClampToEdgeWrapping;
  crosswalkTexture.wrapT = THREE.ClampToEdgeWrapping;

  // 3. Super vibrant sunny green grass texture with little bright wildflowers
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#3FE052';
  gCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 160; i++) {
    gCtx.fillStyle = i % 2 === 0 ? '#2ECC40' : '#63F26E';
    gCtx.beginPath();
    gCtx.arc(
      Math.random() * 256,
      Math.random() * 256,
      5 + Math.random() * 11,
      0,
      Math.PI * 2,
    );
    gCtx.fill();
  }
  const flowerColors = ['#FFE100', '#FF4D8D', '#FFFFFF', '#00E5FF'];
  for (let i = 0; i < 28; i++) {
    gCtx.fillStyle = flowerColors[i % flowerColors.length];
    gCtx.beginPath();
    gCtx.arc(Math.random() * 256, Math.random() * 256, 3, 0, Math.PI * 2);
    gCtx.fill();
  }
  const grassTexture = finalizeColorTexture(grassCanvas, maxAnisotropy, 4, 4);

  // 4. Warm sunny cream sidewalk paver texture
  const swCanvas = document.createElement('canvas');
  swCanvas.width = 256;
  swCanvas.height = 256;
  const swCtx = swCanvas.getContext('2d')!;
  swCtx.fillStyle = '#FFF3C4';
  swCtx.fillRect(0, 0, 256, 256);
  swCtx.strokeStyle = '#FCD34D';
  swCtx.lineWidth = 4;
  for (let y = 0; y <= 256; y += 64) {
    swCtx.beginPath();
    swCtx.moveTo(0, y);
    swCtx.lineTo(256, y);
    swCtx.stroke();
  }
  swCtx.beginPath();
  swCtx.moveTo(128, 0);
  swCtx.lineTo(128, 256);
  swCtx.stroke();

  const sidewalkTexture = finalizeColorTexture(swCanvas, maxAnisotropy, 1, 4);

  // 5. Soft radial contact shadow
  const shCanvas = document.createElement('canvas');
  shCanvas.width = 128;
  shCanvas.height = 128;
  const shCtx = shCanvas.getContext('2d')!;
  const grad = shCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(0.6, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  shCtx.fillStyle = grad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadowTexture = new THREE.CanvasTexture(shCanvas);
  contactShadowTexture.needsUpdate = true;

  return {
    roadTexture,
    crosswalkTexture,
    grassTexture,
    sidewalkTexture,
    contactShadowTexture,
    dispose: () => {
      roadTexture.dispose();
      crosswalkTexture.dispose();
      grassTexture.dispose();
      sidewalkTexture.dispose();
      contactShadowTexture.dispose();
    },
  };
}
