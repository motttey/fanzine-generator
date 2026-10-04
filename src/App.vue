<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  drawPage,
  getArtFrame,
  paperSizes,
  templates,
} from './lib/pageRenderer'

const previewCanvas = ref(null)
const fileInput = ref(null)
const artwork = ref(null)
const artworkName = ref('画像をアップロード')
const activeTemplate = ref('calendar')
const backgroundColors = ref({})
const pageNumber = ref(23)
const printedDate = ref('2022-09-25')
const imageZoom = ref(100)
const imageX = ref(0)
const imageY = ref(0)
const exportSize = ref('A5')
const exportDpi = ref(300)
const isDragging = ref(false)
const draggingText = ref(null)
const hoveredText = ref(null)
const hoveredArtFrame = ref(false)
const textOffsets = ref({})
const artOffsets = ref({})
const isExporting = ref(false)
const dropTarget = ref(null)
const imageError = ref('')
let objectUrl = null
let dragStart = null
let textRegions = []
let previewWidth = 0
let previewHeight = 0

const selectedTemplate = computed(() =>
  templates.find((template) => template.id === activeTemplate.value),
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
function onFileChange(event) {
  const file = event.target.files?.[0]
  loadImage(file)
  event.target.value = ''
}
function loadImage(file) {
  if (!file) return
  imageError.value = ''
  if (file.type && !file.type.startsWith('image/')) {
    imageError.value = '画像ファイルを選択してください。'
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
function preventFileNavigation(event) {
  if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
  event.preventDefault()
  if (event.type === 'dragover') event.dataTransfer.dropEffect = 'none'
  else dropTarget.value = null
}
function onDragOver(event, target) {
  if (!Array.from(event.dataTransfer?.types ?? []).includes('Files')) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'copy'
  dropTarget.value = target
}
function onDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget))
    dropTarget.value = null
}
function onDrop(event) {
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
  const next = { ...artOffsets.value }
  delete next[activeTemplate.value]
  artOffsets.value = next
}
function resetTextPositions() {
  const next = { ...textOffsets.value }
  delete next[activeTemplate.value]
  textOffsets.value = next
}
function pointerPosition(event) {
  const rect = event.currentTarget.getBoundingClientRect()
  if (!rect.width || !rect.height) return null
  return {
    x: ((event.clientX - rect.left) * previewWidth) / rect.width,
    y: ((event.clientY - rect.top) * previewHeight) / rect.height,
  }
}
function textAtPointer(position) {
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
function artFrameAtPointer(position) {
  if (!position || (!artwork.value && selectedTemplate.value.id === 'bleed'))
    return null
  const frame = getArtFrame(
    selectedTemplate.value,
    previewWidth,
    previewHeight,
    currentArtOffset.value,
  )
  return position.x >= frame.x &&
    position.x <= frame.x + frame.w &&
    position.y >= frame.y &&
    position.y <= frame.y + frame.h
    ? frame
    : null
}
function pointerDown(event) {
  const position = pointerPosition(event)
  const textRegion = textAtPointer(position)
  const frame = textRegion ? null : artFrameAtPointer(position)
  if (!textRegion && !frame) return
  isDragging.value = true
  if (textRegion) {
    draggingText.value = textRegion.id
    hoveredText.value = textRegion.id
    hoveredArtFrame.value = false
    dragStart = {
      type: 'text',
      id: textRegion.id,
      x: event.clientX,
      y: event.clientY,
      offset: currentTextOffsets.value[textRegion.id] ?? { x: 0, y: 0 },
      bounds: textRegion.bounds,
    }
  } else {
    hoveredText.value = null
    hoveredArtFrame.value = true
    dragStart = {
      type: 'artFrame',
      x: event.clientX,
      y: event.clientY,
      frame,
      offset: currentArtOffset.value,
    }
  }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function pointerMove(event) {
  if (!dragStart) {
    const position = pointerPosition(event)
    hoveredText.value = textAtPointer(position)?.id ?? null
    hoveredArtFrame.value = !hoveredText.value && !!artFrameAtPointer(position)
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
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
function pointerUp(event) {
  isDragging.value = false
  draggingText.value = null
  dragStart = null
  const position = pointerPosition(event)
  hoveredText.value = textAtPointer(position)?.id ?? null
  hoveredArtFrame.value = !hoveredText.value && !!artFrameAtPointer(position)
  if (event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId)
}
function pointerLeave() {
  hoveredText.value = null
  hoveredArtFrame.value = false
}
function canvasSizeForExport() {
  const pixelsPerMm = exportDpi.value / 25.4
  return {
    width: Math.round(selectedPaper.value.width * pixelsPerMm),
    height: Math.round(selectedPaper.value.height * pixelsPerMm),
  }
}
async function exportPng() {
  isExporting.value = true
  await new Promise((resolve) => requestAnimationFrame(resolve))
  const size = canvasSizeForExport()
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  drawPage(canvas.getContext('2d'), size.width, size.height, {
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
  })
  const link = document.createElement('a')
  link.download = `doujin-page-${exportSize.value.toLowerCase()}-${exportDpi.value}dpi.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
  isExporting.value = false
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
    <main class="workspace">
      <aside class="sidebar">
        <section class="panel section-upload">
          <div class="section-label"><span>01</span> 画像</div>
          <input
            ref="fileInput"
            class="sr-only"
            type="file"
            accept="image/*"
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
            表示枠の位置を戻す
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
              ? '画像の表示枠と文字をドラッグして配置できます。画像内の位置は左のスライダーで調整できます。'
              : '表示枠と文字をドラッグして配置できます。作品画像もアップロードできます。'
          }}
        </p>
      </section>
    </main>
  </div>
</template>
