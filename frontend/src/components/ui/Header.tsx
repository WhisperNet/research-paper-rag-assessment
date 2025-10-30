import { Button } from './button';
import { Link, useLocation } from 'react-router-dom';

type HeaderProps = { collapsed?: boolean };

const Header = ({ collapsed }: HeaderProps) => {
  // Sidebar widths: collapsed 4rem (w-16), expanded 18rem (w-72)
  const leftOffset = collapsed ? '4rem' : '18rem';
  const { pathname } = useLocation();

  const navBtn = (to: string, label: string) => (
    <Button asChild variant="ghost">
      <Link
        to={to}
        className={
          pathname === to
            ? 'font-semibold text-primary underline underline-offset-4'
            : ''
        }
      >
        {label}
      </Link>
    </Button>
  );

  return (
    <header
      className={
        'fixed top-0 right-0 z-30 h-16 bg-white shadow flex items-center px-4'
      }
      style={{ left: leftOffset }}
    >
      <div className="flex items-center gap-6">
        {navBtn('/', 'Home')}
        <span className="font-bold text-xl tracking-tight text-primary">
          🤖 WhisperNet
        </span>
      </div>
      <div className="flex-1"></div>
      <div className="flex items-center gap-4">
        {navBtn('/analytics', 'Analytics')}
        {navBtn('/history', 'History')}
      </div>
    </header>
  );
};

export default Header;
