import { NavLink } from 'react-router-dom'
import { Library, ShoppingBag, ScrollText, User, Settings } from 'lucide-react'
import { UpdatePromo } from './UpdatePromo'

const NAV = [
  { to: '/',         icon: Library,     label: 'Bibliothèque' },
  { to: '/store',    icon: ShoppingBag, label: 'Magasin'      },
  { to: '/news',     icon: ScrollText,  label: 'Changelog'    },
  { to: '/profile',  icon: User,        label: 'Profil'       },
  { to: '/settings', icon: Settings,    label: 'Paramètres'   },
]

export function Sidebar() {
  return (
    <aside className="flex flex-col w-56 shrink-0 bg-surface shadow-[inset_-1px_0_0_var(--hairline)] min-h-0">
      <nav className="flex min-h-0 flex-1 flex-col gap-1 px-2 py-3 overflow-y-auto">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors
               ${isActive
                 ? 'bg-hover text-white font-medium'
                 : 'text-muted hover:text-primary hover:bg-hover'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={15} className={isActive ? 'text-accent' : ''} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <UpdatePromo />
    </aside>
  )
}
