import * as THREE from 'three'
import Page from './Page'
import type { StudyTextures } from './materials'

// Book assembly and progress mapping adapted from The Book of Qbject (MIT).
// See THIRD_PARTY_NOTICES.md. Textures remain owned by the scene.
export function createBook(textures: Pick<StudyTextures, 'paper' | 'cloth' | 'frontCover'>) {
  const bookFrame = new THREE.Group()
  bookFrame.rotation.z = -0.035
  const book = new THREE.Group()
  const bookLiftFrame = new THREE.Group()
  const bookPerspective = new THREE.Group()
  bookPerspective.matrixAutoUpdate = false
  bookLiftFrame.add(book)
  bookPerspective.add(bookLiftFrame)
  bookFrame.add(bookPerspective)

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
      front: i === 0 ? textures.frontCover : textures.paper,
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

  const yAxis = new THREE.Vector3(0, 1, 0)
  const pivot = new THREE.Vector3(spineWidth / 2, 0, coverThickness)

  return {
    frame: bookFrame, liftFrame: bookLiftFrame, meshes: bookMeshes, pages,
    width, height, coverThickness, total,
    setHover(amount: number) {
      bookLiftFrame.position.z = amount * 55
      bookHoverMaterials.forEach(material => { material.emissiveIntensity = amount * 0.025 })
      contactShadow.position.set(15 + amount * 18, -20 - amount * 22, 0.2)
      contactShadow.scale.x *= 1 + amount * 0.08
      contactShadow.scale.y = 1 + amount * 0.08
      contactShadow.material.opacity = 1 - amount * 0.35
    },
    update(progress: number, dt: number, immediate = false) {
      const open = Math.min(progress, 1)
      // Slightly offset raised surfaces to reveal just a sliver of the left edge.
      // Keep the base on the desk and release the correction as the book opens.
      bookPerspective.matrix.set(
        1, 0, 0.10 * (1 - open), 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1,
      )
      bookPerspective.matrixWorldNeedsUpdate = true
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
    },
    dispose() {
      for (const page of pages) page.dispose()
      for (const mesh of [spine, contactShadow]) {
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      shadowTexture.dispose()
    },
  }
}

export type BookModel = ReturnType<typeof createBook>
