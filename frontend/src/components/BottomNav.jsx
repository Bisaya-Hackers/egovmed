import { Home, Chat, Heart, FileText, User } from './Icons.jsx';

function NavItem({ icon, label, active, onClick }) {
  return (
    <button className={'navitem' + (active ? ' active' : '')} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

export default function BottomNav({ c, S, A }) {
  return (
    <nav className="bottomnav" aria-label="Primary">
      <NavItem icon={<Home size={22} />} label={c.navHome} active={S.screen === 'home'} onClick={A.resetToHome} />
      <NavItem icon={<Chat size={22} />} label={c.navMessages} onClick={A.openMessages} />
      <button className="navfab" onClick={() => A.go('symptom')} aria-label={c.startVisit}>
        <Heart size={26} weight="Filled" />
      </button>
      <NavItem icon={<FileText size={22} />} label={c.navRecords} active={S.screen === 'records'} onClick={A.goRecords} />
      <NavItem icon={<User size={22} />} label={c.navAccount} onClick={() => A.toast(c.navAccount)} />
    </nav>
  );
}
