import { useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { DashboardHeader } from './DashboardHeader';
import { ConnectionBanner } from './ConnectionBanner';
import { ResetDbDialog } from '../../features/admin/ResetDbDialog';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-sky-500/20 selection:text-sky-200">
      {/* Desktop Fixed Sidebar */}
      <div className="hidden md:fixed md:inset-y-0 md:z-40 md:flex md:w-64 md:flex-col">
        <AppSidebar onOpenResetDb={() => setResetDialogOpen(true)} />
      </div>

      {/* Mobile Drawer / Backdrop Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-950 shadow-2xl">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                aria-label="Close menu"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <AppSidebar
              onNavigate={() => setMobileMenuOpen(false)}
              onOpenResetDb={() => {
                setMobileMenuOpen(false);
                setResetDialogOpen(true);
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex min-h-screen w-full flex-1 flex-col md:pl-64">
        <DashboardHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="flex-1 px-3 py-4 sm:px-5 lg:px-6 sm:py-5 w-full max-w-[1600px] mx-auto space-y-5">
          <ConnectionBanner />
          {children}
        </main>
      </div>

      {/* Global Reset Database Dialog */}
      <ResetDbDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
      />
    </div>
  );
}

