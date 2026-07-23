import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CompanySettingsProvider } from '@/components/providers/CompanySettingsProvider'
import { AppStoreHydrator } from '@/components/providers/AppStoreHydrator'
import { registerEventHandlers } from '@/lib/events/handlers'
import { Agentation } from 'agentation'

registerEventHandlers()

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanySettingsProvider>
      <AppStoreHydrator>
        <div className="flex min-h-screen" style={{ background: 'var(--app-bg)', backgroundAttachment: 'fixed' }}>
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:p-10">
              {children}
            </main>
          </div>
        </div>
        {process.env.NODE_ENV === 'development' && <Agentation />}
      </AppStoreHydrator>
    </CompanySettingsProvider>
  )
}
