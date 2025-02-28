import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { NotFoundException } from '@zxing/library'

type UPCScannerProps = {
  onScan: (result: { upc: string }) => void
  onClose: () => void
  onError?: (error: string) => void
}

export default function UPCScanner({ onScan, onClose, onError }: UPCScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [, setScanner] = useState<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)
  const controlsRef = useRef<{ stop: () => void } | null>(null) // ✅ Use ref instead of state

  useEffect(() => {
    if (!videoRef.current) return

    const codeReader = new BrowserMultiFormatReader()
    setScanner(codeReader)

    BrowserMultiFormatReader.listVideoInputDevices()
      .then((videoDevices) => {
        if (videoDevices.length === 0) {
          setError('No camera found')
          onError?.('No camera found')
          return
        }

        const selectedDeviceId =
          videoDevices.find((device) => device.label.toLowerCase().includes('back'))
            ?.deviceId || videoDevices[0].deviceId

        return codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current!, (result, err, controls) => {
          controlsRef.current = controls // ✅ Store controls in ref

          if (result) {
            onScan({ upc: result.getText() })
            controls.stop() // ✅ Stop scanning after successful scan
            onClose()
          }
          if (err && !(err instanceof NotFoundException)) {
            console.warn("Scanning error:", err); // Log only meaningful errors
          }
        })
      })
      .catch((err) => {
        setError(err.message)
        onError?.(err.message)
      })

    return () => {
      controlsRef.current?.stop() // ✅ Stop scanner on unmount
    }
  }, [onScan, onClose, onError])

  return (
    <div>
      {error ? (
        <p className="text-red-500">{error}</p>
      ) : (
        <video ref={videoRef} style={{ width: '100%', height: '300px', border: '2px solid black' }} autoPlay playsInline />
      )}
      <button
        onClick={() => {
          controlsRef.current?.stop() // ✅ Properly stop scanner
          onClose()
        }}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full"
      >
        Close Scanner
      </button>
    </div>
  )
}
