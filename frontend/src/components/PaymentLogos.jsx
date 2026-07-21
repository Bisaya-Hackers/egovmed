import { Card } from './Icons.jsx';

// Original, brand-coloured payment badges (not the trademarked GCash/Maya artwork) — swap for
// licensed brand assets in production, same as the illustration placeholders.
function Badge({ bg, color = '#fff', size, children }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 10, background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontWeight: 800, lineHeight: 1 }}>
      {children}
    </span>
  );
}

export function GCashLogo({ size = 38 }) {
  // GCash blue + a coin motif
  return (
    <Badge bg="#0057FF" size={size}>
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" fill="none" stroke="#fff" strokeWidth="2.3" />
        <path d="M16 9.2a5 5 0 10.001 5.6" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
        <path d="M12 12h4.2" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
      </svg>
    </Badge>
  );
}

export function MayaLogo({ size = 38 }) {
  // Maya green wordmark initial
  return (
    <Badge bg="#12C785" size={size}>
      <span style={{ fontSize: size * 0.5 }}>m</span>
    </Badge>
  );
}

export function CardLogo({ size = 38 }) {
  return (
    <span style={{ width: size, height: size, borderRadius: 10, background: '#F1EEFB', color: '#5B3FD6', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      <Card size={size * 0.55} />
    </span>
  );
}

const LOGOS = { GC: GCashLogo, MB: MayaLogo, CT: CardLogo };

// Renders the right badge for a channel abbreviation (GC/MB/CT).
export default function PaymentLogo({ abbr, size = 38 }) {
  const Logo = LOGOS[abbr] || CardLogo;
  return <Logo size={size} />;
}
