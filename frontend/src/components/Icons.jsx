// Inline stroke SVG icons — 24px grid, stroke-width 2, currentColor. Swap for an icon lib later; keep icon+label pairing.
const S = ({ children, size = 24, sw = 2, fill = 'none', ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    {children}
  </svg>
);

export const ChevronLeft = (p) => <S {...p}><path d="M15 18l-6-6 6-6" /></S>;
export const ChevronRight = (p) => <S {...p}><path d="M9 18l6-6-6-6" /></S>;
export const Heart = (p) => <S {...p}><path d="M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" /></S>;
export const HeartPlus = (p) => <S {...p}><path d="M20.8 5.6a5.5 5.5 0 00-7.8 0L12 6.6l-1-1a5.5 5.5 0 10-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z" /><path d="M12 9.5v5M9.5 12h5" /></S>;
export const Bell = (p) => <S {...p}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></S>;
export const Mic = (p) => <S {...p}><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0M12 17v4" /></S>;
export const Stop = (p) => <S {...p} fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2" /></S>;
export const Check = (p) => <S {...p}><path d="M20 6L9 17l-5-5" /></S>;
export const Shield = (p) => <S {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /></S>;
export const ShieldCheck = (p) => <S {...p}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></S>;
export const Fingerprint = (p) => <S {...p} sw={1.7}><path d="M12 11a2 2 0 012 2c0 3-1 5-1 5" /><path d="M8.5 8.5A5 5 0 0117 12c0 2.5-.5 4-.5 4" /><path d="M5.5 12a6.5 6.5 0 0113 0c0 1-.2 2-.2 2" /><path d="M9 13c0 2-1 4-1 4" /></S>;
export const Gear = (p) => <S {...p} sw={1.8}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.6 1.6 0 00-2.7.6 1.6 1.6 0 00-1.1 1.5V22a2 2 0 11-4 0v-.1a1.6 1.6 0 00-1-1.5 1.6 1.6 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.6 1.6 0 00.3-1.8 1.6 1.6 0 00-1.5-1H2a2 2 0 110-4h.1a1.6 1.6 0 001.5-1 1.6 1.6 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.6 1.6 0 001.8.3H8a1.6 1.6 0 001-1.5V2a2 2 0 114 0v.1a1.6 1.6 0 001 1.5 1.6 1.6 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.6 1.6 0 00-.3 1.8V8a1.6 1.6 0 001.5 1H22a2 2 0 110 4h-.1a1.6 1.6 0 00-1.5 1z" /></S>;
export const FileText = (p) => <S {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></S>;
export const Card = (p) => <S {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></S>;
export const Flag = (p) => <S {...p}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V4s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" /></S>;
export const Chat = (p) => <S {...p}><path d="M21 11.5a8.4 8.4 0 01-9 8.4 8.5 8.5 0 01-3.9-.9L3 20l1.9-5A8.4 8.4 0 013 11.5 8.5 8.5 0 0112 3a8.4 8.4 0 019 8.5z" /></S>;
export const Home = (p) => <S {...p}><path d="M3 10l9-7 9 7v10a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2z" /></S>;
export const User = (p) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></S>;
export const Warning = (p) => <S {...p}><path d="M10.3 3.3L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.3 3.3a2 2 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></S>;
export const Clock = (p) => <S {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>;
export const Camera = (p) => <S {...p}><path d="M14.5 4l1.5 2h3a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h3l1.5-2z" /><circle cx="12" cy="13" r="3.5" /></S>;
export const Plus = (p) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const Phone = (p) => <S {...p}><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3 19.5 19.5 0 01-6-6 19.8 19.8 0 01-3-8.6A2 2 0 014.1 2h3a2 2 0 012 1.7c.1 1 .4 1.9.7 2.8a2 2 0 01-.5 2.1L8.1 9.9a16 16 0 006 6l1.3-1.3a2 2 0 012.1-.4c.9.3 1.8.6 2.8.7a2 2 0 011.8 2z" /></S>;
export const Pin = (p) => <S {...p}><path d="M12 21s-7-5.7-7-11a7 7 0 0114 0c0 5.3-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></S>;
export const Dot = ({ color = 'currentColor', size = 8 }) => <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-block', flex: 'none' }} />;
