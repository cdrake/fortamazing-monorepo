'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

type UPCScannerProps = {
  onScan: (result: { upc: string }) => void
  onClose: () => void
  onError?: (error: string) => void
}

export default function UPCScanner({ onScan, onClose, onError }: UPCScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanner, setScanner] = useState<BrowserMultiFormatReader | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!videoRef.current) return

    const codeReader = new BrowserMultiFormatReader()
    setScanner(codeReader)

    BrowserMultiFormatReader
      .listVideoInputDevices()
      .then((videoDevices) => {
        if (videoDevices.length === 0) {
          setError('No camera found')
          onError?.('No camera found')
          return
        }

        // Select the first available camera (rear camera preferred)
        const selectedDeviceId = videoDevices.find((device) =>
          device.label.toLowerCase().includes('back')
        )?.deviceId || videoDevices[0].deviceId

        return codeReader.decodeFromVideoDevice(selectedDeviceId, videoRef.current!, (result, err) => {
          if (result) {
            onScan({ upc: result.getText() })
            codeReader.decodeFromVideoDevice(undefined, videoRef.current!, () => {}) // ✅ Stops camera
            onClose()
          }
          if (err) {
            console.warn('Scanning error:', err)
          }
        })
      })
      .catch((err) => {
        setError(err.message)
        onError?.(err.message)
      })

    return () => {
      codeReader.decodeFromVideoDevice(undefined, undefined, () => {})
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
          scanner?.decodeFromVideoDevice(undefined, videoRef.current!, () => {})
          onClose()
        }}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full"
      >
        Close Scanner
      </button>
    </div>
  )
}
