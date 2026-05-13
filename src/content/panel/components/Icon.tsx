import type { JSX } from 'react';

const ICONS = {
  collapse: (
    <path
      d="M4 8h12M14 4l-4 4 4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  expand: (
    <path
      d="M16 8H4M6 4l4 4-4 4"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  close: (
    <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  ),
  copy: (
    <>
      <rect
        x="5"
        y="5"
        width="9"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path
        d="M3 11V3a1 1 0 011-1h7"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  external: (
    <>
      <path
        d="M9 3h4v4M13 3l-7 7M11 9v3a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1h3"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  search: (
    <>
      <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  question: (
    <>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M6.5 6.2c0-.9.7-1.7 1.7-1.7s1.7.7 1.7 1.7c0 .9-1.7 1.5-1.7 2.4M8 11h.01"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </>
  ),
  settings: (
    <>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.4 1.4M11.55 11.55l1.4 1.4M3.05 12.95l1.4-1.4M11.55 4.45l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  eye: (
    <>
      <path
        d="M1.5 8C3 4.5 5.5 3 8 3s5 1.5 6.5 5C13 11.5 10.5 13 8 13s-5-1.5-6.5-5z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </>
  ),
  eyeOff: (
    <>
      <path
        d="M1.5 8C3 4.5 5.5 3 8 3c1 0 2 .25 2.9.7M14.5 8C13.6 10 12.3 11.4 10.7 12.2M5.5 4.7C3.6 5.7 2.3 7 1.5 8"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  edit: (
    <>
      <path
        d="M2 14h12M3 11l8-8 2 2-8 8H3v-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
    </>
  ),
  share: (
    <>
      <circle cx="12" cy="3.5" r="1.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="4" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <circle cx="12" cy="12.5" r="1.8" stroke="currentColor" strokeWidth="1.3" fill="none" />
      <path
        d="M5.6 7l4.8-2.7M5.6 9l4.8 2.7"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinecap="round"
      />
    </>
  ),
  camera: (
    <>
      <path
        d="M2 5h2.5l1-1.5h5l1 1.5H14v8H2V5z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </>
  ),
  note: (
    <>
      <path
        d="M3 2h7l3 3v9H3V2z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <path d="M10 2v3h3" stroke="currentColor" strokeWidth="1.4" fill="none" />
    </>
  ),
  check: (
    <path
      d="M3 8.5l3 3 7-7"
      stroke="currentColor"
      strokeWidth="1.8"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 16 }: { name: IconName; size?: number }): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}
