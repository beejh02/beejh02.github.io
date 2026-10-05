import * as THREE from 'three'
import { createBook } from './Book'
import { createBookController } from './BookController'
import { createRecordCapture } from './RecordCapture'
import { createStudyTextures } from './materials'
import { createDeskClearance } from './DeskClearance'
import type { ClearanceMode } from './DeskClearance'
import { createDeskInteractions } from './DeskInteractions'
import { createDeskProps } from './DeskProps'
import { createDeskLayout } from './DeskLayout'

import type { BookState, StudyScene } from './types'
export type { BookState, RecordVisual, StudyScene } from './types'

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
  renderer.domElement.setAttribute('aria-label', 'Who Am I 표지의 책. 책장을 잡아 좌우로 끌거나, 클릭 또는 방향키로 넘길 수 있습니다.')
  renderer.domElement.setAttribute('role', 'img')
  host.appendChild(renderer.domElement)

  const textures = createStudyTextures()
  // The tabletop is thousands of units away; a tighter near plane keeps thin
  // surfaces such as the vinyl label from fighting for depth on small screens.
  const camera = new THREE.PerspectiveCamera(28, 1, 100, 25000)
  const studyBook = createBook(textures)
  const { frame: bookFrame, height, total, pages } = studyBook
  scene.add(bookFrame)

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

  let recordInTransit = false
  let disposed = false
  let active = true
  let backgroundOnly = false
  let frame = 0
  let lastTime = 0
  let settling = 60
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  let viewportWidth = 1
  let viewportHeight = 1
  let cameraProgress = -1
  let shadowBoundsDirty = true
  const interactions = createDeskInteractions({
    host, scene, camera, canvas: renderer.domElement, recordEntry, motionQuery,
    getViewport: () => ({ width: viewportWidth, height: viewportHeight }),
    getState: () => ({ active, backgroundOnly, destination: controller.destination, progress: controller.progress, busy: controller.busy, recordInTransit }),
    invalidate,
  })
  interactions.setObject('book', {
    liftFrame: studyBook.liftFrame, meshes: studyBook.meshes, updateEveryFrame: true,
    setHover: studyBook.setHover,
  })
  const layout = createDeskLayout({ camera, bookFrame, bookHeight: height, getViewport: () => ({ width: viewportWidth, height: viewportHeight }) })
  const props = createDeskProps({
    host, scene, interactions, beforeChange: resetDeskClearance, invalidate,
    shadowChanged: () => { shadowBoundsDirty = true },
    positionRecord: layout.positionRecord, positionPencil: layout.positionPencil,
    positionEraser: layout.positionEraser, positionPolaroid: layout.positionPolaroid,
  })
  const clearance = createDeskClearance({
    getObjects: () => ({ book: bookFrame, record: props.record?.group, polaroid: props.polaroid?.group, pencil: props.pencil?.group, eraser: props.eraser?.group }),
    getCamera: layout.createDeskCamera,
  })

  const controller = createBookController({
    book: studyBook, scene, camera, canvas: renderer.domElement, interactions, motionQuery,
    getViewportWidth: () => viewportWidth,
    getState: () => ({ active, backgroundOnly, disposed, recordInTransit }),
    updateBook, notify, invalidate, onSettled: () => { settling = 60 },
  })
  const recordCapture = createRecordCapture({
    scene, camera, renderer, ambient, sunlight,
    getRecord: () => props.record,
    getState: () => ({ busy: controller.busy, destination: controller.destination }),
    getViewport: () => ({ width: viewportWidth, height: viewportHeight }),
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
    for (const prop of [props.eraser?.body, props.polaroid?.body]) {
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

  function notify() {
    const { destination, busy } = controller
    host.dataset.page = String(destination)
    host.dataset.busy = String(busy)
    interactions.syncHighlights()
    renderer.domElement.setAttribute('aria-label', destination === 0
      ? '책상 위의 Who Am I 표지의 닫힌 책, 비닐 레코드, 연필, 지우개와 폴라로이드 즉석카메라. 표지를 잡아 왼쪽으로 끌거나, 클릭 또는 오른쪽 방향키로 펼칠 수 있습니다.'
      : '빈 책. 책장을 잡아 좌우로 끌거나, 클릭 또는 방향키로 넘길 수 있습니다.')
    onChange({ page: destination, total, busy })
  }

  function updateBook(dt: number, immediate = false) {
    const { progress, destination } = controller
    const open = Math.min(progress, 1)
    studyBook.update(progress, dt, immediate)
    if (cameraProgress !== open) {
      cameraProgress = open
      layout.updateCamera(cameraProgress)
    }
    props.update(progress < 1 || destination === 0)
    if (!recordInTransit) setDeskClearance(open, 'book')
  }

  function render(time: number) {
    if (disposed || !active || document.hidden) { frame = 0; lastTime = 0; return }
    const dt = Math.min(lastTime ? (time - lastTime) / 1000 : 1 / 60, 0.05)
    lastTime = time
    controller.update(dt)
    updateBook(dt, controller.dragging && motionQuery.matches)
    const hoverMoving = interactions.updateHover(dt)
    if (shadowBoundsDirty) fitPropShadows()
    interactions.updateOutlines()
    interactions.updateLiftOutlines()
    renderer.render(scene, camera)
    if (controller.busy || hoverMoving || pages.some(page => page.needsUpdate()) || settling-- > 0) frame = requestAnimationFrame(render)
    else { frame = 0; lastTime = 0 }
  }

  function invalidate() {
    settling = 60
    if (!frame && active && !disposed && !document.hidden) frame = requestAnimationFrame(render)
  }

  function resize() {
    resetDeskClearance()
    const bounds = host.getBoundingClientRect()
    viewportWidth = Math.max(bounds.width, 1)
    viewportHeight = Math.max(bounds.height, 1)
    interactions.invalidateOutlines()
    layout.updateCamera(cameraProgress)
    layout.positionRecord(props.record)
    layout.positionPencil(props.pencil)
    layout.positionEraser(props.eraser)
    layout.positionPolaroid(props.polaroid)
    shadowBoundsDirty = true
    renderer.setSize(viewportWidth, viewportHeight)
    if (backgroundOnly && !active) renderBackground()
    else invalidate()
  }

  // Keep the existing canvas as a static backdrop. A resize needs one fresh
  // frame, but project scrolling never starts the desk animation loop.
  function renderBackground() {
    if (!disposed && !document.hidden) renderer.render(scene, camera)
  }

  const onVisibility = () => {
    if (document.hidden) { controller.cancel(); cancelAnimationFrame(frame); frame = 0; lastTime = 0 }
    else if (backgroundOnly && !active) renderBackground()
    else invalidate()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(host)
  document.addEventListener('visibilitychange', onVisibility)
  updateBook(1, true)
  notify()
  resize()

  return {
    turn: controller.turn,
    close: controller.close,
    captureRecord: recordCapture.captureRecord,
    getRecordVisual: recordCapture.getRecordVisual,
    setActive(next) {
      host.dataset.active = String(next)
      if (active === next) return
      active = next
      if (active) invalidate()
      else {
        cancelAnimationFrame(frame)
        frame = 0
        lastTime = 0
        interactions.clearHover()
        interactions.syncHighlights()
      }
    },
    setBackgroundOnly(next) {
      host.dataset.backgroundOnly = String(next)
      if (backgroundOnly === next) return
      backgroundOnly = next
      bookFrame.visible = !next
      props.setVisibility(next, recordInTransit)
      interactions.setBackgroundOnly(next)
      interactions.syncHighlights()
      if (next) renderBackground()
      else invalidate()
    },
    showRecord(visible) {
      recordInTransit = !visible
      props.setVisibility(backgroundOnly, recordInTransit)
      interactions.showRecord(visible)
      if (visible) setDepartureProgress(0)
      interactions.syncHighlights()
      invalidate()
    },
    setDepartureProgress,
    dispose() {
      disposed = true
      recordCapture.dispose()
      clearance.reset()
      controller.dispose()
      cancelAnimationFrame(frame)
      observer.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      studyBook.dispose()
      props.dispose()
      for (const mesh of [desk, daylight]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      for (const texture of [...Object.values(textures), daylightTexture]) texture.dispose()
      sunlight.shadow.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      interactions.dispose()
    },
  }
}
