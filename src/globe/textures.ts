import * as THREE from 'three'

/** 地球昼/夜纹理对（SPEC-3.2，素材登记见 public/assets/ASSETS.md） */
export interface EarthTextures {
  day: THREE.Texture
  night: THREE.Texture
}

const DAY_URL = `${import.meta.env.BASE_URL}assets/textures/earth_day.jpg`
const NIGHT_URL = `${import.meta.env.BASE_URL}assets/textures/earth_night.jpg`

// 占位纯色（线性色值）：昼 = 夜 × 夜景增益（earth.ts 的 NIGHT_GAIN = 2），
// 使纹理就绪前昼夜两半球混合后仍是同一深色（SPEC-3.2「深色纯色」）。
const PLACEHOLDER_DAY: [number, number, number] = [4, 6, 10]
const PLACEHOLDER_NIGHT: [number, number, number] = [2, 3, 5]

function solidTexture(rgb: [number, number, number]): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([...rgb, 255]), 1, 1)
  // 线性色值直出，不走 sRGB 解码，才能保持与增益的比例关系
  tex.colorSpace = THREE.NoColorSpace
  tex.needsUpdate = true
  return tex
}

/** 纹理未就绪/加载失败期的深色占位（SPEC-3.2：无 loading UI、无淡入） */
export function createPlaceholderTextures(): EarthTextures {
  return { day: solidTexture(PLACEHOLDER_DAY), night: solidTexture(PLACEHOLDER_NIGHT) }
}

function loadTexture(loader: THREE.TextureLoader, url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })
}

/** 加载昼/夜纹理并设好色彩空间与各向异性过滤 */
export function loadEarthTextures(): Promise<EarthTextures> {
  const loader = new THREE.TextureLoader()
  return Promise.all([loadTexture(loader, DAY_URL), loadTexture(loader, NIGHT_URL)]).then(
    ([day, night]) => {
      for (const tex of [day, night]) {
        tex.colorSpace = THREE.SRGBColorSpace
        // 上传时 three 会按 GPU 上限自动夹紧，此处取建议值
        tex.anisotropy = 4
      }
      return { day, night }
    },
  )
}
