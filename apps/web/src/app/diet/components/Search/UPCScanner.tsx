'use client'
import { useEffect, useRef } from 'react'
import Quagga from 'quagga'

export type UPCScannerProps = {
  onScan: (item: { upc: string }) => void
  onClose: () => void
  onError?: (error: string) => void
}

export default function UPCScanner({ onScan, onClose, onError }: UPCScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!scannerRef.current) return

    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef.current,
          constraints: {
            facingMode: 'environment'
          }
        },
        decoder: {
          readers: ['ean_reader', 'upc_reader', 'upc_e_reader']
        }
      },
      (err) => {
        if (err) {
          console.error('Quagga init error:', err)
          onError?.('Camera initialization failed')
          return
        }
        Quagga.start()
      }
    )

    Quagga.onDetected((data) => {
      if (data.codeResult?.code) {
        onScan({ upc: data.codeResult.code })
        Quagga.stop()
        onClose()
      }
    })

    return () => {
      Quagga.stop()
    }
  }, [onScan, onClose, onError])

  return (
    <div className="relative border rounded-lg shadow-md mt-4 p-4 bg-white max-w-full">
      {/* ✅ Close Button Above Video */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => {
            Quagga.stop()
            onClose()
          }}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          Close Scanner
        </button>
      </div>

      {/* ✅ Camera Feed */}
      <div
        ref={scannerRef}
        style={{
          width: '100%',
          maxWidth: '600px', // ✅ Limit width to avoid overflow
          height: '400px',
          border: '2px solid black',
          borderRadius: '8px',
          margin: '0 auto', // ✅ Center the camera feed
          overflow: 'hidden' // ✅ Prevent overflow beyond borders
        }}
      />
    </div>
  )
}
