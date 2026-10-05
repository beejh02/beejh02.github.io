import * as THREE from 'three'
import { createVinylRecord } from './Record'
import type { VinylRecord } from './Record'
import { createPencil } from './Pencil'
import type { Pencil } from './Pencil'
import { createEraser } from './Eraser'
import type { Eraser } from './Eraser'
import { createPolaroid } from './Polaroid'
import type { Polaroid } from './Polaroid'
import type { createDeskInteractions, DeskObjectName } from './DeskInteractions'

type DeskProp = VinylRecord | Pencil | Eraser | Polaroid
type PropName = Exclude<DeskObjectName, 'book'>

interface DeskPropsOptions {
  host: HTMLElement
  scene: THREE.Scene
  interactions: ReturnType<typeof createDeskInteractions>
  beforeChange: () => void
  shadowChanged: () => void
  invalidate: () => void
  positionRecord: (record: VinylRecord) => void
  positionPencil: (pencil: Pencil) => void
  positionEraser: (eraser: Eraser) => void
  positionPolaroid: (polaroid: Polaroid) => void
}

/** Owns prop lifetimes. Model factories retain ownership of their GPU resources. */
export function createDeskProps(options: DeskPropsOptions) {
  const { host, scene, interactions } = options

  function slot<T extends DeskProp>(name: PropName, create: () => T, position: (prop: T) => void, affectsShadow = false) {
    let object: T | null = null
    function dispose() {
      if (!object) return
      object.dispose()
      object = null
      interactions.setObject(name, null)
      host.dataset[`${name}Loaded`] = 'false'
    }
    return {
      get object() { return object },
      update(required: boolean) {
        if (required && !object) {
          if (affectsShadow) options.shadowChanged()
          object = create()
          interactions.setObject(name, {
            liftFrame: 'surface' in object ? object.surface : object.body,
            meshes: 'meshes' in object ? object.meshes : [object.body],
            outlineMeshes: 'printMeshes' in object ? [object.printMeshes[0]] : undefined,
            setHover: object.setHover,
          })
          scene.add(object.group)
          position(object)
          host.dataset[`${name}Loaded`] = 'true'
        } else if (!required) dispose()
      },
      dispose,
    }
  }

  const registry = {
    eraser: slot('eraser', createEraser, options.positionEraser, true),
    polaroid: slot('polaroid', () => createPolaroid(options.invalidate), options.positionPolaroid, true),
    pencil: slot('pencil', createPencil, options.positionPencil),
    record: slot('record', createVinylRecord, options.positionRecord),
  }

  return {
    get record() { return registry.record.object },
    get pencil() { return registry.pencil.object },
    get eraser() { return registry.eraser.object },
    get polaroid() { return registry.polaroid.object },
    update(required: boolean) {
      if (required !== !!registry.record.object) options.beforeChange()
      for (const item of Object.values(registry)) item.update(required)
    },
    setVisibility(backgroundOnly: boolean, recordInTransit: boolean) {
      for (const [name, item] of Object.entries(registry)) {
        if (item.object) item.object.group.visible = !backgroundOnly && (name !== 'record' || !recordInTransit)
      }
    },
    dispose() { for (const item of Object.values(registry)) item.dispose() },
  }
}
