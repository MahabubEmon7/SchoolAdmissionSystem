import type { SVGProps } from 'react';

const paths = {
  cap: 'M12 3 1 9l11 6 9-4.9V17h2V9L12 3Zm-7 9.2v4L12 20l7-3.8v-4L12 16l-7-3.8Z',
  check: 'M20 6 9 17l-5-5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  plus: 'M12 5v14M5 12h14',
  inbox: 'M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6l2-8Z',
  offline: 'M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4-2.4M12 20h.01M19 12.5a10 10 0 0 0-2.3-1.6M2 8.8a15 15 0 0 1 4.4-2.6M22 8.8A15 15 0 0 0 10.7 5',
  id: 'M4 5h16v14H4zM8 10h.01M8 14h.01M12 10h5M12 14h5',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: { name: IconName } & SVGProps<SVGSVGElement>) {
  const filled = name === 'cap';
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}
