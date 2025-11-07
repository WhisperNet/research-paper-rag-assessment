import { Link, useLocation } from 'react-router-dom';

type HeaderProps = { collapsed?: boolean };

const Header = ({ collapsed }: HeaderProps) => {
  // Sidebar widths: collapsed 4rem (w-16), expanded 18rem (w-72)
  const leftOffset = collapsed ? '4rem' : '18rem';
  const { pathname } = useLocation();

  const navLink = (to: string, label: string) => {
    const isActive = pathname === to;
    return (
      <Link
        to={to}
        className={`
          px-3 py-2 rounded-md text-sm font-medium transition-colors
          ${
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground/70 hover:text-foreground hover:bg-accent'
          }
        `}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      className="fixed top-0 right-0 z-30 h-16 bg-background border-b border-border flex items-center px-6 transition-all duration-200"
      style={{ left: leftOffset }}
    >
      <nav className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2">{navLink('/', 'Chat')}</div>
        <div className="flex items-center gap-2">
          {navLink('/most-discussed', 'Most Discussed')}
          {navLink('/analytics', 'Analytics')}
          {navLink('/history', 'History')}
          {navLink('/stats', 'Paper Stats')}
          {navLink('/health', 'Health')}
        </div>
      </nav>
    </header>
  );
};

export default Header;
