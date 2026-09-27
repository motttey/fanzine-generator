<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawPage, paperSizes, templates } from './lib/pageRenderer'

const previewCanvas = ref(null)
const fileInput = ref(null)
const artwork = ref(null)
const artworkName = ref('画像をアップロード')
const activeTemplate = ref('calendar')
const pageNumber = ref(23)
const printedDate = ref('2022-09-25')
const imageZoom = ref(100)
const imageX = ref(0)
const imageY = ref(0)
const exportSize = ref('A5')
const exportDpi = ref(300)
const isDragging = ref(false)
const isExporting = ref(false)
let objectUrl = null
let dragStart = null

const selectedTemplate = computed(() =>
  templates.find((template) => template.id === activeTemplate.value),
)
const selectedPaper = computed(() => paperSizes[exportSize.value])

function renderPreview() {
  const canvas = previewCanvas.value
  if (!canvas) return
  const bounds = canvas.getBoundingClientRect()
  const ratio = selectedPaper.value.height / selectedPaper.value.width
  const displayWidth = Math.min(Math.max(bounds.width || 480, 320), 620)
  const displayHeight = displayWidth * ratio
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(displayWidth * dpr)
  canvas.height = Math.round(displayHeight * dpr)
  canvas.style.aspectRatio = `${selectedPaper.value.width} / ${selectedPaper.value.height}`
  const context = canvas.getContext('2d')
  context.scale(dpr, dpr)
  drawPage(context, displayWidth, displayHeight, {
    template: selectedTemplate.value,
    image: artwork.value,
    pageNumber: pageNumber.value,
    printedDate: printedDate.value,
    zoom: imageZoom.value / 100,
    offsetX: imageX.value,
    offsetY: imageY.value,
    showGuide: true,
  })
}

watch(
  [
    activeTemplate,
    pageNumber,
    printedDate,
    imageZoom,
    imageX,
    imageY,
    exportSize,
    artwork,
  ],
  () => nextTick(renderPreview),
)
onMounted(() => {
  renderPreview()
  window.addEventListener('resize', renderPreview)
})

function chooseImage() {
  fileInput.value?.click()
}
function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file || !file.type.startsWith('image/')) return
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(file)
  const image = new Image()
  image.onload = () => {
    artwork.value = image
    artworkName.value = file.name
    imageZoom.value = 100
    imageX.value = 0
    imageY.value = 0
    renderPreview()
  }
  image.src = objectUrl
}
function resetImage() {
  imageZoom.value = 100
  imageX.value = 0
  imageY.value = 0
}
function pointerDown(event) {
  if (!artwork.value) return
  isDragging.value = true
  dragStart = {
    x: event.clientX,
    y: event.clientY,
    offsetX: imageX.value,
    offsetY: imageY.value,
  }
  event.currentTarget.setPointerCapture(event.pointerId)
}
function pointerMove(event) {
  if (!isDragging.value || !dragStart) return
  const rect = event.currentTarget.getBoundingClientRect()
  imageX.value = Math.max(
    -100,
    Math.min(
      100,
      dragStart.offsetX + ((event.clientX - dragStart.x) / rect.width) * 120,
    ),
  )
  imageY.value = Math.max(
    -100,
    Math.min(
      100,
      dragStart.offsetY + ((event.clientY - dragStart.y) / rect.height) * 120,
    ),
  )
}
function pointerUp(event) {
  isDragging.value = false
  dragStart = null
  if (event.currentTarget.hasPointerCapture(event.pointerId))
    event.currentTarget.releasePointerCapture(event.pointerId)
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
    image: artwork.value,
    pageNumber: pageNumber.value,
    printedDate: printedDate.value,
    zoom: imageZoom.value / 100,
    offsetX: imageX.value,
    offsetY: imageY.value,
    showGuide: false,
  })
  const link = document.createElement('a')
  link.download = `doujin-page-${exportSize.value.toLowerCase()}-${exportDpi.value}dpi.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
  isExporting.value = false
}
onBeforeUnmount(() => {
  if (objectUrl) URL.revokeObjectURL(objectUrl)
  window.removeEventListener('resize', renderPreview)
})
</script>

<template>
  <div class="studio">
    <header class="topbar">
      <a class="brand" href="#">DOUJIN <span>PRESS</span></a>
      <div class="project-name"><i></i> untitled-copybook</div>
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
          <button class="upload-zone" @click="chooseImage">
            <span class="upload-icon">↥</span
            ><strong>{{
              artwork ? '画像を差し替える' : '画像をアップロード'
            }}</strong
            ><small>{{ artwork ? artworkName : 'JPG / PNG / WebP' }}</small>
          </button>
          <div v-if="artwork" class="image-actions">
            <span>{{ artworkName }}</span
            ><button @click="resetImage">位置を戻す</button>
          </div>
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
        <div class="preview-wrap">
          <canvas
            ref="previewCanvas"
            class="page-canvas"
            :class="{ draggable: artwork, dragging: isDragging }"
            @pointerdown="pointerDown"
            @pointermove="pointerMove"
            @pointerup="pointerUp"
            @pointercancel="pointerUp"
          ></canvas>
          <div v-if="!artwork" class="empty-state">
            <div>＋</div>
            <strong>ここに作品画像を置く</strong
            ><span>アップロード後、ドラッグで位置を調整できます</span
            ><button @click="chooseImage">画像を選ぶ</button>
          </div>
        </div>
        <p class="drag-hint">
          {{
            artwork
              ? 'プレビュー上をドラッグして、画像の見せる位置を調整できます。'
              : 'テンプレートを選んでから作品画像をアップロードしてください。'
          }}
        </p>
      </section>
    </main>
  </div>
</template>
