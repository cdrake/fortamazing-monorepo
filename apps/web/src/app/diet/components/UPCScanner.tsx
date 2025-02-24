'use client'
import { useEffect, useRef, useState } from 'react'
import Quagga from 'quagga'

type UPCScannerProps = {
  onScan: (item: { upc: string }) => void
}

export default function UPCScanner({ onScan }: UPCScannerProps) {
  const scannerRef = useRef<HTMLDivElement | null>(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClient, setIsClient] = useState(false)
  const isQuaggaRunning = useRef(false)

  useEffect(() => {
    // ✅ Mark as client-side after hydration
    setIsClient(true)
  }, [])

  useEffect(() => {
    const startScanner = async () => {
      if (!scannerRef.current) {
        setError('Scanner element not found.')
        return
      }

      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            target: scannerRef.current,
            constraints: {
              facingMode: 'environment',
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 }
            }
          },
          decoder: {
            readers: ['upc_reader', 'ean_reader']
          },
          locate: true
        },
        (err) => {
          if (err) {
            console.error('Quagga init error:', err)
            setError('Failed to initialize scanner.')
            return
          }
          Quagga.start()
          isQuaggaRunning.current = true
        }
      )

      Quagga.onDetected((data) => {
        if (data?.codeResult?.code) {
          const upc = data.codeResult.code
          console.log('Scanned UPC:', upc)
          onScan({ upc })

          // ✅ Stop after a successful scan
          if (isQuaggaRunning.current) {
            Quagga.stop()
            isQuaggaRunning.current = false
            setScanning(false)
          }
        }
      })
    }

    if (scanning && isClient) {
      startScanner()
    }

    return () => {
      if (isQuaggaRunning.current) {
        Quagga.stop()
        isQuaggaRunning.current = false
      }
    }
  }, [scanning, isClient, onScan])

  return (
    <div className="my-4">
      <h2 className="text-xl font-bold mb-2">UPC Scanner</h2>

      {!scanning ? (
        <button
          onClick={() => setScanning(true)}
          className="bg-green-500 text-white px-4 py-2 rounded"
        >
          Start Scanning
        </button>
      ) : (
        isClient && (
          <div>
            <div
              ref={scannerRef}
              style={{ width: '300px', height: '300px', border: '1px solid #ccc' }}
            />
            <button
              onClick={() => {
                if (isQuaggaRunning.current) {
                  Quagga.stop()
                  isQuaggaRunning.current = false
                }
                setScanning(false)
              }}
              className="bg-red-500 text-white px-4 py-2 mt-2 rounded"
            >
              Stop Scanning
            </button>
          </div>
        )
      )}

      {error && <p className="text-red-500 mt-2">{error}</p>}
    </div>
  )
}
