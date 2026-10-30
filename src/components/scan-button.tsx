import { ScanBarcode } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
} from 'react-aria-components'
import { toast } from 'sonner'
import { useOnline } from '#/lib/online'
import { lookupProduct } from '#/lib/products'
import { m } from '#/paraglide/messages.js'

// Not in the DOM typings yet: Chrome on Android, ChromeOS and macOS have it.
type Detector = {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>
}
type DetectorClass = new (options: { formats: string[] }) => Detector

const detectorClass = () =>
  (window as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector

const productFormats = ['ean_13', 'ean_8', 'upc_a', 'upc_e']

/**
 * Scans a product's barcode with the camera (Barcode Detection API) and hands over its name from
 * Open Food Facts. Shown only where the browser can detect barcodes; off while offline, since the
 * name comes from the network.
 */
export function ScanButton({
  onProduct,
}: {
  onProduct: (name: string) => void
}) {
  const [Detector] = useState(detectorClass)
  const online = useOnline()

  if (!Detector) return null

  async function found(code: string) {
    const name = await lookupProduct(code)
    if (name) onProduct(name)
    else toast(m.scan_unknown({ code }))
  }

  return (
    <DialogTrigger>
      <Button
        aria-label={m.scan()}
        isDisabled={!online}
        className="grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground data-disabled:opacity-50 data-focus-visible:outline-2 motion-reduce:transition-none"
      >
        <ScanBarcode aria-hidden className="size-4" />
      </Button>
      <ModalOverlay
        isDismissable
        className="fixed inset-0 z-50 grid place-items-end bg-foreground/20 p-4 sm:place-items-center"
      >
        <Modal className="w-full max-w-sm rounded-md bg-background p-6 shadow-lg">
          <Dialog className="flex flex-col gap-3 outline-none">
            {({ close }) => (
              <>
                <Heading slot="title" className="font-serif text-2xl">
                  {m.scan()}
                </Heading>
                <Camera
                  Detector={Detector}
                  onCode={(code) => {
                    close()
                    void found(code)
                  }}
                  onError={(message) => {
                    close()
                    toast(message)
                  }}
                />
                <Button
                  onPress={close}
                  className="self-end rounded-sm py-2 text-sm text-muted-foreground hover:text-foreground data-focus-visible:outline-2"
                >
                  {m.cancel()}
                </Button>
              </>
            )}
          </Dialog>
        </Modal>
      </ModalOverlay>
    </DialogTrigger>
  )
}

function Camera({
  Detector,
  onCode,
  onError,
}: {
  Detector: DetectorClass
  onCode: (code: string) => void
  onError: (message: string) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  // The latest callbacks, so the camera is not restarted when the parent renders.
  const handlers = useRef({ onCode, onError })
  handlers.current = { onCode, onError }

  useEffect(() => {
    let stream: MediaStream | undefined
    let timer: number | undefined
    let stopped = false
    const detector = new Detector({ formats: productFormats })

    async function look() {
      const element = video.current
      if (stopped || !element) return
      try {
        const [code] = await detector.detect(element)
        if (code && !stopped) {
          stopped = true
          handlers.current.onCode(code.rawValue)
          return
        }
      } catch {
        // The video has no frame yet; try again.
      }
      timer = window.setTimeout(look, 250)
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (media) => {
        stream = media
        if (stopped || !video.current) return
        video.current.srcObject = media
        await video.current.play()
        void look()
      })
      .catch(() => {
        if (!stopped) handlers.current.onError(m.scan_no_camera())
      })

    return () => {
      stopped = true
      window.clearTimeout(timer)
      for (const track of stream?.getTracks() ?? []) track.stop()
    }
  }, [Detector])

  return (
    <video
      ref={video}
      muted
      playsInline
      aria-label={m.scan_camera_view()}
      className="aspect-[4/3] w-full rounded-sm bg-foreground/10 object-cover"
    />
  )
}
