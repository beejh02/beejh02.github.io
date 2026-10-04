import * as THREE from 'three'
import Page from './Page'
import { createStudyTextures } from './materials'
import { createVinylRecord } from './Record'
import type { VinylRecord } from './Record'
import { createPencil } from './Pencil'
import type { Pencil } from './Pencil'
import { createEraser } from './Eraser'
import type { Eraser } from './Eraser'
import { createPolaroid } from './Polaroid'
import type { Polaroid } from './Polaroid'
import { createDeskClearance } from './DeskClearance'
import type { ClearanceMode } from './DeskClearance'

export interface BookState { page: number; total: number; busy: boolean }
export interface RecordVisual { src: string; left: number; top: number; size: number }
export interface StudyScene {
  turn: (direction: -1 | 1) => void
  close: () => void
  captureRecord: () => RecordVisual | null
  getRecordVisual: () => RecordVisual | null
  showRecord: (visible: boolean) => void
  setActive: (active: boolean) => void
  setDepartureProgress: (amount: number) => void
  dispose: () => void
}

// Book assembly and progress mapping adapted from The Book of Qbject (MIT).
// See THIRD_PARTY_NOTICES.md. All surfaces are created locally without its assets.
export function createStudyScene(host: HTMLElement, onChange: (state: BookState) => void, recordEntry: HTMLButtonElement | null = null): StudyScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#493024')
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-label', '빈 책. 책장을 잡아 좌우로 끌거나, 클릭 또는 방향키로 넘길 수 있습니다.')
  renderer.domElement.setAttribute('role', 'img')
  host.appendChild(renderer.domElement)

  // Project the models' actual contours instead of approximating them with CSS.
  const svgNamespace = 'http://www.w3.org/2000/svg'
  const outlines = document.createElementNS(svgNamespace, 'svg')
  outlines.classList.add('study__outlines')
  outlines.setAttribute('aria-hidden', 'true')
  const bookOutline = document.createElementNS(svgNamespace, 'path')
  bookOutline.classList.add('study__outline--book')
  const recordOutline = document.createElementNS(svgNamespace, 'path')
  recordOutline.classList.add('study__outline--record')
  const pencilOutline = document.createElementNS(svgNamespace, 'path')
  pencilOutline.classList.add('study__outline--pencil')
  const eraserOutline = document.createElementNS(svgNamespace, 'path')
  eraserOutline.classList.add('study__outline--eraser')
  const polaroidOutline = document.createElementNS(svgNamespace, 'path')
  polaroidOutline.classList.add('study__outline--polaroid')
  for (const path of [bookOutline, recordOutline, pencilOutline, eraserOutline, polaroidOutline]) {
    path.classList.add('study__outline')
    outlines.appendChild(path)
  }
  host.appendChild(outlines)

  const textures = createStudyTextures()
  // The tabletop is thousands of units away; a tighter near plane keeps thin
  // surfaces such as the vinyl label from fighting for depth on small screens.
  const camera = new THREE.PerspectiveCamera(28, 1, 100, 25000)
  const bookFrame = new THREE.Group()
  bookFrame.rotation.z = -0.035
  const book = new THREE.Group()
  const bookLiftFrame = new THREE.Group()
  bookLiftFrame.add(book)
  bookFrame.add(bookLiftFrame)
  scene.add(bookFrame)

  const width = 764
  const height = 1080
  const coverThickness = 7
  const rootThickness = 5
  const paperCount = 16
  const pageCount = paperCount + 2
  const total = pageCount - 1
  const spineWidth = paperCount * rootThickness
  const pages: Page[] = []

  const clothMaterial = new THREE.MeshStandardMaterial({ map: textures.cloth, roughness: 0.96 })
  const spine = new THREE.Mesh(new THREE.BoxGeometry(spineWidth, height + 28, coverThickness), clothMaterial)
  spine.position.z = coverThickness / 2
  spine.castShadow = true
  spine.receiveShadow = true
  book.add(spine)

  for (let i = 0; i < pageCount; i++) {
    const isCover = i === 0 || i === pageCount - 1
    const page = new Page({
      front: i === 0 ? textures.cloth : textures.paper,
      back: i === pageCount - 1 ? textures.cloth : textures.paper,
      width: isCover ? width + 20 : width,
      height: isCover ? height + 28 : height,
      thickness: isCover ? coverThickness : 1.4,
      rootThickness: isCover ? coverThickness : rootThickness,
      isCover,
      isFrontCover: i === 0,
      edgeColor: isCover ? '#667558' : '#dfd9c8',
    })
    if (isCover) {
      page.pivot.position.set((spineWidth / 2) * (i === 0 ? -1 : 1), 0, coverThickness)
    } else {
      const offset = (i - 1) * rootThickness + rootThickness / 2
      page.pivot.position.set(-spineWidth / 2 + offset, 0, coverThickness)
      page.setElevation(offset * 0.7, (spineWidth - offset) * 0.7)
    }
    book.add(page.pivot)
    pages.push(page)
  }
  const bookMeshes = [spine, ...pages.map(page => page.mesh)]
  const bookHoverMaterials = [clothMaterial, ...pages.filter(page => page.isCover).flatMap(page => page.mesh.material)]
  bookHoverMaterials.forEach(material => {
    material.emissive.set('#ffcd7b')
    material.emissiveIntensity = 0
  })

  // A continuous desktop fills both landscape and portrait viewports.
  const deskMaterial = new THREE.MeshStandardMaterial({ map: textures.desktop, roughness: 0.76, metalness: 0 })
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), deskMaterial)
  textures.desktop.repeat.set(14000 / 4200, 14000 / 2800)
  desk.receiveShadow = true
  scene.add(desk)

  const ambient = new THREE.HemisphereLight('#fff3df', '#736151', 1.3)
  ambient.position.set(0, 0, 3000)
  scene.add(ambient)
  const sunlight = new THREE.DirectionalLight('#ffe5bf', 2)
  sunlight.position.set(-1800, 2100, 3500)
  sunlight.castShadow = true
  sunlight.shadow.mapSize.set(2048, 2048)
  sunlight.shadow.camera.left = -1900
  sunlight.shadow.camera.right = 1900
  sunlight.shadow.camera.top = 1600
  sunlight.shadow.camera.bottom = -1600
  sunlight.shadow.camera.near = 100
  sunlight.shadow.camera.far = 7000
  sunlight.shadow.normalBias = 1.5
  sunlight.shadow.bias = -0.00012
  sunlight.shadow.radius = 4
  scene.add(sunlight, sunlight.target)

  // A soft pool of warm light on the walnut desktop.
  const lightCanvas = document.createElement('canvas')
  lightCanvas.width = 512
  lightCanvas.height = 512
  const lightContext = lightCanvas.getContext('2d')!
  const lightGradient = lightContext.createRadialGradient(185, 325, 12, 220, 260, 310)
  lightGradient.addColorStop(0, 'rgba(255,220,164,0.12)')
  lightGradient.addColorStop(0.5, 'rgba(255,220,164,0.04)')
  lightGradient.addColorStop(1, 'rgba(255,220,164,0)')
  lightContext.fillStyle = lightGradient
  lightContext.fillRect(0, 0, 512, 512)
  const daylightTexture = new THREE.CanvasTexture(lightCanvas)
  daylightTexture.colorSpace = THREE.SRGBColorSpace
  const daylight = new THREE.Mesh(
    new THREE.PlaneGeometry(5000, 3600),
    new THREE.MeshBasicMaterial({ map: daylightTexture, transparent: true, depthWrite: false, toneMapped: false }),
  )
  daylight.position.set(-850, 600, 0.1)
  scene.add(daylight)

  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 256
  shadowCanvas.height = 256
  const shadowContext = shadowCanvas.getContext('2d')!
  const shadowGradient = shadowContext.createRadialGradient(128, 128, 50, 128, 128, 128)
  shadowGradient.addColorStop(0, 'rgba(72,59,36,0.23)')
  shadowGradient.addColorStop(0.64, 'rgba(72,59,36,0.12)')
  shadowGradient.addColorStop(1, 'rgba(72,59,36,0)')
  shadowContext.fillStyle = shadowGradient
  shadowContext.fillRect(0, 0, 256, 256)
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas)
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2200, 1550),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }),
  )
  contactShadow.position.set(15, -20, 0.2)
  bookFrame.add(contactShadow)

  let progress = 0
  let destination = progress
  let animationStart = progress
  let animationTime = 0
  let duration = 1.1
  let busy = false
  let recordInTransit = false
  let pointerStart: {
    x: number
    y: number
    id: number
    origin: number
    target: number
    span: number
    dragging: boolean
    vertical: boolean
  } | null = null
  let disposed = false
  let active = true
  let recordSnapshot: string | null = null
  let frame = 0
  let lastTime = 0
  let settling = 60
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const yAxis = new THREE.Vector3(0, 1, 0)
  const pivot = new THREE.Vector3(spineWidth / 2, 0, coverThickness)
  let viewportWidth = 1
  let viewportHeight = 1
  let cameraProgress = -1
  let record: VinylRecord | null = null
  let pencil: Pencil | null = null
  let eraser: Eraser | null = null
  let polaroid: Polaroid | null = null
  const polaroidSourcePositions = new WeakMap<THREE.BufferGeometry, Float32Array>()
  let bookHovered = false
  let recordHovered = false
  let pencilHovered = false
  let eraserHovered = false
  let eraserLift = 0
  let eraserRestContour: THREE.Vector2[] = []
  let eraserContour: THREE.Vector2[] = []
  let eraserOutlineDirty = true
  let polaroidHovered = false
  let polaroidLift = 0
  let pencilLift = 0
  let bookLift = 0
  let recordLift = 0
  let bookRestContour: THREE.Vector2[] = []
  let bookContour: THREE.Vector2[] = []
  let recordRestContour: THREE.Vector2[] = []
  let pencilRestContour: THREE.Vector2[] = []
  let pencilContour: THREE.Vector2[] = []
  let polaroidRestContour: THREE.Vector2[] = []
  let polaroidContour: THREE.Vector2[] = []
  let polaroidOutlineDirty = true
  let pencilOutlineDirty = true
  let bookOutlineDirty = true
  let recordOutlineDirty = true
  let outlinesDirty = true
  let shadowBoundsDirty = true
  const clearance = createDeskClearance({
    getObjects: () => ({ book: bookFrame, record: record?.group, polaroid: polaroid?.group, pencil: pencil?.group, eraser: eraser?.group }),
    getCamera: createDeskCamera,
  })

  function resetDeskClearance() {
    clearance.reset()
    host.dataset.departure = '0'
    delete host.dataset.clearanceMode
  }

  function setDeskClearance(amount: number, mode: ClearanceMode) {
    amount = THREE.MathUtils.clamp(amount, 0, 1)
    if (!clearance.setProgress(amount, mode)) return
    host.dataset.departure = amount === 0 ? '0' : amount.toFixed(3)
    if (amount === 0) delete host.dataset.clearanceMode
    else host.dataset.clearanceMode = mode
    invalidate()
  }

  function setDepartureProgress(amount: number) { setDeskClearance(amount, 'record') }
  function fitPropShadows() {
    scene.updateMatrixWorld(true)
    sunlight.shadow.updateMatrices(sunlight)
    const shadowCamera = sunlight.shadow.camera
    const lightDirection = sunlight.target.getWorldPosition(new THREE.Vector3())
      .sub(sunlight.getWorldPosition(new THREE.Vector3())).normalize()
    const bounds = new THREE.Box3()
    const point = new THREE.Vector3()
    const shadowPoint = new THREE.Vector3()
    let left = -1900, right = 1900, bottom = -1600, top = 1600
    // Keep the book's existing shadow area, and include each prop's full cast
    // shadow on the tabletop, not just the prop itself. Leave room for hover.
    for (const prop of [eraser?.body, polaroid?.body]) {
      if (!prop) continue
      bounds.setFromObject(prop)
      for (const x of [bounds.min.x, bounds.max.x]) {
        for (const y of [bounds.min.y, bounds.max.y]) {
          for (const z of [bounds.min.z, bounds.max.z + 100]) {
            point.set(x, y, z)
            shadowPoint.copy(point).addScaledVector(lightDirection, -z / lightDirection.z)
            for (const sample of [point, shadowPoint]) {
              sample.applyMatrix4(shadowCamera.matrixWorldInverse)
              left = Math.min(left, sample.x - 180)
              right = Math.max(right, sample.x + 180)
              bottom = Math.min(bottom, sample.y - 180)
              top = Math.max(top, sample.y + 180)
            }
          }
        }
      }
    }
    Object.assign(shadowCamera, { left, right, bottom, top })
    shadowCamera.updateProjectionMatrix()
    shadowBoundsDirty = false
  }

  function syncHighlights() {
    const interactive = active && destination === 0 && !busy && !recordInTransit
    const bookActive = interactive && bookHovered
    const recordActive = interactive && (recordHovered || !!recordEntry?.matches(':focus-visible'))
    const pencilActive = interactive && pencilHovered
    const eraserActive = interactive && eraserHovered
    const polaroidActive = interactive && polaroidHovered
    const changed = host.dataset.bookHovered !== String(bookActive)
      || host.dataset.recordHovered !== String(recordActive) || host.dataset.pencilHovered !== String(pencilActive)
      || host.dataset.polaroidHovered !== String(polaroidActive)
      || host.dataset.eraserHovered !== String(eraserActive)
    bookOutline.classList.toggle('study__outline--active', bookActive)
    recordOutline.classList.toggle('study__outline--active', recordActive)
    host.dataset.bookHovered = String(bookActive)
    host.dataset.recordHovered = String(recordActive)
    host.dataset.pencilHovered = String(pencilActive)
    host.dataset.eraserHovered = String(eraserActive)
    host.dataset.polaroidHovered = String(polaroidActive)
    if (!interactive) for (const path of [bookOutline, recordOutline, pencilOutline, eraserOutline, polaroidOutline]) path.style.opacity = '0'
    if (changed) invalidate()
  }

  function setPencilHovered(next: boolean) {
    if (pencilHovered === next) return
    pencilHovered = next
    syncHighlights()
    invalidate()
  }

  function updateHover(dt: number) {
    const interactive = active && destination === 0 && !busy && !recordInTransit
    const targets = [interactive && bookHovered ? 1 : 0,
      interactive && (recordHovered || recordEntry?.matches(':focus-visible')) ? 1 : 0,
      interactive && pencilHovered ? 1 : 0, interactive && polaroidHovered ? 1 : 0,
      interactive && eraserHovered ? 1 : 0]
    const approach = (value: number, target: number) => {
      const next = motionQuery.matches ? target : THREE.MathUtils.damp(value, target, target ? 12 : 10, dt)
      return Math.abs(next - target) < 0.002 ? target : next
    }
    const nextBook = approach(bookLift, targets[0])
    const nextRecord = approach(recordLift, targets[1])
    const amount = approach(pencilLift, targets[2])
    const nextPolaroid = approach(polaroidLift, targets[3])
    const nextEraser = approach(eraserLift, targets[4])
    if (nextEraser !== eraserLift) {
      eraserLift = nextEraser
      eraser?.setHover(eraserLift)
      eraserOutlineDirty = true
    }
    if (nextPolaroid !== polaroidLift) {
      polaroidLift = nextPolaroid
      polaroid?.setHover(polaroidLift)
      polaroidOutlineDirty = true
    }
    if (nextBook !== bookLift) { bookLift = nextBook; bookOutlineDirty = true }
    if (nextRecord !== recordLift) {
      recordLift = nextRecord
      record?.setHover(recordLift)
      recordOutlineDirty = true
    }
    bookLiftFrame.position.z = bookLift * 55
    bookHoverMaterials.forEach(material => { material.emissiveIntensity = bookLift * 0.025 })
    contactShadow.position.set(15 + bookLift * 18, -20 - bookLift * 22, 0.2)
    contactShadow.scale.x *= 1 + bookLift * 0.08
    contactShadow.scale.y = 1 + bookLift * 0.08
    contactShadow.material.opacity = 1 - bookLift * 0.35
    if (amount !== pencilLift) {
      pencilLift = amount
      pencil?.setHover(amount)
      pencilOutlineDirty = true
    }
    host.dataset.pencilLift = pencilLift.toFixed(3)
    host.dataset.bookLift = bookLift.toFixed(3)
    host.dataset.recordLift = recordLift.toFixed(3)
    host.dataset.polaroidLift = polaroidLift.toFixed(3)
    host.dataset.eraserLift = eraserLift.toFixed(3)
    for (const [path, lift] of [[bookOutline, bookLift], [recordOutline, recordLift], [pencilOutline, pencilLift], [eraserOutline, eraserLift], [polaroidOutline, polaroidLift]] as const) {
      path.style.opacity = String(interactive ? lift * 0.7 : 0)
    }
    return bookLift !== targets[0] || recordLift !== targets[1] || pencilLift !== targets[2] || polaroidLift !== targets[3] || eraserLift !== targets[4]
  }

  function screenPoint(point: THREE.Vector3): THREE.Vector2 {
    point.project(camera)
    return new THREE.Vector2((point.x + 1) * viewportWidth / 2, (1 - point.y) * viewportHeight / 2)
  }

  function contourPath(points: THREE.Vector2[]): string {
    return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(3)},${point.y.toFixed(3)}`).join(' ') + ' Z'
  }

  function projectedContour(meshes: THREE.Mesh[]): THREE.Vector2[] {
    const points: THREE.Vector2[] = []
    for (const mesh of meshes) {
      const positions = mesh.geometry.attributes.position
      for (let index = 0; index < positions.count; index++) {
        points.push(screenPoint(new THREE.Vector3().fromBufferAttribute(positions, index).applyMatrix4(mesh.matrixWorld)))
      }
    }
    return convexContour(points)
  }

  function convexContour(points: THREE.Vector2[]): THREE.Vector2[] {
    points.sort((a, b) => a.x - b.x || a.y - b.y)
    const cross = (a: THREE.Vector2, b: THREE.Vector2, c: THREE.Vector2) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
    const halfHull = (ordered: THREE.Vector2[]) => {
      const hull: THREE.Vector2[] = []
      for (const point of ordered) {
        while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop()
        hull.push(point)
      }
      hull.pop()
      return hull
    }
    return [...halfHull(points), ...halfHull([...points].reverse())]
  }

  function updateOutlines() {
    if (!outlinesDirty || progress !== 0 || busy) return
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    outlines.setAttribute('viewBox', `0 0 ${viewportWidth} ${viewportHeight}`)
    // Include the cover, page block and spine so the glow follows the whole book.
    const bookHeight = bookLiftFrame.position.z
    bookLiftFrame.position.z = 0
    bookLiftFrame.updateMatrixWorld(true)
    bookRestContour = projectedContour(bookMeshes)
    bookLiftFrame.position.z = bookHeight
    bookLiftFrame.updateMatrixWorld(true)
    bookOutlineDirty = true

    if (pencil) {
      // Retain the resting hit area so lifting a thin pencil cannot flicker hover.
      const height = pencil.body.position.z
      pencil.body.position.z = 0
      pencil.body.updateMatrixWorld(true)
      pencilRestContour = projectedContour(pencil.meshes)
      pencil.body.position.z = height
      pencil.body.updateMatrixWorld(true)
      pencilOutlineDirty = true
    }

    if (eraser) {
      const height = eraser.body.position.z
      eraser.body.position.z = 0
      eraser.body.updateMatrixWorld(true)
      eraserRestContour = projectedContour(eraser.meshes)
      eraser.body.position.z = height
      eraser.body.updateMatrixWorld(true)
      eraserOutlineDirty = true
    }

    if (polaroid) {
      const height = polaroid.body.position.z
      polaroid.body.position.z = 0
      polaroid.body.updateMatrixWorld(true)
      polaroidRestContour = projectedContour(polaroid.meshes)
      polaroid.body.position.z = height
      polaroid.body.updateMatrixWorld(true)
      polaroidOutlineDirty = true
    }

    if (!record) return
    const recordHeight = record.surface.position.z
    record.surface.position.z = 0
    record.surface.updateMatrixWorld(true)
    recordRestContour = projectedContour([record.body])
    record.surface.position.z = recordHeight
    record.surface.updateMatrixWorld(true)
    recordOutlineDirty = true
    outlinesDirty = false
  }

  function positionRecordEntry(rim: THREE.Vector2[]) {
    if (recordEntry) {
      const left = Math.min(...rim.map(point => point.x))
      const top = Math.min(...rim.map(point => point.y))
      const width = Math.max(...rim.map(point => point.x)) - left
      const height = Math.max(...rim.map(point => point.y)) - top
      Object.assign(recordEntry.style, {
        left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`,
        clipPath: `polygon(${rim.map(point => `${(point.x - left) / width * 100}% ${(point.y - top) / height * 100}%`).join(',')})`,
      })
    }
  }

  function updateLiftOutlines() {
    if (progress !== 0 || busy || !(bookOutlineDirty || recordOutlineDirty || pencilOutlineDirty || eraserOutlineDirty || polaroidOutlineDirty)) return
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    if (bookOutlineDirty) {
      bookContour = projectedContour(bookMeshes)
      bookOutline.setAttribute('d', contourPath(bookContour))
      bookOutlineDirty = false
    }
    if (record && recordOutlineDirty) {
      const rim = projectedContour([record.body])
      recordOutline.setAttribute('d', contourPath(rim))
      // The click area covers both heights so a moving edge cannot lose hover.
      positionRecordEntry(convexContour([...recordRestContour, ...rim]))
      recordOutlineDirty = false
    }
    if (pencil && pencilOutlineDirty) {
      pencilContour = projectedContour(pencil.meshes)
      pencilOutline.setAttribute('d', contourPath(pencilContour))
      pencilOutlineDirty = false
    }
    if (polaroid && polaroidOutlineDirty) {
      polaroidContour = projectedContour(polaroid.meshes)
      polaroidOutline.setAttribute('d', contourPath(polaroidContour))
      polaroidOutlineDirty = false
    }
    if (eraser && eraserOutlineDirty) {
      eraserContour = projectedContour(eraser.meshes)
      eraserOutline.setAttribute('d', contourPath(eraserContour))
      eraserOutlineDirty = false
    }
  }

  function overContours(event: PointerEvent, resting: THREE.Vector2[], raised: THREE.Vector2[], tolerance = 3): boolean {
    if (destination !== 0 || busy) return false
    const bounds = renderer.domElement.getBoundingClientRect()
    const point = new THREE.Vector2(event.clientX - bounds.left, event.clientY - bounds.top)
    const nearContour = (contour: THREE.Vector2[]) => {
      let inside = false
      for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
        const a = contour[i]
        const b = contour[j]
        if ((a.y > point.y) !== (b.y > point.y)
          && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside
        const edge = b.clone().sub(a)
        const fraction = THREE.MathUtils.clamp(point.clone().sub(a).dot(edge) / (edge.lengthSq() || 1), 0, 1)
        if (a.clone().addScaledVector(edge, fraction).distanceToSquared(point) <= tolerance * tolerance) return true
      }
      return inside
    }
    return nearContour(resting) || nearContour(raised)
  }

  // Props keep their desk positions while the reading camera moves.
  function createDeskCamera() {
    const aspect = viewportWidth / viewportHeight
    const portrait = aspect <= 1
    const span = portrait ? Math.max(2150, 2300 / aspect) : Math.max(1750, 4000 / aspect)
    const distance = span / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    const deskCamera = camera.clone()
    deskCamera.position.set(0, -distance * 0.40 - 70, distance * 0.9165)
    deskCamera.lookAt(0, -70, 0)
    deskCamera.setViewOffset(viewportWidth, viewportHeight, viewportWidth * (portrait ? 0.1 : 0.26), -viewportHeight * (portrait ? 0.06 : 0.095), viewportWidth, viewportHeight)
    deskCamera.updateProjectionMatrix()
    deskCamera.updateMatrixWorld()
    return deskCamera
  }

  function deskPoint(deskCamera: THREE.PerspectiveCamera, x: number, y: number) {
    const point = new THREE.Vector3(x * 2 - 1, 1 - y * 2, 0.5).unproject(deskCamera)
    const ray = new THREE.Ray(deskCamera.position, point.sub(deskCamera.position).normalize())
    return ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), new THREE.Vector3())!
  }

  // Compensate the desk camera's foreshortening and skew so flat props
  // remain on the tabletop with level lettering and round lenses or grooves.
  function alignFlatProp(group: THREE.Group, deskCamera: THREE.PerspectiveCamera, center: THREE.Vector3, pixelScale: number) {
    const projectedCenter = center.clone().project(deskCamera)
    const projectedX = center.clone().add(new THREE.Vector3(1, 0, 0)).project(deskCamera).sub(projectedCenter)
    const projectedY = center.clone().add(new THREE.Vector3(0, 1, 0)).project(deskCamera).sub(projectedCenter)
    const a = projectedX.x * viewportWidth / 2
    const b = projectedY.x * viewportWidth / 2
    const c = projectedX.y * viewportHeight / 2
    const d = projectedY.y * viewportHeight / 2
    const determinant = a * d - b * c
    const depthScale = pixelScale / Math.hypot(a, c)
    group.matrixAutoUpdate = false
    group.matrix.set(
      pixelScale * d / determinant, -pixelScale * b / determinant, 0, center.x,
      -pixelScale * c / determinant, pixelScale * a / determinant, 0, center.y,
      0, 0, depthScale, center.z,
      0, 0, 0, 1,
    )
    group.matrixWorldNeedsUpdate = true
  }

  // Use the book's projected height as one scale for every prop. Independent
  // viewport percentages made the eraser grow wider on wide screens while the
  // pencil stayed tied to the screen height.
  function deskBookHeight(deskCamera: THREE.PerspectiveCamera) {
    const top = new THREE.Vector3(0, (height + 28) / 2, 0).applyEuler(bookFrame.rotation).project(deskCamera)
    const bottom = new THREE.Vector3(0, -(height + 28) / 2, 0).applyEuler(bookFrame.rotation).project(deskCamera)
    return Math.hypot((top.x - bottom.x) * viewportWidth / 2, (top.y - bottom.y) * viewportHeight / 2)
  }

  function positionRecord() {
    if (!record) return
    const portrait = viewportWidth <= viewportHeight
    const deskCamera = createDeskCamera()
    const radius = deskBookHeight(deskCamera) * 0.56
    // Tuck more of the upper rim beyond the viewport, retaining the centre label.
    // On narrow screens move it clear of the heading at the top left.
    const anchorX = portrait ? Math.max(0.42, (130 + radius) / viewportWidth) : 0.54
    const anchorY = portrait ? 0 : radius * 0.20 / viewportHeight
    alignFlatProp(record.group, deskCamera, deskPoint(deskCamera, anchorX, anchorY), radius / 450)
  }

  function stationeryLayout(deskCamera: THREE.PerspectiveCamera) {
    const portrait = viewportWidth <= viewportHeight
    const stacked = viewportWidth / viewportHeight < 0.8
    const bookHeight = deskBookHeight(deskCamera)
    const length = bookHeight * 0.96
    const angle = THREE.MathUtils.degToRad(portrait ? -32 : -40)
    const x = portrait ? 0.74 : 0.53
    // Leave room below the stationery on square and tablet screens.
    const y = portrait
      ? stacked ? Math.min(0.64, 0.88 - (Math.cos(angle) * length / 2 + bookHeight * 0.31) / viewportHeight) : 0.70
      : 0.64
    const dx = Math.sin(angle) * length / 2 / viewportWidth
    const dy = Math.cos(angle) * length / 2 / viewportHeight
    return {
      tip: new THREE.Vector2(x + dx, y - dy),
      end: new THREE.Vector2(x - dx, y + dy),
      eraser: new THREE.Vector2(
        portrait ? (stacked ? 0.84 : 0.87) : 0.81,
        portrait ? (stacked ? 0.88 : 0.61) : 0.77,
      ),
      eraserWidth: bookHeight * 0.30,
    }
  }

  function positionPencil() {
    if (!pencil) return
    const deskCamera = createDeskCamera()
    const layout = stationeryLayout(deskCamera)
    const tip = deskPoint(deskCamera, layout.tip.x, layout.tip.y)
    const end = deskPoint(deskCamera, layout.end.x, layout.end.y)
    const direction = tip.clone().sub(end)
    pencil.group.position.copy(tip).add(end).multiplyScalar(0.5)
    pencil.group.rotation.z = Math.atan2(-direction.x, direction.y)
    pencil.group.scale.setScalar(direction.length() / 1000)
  }

  function positionEraser() {
    if (!eraser) return
    const deskCamera = createDeskCamera()
    const layout = stationeryLayout(deskCamera)
    const center = deskPoint(deskCamera, layout.eraser.x, layout.eraser.y)
    alignFlatProp(eraser.group, deskCamera, center, layout.eraserWidth / 800)
  }

  function positionPolaroid() {
    if (!polaroid) return
    const portrait = viewportWidth <= viewportHeight
    const deskCamera = createDeskCamera()
    const x = portrait ? (viewportWidth / viewportHeight >= 0.8 ? 0.82 : 0.78) : 0.80
    const y = portrait ? 0.27 : 0.34
    const width = deskBookHeight(deskCamera) * 0.66
    const center = deskPoint(deskCamera, x, y)
    alignFlatProp(polaroid.group, deskCamera, center, width / 800)
    polaroid.group.matrix.elements[10] *= 0.65
    rectifyPolaroid(deskCamera, center, width / 800)
  }

  // The affine tabletop alignment corrects only the centre of a prop. Undo the
  // remaining perspective across each camera surface so its parallel edges stay
  // parallel on screen, while retaining the height offset of each raised part.
  function rectifyPolaroid(deskCamera: THREE.PerspectiveCamera, center: THREE.Vector3, pixelScale: number) {
    if (!polaroid) return
    const hoverHeight = polaroid.body.position.z
    polaroid.body.position.z = 0
    polaroid.group.updateMatrixWorld(true)
    const inverseGroup = polaroid.group.matrixWorld.clone().invert()
    const depthScale = polaroid.group.matrix.elements[10]
    const deskPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1))
    const point = new THREE.Vector3()
    const projected = new THREE.Vector3()
    const ray = new THREE.Ray(deskCamera.position.clone())
    for (const mesh of polaroid.meshes) {
      const positions = mesh.geometry.getAttribute('position')
      let source = polaroidSourcePositions.get(mesh.geometry)
      if (!source) {
        source = new Float32Array(positions.array)
        polaroidSourcePositions.set(mesh.geometry, source)
      }
      const meshToGroup = new THREE.Matrix4().multiplyMatrices(inverseGroup, mesh.matrixWorld)
      const worldToMesh = mesh.matrixWorld.clone().invert()
      for (let index = 0; index < positions.count; index++) {
        point.fromArray(source, index * 3).applyMatrix4(meshToGroup)
        const worldHeight = center.z + point.z * depthScale
        projected.set(center.x, center.y, worldHeight).project(deskCamera)
        projected.x += point.x * pixelScale * 2 / viewportWidth
        projected.y += point.y * pixelScale * 2 / viewportHeight
        projected.z = 0.5
        projected.unproject(deskCamera)
        ray.direction.copy(projected).sub(ray.origin).normalize()
        deskPlane.constant = -worldHeight
        ray.intersectPlane(deskPlane, point)!
        point.applyMatrix4(worldToMesh)
        positions.setXYZ(index, point.x, point.y, point.z)
      }
      positions.needsUpdate = true
      mesh.geometry.computeVertexNormals()
      mesh.geometry.computeBoundingBox()
      mesh.geometry.computeBoundingSphere()
    }
    polaroid.body.position.z = hoverHeight
    polaroid.group.updateMatrixWorld(true)
  }

  function updateDeskProps() {
    const needsProps = progress < 1 || destination === 0
    if (needsProps !== !!record) resetDeskClearance()
    if (needsProps && !eraser) {
      shadowBoundsDirty = true
      eraser = createEraser()
      eraserLift = 0
      eraserOutlineDirty = true
      outlinesDirty = true
      scene.add(eraser.group)
      positionEraser()
      host.dataset.eraserLoaded = 'true'
    } else if (!needsProps && eraser) {
      eraser.dispose()
      eraser = null
      eraserLift = 0
      eraserRestContour = []
      eraserContour = []
      eraserOutline.setAttribute('d', '')
      host.dataset.eraserLoaded = 'false'
    }
    if (needsProps && !polaroid) {
      shadowBoundsDirty = true
      polaroid = createPolaroid()
      polaroidLift = 0
      polaroidOutlineDirty = true
      outlinesDirty = true
      scene.add(polaroid.group)
      positionPolaroid()
      host.dataset.polaroidLoaded = 'true'
    } else if (!needsProps && polaroid) {
      polaroid.dispose()
      polaroid = null
      polaroidLift = 0
      polaroidRestContour = []
      polaroidContour = []
      polaroidOutline.setAttribute('d', '')
      host.dataset.polaroidLoaded = 'false'
    }
    if (needsProps && !pencil) {
      pencil = createPencil()
      pencilLift = 0
      pencilOutlineDirty = true
      outlinesDirty = true
      scene.add(pencil.group)
      positionPencil()
      host.dataset.pencilLoaded = 'true'
    } else if (!needsProps && pencil) {
      pencil.dispose()
      pencil = null
      pencilLift = 0
      pencilRestContour = []
      pencilContour = []
      pencilOutline.setAttribute('d', '')
      host.dataset.pencilLoaded = 'false'
    }
    if (needsProps && !record) {
      record = createVinylRecord()
      recordLift = 0
      outlinesDirty = true
      scene.add(record.group)
      positionRecord()
      host.dataset.recordLoaded = 'true'
    } else if (!needsProps && record) {
      record.dispose()
      record = null
      recordLift = 0
      recordRestContour = []
      host.dataset.recordLoaded = 'false'
    }
  }

  function notify() {
    host.dataset.page = String(destination)
    host.dataset.busy = String(busy)
    syncHighlights()
    renderer.domElement.setAttribute('aria-label', destination === 0
      ? '책상 위의 닫힌 책, 비닐 레코드, 연필, 지우개와 폴라로이드 즉석카메라. 표지를 잡아 왼쪽으로 끌거나, 클릭 또는 오른쪽 방향키로 펼칠 수 있습니다.'
      : '빈 책. 책장을 잡아 좌우로 끌거나, 클릭 또는 방향키로 넘길 수 있습니다.')
    onChange({ page: destination, total, busy })
  }

  function updateBook(dt: number, immediate = false) {
    const open = Math.min(progress, 1)
    for (const [index, page] of pages.entries()) {
      const turn = index >= progress ? open : index < Math.floor(progress) || page.isCover ? -open : 1 - (progress % 1) * 2
      page.bendingEnabled = progress >= 1
      page.setTurnProgress(turn)
      if (immediate) page.turnProgressLag = turn
      if (page.needsUpdate() || immediate) page.update(dt)
      page.mesh.renderOrder = Math.abs(progress - 0.5 - index)
    }
    const angle = (1 - open) * Math.PI / 2
    book.rotation.y = angle
    book.position.copy(new THREE.Vector3().sub(pivot).applyAxisAngle(yAxis, angle).add(pivot))
    book.position.x -= (1 - open) * width / 2
    contactShadow.scale.x = 0.55 + open * 0.45
    if (cameraProgress !== open) {
      cameraProgress = open
      updateCamera()
    }
    updateDeskProps()
    if (!recordInTransit) setDeskClearance(open, 'book')
  }

  function render(time: number) {
    if (disposed || !active || document.hidden) { frame = 0; lastTime = 0; return }
    const dt = Math.min(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.05)
    lastTime = time
    if (busy && !pointerStart?.dragging) {
      animationTime += dt
      const fraction = Math.min(animationTime / duration, 1)
      const eased = fraction * fraction * (3 - 2 * fraction)
      // Gather the open sheets first, then leave enough time to close the cover
      // and bring the props back, even when returning from the last page.
      progress = destination === 0 && animationStart > 1
        ? fraction < .35
          ? THREE.MathUtils.lerp(animationStart, 1, THREE.MathUtils.smoothstep(fraction, 0, .35))
          : 1 - THREE.MathUtils.smoothstep(fraction, .35, 1)
        : THREE.MathUtils.lerp(animationStart, destination, eased)
      if (fraction === 1) {
        progress = destination
        busy = false
        settling = 60
        notify()
      }
    }
    updateBook(dt, !!pointerStart?.dragging && motionQuery.matches)
    const hoverMoving = updateHover(dt)
    if (shadowBoundsDirty) fitPropShadows()
    updateOutlines()
    updateLiftOutlines()
    renderer.render(scene, camera)
    if (busy || hoverMoving || pages.some(page => page.needsUpdate()) || settling-- > 0) frame = requestAnimationFrame(render)
    else { frame = 0; lastTime = 0 }
  }

  function invalidate() {
    settling = 60
    if (!frame && active && !disposed && !document.hidden) frame = requestAnimationFrame(render)
  }

  function animateTo(next: number, seconds: number) {
    destination = next
    outlinesDirty = true
    bookHovered = false
    recordHovered = false
    pencilHovered = false
    eraserHovered = false
    polaroidHovered = false
    renderer.domElement.style.cursor = 'default'
    animationStart = progress
    animationTime = 0
    duration = seconds
    if (motionQuery.matches || progress === destination) {
      progress = destination
      busy = false
      updateBook(1, true)
    } else busy = true
    notify()
    invalidate()
  }

  function goTo(next: number) {
    if (!active || busy || pointerStart || disposed || recordInTransit) return
    next = THREE.MathUtils.clamp(next, 0, total)
    if (next === destination) return
    animateTo(next, next === 0 ? Math.min(2, 0.9 + progress * 0.075) : 1.05)
  }

  function turn(direction: -1 | 1) { goTo(destination + direction) }

  function updateCamera() {
    const aspect = viewportWidth / viewportHeight
    camera.aspect = aspect
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    const portrait = aspect <= 1
    const deskSpan = portrait ? Math.max(2150, 2300 / aspect) : Math.max(1750, 4000 / aspect)
    const readingSpan = Math.max(1500, 1950 / aspect)
    // Follow the cover's opening progress so the same book becomes the reading view.
    const focus = THREE.MathUtils.smoothstep(cameraProgress, 0, 1)
    const spanY = THREE.MathUtils.lerp(deskSpan, readingSpan, focus)
    const distance = spanY / (2 * tangent)
    const tilt = THREE.MathUtils.lerp(0.40, 0.12, focus)
    camera.position.set(0, -distance * tilt - 70, distance * Math.sqrt(1 - tilt * tilt))
    camera.lookAt(0, -70, 0)
    // Keep the book at the sketch's lower-left anchor while reserving the right
    // and upper desktop for props. View offset preserves the book's perspective.
    camera.setViewOffset(viewportWidth, viewportHeight, viewportWidth * (portrait ? 0.1 : 0.26) * (1 - focus), -viewportHeight * (portrait ? 0.06 : 0.095) * (1 - focus), viewportWidth, viewportHeight)
    camera.updateProjectionMatrix()
  }

  function resize() {
    resetDeskClearance()
    const bounds = host.getBoundingClientRect()
    viewportWidth = Math.max(bounds.width, 1)
    viewportHeight = Math.max(bounds.height, 1)
    outlinesDirty = true
    updateCamera()
    positionRecord()
    positionPencil()
    positionEraser()
    positionPolaroid()
    shadowBoundsDirty = true
    renderer.setSize(viewportWidth, viewportHeight)
    invalidate()
  }

  function hit(event: PointerEvent) {
    const bounds = renderer.domElement.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObjects(pages.map(page => page.mesh))[0]
  }

  // Use the projected spread width so the gesture scales with the visible book.
  // Freeze this distance at pointerdown: the camera moves while opening the cover.
  function dragSpan() {
    scene.updateMatrixWorld(true)
    const left = bookFrame.localToWorld(new THREE.Vector3(-width, 0, coverThickness)).project(camera)
    const right = bookFrame.localToWorld(new THREE.Vector3(width, 0, coverThickness)).project(camera)
    return Math.max(120, Math.min(Math.abs(right.x - left.x) * viewportWidth / 2, viewportWidth * 0.85))
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || !event.isPrimary || busy || pointerStart || recordInTransit) return
    const intersection = hit(event)
    if (!intersection && !(destination === 0 && overContours(event, bookRestContour, bookContour))) return
    const point = intersection && bookFrame.worldToLocal(intersection.point.clone())
    const direction = destination === 0 || (point && point.x > 0) ? 1 : -1
    const target = THREE.MathUtils.clamp(destination + direction, 0, total)
    if (target === destination) return
    pointerStart = {
      x: event.clientX, y: event.clientY, id: event.pointerId,
      origin: destination, target, span: dragSpan(), dragging: false, vertical: false,
    }
    renderer.domElement.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent) {
    const start = pointerStart
    if (!start || start.id !== event.pointerId || start.vertical) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (!start.dragging) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 6) return
      if (Math.abs(dy) > Math.abs(dx)) { start.vertical = true; return }
      start.dragging = true
      destination = start.target
      busy = true
      bookHovered = recordHovered = pencilHovered = eraserHovered = polaroidHovered = false
      outlinesDirty = true
      notify()
    }
    event.preventDefault()
    // A sheet remains held until release, including when the pointer leaves it.
    const direction = start.target - start.origin
    const fraction = THREE.MathUtils.clamp(-dx * direction / start.span, 0, 1)
    progress = start.origin + direction * fraction
    renderer.domElement.style.cursor = 'grabbing'
    invalidate()
  }

  function releasePointer() {
    const start = pointerStart
    pointerStart = null
    if (start && renderer.domElement.hasPointerCapture(start.id)) renderer.domElement.releasePointerCapture(start.id)
    return start
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return
    moveDrag(event)
    const start = releasePointer()!
    if (start.dragging) {
      const next = Math.abs(progress - start.origin) >= 0.5 ? start.target : start.origin
      animateTo(next, 0.2 + Math.abs(next - progress) * 0.45)
      return
    }
    if (start.vertical) return
    if (destination === 0 && overContours(event, bookRestContour, bookContour)) { goTo(start.target); return }
    const intersection = hit(event)
    if (!intersection) return
    goTo(start.target)
  }
  const onPointerCancel = (event?: PointerEvent) => {
    if (!pointerStart || (event && event.pointerId !== pointerStart.id)) return
    const start = releasePointer()!
    if (start.dragging) animateTo(start.origin, 0.2 + Math.abs(progress - start.origin) * 0.45)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (recordInTransit) return
    if (pointerStart) { moveDrag(event); return }
    if (event.pointerType !== 'mouse') return
    const pencilHit = !!pencil && overContours(event, pencilRestContour, pencilContour)
    const eraserHit = !!eraser && overContours(event, eraserRestContour, eraserContour)
    const polaroidHit = !!polaroid && overContours(event, polaroidRestContour, polaroidContour)
    const overBook = !pencilHit && !eraserHit && !polaroidHit && !busy && (destination === 0
      ? overContours(event, bookRestContour, bookContour, 1) : !!hit(event))
    renderer.domElement.style.cursor = overBook ? 'grab' : 'default'
    bookHovered = destination === 0 && overBook
    polaroidHovered = polaroidHit
    eraserHovered = eraserHit
    setPencilHovered(pencilHit)
    syncHighlights()
  }
  const onPointerLeave = () => {
    if (pointerStart) return
    eraserHovered = false
    bookHovered = false
    polaroidHovered = false
    setPencilHovered(false)
    renderer.domElement.style.cursor = 'default'
    syncHighlights()
  }
  const onRecordEnter = (event: PointerEvent) => {
    eraserHovered = false
    recordHovered = event.pointerType === 'mouse'
    bookHovered = false
    polaroidHovered = false
    setPencilHovered(false)
    syncHighlights()
  }
  const onRecordLeave = () => { recordHovered = false; syncHighlights() }
  const onKeyDown = (event: KeyboardEvent) => {
    if (!active || recordInTransit) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1) }
    else if (event.key === 'Escape') goTo(0)
  }
  const onVisibility = () => {
    if (document.hidden) { onPointerCancel(); cancelAnimationFrame(frame); frame = 0; lastTime = 0 }
    else invalidate()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerCancel)
  renderer.domElement.addEventListener('lostpointercapture', onPointerCancel)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerleave', onPointerLeave)
  recordEntry?.addEventListener('pointerenter', onRecordEnter)
  recordEntry?.addEventListener('pointerleave', onRecordLeave)
  recordEntry?.addEventListener('focus', syncHighlights)
  recordEntry?.addEventListener('blur', syncHighlights)
  window.addEventListener('keydown', onKeyDown)
  const onBlur = () => onPointerCancel()
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)
  updateBook(1, true)
  notify()
  resize()

  function recordVisual(src: string): RecordVisual | null {
    if (!record || busy || destination !== 0) return null
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const rim = projectedContour([record.body])
    const left = Math.min(...rim.map(point => point.x))
    const right = Math.max(...rim.map(point => point.x))
    const top = Math.min(...rim.map(point => point.y))
    const bottom = Math.max(...rim.map(point => point.y))
    // Include the soft shadow and the full rim, even above the viewport.
    const size = Math.max(right - left, bottom - top) * 1.16
    const bounds = renderer.domElement.getBoundingClientRect()
    return { src, left: bounds.left + (left + right - size) / 2, top: bounds.top + (top + bottom - size) / 2, size }
  }

  return {
    turn,
    close: () => goTo(0),
    captureRecord() {
      const visual = recordVisual(recordSnapshot ?? '')
      if (!visual || !record) return null
      if (recordSnapshot) return visual
      const snapshotScene = new THREE.Scene()
      const snapshotRecord = record.group.clone(true)
      snapshotRecord.visible = true
      snapshotScene.add(snapshotRecord, ambient.clone())
      const snapshotLight = sunlight.clone()
      snapshotLight.castShadow = false
      snapshotScene.add(snapshotLight, snapshotLight.target)
      const snapshotCamera = camera.clone()
      const view = camera.view!
      const bounds = renderer.domElement.getBoundingClientRect()
      snapshotCamera.setViewOffset(view.fullWidth, view.fullHeight, view.offsetX + visual.left - bounds.left, view.offsetY + visual.top - bounds.top, visual.size, visual.size)
      const snapshotRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
      try {
        snapshotRenderer.setSize(1536, 1536)
        snapshotRenderer.outputColorSpace = renderer.outputColorSpace
        snapshotRenderer.toneMapping = renderer.toneMapping
        snapshotRenderer.toneMappingExposure = renderer.toneMappingExposure
        snapshotRenderer.render(snapshotScene, snapshotCamera)
        recordSnapshot = snapshotRenderer.domElement.toDataURL('image/png')
        return { ...visual, src: recordSnapshot }
      } finally {
        snapshotRenderer.dispose()
        snapshotRenderer.forceContextLoss()
      }
    },
    getRecordVisual: () => recordSnapshot ? recordVisual(recordSnapshot) : null,
    setActive(next) {
      host.dataset.active = String(next)
      if (active === next) return
      active = next
      if (active) invalidate()
      else {
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0
        bookHovered = recordHovered = pencilHovered = eraserHovered = polaroidHovered = false
        syncHighlights()
      }
    },
    showRecord(visible) {
      recordInTransit = !visible
      if (record) record.group.visible = visible
      recordOutline.style.visibility = visible ? '' : 'hidden'
      if (visible) setDepartureProgress(0)
      syncHighlights()
      invalidate()
    },
    setDepartureProgress,
    dispose() {
      disposed = true
      recordSnapshot = null
      clearance.reset()
      releasePointer()
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      renderer.domElement.removeEventListener('lostpointercapture', onPointerCancel)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      recordEntry?.removeEventListener('pointerenter', onRecordEnter)
      recordEntry?.removeEventListener('pointerleave', onRecordLeave)
      recordEntry?.removeEventListener('focus', syncHighlights)
      recordEntry?.removeEventListener('blur', syncHighlights)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const page of pages) page.dispose()
      record?.dispose()
      pencil?.dispose()
      eraser?.dispose()
      polaroid?.dispose()
      for (const mesh of [spine, desk, daylight, contactShadow]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      for (const texture of [...Object.values(textures), daylightTexture, shadowTexture]) texture.dispose()
      sunlight.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      outlines.remove()
    },
  }
}
