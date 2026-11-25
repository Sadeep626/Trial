import * as THREE from 'three';

export function createAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#2b2f36';
  ctx.fillRect(0, 0, 512, 512);

  // Mineral aggregate speckle
  for (let i = 0; i < 18000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 34 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 5})`;
    ctx.fillRect(x, y, Math.random() > 0.8 ? 2 : 1, Math.random() > 0.8 ? 2 : 1);
  }

  // Subtle tire-wear tonal variation
  ctx.fillStyle = 'rgba(18, 20, 24, 0.14)';
  ctx.fillRect(0, 120, 512, 48);
  ctx.fillRect(0, 340, 512, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 18);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createRampConcreteTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#7e838a';
  ctx.fillRect(0, 0, 256, 512);

  // Subtle concrete grain
  for (let i = 0; i < 6000; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const v = 110 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgb(${v},${v + 2},${v + 4})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Anti-slip traction grooves across ramp
  for (let y = 0; y < 512; y += 16) {
    ctx.fillStyle = 'rgba(40, 44, 50, 0.35)';
    ctx.fillRect(0, y, 256, 3);
    ctx.fillStyle = 'rgba(215, 220, 226, 0.2)';
    ctx.fillRect(0, y + 3, 256, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 5);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createBrickWallTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#9e978e'; // mortar
  ctx.fillRect(0, 0, 256, 256);

  const brickH = 24;
  const brickW = 60;
  for (let row = 0; row < 12; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = -1; col < 6; col++) {
      const x = col * brickW + offset;
      const y = row * brickH;
      const r = 148 + Math.floor(Math.random() * 26);
      const g = 74 + Math.floor(Math.random() * 18);
      const b = 52 + Math.floor(Math.random() * 14);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x + 2, y + 2, brickW - 4, brickH - 4);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 1);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createLearnerBoardTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 244, 116);

  // Red L
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(46, 24, 20, 80);
  ctx.fillRect(46, 84, 54, 20);

  // TRIAL label
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 28px sans-serif';
  ctx.fillText('TRIAL', 118, 74);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
