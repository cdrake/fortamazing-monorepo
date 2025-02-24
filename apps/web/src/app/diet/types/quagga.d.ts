declare module 'quagga' {
  export type QuaggaConfig = {
    inputStream: {
      name?: string
      type: 'LiveStream' | 'ImageStream'
      target: HTMLElement | string
      constraints?: MediaTrackConstraints
    }
    locator?: {
      patchSize?: 'x-small' | 'small' | 'medium' | 'large' | 'x-large'
      halfSample?: boolean
    }
    decoder: {
      readers: string[]
    }
    locate?: boolean
    numOfWorkers?: number
    frequency?: number
  }

  export interface QuaggaResult {
    codeResult: {
      code: string
      format: string
    }
    box: Array<{ x: number; y: number }>
    boxes: Array<Array<{ x: number; y: number }>>
    line: Array<{ x: number; y: number }>
  }

  export interface ProcessedResult {
    box?: Array<{ x: number; y: number }>
    boxes?: Array<Array<{ x: number; y: number }>>
    codeResult?: {
      code: string
      format: string
    }
    line?: Array<{ x: number; y: number }> // ✅ Added line property
  }

  export interface QuaggaCanvas {
    ctx: {
      overlay: CanvasRenderingContext2D
    }
    dom: {
      overlay: HTMLCanvasElement
    }
  }

  export interface QuaggaImageDebug {
    drawPath: (
      path: Array<{ x: number; y: number }>,
      offset: { x: number | string; y: number | string },
      ctx: CanvasRenderingContext2D,
      options: { color: string; lineWidth: number }
    ) => void
  }

  const Quagga: {
    init: (config: QuaggaConfig, callback: (err: Error | null) => void) => void
    start: () => void
    stop: () => void
    onDetected: (callback: (data: QuaggaResult) => void) => void
    onProcessed: (callback: (result: ProcessedResult | null) => void) => void
    offDetected: (callback: (data: QuaggaResult) => void) => void
    canvas: QuaggaCanvas
    ImageDebug: QuaggaImageDebug
  }

  export default Quagga
}
