import { useId } from 'react'

const check = 'M11.9 17.3 14.6 20 25.4 8.2'

/**
 * The mark: a broad-nib "O" with a check that cuts through it on the way out. Drawn in
 * `currentColor`, so it follows the text color it sits in (the same paths as `public/favicon.svg`).
 */
export function Logo({ className }: { className?: string }) {
  // A mask id per instance: two logos on one page must not share one.
  const mask = useId()
  return (
    // 1em until the stylesheet sizes it, so it never shows huge on an unstyled page.
    <svg
      viewBox="5 6 23 22"
      width="1em"
      height="1em"
      aria-hidden
      className={className}
    >
      <mask id={mask}>
        <rect x="0" y="0" width="32" height="32" fill="#fff" />
        <path
          d={check}
          fill="none"
          stroke="#000"
          strokeWidth="5.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </mask>
      <g mask={`url(#${mask})`}>
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M15 7.2a9.8 9.8 0 1 1 0 19.6a9.8 9.8 0 1 1 0-19.6Z M15 9.1c-3.6 0-6.4 3.5-6.4 7.9s2.8 7.9 6.4 7.9 6.4-3.5 6.4-7.9-2.8-7.9-6.4-7.9Z"
          transform="rotate(-28 15 17)"
        />
      </g>
      <path
        d={check}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
