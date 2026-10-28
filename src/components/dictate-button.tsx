import { Mic } from 'lucide-react'
import { useRef, useState } from 'react'
import { ToggleButton } from 'react-aria-components'
import { useOnline } from '#/lib/online'

// The DOM typings know the events but not the recognizer itself, which Chrome and Safari still
// ship under a prefix.
type Recognizer = {
  lang: string
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}
type RecognizerClass = new () => Recognizer

function recognizerClass(): RecognizerClass | undefined {
  const scope = window as unknown as Record<string, RecognizerClass | undefined>
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition
}

const errorMessages: Record<string, string> = {
  'not-allowed': 'The browser did not allow the microphone',
  'service-not-allowed': 'The browser did not allow the microphone',
  network: 'Dictation needs a connection',
  'no-speech': 'Did not hear anything',
}

/**
 * Dictation into the capture field (Web Speech API). Shown only where the browser has it; the
 * browser sends the audio to its own speech service, so it is off while offline.
 */
export function DictateButton({
  onText,
  onError,
}: {
  /** A finished phrase, to add to the field. */
  onText: (text: string) => void
  onError: (message: string) => void
}) {
  const [Recognizer] = useState(recognizerClass)
  const [listening, setListening] = useState(false)
  const recognizer = useRef<Recognizer | null>(null)
  const online = useOnline()

  if (!Recognizer) return null

  function toggle(on: boolean) {
    if (!on || !Recognizer) {
      recognizer.current?.stop()
      return
    }
    const next = new Recognizer()
    next.lang = navigator.language
    next.interimResults = false
    next.onresult = (event) => {
      const phrase = [...event.results]
        .map((result) => result[0].transcript)
        .join(' ')
        .trim()
      if (phrase) onText(phrase)
    }
    next.onerror = (event) => {
      if (event.error !== 'aborted')
        onError(errorMessages[event.error] ?? 'Dictation stopped')
    }
    next.onend = () => {
      recognizer.current = null
      setListening(false)
    }
    recognizer.current = next
    setListening(true)
    next.start()
  }

  return (
    <ToggleButton
      isSelected={listening}
      onChange={toggle}
      isDisabled={!online}
      aria-label={listening ? 'Stop dictation' : 'Dictate'}
      className="grid size-11 shrink-0 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-foreground data-disabled:opacity-50 data-focus-visible:outline-2 data-selected:text-primary motion-reduce:transition-none"
    >
      <Mic aria-hidden className="size-4" />
    </ToggleButton>
  )
}
