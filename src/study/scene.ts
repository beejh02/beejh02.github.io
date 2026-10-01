import * as THREE from 'three'
import Page from './Page'
import { createStudyTextures } from './materials'
import { createVinylRecord } from './Record'
import type { VinylRecord } from './Record'

export interface BookState { page: number; total: number; busy: boolean }
export interface StudyScene {
  turn: (direction: -1 | 1) => void
  close: () => void
  dispose: () => void
}

// Book assembly and progress mapping adapted from The Book of Qbject (MIT).
// See THIRD_PARTY_NOTICES.md. All surfaces are created locally without its assets.
export function createStudyScene(host: HTMLElement, onChange: (state: BookState) => void): StudyScene {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#e9dbc2')
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.setAttribute('aria-label', '빈 책. 좌우 책장을 누르거나 방향키로 넘길 수 있습니다.')
  renderer.domElement.setAttribute('role', 'img')
  host.appendChild(renderer.domElement)

  const textures = createStudyTextures()
  // The tabletop is thousands of units away; a tighter near plane keeps thin
  // surfaces such as the vinyl label from fighting for depth on small screens.
  const camera = new THREE.PerspectiveCamera(28, 1, 100, 25000)
  const bookFrame = new THREE.Group()
  bookFrame.rotation.z = -0.035
  const book = new THREE.Group()
  bookFrame.add(book)
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

  // A continuous desktop fills both landscape and portrait viewports.
  const deskMaterial = new THREE.MeshStandardMaterial({ map: textures.wood, roughness: 0.82, metalness: 0 })
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), deskMaterial)
  textures.wood.repeat.set(14000 / 4200, 14000 / 2800)
  desk.receiveShadow = true
  scene.add(desk)

  const ambient = new THREE.HemisphereLight('#fffaf0', '#aa9e82', 1.6)
  ambient.position.set(0, 0, 3000)
  scene.add(ambient)
  const sunlight = new THREE.DirectionalLight('#fff5df', 2)
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

  // Broad, quiet daylight on the desktop.
  const lightCanvas = document.createElement('canvas')
  lightCanvas.width = 512
  lightCanvas.height = 512
  const lightContext = lightCanvas.getContext('2d')!
  const lightGradient = lightContext.createRadialGradient(185, 325, 12, 220, 260, 310)
  lightGradient.addColorStop(0, 'rgba(255,252,224,0.32)')
  lightGradient.addColorStop(0.5, 'rgba(255,252,224,0.12)')
  lightGradient.addColorStop(1, 'rgba(255,252,224,0)')
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
  let disposed = false
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

  function positionRecord() {
    if (!record) return
    // Match the prop's desk anchor at every aspect ratio, even when returning
    // from the reading camera. Keep this position fixed throughout the zoom.
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
    const anchorX = portrait ? 0.33 : 0.54
    const anchorY = portrait ? 0.18 : Math.max(0.20, (viewportWidth * 0.12 + 28) / viewportHeight)
    const table = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const project = (x: number) => {
      const point = new THREE.Vector3(x * 2 - 1, 1 - anchorY * 2, 0.5).unproject(deskCamera)
      const ray = new THREE.Ray(deskCamera.position, point.sub(deskCamera.position).normalize())
      return ray.intersectPlane(table, new THREE.Vector3())!
    }
    const center = project(anchorX)
    // Compensate the desk camera's foreshortening and skew. Keep the record
    // flat on the tabletop while presenting its face as a circle, with level type.
    const projectedCenter = center.clone().project(deskCamera)
    const projectedX = center.clone().add(new THREE.Vector3(1, 0, 0)).project(deskCamera).sub(projectedCenter)
    const projectedY = center.clone().add(new THREE.Vector3(0, 1, 0)).project(deskCamera).sub(projectedCenter)
    const a = projectedX.x * viewportWidth / 2
    const b = projectedY.x * viewportWidth / 2
    const c = projectedX.y * viewportHeight / 2
    const d = projectedY.y * viewportHeight / 2
    const determinant = a * d - b * c
    const pixelScale = viewportWidth * (portrait ? 0.17 : 0.12) / 450
    const depthScale = pixelScale / Math.hypot(a, c)
    record.group.matrixAutoUpdate = false
    record.group.matrix.set(
      pixelScale * d / determinant, -pixelScale * b / determinant, 0, center.x,
      -pixelScale * c / determinant, pixelScale * a / determinant, 0, center.y,
      0, 0, depthScale, center.z,
      0, 0, 0, 1,
    )
    record.group.matrixWorldNeedsUpdate = true
  }

  function updateDeskProps() {
    if (destination === 0 && !record) {
      record = createVinylRecord()
      scene.add(record.group)
      positionRecord()
      host.dataset.recordLoaded = 'true'
    } else if (destination > 0 && progress >= 1 && record) {
      record.dispose()
      record = null
      host.dataset.recordLoaded = 'false'
    }
  }

  function notify() {
    host.dataset.page = String(destination)
    host.dataset.busy = String(busy)
    renderer.domElement.setAttribute('aria-label', destination === 0
      ? '책상 위의 닫힌 책과 비닐 레코드. 책을 누르거나 오른쪽 방향키로 펼칠 수 있습니다.'
      : '빈 책. 좌우 책장을 누르거나 방향키로 넘길 수 있습니다.')
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
  }

  function render(time: number) {
    if (disposed) return
    const dt = Math.min(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.05)
    lastTime = time
    if (busy) {
      animationTime += dt
      const fraction = Math.min(animationTime / duration, 1)
      const eased = fraction * fraction * (3 - 2 * fraction)
      progress = THREE.MathUtils.lerp(animationStart, destination, eased)
      if (fraction === 1) {
        progress = destination
        busy = false
        settling = 60
        notify()
      }
    }
    updateBook(dt)
    renderer.render(scene, camera)
    if (busy || pages.some(page => page.needsUpdate()) || settling-- > 0) frame = requestAnimationFrame(render)
    else { frame = 0; lastTime = 0 }
  }

  function invalidate() {
    settling = 60
    if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(render)
  }

  function goTo(next: number) {
    if (busy || disposed) return
    next = THREE.MathUtils.clamp(next, 0, total)
    if (next === destination) return
    destination = next
    animationStart = progress
    animationTime = 0
    duration = next === 0 ? Math.min(2, 0.9 + progress * 0.075) : 1.05
    if (motionQuery.matches) {
      progress = destination
      updateBook(1, true)
    } else busy = true
    notify()
    invalidate()
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
    const bounds = host.getBoundingClientRect()
    viewportWidth = Math.max(bounds.width, 1)
    viewportHeight = Math.max(bounds.height, 1)
    updateCamera()
    positionRecord()
    renderer.setSize(viewportWidth, viewportHeight)
    invalidate()
  }

  function hit(event: PointerEvent) {
    const bounds = renderer.domElement.getBoundingClientRect()
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2)
    raycaster.setFromCamera(pointer, camera)
    return raycaster.intersectObjects(pages.map(page => page.mesh))[0]
  }

  let pointerStart: { x: number; y: number; id: number } | null = null
  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || busy || !hit(event)) return
    pointerStart = { x: event.clientX, y: event.clientY, id: event.pointerId }
    renderer.domElement.setPointerCapture(event.pointerId)
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!pointerStart || pointerStart.id !== event.pointerId) return
    const start = pointerStart
    pointerStart = null
    renderer.domElement.releasePointerCapture(event.pointerId)
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 25) return
    if (Math.abs(dx) > 35) { turn(dx < 0 ? 1 : -1); return }
    const intersection = hit(event)
    if (!intersection) return
    const point = bookFrame.worldToLocal(intersection.point.clone())
    turn(destination === 0 || point.x > 0 ? 1 : -1)
  }
  const onPointerCancel = () => { pointerStart = null }
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') renderer.domElement.style.cursor = !busy && hit(event) ? 'pointer' : 'default'
  }
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return
    if ((event.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]')) return
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(1) }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1) }
    else if (event.key === 'Escape') goTo(0)
  }
  const onVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; lastTime = 0 }
    else invalidate()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerCancel)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('visibilitychange', onVisibility)
  updateBook(1, true)
  notify()
  resize()

  return {
    turn,
    close: () => goTo(0),
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('visibilitychange', onVisibility)
      for (const page of pages) page.dispose()
      record?.dispose()
      for (const mesh of [spine, desk, daylight, contactShadow]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      for (const texture of [...Object.values(textures), daylightTexture, shadowTexture]) texture.dispose()
      sunlight.shadow.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
