import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, CircleHelp, Cloud, Flower2,
  LockKeyhole, LogOut, Mail, ShieldCheck, Sparkles, UserRound,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { dateFromKey, daysBetween, formatLongDate, formatMonth, isFuture, toDateKey } from './lib/date'
import { getCompletedCountForDate, getCompletedSetForDate, PRAYERS } from './lib/salah'
import type { Completion, PrayerId } from './lib/salah'

type Profile = { date_of_birth: string }
type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null

const todayKey = () => toDateKey(new Date())

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileError, setProfileError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [completions, setCompletions] = useState<Completion[]>([])
  const [dataLoading, setDataLoading] = useState(false)
  const [notice, setNotice] = useState<Notice>(null)
  const [busyPrayer, setBusyPrayer] = useState<PrayerId | null>(null)
  const [selectedDate, setSelectedDate] = useState(todayKey())
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  const loadProfile = useCallback(async (userId: string) => {
    if (!supabase) return
    setProfileLoading(true)
    const { data, error } = await supabase.from('profiles').select('date_of_birth').eq('id', userId).maybeSingle()
    if (error) {
      setNotice({ kind: 'error', text: 'We could not load your profile. Check that the database setup is complete.' })
      setProfile(null)
      setProfileError(true)
    } else {
      setProfile(data)
      setProfileError(false)
    }
    setProfileLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    let alive = true
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return
      setSession(data.session)
      if (!data.session) setLoading(false)
      else void loadProfile(data.session.user.id).finally(() => setLoading(false))
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return
      setSession(nextSession)
      setNotice(null)
      setProfile(null)
      setProfileError(false)
      setCompletions([])
      if (!nextSession) {
        setLoading(false)
        setProfileLoading(false)
        return
      }
      setLoading(true)
      window.setTimeout(() => {
        void loadProfile(nextSession.user.id).finally(() => setLoading(false))
      }, 0)
    })
    return () => {
      alive = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const loadCompletions = useCallback(async () => {
    if (!supabase || !session?.user.id || !profile) return
    setDataLoading(true)
    const { data, error } = await supabase
      .from('prayer_completions')
      .select('prayer_date, prayer_name')
      .eq('user_id', session.user.id)
      .gte('prayer_date', profile.date_of_birth)
      .lte('prayer_date', todayKey())
      .order('prayer_date', { ascending: true })
    if (error) {
      setNotice({ kind: 'error', text: 'Prayer records could not be loaded. Please refresh and try again.' })
    } else {
      setCompletions((data ?? []) as Completion[])
    }
    setDataLoading(false)
  }, [profile, session?.user.id])

  useEffect(() => { void loadCompletions() }, [loadCompletions])

  const handleProfileSave = async (dateOfBirth: string) => {
    if (!supabase || !session?.user.id) return
    setProfileLoading(true)
    setNotice(null)
    const { error } = await supabase.from('profiles').insert({ id: session.user.id, date_of_birth: dateOfBirth })
    if (error) {
      setNotice({ kind: 'error', text: error.code === '23505' ? 'Your date of birth is already saved.' : 'We could not save that date. Please try again.' })
    } else {
      setProfile({ date_of_birth: dateOfBirth })
      setSelectedDate(todayKey())
      setVisibleMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
      setNotice({ kind: 'success', text: 'Your profile is ready. Welcome to Salah.' })
    }
    setProfileLoading(false)
  }

  const togglePrayer = async (date: string, prayer: PrayerId) => {
    if (!supabase || !session?.user.id || !profile || busyPrayer || isFuture(date, todayKey())) return
    const alreadyDone = completions.some((item) => item.prayer_date === date && item.prayer_name === prayer)
    setBusyPrayer(prayer)
    setNotice(null)
    if (alreadyDone) {
      const { error } = await supabase.from('prayer_completions').delete()
        .eq('user_id', session.user.id).eq('prayer_date', date).eq('prayer_name', prayer)
      if (error) setNotice({ kind: 'error', text: 'That update did not save. Please try again.' })
      else setCompletions((items) => items.filter((item) => !(item.prayer_date === date && item.prayer_name === prayer)))
    } else {
      const { error } = await supabase.from('prayer_completions').insert({
        user_id: session.user.id, prayer_date: date, prayer_name: prayer,
      })
      if (error) setNotice({ kind: 'error', text: 'That update did not save. Please try again.' })
      else setCompletions((items) => [...items, { prayer_date: date, prayer_name: prayer }])
    }
    setBusyPrayer(null)
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  if (loading || profileLoading) return <LoadingScreen />
  if (!isSupabaseConfigured || !supabase) return <SetupScreen />
  if (!session) return <AuthScreen notice={notice} setNotice={setNotice} />
  if (profileError) return <ProfileErrorScreen onRetry={() => void loadProfile(session.user.id)} onSignOut={signOut} />
  if (!profile) return <BirthDateScreen onSave={handleProfileSave} notice={notice} loading={profileLoading} />

  return (
    <Dashboard
      email={session.user.email ?? 'Your account'}
      profile={profile}
      completions={completions}
      dataLoading={dataLoading}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      visibleMonth={visibleMonth}
      setVisibleMonth={setVisibleMonth}
      busyPrayer={busyPrayer}
      togglePrayer={togglePrayer}
      signOut={signOut}
      notice={notice}
      onDismissNotice={() => setNotice(null)}
    />
  )
}

function Mark({ light = false }: { light?: boolean }) {
  return <span className={`brand-mark${light ? ' brand-mark-light' : ''}`} aria-hidden="true"><span /></span>
}

function LoadingScreen() {
  return <main className="loading-screen"><Mark /><p>Making a little space for you…</p></main>
}

function SetupScreen() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="brand-lockup"><Mark /><span>SALAH</span></div>
        <div className="setup-icon"><Cloud size={22} /></div>
        <p className="eyebrow">One small setup step</p>
        <h1>Give your prayer log a safe home.</h1>
        <p className="setup-copy">Connect a free Supabase project to turn on sign-in and securely sync your account across devices.</p>
        <ol className="setup-steps">
          <li><span>1</span>Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a>.</li>
          <li><span>2</span>Run the database script in <code>supabase/schema.sql</code>.</li>
          <li><span>3</span>Copy the project URL and publishable key to <code>.env</code>.</li>
        </ol>
        <p className="setup-footnote">Your sign-in details and prayer history are stored in your own project. See the README for the complete setup guide.</p>
      </section>
    </main>
  )
}

function ProfileErrorScreen({ onRetry, onSignOut }: { onRetry: () => void; onSignOut: () => Promise<void> }) {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="brand-lockup"><Mark /><span>SALAH</span></div>
        <div className="setup-icon"><Cloud size={22} /></div>
        <p className="eyebrow">A QUICK CHECK-IN</p>
        <h1>Your journal couldn’t load.</h1>
        <p className="setup-copy">Check your connection and database setup, then try again. Your saved profile is still there.</p>
        <div className="profile-error-actions"><button className="primary-button" onClick={onRetry}>Try again <ArrowRight size={16} /></button><button className="secondary-button" onClick={() => void onSignOut()}>Sign out</button></div>
      </section>
    </main>
  )
}

function AuthScreen({ notice, setNotice }: { notice: Notice; setNotice: (notice: Notice) => void }) {
  const [mode, setMode] = useState<'login' | 'signup'>('signup')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    setPending(true)
    setNotice(null)
    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error?.code === 'email_address_not_authorized') setNotice({ kind: 'error', text: 'Email confirmation is restricted by the project’s mail settings. Use Google sign-in or ask the project owner to configure SMTP.' })
      else if (error) setNotice({ kind: 'error', text: error.message })
      else if (!data.session) setNotice({ kind: 'info', text: 'Check your inbox for a confirmation link. After confirming, sign in to finish setting up your account.' })
      else setNotice({ kind: 'success', text: 'Your account is ready. One last step, then you can begin.' })
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) setNotice({ kind: 'error', text: 'We could not sign you in. Check your email and password, then try again.' })
    }
    setPending(false)
  }

  const google = async () => {
    if (!supabase) return
    setPending(true)
    setNotice(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google', options: { redirectTo: window.location.origin },
    })
    if (error) {
      setNotice({ kind: 'error', text: 'Google sign-in could not start. Please try again in a moment.' })
      setPending(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="welcome-panel">
        <div className="welcome-inner">
          <div className="brand-lockup brand-lockup-light"><Mark light /><span>SALAH</span></div>
          <div className="welcome-copy">
            <p className="eyebrow eyebrow-light"><span className="eyebrow-line" /> YOUR QUIET CORNER</p>
            <h1>A little more<br /><em>present,</em> every day.</h1>
            <p>Keep a gentle record of your prayers. Find your rhythm, one moment at a time.</p>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="art-arch"><div className="art-moon" /><div className="art-star art-star-one">✦</div><div className="art-star art-star-two">✦</div><div className="art-dot art-dot-one" /><div className="art-dot art-dot-two" /><div className="arch-lantern"><span /></div></div>
            <span className="art-caption">ONE DAY AT A TIME</span>
          </div>
          <div className="welcome-bottom"><span>“Indeed, in the remembrance of Allah do hearts find rest.”</span><small>QUR’AN 13:28</small></div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-top"><span className="mobile-brand"><Mark /><span>SALAH</span></span><p>Already have an account? <button className="text-button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setNotice(null) }}>{mode === 'signup' ? 'Sign in' : 'Create account'}</button></p></div>
        <div className="auth-form-wrap">
          <div className="auth-heading"><p className="eyebrow">A JOURNEY, JUST FOR YOU</p><h2>{mode === 'signup' ? 'Begin with intention.' : 'Welcome back.'}</h2><p>{mode === 'signup' ? 'Create your private space to keep track of every prayer.' : 'Pick up where your heart left off.'}</p></div>
          {notice && <NoticeBanner notice={notice} onClose={() => setNotice(null)} />}
          <button type="button" className="google-button" onClick={() => void google()} disabled={pending}>
            <GoogleMark /> Continue with Google
          </button>
          <div className="form-divider"><span /> <small>OR WITH EMAIL</small> <span /></div>
          <form onSubmit={(event) => void submit(event)} className="auth-form">
            <label className="field-label" htmlFor="auth-email">Email address</label>
            <div className="input-wrap"><Mail size={18} /><input id="auth-email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div>
            <div className="password-label"><label className="field-label" htmlFor="auth-password">Password</label><button type="button" className="text-button text-button-small" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div>
            <div className="input-wrap"><LockKeyhole size={18} /><input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} placeholder="At least 8 characters" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
            <button className="primary-button auth-submit" disabled={pending}>{pending ? 'One moment…' : mode === 'signup' ? 'Create my account' : 'Sign in'}<ArrowRight size={17} /></button>
          </form>
          <p className="privacy-note"><ShieldCheck size={16} /> Your account and prayer log stay private.</p>
          <p className="auth-toggle">{mode === 'signup' ? 'Already have an account?' : 'New to Salah?'} <button className="text-button" onClick={() => { setMode(mode === 'signup' ? 'login' : 'signup'); setNotice(null) }}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
        </div>
        <div className="auth-footer"><span>MADE WITH CARE FOR YOUR DAILY PRACTICE</span><button className="help-link" onClick={() => setNotice({ kind: 'info', text: 'If you have trouble signing in, check your email for a confirmation link or ask your project administrator for help.' })}><CircleHelp size={15} /> Need help?</button></div>
      </section>
    </main>
  )
}

function GoogleMark() {
  return <svg className="google-mark" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.35 12.2c0-.7-.06-1.37-.18-2.02H12v3.82h5.24a4.48 4.48 0 0 1-1.94 2.94v2.4h3.14c1.84-1.7 2.91-4.2 2.91-7.14Z"/><path fill="#34A853" d="M12 21.7c2.62 0 4.82-.87 6.43-2.36l-3.14-2.4c-.87.59-1.98.94-3.3.94-2.54 0-4.7-1.72-5.47-4.03H3.27v2.48A9.7 9.7 0 0 0 12 21.7Z"/><path fill="#FBBC05" d="M6.53 13.85a5.83 5.83 0 0 1 0-3.7V7.67H3.27a9.72 9.72 0 0 0 0 8.65l3.26-2.47Z"/><path fill="#EA4335" d="M12 6.12c1.43 0 2.7.5 3.7 1.47l2.78-2.78C16.81 3.23 14.62 2.3 12 2.3a9.7 9.7 0 0 0-8.73 5.37l3.26 2.48c.78-2.31 2.93-4.03 5.47-4.03Z"/></svg>
}

function BirthDateScreen({ onSave, notice, loading }: { onSave: (date: string) => Promise<void>; notice: Notice; loading: boolean }) {
  const [date, setDate] = useState('')
  const maxDate = todayKey()
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (date && date <= maxDate) void onSave(date)
  }
  return (
    <main className="birth-page">
      <div className="birth-card">
        <div className="birth-topline"><div className="brand-lockup"><Mark /><span>SALAH</span></div><span className="step-pill">ONE LAST STEP <span>•</span> 01 / 01</span></div>
        <div className="birth-content"><div className="birth-icon"><Flower2 size={22} /></div><p className="eyebrow">YOUR STORY, YOUR PACE</p><h1>When did your journey begin?</h1><p className="birth-lede">Your date of birth helps us shape your personal prayer timeline. This stays private to your account and can’t be changed later.</p>
          {notice && <NoticeBanner notice={notice} onClose={() => undefined} />}
          <form onSubmit={submit} className="birth-form"><label htmlFor="birth-date" className="field-label">Date of birth</label><div className="input-wrap"><CalendarDays size={18} /><input id="birth-date" type="date" max={maxDate} value={date} onChange={(event) => setDate(event.target.value)} required /></div><p className="form-hint">Saved once and used only to calculate your prayer count.</p><button className="primary-button" disabled={loading || !date}>{loading ? 'Saving…' : 'Continue to my journal'}<ArrowRight size={17} /></button></form>
          <p className="privacy-note"><ShieldCheck size={16} /> Your date is private to your account.</p>
        </div>
        <div className="birth-footer"><ArrowLeft size={14} /><span>You can sign out at any time</span></div>
      </div>
    </main>
  )
}

type DashboardProps = {
  email: string
  profile: Profile
  completions: Completion[]
  dataLoading: boolean
  selectedDate: string
  setSelectedDate: (date: string) => void
  visibleMonth: Date
  setVisibleMonth: (date: Date) => void
  busyPrayer: PrayerId | null
  togglePrayer: (date: string, prayer: PrayerId) => Promise<void>
  signOut: () => Promise<void>
  notice: Notice
  onDismissNotice: () => void
}

function Dashboard(props: DashboardProps) {
  const { email, profile, completions, dataLoading, selectedDate, setSelectedDate, visibleMonth, setVisibleMonth, busyPrayer, togglePrayer, signOut, notice, onDismissNotice } = props
  const today = todayKey()
  const daysSinceBirth = daysBetween(profile.date_of_birth, today) + 1
  const requiredTotal = daysSinceBirth * PRAYERS.length
  const loggedTotal = completions.length
  const remaining = Math.max(0, requiredTotal - loggedTotal)
  const selectedDone = getCompletedSetForDate(completions, selectedDate)
  const selectedCount = selectedDone.size
  const selectedFuture = isFuture(selectedDate, today)
  const [accountOpen, setAccountOpen] = useState(false)

  return (
    <div className="dashboard-shell">
      <header className="app-header">
        <div className="header-brand"><Mark /><span>SALAH</span><span className="brand-separator" /><span className="header-caption">YOUR PRAYER JOURNAL</span></div>
        <div className="header-actions"><span className="sync-status"><span className="sync-dot" /> <span>Synced</span></span><div className="account-menu-wrap"><button className="account-button" aria-label="Account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}><span className="avatar"><UserRound size={17} /></span><span className="account-name">{email}</span><ChevronRight size={15} className={accountOpen ? 'rotate-down' : 'rotate-side'} /></button>{accountOpen && <div className="account-menu"><span className="account-email">{email}</span><span className="account-menu-label">Account created for your personal use</span><button onClick={() => void signOut()}><LogOut size={15} /> Sign out</button></div>}</div></div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-intro"><div><p className="eyebrow"><span className="eyebrow-line eyebrow-line-green" /> YOUR PRACTICE, GENTLY KEPT</p><h1>A little more present, <em>every day.</em></h1><p className="intro-subtitle">Your prayer journal is a quiet place to begin again, whenever you need.</p></div><div className="today-chip"><span className="today-chip-label">TODAY</span><strong>{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</strong><span className="today-chip-flower">✳</span></div></section>

        {notice && <NoticeBanner notice={notice} onClose={onDismissNotice} />}

        <section className="summary-grid" aria-label="Prayer summary">
          <article className="summary-card summary-card-main"><div className="summary-topline"><span className="summary-icon summary-icon-light"><Sparkles size={18} /></span><span className="summary-kicker">YOUR JOURNEY SO FAR</span><span className="summary-decoration">✳</span></div><div className="summary-content"><div><p className="summary-number">{remaining.toLocaleString()}</p><p className="summary-label">prayers left to log</p></div><div className="summary-description"><span className="summary-rule" />Since {dateFromKey(profile.date_of_birth).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}, at your own pace.</div></div><div className="summary-footer"><span><span className="footer-dot" /> {loggedTotal.toLocaleString()} logged so far</span><span>{requiredTotal.toLocaleString()} total to date</span></div></article>
          <article className="summary-card summary-card-today"><div className="today-card-heading"><span className="summary-icon"><CalendarDays size={18} /></span><span className="summary-kicker">TODAY’S PRAYERS</span></div><div className="today-progress-number"><strong>{getCompletedCountForDate(completions, today)}</strong><span> / 5</span></div><div className="progress-track" role="progressbar" aria-label="Prayers logged today" aria-valuenow={getCompletedCountForDate(completions, today)} aria-valuemin={0} aria-valuemax={5}><span style={{ width: `${getCompletedCountForDate(completions, today) * 20}%` }} /></div><div className="today-card-foot"><span>{getCompletedCountForDate(completions, today) === 5 ? 'All five, beautifully done.' : 'One prayer at a time.'}</span><span className="gold-sparkle">✦</span></div></article>
          <article className="summary-card summary-card-days"><span className="days-decoration">☼</span><div className="days-icon"><Flower2 size={18} /></div><p className="days-number">{daysSinceBirth.toLocaleString()}</p><p className="days-label">days in your journey</p><p className="days-note">Your practice, at your pace.</p></article>
        </section>

        <section id="journal" className="journal-layout" aria-label="Prayer journal calendar">
          <article className="panel calendar-panel">
            <div className="panel-heading"><div><p className="eyebrow"><span className="eyebrow-line eyebrow-line-green" /> THE BIG PICTURE</p><h2>Your calendar</h2></div><div className="calendar-legend"><span><i className="legend-dot legend-done" /> All done</span><span><i className="legend-dot legend-some" /> Some logged</span></div></div>
            <CalendarView profileDate={profile.date_of_birth} completions={completions} today={today} visibleMonth={visibleMonth} setVisibleMonth={setVisibleMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />
            <div className="calendar-footnote"><span className="footnote-icon"><Sparkles size={13} /></span><span>Every small return is part of the journey.</span><span className="footnote-ornament">✳</span></div>
          </article>

          <article className="panel day-panel">
            <div className="day-panel-header"><div><p className="eyebrow"><span className="eyebrow-line eyebrow-line-green" /> YOUR DAILY CHECK-IN</p><h2>{selectedDate === today ? 'Today’s prayers' : dateFromKey(selectedDate).toLocaleDateString(undefined, { weekday: 'long' })}</h2><p className="selected-date-label">{formatLongDate(selectedDate)}</p></div><div className="day-count-badge"><strong>{selectedCount}</strong><span>/ 5</span></div></div>
            {selectedFuture && <div className="future-note">This day is still ahead. Your check-in will be ready then.</div>}
            <div className="prayer-list" aria-label={`Prayers for ${formatLongDate(selectedDate)}`}>
              {PRAYERS.map((prayer, index) => {
                const done = selectedDone.has(prayer.id)
                const disabled = selectedFuture || busyPrayer !== null || dataLoading
                return <button key={prayer.id} className={`prayer-row${done ? ' prayer-row-done' : ''}`} disabled={disabled} aria-pressed={done} onClick={() => void togglePrayer(selectedDate, prayer.id)}>
                  <span className={`prayer-letter prayer-letter-${index}`} aria-hidden="true">{prayer.mark}</span><span className="prayer-meta"><span className="prayer-name">{prayer.name}</span><span className="prayer-time">{prayer.time}</span></span><span className={`prayer-check${done ? ' prayer-check-done' : ''}`}>{busyPrayer === prayer.id ? <span className="mini-spinner" /> : done ? <Check size={16} strokeWidth={2.8} /> : null}</span>
                </button>
              })}
            </div>
            <div className="day-panel-footer"><span><LockKeyhole size={14} /> Just for you</span><span>{selectedFuture ? 'Available on this day' : `${selectedCount} of 5 marked complete`}</span></div>
          </article>
        </section>

        <footer className="dashboard-footer"><div className="footer-brand"><Mark /><span>May each day bring you closer to what matters.</span></div><span className="footer-privacy"><ShieldCheck size={14} /> Your journal stays private</span></footer>
      </main>
      <MobileNav selectedDate={selectedDate} setSelectedDate={setSelectedDate} today={today} />
    </div>
  )
}

function CalendarView({ profileDate, completions, today, visibleMonth, setVisibleMonth, selectedDate, setSelectedDate }: {
  profileDate: string; completions: Completion[]; today: string; visibleMonth: Date; setVisibleMonth: (date: Date) => void; selectedDate: string; setSelectedDate: (date: string) => void
}) {
  const offset = visibleMonth.getDay()
  const monthDays = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const days = useMemo(() => Array.from({ length: offset + monthDays }, (_, index) => index < offset ? null : index - offset + 1), [offset, monthDays])
  const earliestMonth = new Date(dateFromKey(profileDate).getFullYear(), dateFromKey(profileDate).getMonth(), 1)
  const latestMonth = new Date(dateFromKey(today).getFullYear(), dateFromKey(today).getMonth(), 1)
  const canPrevious = visibleMonth > earliestMonth
  const canNext = visibleMonth < latestMonth

  const changeMonth = (amount: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + amount, 1)
    setVisibleMonth(next)
    if (next.getFullYear() === latestMonth.getFullYear() && next.getMonth() === latestMonth.getMonth()) setSelectedDate(today)
    else if (next.getFullYear() === earliestMonth.getFullYear() && next.getMonth() === earliestMonth.getMonth()) setSelectedDate(profileDate)
    else setSelectedDate(toDateKey(new Date(next.getFullYear(), next.getMonth(), 1)))
  }

  return <>
    <div className="month-switcher"><div className="month-label"><span className="month-flower">✳</span><strong>{formatMonth(visibleMonth)}</strong></div><div className="month-controls"><button onClick={() => changeMonth(-1)} disabled={!canPrevious} aria-label="Previous month"><ChevronLeft size={18} /></button><button onClick={() => changeMonth(1)} disabled={!canNext} aria-label="Next month"><ChevronRight size={18} /></button></div></div>
    <div className="calendar-grid" role="grid" aria-label={formatMonth(visibleMonth)}>
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => <div className="weekday" role="columnheader" key={`${day}-${index}`} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index]}>{day}</div>)}
      {days.map((day, index) => {
        if (day === null) return <div className="calendar-empty" role="gridcell" key={`empty-${index}`} />
        const key = toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day))
        const count = getCompletedCountForDate(completions, key)
        const future = isFuture(key, today)
        const beforeBirth = key < profileDate
        const selected = key === selectedDate
        const isToday = key === today
        const state = count === 5 ? 'all' : count > 0 ? 'some' : 'none'
        return <button key={key} role="gridcell" aria-selected={selected} aria-label={`${formatLongDate(key)}${future ? ', upcoming' : `, ${count} of 5 prayers logged`}`} className={`calendar-day calendar-day-${state}${selected ? ' calendar-day-selected' : ''}${isToday ? ' calendar-day-today' : ''}${future || beforeBirth ? ' calendar-day-disabled' : ''}`} disabled={future || beforeBirth} onClick={() => setSelectedDate(key)}>
          <span>{day}</span>{count > 0 && <i className={`day-mark ${count === 5 ? 'day-mark-all' : 'day-mark-some'}`} />}
        </button>
      })}
    </div>
  </>
}

function MobileNav({ selectedDate, setSelectedDate, today }: { selectedDate: string; setSelectedDate: (date: string) => void; today: string }) {
  return <nav className="mobile-bottom-nav" aria-label="Quick navigation"><a className="mobile-nav-item mobile-nav-active" aria-current="page" href="#journal"><CalendarDays size={19} /><span>Journal</span></a><button className="mobile-nav-item" onClick={() => setSelectedDate(today)}><Sparkles size={18} /><span>Today</span></button><span className="mobile-nav-date">{dateFromKey(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span></nav>
}

function NoticeBanner({ notice, onClose }: { notice: Exclude<Notice, null>; onClose: () => void }) {
  return <div className={`notice notice-${notice.kind}`} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.text}</span><button onClick={onClose} aria-label="Dismiss message">×</button></div>
}

