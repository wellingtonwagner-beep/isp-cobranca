export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1e1b4b] to-[#312e81] flex items-center justify-center p-4">
      {children}
    </div>
  )
}
