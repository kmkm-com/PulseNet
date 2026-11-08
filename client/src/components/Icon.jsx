// Small stroke icons, drawn on a 24px grid. Decorative by default.
const paths = {
  feed: <><path d="M4 5h16M4 12h16M4 19h10" /></>,
  friends: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.8c2 .7 3.2 2.5 3.5 5.2" /></>,
  messages: <><path d="M4 5.5h16v10H9l-5 4z" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></>,
  user: <><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  send: <><path d="M4 12 20 4l-5 16-3.5-6.5z" /><path d="M11.5 13.5 20 4" /></>,
  back: <><path d="M15 5l-7 7 7 7" /></>,
  logout: <><path d="M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10" /></>,
  close: <><path d="M6 6l12 12M18 6 6 18" /></>,
};

export default function Icon({ name, size = 22, title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      {paths[name]}
    </svg>
  );
}
