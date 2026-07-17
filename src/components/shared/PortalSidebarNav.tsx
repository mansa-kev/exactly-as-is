import React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface PortalNavItem {
  id: string;
  label: string;
  shortLabel?: string;
  path: string;
  icon: React.ElementType;
  badge?: number;
}

export interface PortalNavGroup {
  title: string;
  items: PortalNavItem[];
}

interface PortalSidebarNavProps {
  groups: PortalNavGroup[];
  activePath: string;
  expandedGroups: string[];
  onToggleGroup: (title: string) => void;
  onPrefetch?: (path: string) => void;
  onNavigate?: () => void;
}

export function PortalSidebarNav({
  groups,
  activePath,
  expandedGroups,
  onToggleGroup,
  onPrefetch,
  onNavigate,
}: PortalSidebarNavProps) {
  return (
    <nav className="flex-1 overflow-y-auto py-4 scrollbar-hide">
      {groups.map((group) => {
        const isExpanded = expandedGroups.includes(group.title);
        const hasActive = group.items.some((item) => item.path === activePath);

        return (
          <div key={group.title} className="mb-1">
            <button
              type="button"
              onClick={() => onToggleGroup(group.title)}
              className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                hasActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-left leading-tight line-clamp-2">{group.title}</span>
              {isExpanded ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
            </button>

            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="overflow-hidden"
                >
                  <div className="px-3 space-y-1">
                    {group.items.map((item) => {
                      const isActive = activePath === item.path;
                      const displayLabel = item.shortLabel || item.label;
                      return (
                        <Link
                          key={item.id}
                          to={item.path}
                          title={item.label}
                          onClick={onNavigate}
                          onMouseEnter={() => onPrefetch?.(item.path)}
                          onFocus={() => onPrefetch?.(item.path)}
                          onTouchStart={() => onPrefetch?.(item.path)}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg transition-all relative group min-w-0 ${
                            isActive
                              ? 'bg-primary/10 text-primary'
                              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                          }`}
                        >
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                          )}
                          <span className="flex items-center gap-3 min-w-0">
                            <item.icon size={18} className={isActive ? 'text-primary shrink-0' : 'shrink-0'} />
                            <span className="text-sm font-medium truncate">{displayLabel}</span>
                          </span>
                          {item.badge != null && item.badge > 0 && (
                            <span className={`shrink-0 min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-black ${
                              isActive ? 'bg-primary text-primary-foreground' : 'bg-error text-white'
                            }`}>
                              {item.badge > 99 ? '99+' : item.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </nav>
  );
}
