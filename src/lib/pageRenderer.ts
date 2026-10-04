import type {
  ArtFrame,
  Bounds,
  CanvasTextAlign,
  DrawPageOptions,
  LayoutTemplate,
  PaperSizes,
  PositionOffset,
  TextRegion,
} from '../@types/generator'

export const paperSizes: PaperSizes = {
  A5: { width: 148, height: 210, label: '148 × 210 mm' },
  B5: { width: 182, height: 257, label: '182 × 257 mm' },
  A4: { width: 210, height: 297, label: '210 × 297 mm' },
}

export const templates: LayoutTemplate[] = [
  {
    id: 'calendar',
    name: '作品カレンダー',
    backgroundColor: '#fffefa',
    art: { x: 10.5, y: 20, w: 79, h: 57 },
    date: true,
    number: 'bottom',
  },
  {
    id: 'gallery',
    name: '余白ギャラリー',
    backgroundColor: '#fffefa',
    art: { x: 13, y: 12, w: 74, h: 68 },
    date: false,
    number: 'bottom',
  },
  {
    id: 'bleed',
    name: 'フルブリード',
    backgroundColor: '#ffffff',
    art: { x: 0, y: 0, w: 100, h: 100 },
    date: false,
    number: 'over',
  },
  {
    id: 'postcard',
    name: 'ポストカード',
    backgroundColor: '#fffefa',
    art: { x: 10, y: 16, w: 80, h: 56 },
    date: true,
    number: 'bottom',
  },
]

export function getArtFrame(
  template: LayoutTemplate,
  width: number,
  height: number,
  offset: Partial<PositionOffset> = {},
): ArtFrame {
  const u = width / 100
  return {
    x: template.art.x * u + ((offset.x ?? 0) * width) / 100,
    y: template.art.y * u + ((offset.y ?? 0) * height) / 100,
    w: template.art.w * u,
    h: template.art.h * u,
  }
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  initial: number,
): number {
  let size = initial
  ctx.font = `700 ${size}px 'DM Mono', monospace`
  while (ctx.measureText(text).width > maxWidth && size > 5) {
    size -= 0.5
    ctx.font = `700 ${size}px 'DM Mono', monospace`
  }
  return size
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement | null | undefined,
  frame: ArtFrame,
  zoom: number,
  offsetX: number,
  offsetY: number,
): void {
  if (!image) {
    const gradient = ctx.createLinearGradient(
      frame.x,
      frame.y,
      frame.x + frame.w,
      frame.y + frame.h,
    )
    gradient.addColorStop(0, '#e7e3d9')
    gradient.addColorStop(1, '#d6d1c4')
    ctx.fillStyle = gradient
    ctx.fillRect(frame.x, frame.y, frame.w, frame.h)
    ctx.strokeStyle = '#b6b0a2'
    ctx.lineWidth = Math.max(1, frame.w / 260)
    ctx.setLineDash([frame.w / 40, frame.w / 40])
    ctx.strokeRect(frame.x + 1, frame.y + 1, frame.w - 2, frame.h - 2)
    ctx.setLineDash([])
    return
  }
  const imageRatio = image.naturalWidth / image.naturalHeight
  const frameRatio = frame.w / frame.h
  let width: number, height: number
  if (imageRatio > frameRatio) {
    height = frame.h * zoom
    width = height * imageRatio
  } else {
    width = frame.w * zoom
    height = width / imageRatio
  }
  const xRange = Math.max(0, width - frame.w) / 2
  const yRange = Math.max(0, height - frame.h) / 2
  const x = frame.x + (frame.w - width) / 2 - xRange * (offsetX / 100)
  const y = frame.y + (frame.h - height) / 2 - yRange * (offsetY / 100)
  ctx.save()
  ctx.beginPath()
  ctx.rect(frame.x, frame.y, frame.w, frame.h)
  ctx.clip()
  ctx.drawImage(image, x, y, width, height)
  ctx.restore()
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  font: string,
  align: CanvasTextAlign,
  color: string,
  offset: PositionOffset | undefined,
  page: { width: number; height: number },
): { bounds: Bounds; hit: Bounds } {
  ctx.font = font
  ctx.textAlign = align
  ctx.fillStyle = color
  const shiftedX = x + ((offset?.x ?? 0) * page.width) / 100
  const shiftedY = y + ((offset?.y ?? 0) * page.height) / 100
  ctx.fillText(text, shiftedX, shiftedY)

  const metrics = ctx.measureText(text)
  const fontSize = Number.parseFloat(font.match(/[\d.]+px/)?.[0] ?? '') || 12
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2
  const left =
    align === 'center'
      ? shiftedX - metrics.width / 2
      : align === 'right'
        ? shiftedX - metrics.width
        : shiftedX
  const bounds = {
    x: left,
    y: shiftedY - ascent,
    width: metrics.width,
    height: ascent + descent,
  }
  const padding = Math.max(5, fontSize * 0.65)
  return {
    bounds,
    hit: {
      x: left - padding,
      y: bounds.y - padding,
      width: Math.max(metrics.width, 8) + padding * 2,
      height: bounds.height + padding * 2,
    },
  }
}

export function drawPage(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: DrawPageOptions,
): TextRegion[] {
  const {
    template,
    backgroundColor = template.backgroundColor,
    image,
    pageNumber,
    printedDate,
    zoom,
    offsetX,
    offsetY,
    showGuide,
    textOffsets = {},
    activeTextId,
    artOffset,
    activeArtFrame,
  } = options
  const u = width / 100
  const red = Number.parseInt(backgroundColor.slice(1, 3), 16)
  const green = Number.parseInt(backgroundColor.slice(3, 5), 16)
  const blue = Number.parseInt(backgroundColor.slice(5, 7), 16)
  const backgroundBrightness = red * 0.299 + green * 0.587 + blue * 0.114
  const lightInk = backgroundBrightness < 150
  const frame = getArtFrame(template, width, height, artOffset)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, width, height)
  if (image || template.id !== 'bleed') {
    drawImageCover(ctx, image, frame, zoom, offsetX, offsetY)
  }
  const textRegions: TextRegion[] = []
  const page = { width, height }

  if (template.id !== 'bleed') {
    ctx.strokeStyle = lightInk ? '#fffefa' : '#1e1e1b'
    ctx.lineWidth = Math.max(1, u * 0.13)
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h)
  } else if (image) {
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0.6, 'transparent')
    shade.addColorStop(1, 'rgba(0,0,0,.55)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  }

  if (template.date) {
    const x = width * 0.75
    const y = height * 0.815
    const dateOffset = textOffsets.dateBlock
    const lineX = x + ((dateOffset?.x ?? 0) * width) / 100
    const lineY = y + ((dateOffset?.y ?? 0) * height) / 100
    ctx.strokeStyle = lightInk ? '#fffefa' : '#33332f'
    ctx.lineWidth = Math.max(1, u * 0.15)
    ctx.beginPath()
    ctx.moveTo(lineX, lineY - u * 5.5)
    ctx.lineTo(lineX, lineY + u * 4.5)
    ctx.stroke()
    const numberSize = fitText(
      ctx,
      String(pageNumber).padStart(2, '0'),
      width * 0.18,
      u * 3.1,
    )
    const dateNumberRegion = drawText(
      ctx,
      String(pageNumber).padStart(2, '0'),
      x + u * 1.8,
      y - u * 1.8,
      `700 ${numberSize}px 'DM Mono', monospace`,
      'left',
      lightInk ? '#fffefa' : '#292926',
      dateOffset,
      page,
    )
    const dateRegion = drawText(
      ctx,
      printedDate || 'YYYY-MM-DD',
      x + u * 1.8,
      y + u * 2,
      `400 ${u * 1.65}px 'DM Mono', monospace`,
      'left',
      lightInk ? '#fffefa' : '#292926',
      dateOffset,
      page,
    )
    const dateRegions = [dateNumberRegion, dateRegion]
    const linePadding = Math.max(5, u * 2)
    const hitRects = [
      ...dateRegions.map((region) => region.hit),
      {
        x: lineX - linePadding,
        y: lineY - u * 5.5 - linePadding,
        width: linePadding * 2,
        height: u * 10 + linePadding * 2,
      },
    ]
    const bounds = [
      ...dateRegions.map((region) => region.bounds),
      {
        x: lineX - ctx.lineWidth / 2,
        y: lineY - u * 5.5,
        width: ctx.lineWidth,
        height: u * 10,
      },
    ]
    const enclosingRect = (rects: Bounds[]): Bounds => {
      const left = Math.min(...rects.map((rect) => rect.x))
      const top = Math.min(...rects.map((rect) => rect.y))
      const right = Math.max(...rects.map((rect) => rect.x + rect.width))
      const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
      return { x: left, y: top, width: right - left, height: bottom - top }
    }
    textRegions.push({
      id: 'dateBlock',
      bounds: enclosingRect(bounds),
      hit: enclosingRect(hitRects),
    })
  }

  if (template.number === 'bottom') {
    textRegions.push({
      id: 'footerNumber',
      ...drawText(
        ctx,
        String(pageNumber),
        width / 2,
        height - u * 4.2,
        `700 ${u * 2.1}px 'DM Mono', monospace`,
        'center',
        lightInk ? '#fffefa' : '#20201e',
        textOffsets.footerNumber,
        page,
      ),
    })
  }
  if (template.number === 'over') {
    textRegions.push({
      id: 'overNumber',
      ...drawText(
        ctx,
        String(pageNumber).padStart(2, '0'),
        width - u * 5,
        height - u * 4.5,
        `700 ${u * 2.1}px 'DM Mono', monospace`,
        'right',
        image || lightInk ? '#fffefa' : '#20201e',
        textOffsets.overNumber,
        page,
      ),
    })
  }
  if (showGuide && activeTextId) {
    const region = textRegions.find((item) => item.id === activeTextId)
    if (region) {
      ctx.save()
      ctx.strokeStyle = '#f15132'
      ctx.lineWidth = Math.max(1, u * 0.2)
      ctx.setLineDash([u * 0.6, u * 0.45])
      ctx.strokeRect(
        region.hit.x,
        region.hit.y,
        region.hit.width,
        region.hit.height,
      )
      ctx.restore()
    }
  }
  if (showGuide && (image || activeArtFrame)) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 89, 51, .85)'
    ctx.setLineDash([u * 1, u * 0.7])
    ctx.lineWidth = Math.max(1, u * 0.15)
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h)
    ctx.restore()
  }
  return textRegions
}
