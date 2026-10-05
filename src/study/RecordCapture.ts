import * as THREE from 'three'
import { projectedContour } from './ScreenContours'
import type { Viewport } from './ScreenContours'
import type { VinylRecord } from './Record'
import type { RecordVisual } from './types'

interface RecordCaptureOptions {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  ambient: THREE.HemisphereLight
  sunlight: THREE.DirectionalLight
  getRecord: () => VinylRecord | null
  getState: () => { busy: boolean; destination: number }
  getViewport: () => Viewport
}

/** Reuses one record snapshot while measuring its current desk position. */
export function createRecordCapture({ scene, camera, renderer, ambient, sunlight, getRecord, getState, getViewport }: RecordCaptureOptions) {
  let recordSnapshot: string | null = null

  function recordVisual(src: string): RecordVisual | null {
    const record = getRecord()
    const { busy, destination } = getState()
    if (!record || busy || destination !== 0) return null
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const rim = projectedContour([record.body], camera, getViewport())
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
    captureRecord() {
      const record = getRecord()
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
    dispose() { recordSnapshot = null },
  }
}
