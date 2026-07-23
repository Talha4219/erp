import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { CompanySettingsProvider } from '@/components/providers/CompanySettingsProvider'
import { AppStoreHydrator } from '@/components/providers/AppStoreHydrator'
import { registerEventHandlers } from '@/lib/events/handlers'

registerEventHandlers()

export default function ERPLayout({ children }: { children: React.ReactNode }) {
  return (
    <CompanySettingsProvider>
      <AppStoreHydrator>
        <div className="flex min-h-screen bg-[#f5f6fa]">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0">
            <Header />
            <main className="flex-1 overflow-y-auto p-5 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </AppStoreHydrator>
    </CompanySettingsProvider>
  )
}
