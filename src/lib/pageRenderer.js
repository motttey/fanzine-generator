export const paperSizes = {
  A5: { width: 148, height: 210, label: '148 × 210 mm' },
  B5: { width: 182, height: 257, label: '182 × 257 mm' },
  A4: { width: 210, height: 297, label: '210 × 297 mm' },
}

export const templates = [
  { id: 'calendar', name: '作品カレンダー', art: { x: 10.5, y: 20, w: 79, h: 57 }, date: true, number: 'bottom' },
  { id: 'gallery', name: '余白ギャラリー', art: { x: 13, y: 12, w: 74, h: 68 }, date: false, number: 'bottom' },
  { id: 'bleed', name: 'フルブリード', art: { x: 0, y: 0, w: 100, h: 100 }, date: false, number: 'over' },
  { id: 'postcard', name: 'ポストカード', art: { x: 10, y: 16, w: 80, h: 56 }, date: true, number: 'bottom' },
]

function fitText(ctx, text, maxWidth, initial) {
  let size = initial
  ctx.font = `700 ${size}px 'DM Mono', monospace`
  while (ctx.measureText(text).width > maxWidth && size > 5) {
    size -= 0.5
    ctx.font = `700 ${size}px 'DM Mono', monospace`
  }
  return size
}

function drawImageCover(ctx, image, frame, zoom, offsetX, offsetY) {
  if (!image) {
    const gradient = ctx.createLinearGradient(frame.x, frame.y, frame.x + frame.w, frame.y + frame.h)
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
  let width, height
  if (imageRatio > frameRatio) { height = frame.h * zoom; width = height * imageRatio } else { width = frame.w * zoom; height = width / imageRatio }
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

export function drawPage(ctx, width, height, options) {
  const { template, image, pageNumber, printedDate, zoom, offsetX, offsetY, showGuide } = options
  const u = width / 100
  const frame = { x: template.art.x * u, y: template.art.y * u, w: template.art.w * u, h: template.art.h * u }
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = template.id === 'bleed' ? '#171716' : '#fffefa'
  ctx.fillRect(0, 0, width, height)
  drawImageCover(ctx, image, frame, zoom, offsetX, offsetY)

  if (template.id !== 'bleed') {
    ctx.strokeStyle = '#1e1e1b'
    ctx.lineWidth = Math.max(1, u * 0.13)
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h)
  } else {
    const shade = ctx.createLinearGradient(0, 0, 0, height)
    shade.addColorStop(0.6, 'transparent')
    shade.addColorStop(1, 'rgba(0,0,0,.55)')
    ctx.fillStyle = shade
    ctx.fillRect(0, 0, width, height)
  }

  if (template.date) {
    const x = width * 0.75
    const y = height * 0.815
    ctx.strokeStyle = '#33332f'
    ctx.lineWidth = Math.max(1, u * 0.15)
    ctx.beginPath(); ctx.moveTo(x, y - u * 5.5); ctx.lineTo(x, y + u * 4.5); ctx.stroke()
    ctx.fillStyle = '#292926'
    ctx.textAlign = 'left'
    const numberSize = fitText(ctx, String(pageNumber).padStart(2, '0'), width * 0.18, u * 3.1)
    ctx.font = `700 ${numberSize}px 'DM Mono', monospace`
    ctx.fillText(String(pageNumber).padStart(2, '0'), x + u * 1.8, y - u * 1.8)
    ctx.font = `400 ${u * 1.65}px 'DM Mono', monospace`
    ctx.fillText(printedDate || 'YYYY-MM-DD', x + u * 1.8, y + u * 2)
  }

  if (template.number === 'bottom') {
    ctx.fillStyle = '#20201e'
    ctx.textAlign = 'center'
    ctx.font = `700 ${u * 2.1}px 'DM Mono', monospace`
    ctx.fillText(pageNumber, width / 2, height - u * 4.2)
  }
  if (template.number === 'over') {
    ctx.fillStyle = '#fffefa'
    ctx.textAlign = 'right'
    ctx.font = `700 ${u * 2.1}px 'DM Mono', monospace`
    ctx.fillText(String(pageNumber).padStart(2, '0'), width - u * 5, height - u * 4.5)
  }
  if (showGuide && image) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255, 89, 51, .85)'
    ctx.setLineDash([u * 1, u * .7])
    ctx.lineWidth = Math.max(1, u * .15)
    ctx.strokeRect(frame.x, frame.y, frame.w, frame.h)
    ctx.restore()
  }
}
