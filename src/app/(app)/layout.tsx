import Sidebar from '@/components/layout/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Sidebar />
      <main className="ml-52 min-h-screen">
        <div className="p-6 max-w-7xl">{children}</div>
      </main>
    </>
  )
}
