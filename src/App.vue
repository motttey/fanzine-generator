<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type {
  ArtFrame,
  ArtOffsetsByTemplate,
  ArtSizesByTemplate,
  BackgroundColors,
  CanvasPoint,
  DragStart,
  DropTarget,
  LayoutElementId,
  PaperSizeId,
  TemplateId,
  TextOffsetsByTemplate,
  TextRegion,
} from './@types/generator'
import {
  drawPage,
  getArtFrame,
  getArtResizeHandle,
  paperSizes,
  templates,
} from './lib/pageRenderer'

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const artwork = ref<HTMLImageElement | null>(null)
const artworkName = ref('画像をアップロード')
const activeTemplate = ref<TemplateId>('calendar')
const backgroundColors = ref<BackgroundColors>({})
const pageNumber = ref(23)
const printedDate = ref('2022-09-25')
const imageZoom = ref(100)
const imageX = ref(0)
const imageY = ref(0)
const exportSize = ref<PaperSizeId>('A5')
const exportDpi = ref(300)
const isDragging = ref(false)
const draggingText = ref<LayoutElementId | null>(null)
const hoveredText = ref<LayoutElementId | null>(null)
const hoveredArtFrame = ref(false)
const hoveredResizeHandle = ref(false)
const textOffsets = ref<TextOffsetsByTemplate>({})
const artOffsets = ref<ArtOffsetsByTemplate>({})
const artSizes = ref<ArtSizesByTemplate>({})
const isExporting = ref(false)
const dropTarget = ref<DropTarget | null>(null)
const imageError = ref('')
const exportError = ref('')
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageBytes = 30 * 1024 * 1024
const maxImagePixels = 30_000_000
let objectUrl: string | null = null
let dragStart: DragStart | null = null
let textRegions: TextRegion[] = []
let previewWidth = 0
let previewHeight = 0

const selectedTemplate = computed(
  () =>
    templates.find((template) => template.id === activeTemplate.value) ??
    templates[0],
)
const selectedBackgroundColor = computed({
  get: () =>
    backgroundColors.value[activeTemplate.value] ??
    selectedTemplate.value.backgroundColor,
  set: (color) => {
    backgroundColors.value = {
      ...backgroundColors.value,
      [activeTemplate.value]: color,
    }
  },
})
const selectedPaper = computed(() => paperSizes[exportSize.value])
const currentTextOffsets = computed(
  () => textOffsets.value[activeTemplate.value] ?? {},
)
const currentArtOffset = computed(
  () => artOffsets.value[activeTemplate.value] ?? { x: 0, y: 0 },
)
const currentArtSize = computed(() => artSizes.value[activeTemplate.value])

function renderPreview() {
  const canvas = previewCanvas.value
  if (!canvas) return
  const bounds = canvas.getBoundingClientRect()
  const ratio = selectedPaper.value.height / selectedPaper.value.width
  const displayWidth = bounds.width || 480
  const displayHeight = displayWidth * ratio
  previewWidth = displayWidth
  previewHeight = displayHeight
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(displayWidth * dpr)
  canvas.height = Math.round(displayHeight * dpr)
  canvas.style.aspectRatio = `${selectedPaper.value.width} / ${selectedPaper.value.height}`
  const context = canvas.getContext('2d')
  if (!context) return
  context.scale(dpr, dpr)
  textRegions = drawPage(context, displayWidth, displayHeight, {
    template: selectedTemplate.value,
    backgroundColor: selectedBackgroundColor.value,
    image: artwork.value,
    pageNumber: pageNumber.value,
    printedDate: printedDate.value,
    zoom: imageZoom.value / 100,
    offsetX: imageX.value,
    offsetY: imageY.value,
    showGuide: true,
    textOffsets: currentTextOffsets.value,
    activeTextId: draggingText.value || hoveredText.value,
    artOffset: currentArtOffset.value,
    artSize: currentArtSize.value,
    activeArtFrame: hoveredArtFrame.value,
  })
}

watch(
  [
    activeTemplate,
    backgroundColors,
    pageNumber,
    printedDate,
    imageZoom,
    imageX,
    imageY,
    exportSize,
    artwork,
    textOffsets,
    artOffsets,
    artSizes,
    draggingText,
    hoveredText,
    hoveredArtFrame,
  ],
  () => nextTick(renderPreview),
)
onMounted(() => {
  renderPreview()
  window.addEventListener('resize', renderPreview)
  window.addEventListener('dragover', preventFileNavigation)
  window.addEventListener('drop', preventFileNavigation)
})

function chooseImage() {
  fileInput.value?.click()
}
function onFileChange(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  loadImage(file)
  input.value = ''
}
function loadImage(file: File | undefined | null) {
  if (!file) return
  imageError.value = ''
  if (
    !supportedImageTypes.has(file.type) &&
    !(file.type === '' && /\.(jpe?g|png|webp)$/i.test(file.name))
  ) {
    imageError.value = 'JPG・PNG・WebP の画像を選択してください。'
    return
  }
  if (file.size === 0 || file.size > maxImageBytes) {
    imageError.value = '画像は 30 MB 以下のファイルを選択してください。'
    return
  }
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  const url = URL.createObjectURL(file)
  objectUrl = url
  const image = new Image()
  image.onload = () => {
    if (objectUrl !== url) return
    URL.revokeObjectURL(url)
    objectUrl = null
    if (
      !image.naturalWidth ||
      !image.naturalHeight ||
      image.naturalWidth * image.naturalHeight > maxImagePixels
    ) {
      imageError.value = '画像の解像度は 3000 万画素以下にしてください。'
      return
    }
    artwork.value = image
    artworkName.value = file.name
    imageError.value = ''
    resetImage()
    renderPreview()
  }
  image.onerror = () => {
    if (objectUrl !== url) return
    URL.revokeObjectURL(url)
    objectUrl = null
    imageError.value =
      '画像を読み込めませんでした。JPG・PNG・WebPなどの画像を選択してください。'
  }
  image.src = url
}
function preventFileNavigation(event: DragEvent) {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !Array.from(dataTransfer.types).includes('Files')) return
  event.preventDefault()
  if (event.type === 'dragover') dataTransfer.dropEffect = 'none'
  else dropTarget.value = null
}
function onDragOver(event: DragEvent, target: DropTarget) {
  const dataTransfer = event.dataTransfer
  if (!dataTransfer || !Array.from(dataTransfer.types).includes('Files')) return
  event.preventDefault()
  event.stopPropagation()
  dataTransfer.dropEffect = 'copy'
  dropTarget.value = target
}
function onDragLeave(event: DragEvent) {
  const element = event.currentTarget as HTMLElement
  if (!element.contains(event.relatedTarget as Node | null))
    dropTarget.value = null
}
function onDrop(event: DragEvent) {
  event.preventDefault()
  event.stopPropagation()
  dropTarget.value = null
  const files = event.dataTransfer?.files
  if (!files?.length) return
  if (files.length > 1) {
    imageError.value = '画像は1枚ずつドロップしてください。'
    return
  }
  loadImage(files[0])
}
function resetImage() {
  imageZoom.value = 100
  imageX.value = 0
  imageY.value = 0
}
function resetArtFrame() {
  const nextOffsets = { ...artOffsets.value }
  const nextSizes = { ...artSizes.value }
  delete nextOffsets[activeTemplate.value]
  delete nextSizes[activeTemplate.value]
  artOffsets.value = nextOffsets
  artSizes.value = nextSizes
}
function resetTextPositions() {
  const next = { ...textOffsets.value }
  delete next[activeTemplate.value]
  textOffsets.value = next
}
function pointerPosition(event: PointerEvent): CanvasPoint | null {
  const rect = (
    event.currentTarget as HTMLCanvasElement
  ).getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    x: ((event.clientX - rect.left) * previewWidth) / rect.width,
    y: ((event.clientY - rect.top) * previewHeight) / rect.height,
  }
}
function textAtPointer(position: CanvasPoint | null): TextRegion | null {
  if (!position) return null
  return (
    [...textRegions]
      .reverse()
      .find(
        ({ hit }) =>
          position.x >= hit.x &&
          position.x <= hit.x + hit.width &&
          position.y >= hit.y &&
          position.y <= hit.y + hit.height,
      ) ?? null
  )
}
function currentArtFrame(): ArtFrame {
  return getArtFrame(
    selectedTemplate.value,
    previewWidth,
    previewHeight,
    currentArtOffset.value,
    currentArtSize.value,
  )
}
function artFrameAtPointer(position: CanvasPoint | null): ArtFrame | null {
  if (!position) return null
  const frame = currentArtFrame()
  return position.x >= frame.x &&
    position.x <= frame.x + frame.w &&
    position.y >= frame.y &&
    position.y <= frame.y + frame.h
    ? frame
    : null
}
function resizeHandleAtPointer(position: CanvasPoint | null): ArtFrame | null {
  if (!position) return null
  const frame = currentArtFrame()
  const handle = getArtResizeHandle(frame, previewWidth)
  const hitRadius = Math.max(14, handle.size)
  return Math.abs(position.x - handle.x) <= hitRadius &&
    Math.abs(position.y - handle.y) <= hitRadius
    ? frame
    : null
}
function pointerDown(event: PointerEvent) {
  const position = pointerPosition(event)
  const resizeFrame = resizeHandleAtPointer(position)
  const textRegion = resizeFrame ? null : textAtPointer(position)
  const frame = textRegion || resizeFrame ? null : artFrameAtPointer(position)
  if (!textRegion && !frame && !resizeFrame) return
  isDragging.value = true
  if (resizeFrame) {
    hoveredText.value = null
    hoveredArtFrame.value = true
    hoveredResizeHandle.value = true
    dragStart = {
      type: 'artFrameResize',
      x: event.clientX,
      y: event.clientY,
      frame: resizeFrame,
    }
  } else if (textRegion) {
    draggingText.value = textRegion.id
    hoveredText.value = textRegion.id
    hoveredArtFrame.value = false
    hoveredResizeHandle.value = false
    dragStart = {
      type: 'text',
      id: textRegion.id,
      x: event.clientX,
      y: event.clientY,
      offset: currentTextOffsets.value[textRegion.id] ?? { x: 0, y: 0 },
      bounds: textRegion.bounds,
    }
  } else if (frame) {
    hoveredText.value = null
    hoveredArtFrame.value = true
    hoveredResizeHandle.value = false
    dragStart = {
      type: 'artFrame',
      x: event.clientX,
      y: event.clientY,
      frame,
      offset: currentArtOffset.value,
    }
  }
  const canvas = event.currentTarget as HTMLCanvasElement
  canvas.setPointerCapture(event.pointerId)
}
function pointerMove(event: PointerEvent) {
  if (!dragStart) {
    const position = pointerPosition(event)
    hoveredResizeHandle.value = !!resizeHandleAtPointer(position)
    hoveredText.value = hoveredResizeHandle.value
      ? null
      : (textAtPointer(position)?.id ?? null)
    hoveredArtFrame.value = !hoveredText.value && !!artFrameAtPointer(position)
    return
  }
  const rect = (
    event.currentTarget as HTMLCanvasElement
  ).getBoundingClientRect()
  if (dragStart.type === 'text') {
    const dx = ((event.clientX - dragStart.x) / rect.width) * previewWidth
    const dy = ((event.clientY - dragStart.y) / rect.height) * previewHeight
    const { bounds, offset, id } = dragStart
    const pageWidth = previewWidth
    const pageHeight = previewHeight
    const limitedX = Math.max(
      -bounds.x,
      Math.min(pageWidth - bounds.x - bounds.width, dx),
    )
    const limitedY = Math.max(
      -bounds.y,
      Math.min(pageHeight - bounds.y - bounds.height, dy),
    )
    textOffsets.value = {
      ...textOffsets.value,
      [activeTemplate.value]: {
        ...currentTextOffsets.value,
        [id]: {
          x: offset.x + (limitedX / pageWidth) * 100,
          y: offset.y + (limitedY / pageHeight) * 100,
        },
      },
    }
    return
  }
  if (dragStart.type === 'artFrameResize') {
    const dx = ((event.clientX - dragStart.x) / rect.width) * previewWidth
    const dy = ((event.clientY - dragStart.y) / rect.height) * previewHeight
    const { frame } = dragStart
    const maxWidth = previewWidth - frame.x
    const maxHeight = previewHeight - frame.y
    const width = Math.max(
      Math.min(previewWidth * 0.08, maxWidth),
      Math.min(maxWidth, frame.w + dx),
    )
    const height = Math.max(
      Math.min(previewHeight * 0.08, maxHeight),
      Math.min(maxHeight, frame.h + dy),
    )
    artSizes.value = {
      ...artSizes.value,
      [activeTemplate.value]: {
        w: (width / previewWidth) * 100,
        h: (height / previewHeight) * 100,
      },
    }
    return
  }
  const dx = ((event.clientX - dragStart.x) / rect.width) * previewWidth
  const dy = ((event.clientY - dragStart.y) / rect.height) * previewHeight
  const { frame, offset } = dragStart
  const limitedX = Math.max(
    -frame.x,
    Math.min(previewWidth - frame.x - frame.w, dx),
  )
  const limitedY = Math.max(
    -frame.y,
    Math.min(previewHeight - frame.y - frame.h, dy),
  )
  artOffsets.value = {
    ...artOffsets.value,
    [activeTemplate.value]: {
      x: offset.x + (limitedX / previewWidth) * 100,
      y: offset.y + (limitedY / previewHeight) * 100,
    },
  }
}
function pointerUp(event: PointerEvent) {
  isDragging.value = false
  draggingText.value = null
  dragStart = null
  const position = pointerPosition(event)
  hoveredResizeHandle.value = !!resizeHandleAtPointer(position)
  hoveredText.value = hoveredResizeHandle.value
    ? null
    : (textAtPointer(position)?.id ?? null)
  hoveredArtFrame.value = !hoveredText.value && !!artFrameAtPointer(position)
  const canvas = event.currentTarget as HTMLCanvasElement
  if (canvas.hasPointerCapture(event.pointerId))
    canvas.releasePointerCapture(event.pointerId)
}
function pointerLeave() {
  hoveredText.value = null
  hoveredArtFrame.value = false
  hoveredResizeHandle.value = false
}
function canvasSizeForExport(paperSize: PaperSizeId, dpi: number) {
  const pixelsPerMm = dpi / 25.4
  const paper = paperSizes[paperSize]
  return {
    width: Math.round(paper.width * pixelsPerMm),
    height: Math.round(paper.height * pixelsPerMm),
  }
}
async function exportPng() {
  if (isExporting.value) return
  isExporting.value = true
  exportError.value = ''
  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await document.fonts.ready
    const paperSize = exportSize.value
    const dpi = exportDpi.value
    const size = canvasSizeForExport(paperSize, dpi)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    drawPage(context, size.width, size.height, {
      template: selectedTemplate.value,
      backgroundColor: selectedBackgroundColor.value,
      image: artwork.value,
      pageNumber: pageNumber.value,
      printedDate: printedDate.value,
      zoom: imageZoom.value / 100,
      offsetX: imageX.value,
      offsetY: imageY.value,
      showGuide: false,
      textOffsets: currentTextOffsets.value,
      artOffset: currentArtOffset.value,
      artSize: currentArtSize.value,
    })
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) resolve(result)
        else reject(new Error('PNG encoding failed'))
      }, 'image/png')
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `doujin-page-${paperSize.toLowerCase()}-${dpi}dpi.png`
    link.href = url
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch {
    exportError.value =
      'PNG を書き出せませんでした。画像を小さくするか、解像度を 150 DPI にして再試行してください。'
  } finally {
    isExporting.value = false
  }
}
onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = null
  window.removeEventListener('resize', renderPreview)
  window.removeEventListener('dragover', preventFileNavigation)
  window.removeEventListener('drop', preventFileNavigation)
})
</script>

<template>
  <div class="studio">
    <header class="topbar">
      <a class="brand" href="#">同人誌レイアウト<span>ジェネレーター</span></a>
      <button class="export-button" :disabled="isExporting" @click="exportPng">
        {{ isExporting ? '書き出し中...' : 'PNGを書き出す' }} <span>↗</span>
      </button>
    </header>
    <p v-if="exportError" class="export-error" role="alert">
      {{ exportError }}
    </p>
    <main class="workspace">
      <aside class="sidebar">
        <section class="panel section-upload">
          <div class="section-label"><span>01</span> 画像</div>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            @change="onFileChange"
          />
          <button
            class="upload-zone"
            :class="{ 'drop-active': dropTarget === 'upload' }"
            @click="chooseImage"
            @dragover="onDragOver($event, 'upload')"
            @dragleave="onDragLeave"
            @drop="onDrop"
          >
            <span class="upload-icon">↥</span
            ><strong>{{
              artwork ? '画像を差し替える' : '画像をアップロード'
            }}</strong
            ><small>{{ artwork ? artworkName : 'JPG / PNG / WebP' }}</small>
            <small>画像をドラッグ＆ドロップ、またはクリック</small>
          </button>
          <div v-if="artwork" class="image-actions">
            <span>{{ artworkName }}</span
            ><button @click="resetImage">位置を戻す</button>
          </div>
          <p v-if="imageError" class="image-error" role="alert">
            {{ imageError }}
          </p>
          <p class="privacy-note">画像は端末内で処理され、送信されません。</p>
        </section>
        <section class="panel">
          <div class="section-label"><span>02</span> レイアウト</div>
          <div class="template-grid">
            <button
              v-for="template in templates"
              :key="template.id"
              class="template-card"
              :class="{ selected: activeTemplate === template.id }"
              @click="activeTemplate = template.id"
            >
              <span class="mini-page" :class="`mini-${template.id}`"
                ><i></i><b></b><em></em></span
              ><strong>{{ template.name }}</strong>
            </button>
          </div>
          <label class="background-color-control">
            <span>背景色</span>
            <input v-model="selectedBackgroundColor" type="color" />
            <output>{{ selectedBackgroundColor.toUpperCase() }}</output>
          </label>
          <button class="reset-text" @click="resetArtFrame">
            表示枠の位置・サイズを戻す
          </button>
        </section>
        <section class="panel controls">
          <div class="section-label"><span>03</span> 調整</div>
          <label
            >拡大・縮小 <output>{{ imageZoom }}%</output
            ><input v-model.number="imageZoom" type="range" min="100" max="180"
          /></label>
          <label
            >横位置 <output>{{ Math.round(imageX) }}</output
            ><input v-model.number="imageX" type="range" min="-100" max="100"
          /></label>
          <label
            >縦位置 <output>{{ Math.round(imageY) }}</output
            ><input v-model.number="imageY" type="range" min="-100" max="100"
          /></label>
        </section>
        <section class="panel text-fields">
          <div class="section-label"><span>04</span> 文字</div>
          <label
            >ページ番号<input
              v-model.number="pageNumber"
              type="number"
              min="1"
              max="999"
          /></label>
          <label
            >日付<input
              v-model="printedDate"
              type="text"
              placeholder="YYYY-MM-DD"
          /></label>
          <button class="reset-text" @click="resetTextPositions">
            文字の位置を戻す
          </button>
        </section>
        <section class="panel export-settings">
          <div class="section-label"><span>05</span> 書き出し設定</div>
          <div class="select-row">
            <label
              >仕上がり<select v-model="exportSize">
                <option
                  v-for="(size, key) in paperSizes"
                  :key="key"
                  :value="key"
                >
                  {{ key }}（{{ size.label }}）
                </option>
              </select></label
            ><label
              >DPI<select v-model.number="exportDpi">
                <option :value="150">150</option>
                <option :value="300">300</option>
              </select></label
            >
          </div>
          <p>
            {{ selectedPaper.width }} × {{ selectedPaper.height }} mm ・ PNG
          </p>
        </section>
      </aside>
      <section class="canvas-area">
        <div class="canvas-meta">
          <span>PAGE {{ String(pageNumber).padStart(2, '0') }}</span
          ><span>{{ selectedTemplate.name }}</span>
        </div>
        <div
          class="preview-wrap"
          :class="{ 'drop-active': dropTarget === 'preview' }"
          @dragover="onDragOver($event, 'preview')"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <canvas
            ref="previewCanvas"
            class="page-canvas"
            :class="{
              draggable: hoveredArtFrame || hoveredText,
              dragging: isDragging,
              resizing: hoveredResizeHandle,
            }"
            @pointerdown="pointerDown"
            @pointermove="pointerMove"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
            @pointerleave="pointerLeave"
          ></canvas>
          <div v-if="!artwork" class="empty-state">
            <div>＋</div>
            <strong>ここに作品画像を置く</strong
            ><span>画像をドラッグ＆ドロップして読み込めます</span
            ><button @click="chooseImage">画像を選ぶ</button>
          </div>
        </div>
        <p class="drag-hint">
          {{
            artwork
              ? '表示枠の右下をドラッグするとサイズ変更、枠内をドラッグすると移動できます。画像内の位置は左のスライダーで調整できます。'
              : '表示枠の右下をドラッグするとサイズ変更、枠内と文字はドラッグで移動できます。作品画像もアップロードできます。'
          }}
        </p>
      </section>
    </main>
  </div>
</template>
