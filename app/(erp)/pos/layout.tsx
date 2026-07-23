// POS runs full-screen with no sidebar
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-100">{children}</div>
}
