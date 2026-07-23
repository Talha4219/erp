'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@/lib/validations/auth'
import { Button } from '@/components/ui/button'
import { formatGBP } from '@/lib/uk-locale'
import { cn } from '@/lib/utils'
import {
  Building2, Loader2, Eye, EyeOff, CheckCircle2, AlertTriangle, Lock, ShieldCheck,
  TrendingUp, TrendingDown, Package, Workflow, Warehouse, Truck, Users, Landmark, BarChart2,
} from 'lucide-react'
import { toast } from 'sonner'
import pkg from '@/package.json'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

type PublicBranding = { name: string; logo: string | null }

const FEATURES = [
  { icon: Truck, label: 'Procurement Automation' },
  { icon: Users, label: 'Customer Management' },
  { icon: Warehouse, label: 'Inventory Tracking' },
  { icon: Landmark, label: 'Financial Control' },
  { icon: BarChart2, label: 'Advanced Reporting' },
]

const KPIS = [
  { label: 'Revenue Today', target: 124500, format: (v: number) => formatGBP(v), icon: TrendingUp, accent: 'text-emerald-400 bg-emerald-400/10' },
  { label: 'Open Orders', target: 248, format: (v: number) => String(v), icon: Package, accent: 'text-blue-400 bg-blue-400/10' },
  { label: 'Pending Approvals', target: 12, format: (v: number) => String(v), icon: Workflow, accent: 'text-amber-400 bg-amber-400/10' },
  { label: 'Inventory Health', target: 96, format: (v: number) => `${v}%`, icon: Warehouse, accent: 'text-teal-400 bg-teal-400/10' },
]

function useCountUp(target: number, durationMs = 1400) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf: number
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])
  return value
}

function KpiMini({ label, target, format, icon: Icon, accent, delay }: {
  label: string; target: number; format: (v: number) => string; icon: React.ElementType; accent: string; delay: number
}) {
  const value = useCountUp(target)
  return (
    <div className="animate-fade-up rounded-xl border border-white/10 bg-white/[0.06] p-3.5 backdrop-blur-sm" style={{ animationDelay: `${delay}ms` }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</span>
        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md', accent)}>
          <Icon className="h-3 w-3" />
        </div>
      </div>
      <p className="mt-1.5 text-xl font-bold text-white tabular-nums">{format(value)}</p>
    </div>
  )
}

function FloatingInput({
  id, label, type, error, rightSlot, registerProps, hasValue, onKeyUp,
}: {
  id: string; label: string; type: string; error?: string; rightSlot?: React.ReactNode
  registerProps: UseFormRegisterReturn; hasValue: boolean; onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>
}) {
  const [focused, setFocused] = useState(false)
  const floated = focused || hasValue
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={id === 'email' ? 'email' : 'current-password'}
          {...registerProps}
          onFocus={() => setFocused(true)}
          onBlur={(e) => { setFocused(false); registerProps.onBlur(e) }}
          onKeyUp={onKeyUp}
          className={cn(
            'w-full rounded-xl border bg-white px-4 text-sm text-slate-900 outline-none transition-all duration-150',
            floated ? 'pt-5 pb-2' : 'py-3.5',
            rightSlot && 'pr-11',
            error
              ? 'border-red-300 focus:border-red-400 focus:ring-4 focus:ring-red-500/10'
              : 'border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10',
          )}
        />
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute left-4 transition-all duration-150',
            floated ? 'top-2 text-[11px] font-medium' : 'top-1/2 -translate-y-1/2 text-sm',
            focused ? 'text-blue-600' : error ? 'text-red-400' : 'text-slate-400',
          )}
        >
          {label}
        </label>
        {rightSlot}
      </div>
      {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
    </div>
  )
}

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'
}

export default function LoginPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [featureIdx, setFeatureIdx] = useState(0)
  const [greeting, setGreeting] = useState('Welcome Back')

  const { data: branding } = useQuery({
    queryKey: ['public-branding'],
    queryFn: () => api.get<PublicBranding>('/api/settings/public').then((r) => r.data),
    staleTime: 5 * 60_000,
  })
  const companyName = branding?.name || 'ERP'

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const emailValue = watch('email')
  const passwordValue = watch('password')

  useEffect(() => {
    setGreeting(getGreeting())
    setRememberMe(false)
  }, [setValue])

  useEffect(() => {
    const t = setInterval(() => setFeatureIdx((i) => (i + 1) % FEATURES.length), 3000)
    return () => clearInterval(t)
  }, [])

  function handlePanelMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    setMouse({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
      y: ((e.clientY - rect.top) / rect.height - 0.5) * 2,
    })
  }

  async function onSubmit(data: LoginInput) {
    setStatus('loading')
    try {
      const result = await signIn('credentials', { email: data.email, password: data.password, redirect: false })
      if (result?.error) {
        setStatus('error')
        toast.error('Invalid email or password')
        setTimeout(() => setStatus('idle'), 600)
        return
      }
      void rememberMe
      setStatus('success')
      toast.success('Logged in successfully')
      // Prefetch high-traffic routes so navigation feels instant
      router.prefetch('/dashboard')
      router.prefetch('/sales')
      router.prefetch('/inventory')
      router.prefetch('/procurement')
      router.prefetch('/customers')
      router.prefetch('/pos')
      setTimeout(() => { router.push('/dashboard'); router.refresh() }, 500)
    } catch {
      setStatus('error')
      toast.error('An unexpected error occurred')
      setTimeout(() => setStatus('idle'), 600)
    }
  }

  const env = process.env.NODE_ENV === 'production' ? 'Production' : 'Development'

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Left Showcase ─────────────────────────────────────────────── */}
      <div
        onMouseMove={handlePanelMouseMove}
        className="relative hidden w-[62%] flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-12 lg:flex xl:p-16"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-blue-600/20 blur-3xl transition-transform duration-300 ease-out"
            style={{ transform: `translate(${mouse.x * 14}px, ${mouse.y * 14}px)` }}
          />
          <div
            className="absolute right-0 top-1/3 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl transition-transform duration-300 ease-out"
            style={{ transform: `translate(${mouse.x * -10}px, ${mouse.y * 10}px)` }}
          />
          <div
            className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl transition-transform duration-300 ease-out"
            style={{ transform: `translate(${mouse.x * 8}px, ${mouse.y * -8}px)` }}
          />
          <div className="absolute inset-0 opacity-[0.04] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/10 backdrop-blur-sm">
            {branding?.logo ? (
              <img src={branding.logo} alt={companyName} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold leading-none text-white">{companyName}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Business Operating System</p>
          </div>
        </div>

        <div className="relative space-y-8 py-10">
          <div>
            <h2 className="max-w-md text-3xl font-bold leading-tight text-white xl:text-4xl">
              Run your entire business from one platform.
            </h2>
            <p className="mt-3 max-w-sm text-sm text-slate-400">
              Real-time visibility across sales, procurement, inventory and finance — built for teams that move fast.
            </p>
          </div>

          <div className="grid max-w-md grid-cols-2 gap-3">
            {KPIS.map((k, i) => <KpiMini key={k.label} {...k} delay={i * 100} />)}
          </div>

          <div className="flex flex-wrap gap-2.5">
            {[
              { label: 'Sales', delta: '+18%', up: true },
              { label: 'Procurement', delta: '-5%', up: false },
              { label: 'Profit', delta: '+12%', up: true },
            ].map((a) => (
              <div key={a.label} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 backdrop-blur-sm">
                {a.up ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                <span className="text-xs text-slate-300">{a.label}</span>
                <span className={cn('text-xs font-semibold', a.up ? 'text-emerald-400' : 'text-red-400')}>{a.delta}</span>
              </div>
            ))}
          </div>

          <div className="h-11 overflow-hidden">
            {FEATURES.map((f, i) => i === featureIdx && (
              <div key={f.label} className="animate-fade-up flex items-center gap-2.5 text-slate-300">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <f.icon className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-sm font-medium">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-1.5">
          {FEATURES.map((f, i) => (
            <span key={f.label} className={cn('h-1 rounded-full transition-all', i === featureIdx ? 'w-6 bg-blue-400' : 'w-1.5 bg-white/20')} />
          ))}
        </div>
      </div>

      {/* ── Right Login Card ──────────────────────────────────────────── */}
      <div className="flex w-full flex-1 flex-col items-center justify-center px-6 py-10 lg:w-[38%]">
        <div className="w-full max-w-sm">

          <div className="mb-8 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-blue-600 shadow-lg shadow-blue-600/20">
              {branding?.logo ? (
                <img src={branding.logo} alt={companyName} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-5 w-5 text-white" />
              )}
            </div>
            <p className="mt-2.5 text-xs font-medium uppercase tracking-widest text-slate-400">Enterprise Resource Planning</p>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900">{greeting}</h1>
            <p className="mt-1 text-sm text-slate-500">Sign in to continue managing your business.</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FloatingInput
              id="email" label="Email Address" type="email"
              registerProps={register('email')} hasValue={!!emailValue}
              error={errors.email?.message}
            />
            <FloatingInput
              id="password" label="Password" type={showPassword ? 'text' : 'password'}
              registerProps={register('password')} hasValue={!!passwordValue}
              error={errors.password?.message}
              onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
              rightSlot={
                <button
                  type="button" tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              }
            />
            {capsLock && (
              <p className="-mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" /> Caps Lock is on
              </p>
            )}

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox" checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                />
                Remember this device
              </label>
              <button
                type="button"
                onClick={() => toast.info('Contact your system administrator to reset your password')}
                className="text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={status === 'loading' || status === 'success'}
              className={cn(
                'h-12 w-full rounded-xl text-sm font-semibold transition-all',
                status === 'error' && 'animate-shake bg-red-600 hover:bg-red-600',
                status === 'success' && 'bg-emerald-600 hover:bg-emerald-600',
              )}
            >
              {status === 'loading' ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
              ) : status === 'success' ? (
                <><CheckCircle2 className="mr-2 h-4 w-4" />Signed in</>
              ) : 'Sign In'}
            </Button>
          </form>

          <div className="mt-7 flex items-center gap-3 text-[11px] font-medium uppercase tracking-wider text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> Trusted &amp; Secure <div className="h-px flex-1 bg-slate-200" />
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> SSL Secured</span>
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Role-Based Access</span>
            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Audit Logged</span>
          </div>

          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <span>v{pkg.version}</span>
            <span>·</span>
            <span className={cn('rounded-full px-2 py-0.5 font-medium', env === 'Production' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600')}>
              {env}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
