export type TemplateId = 'calendar' | 'gallery' | 'bleed' | 'postcard'
export type PaperSizeId = 'A5' | 'B5' | 'A4'
export type LayoutElementId = 'dateBlock' | 'footerNumber' | 'overNumber'
export type DropTarget = 'upload' | 'preview'

/** Page relative offset, in percent of the page width and height. */
export interface PositionOffset {
  x: number
  y: number
}

/** Position on a canvas in pixels. */
export interface CanvasPoint {
  x: number
  y: number
}

/** Artwork placement in units of one percent of the page width. */
export interface ArtPlacement {
  x: number
  y: number
  w: number
  h: number
}

/** Canvas rectangle in pixels. */
export interface ArtFrame {
  x: number
  y: number
  w: number
  h: number
}

/** Hit area or drawn bounds in canvas pixels. */
export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

export interface PaperSize {
  width: number
  height: number
  label: string
}

export type PaperSizes = Record<PaperSizeId, PaperSize>

export interface LayoutTemplate {
  id: TemplateId
  name: string
  backgroundColor: string
  art: ArtPlacement
  date: boolean
  number: 'bottom' | 'over'
}

export type TextOffsets = Partial<Record<LayoutElementId, PositionOffset>>
export type TextOffsetsByTemplate = Partial<Record<TemplateId, TextOffsets>>
export type ArtOffsetsByTemplate = Partial<Record<TemplateId, PositionOffset>>
export type BackgroundColors = Partial<Record<TemplateId, string>>

export interface LayoutState {
  templateId: TemplateId
  backgroundColors: BackgroundColors
  textOffsets: TextOffsetsByTemplate
  artOffsets: ArtOffsetsByTemplate
}

export interface ImageState {
  artwork: HTMLImageElement | null
  artworkName: string
  zoom: number
  offsetX: number
  offsetY: number
}

export interface PageContent {
  pageNumber: number
  printedDate: string
}

export interface ExportSettings {
  size: PaperSizeId
  dpi: 150 | 300
}

export interface GeneratorState {
  layout: LayoutState
  image: ImageState
  page: PageContent
  export: ExportSettings
}

export interface TextRegion {
  id: LayoutElementId
  bounds: Bounds
  hit: Bounds
}

export type DragStart =
  | {
      type: 'text'
      id: LayoutElementId
      x: number
      y: number
      offset: PositionOffset
      bounds: Bounds
    }
  | {
      type: 'artFrame'
      x: number
      y: number
      frame: ArtFrame
      offset: PositionOffset
    }

export interface DrawPageOptions {
  template: LayoutTemplate
  backgroundColor?: string
  image?: HTMLImageElement | null
  pageNumber: number
  printedDate: string
  zoom: number
  offsetX: number
  offsetY: number
  showGuide: boolean
  textOffsets?: TextOffsets
  activeTextId?: LayoutElementId | null
  artOffset?: PositionOffset
  activeArtFrame?: boolean
}
