import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'

async function request(path, { method = 'GET', body, companyId, csrf = false } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (companyId) headers['X-Company-Id'] = companyId
  if (csrf) {
    const tokenResponse = await fetch('/api/auth/csrf', { credentials: 'include' })
    if (!tokenResponse.ok) throw new Error('Your session expired. Sign in again.')
    const { csrfToken } = await tokenResponse.json()
    if (!csrfToken) throw new Error('Security token is missing. Sign in again.')
    headers['X-CSRF-Token'] = csrfToken
  }

  const response = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 204) return null
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `Request failed (${response.status}).`)
    error.status = response.status
    throw error
  }
  return payload
}

function Icon({ name }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    company: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h1m4 0h1m-6 4h1m4 0h1m-4 7v-4h2v4" /></>,
    branches: <><rect x="3" y="4" width="7" height="6" rx="1" /><rect x="14" y="14" width="7" height="6" rx="1" /><path d="M10 7h3a2 2 0 0 1 2 2v5M12 9l2-2 2 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5m4-1v5l3 2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    logout: <><path d="M10 17l5-5-5-5m5 5H3" /><path d="M12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <><path d="m9 18 6-6-6-6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  }
  return <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>
}

function Notice({ notice, onClose }) {
  if (!notice) return null
  return <div role="status" className={`notice ${notice.type}`}><span>{notice.type === 'error' ? '!' : <Icon name="check" />}</span><p>{notice.text}</p><button aria-label="Dismiss message" onClick={onClose}><Icon name="close" /></button></div>
}

function SignIn({ onSignedIn, onNotice }) {
  const [mode, setMode] = useState(() => new URLSearchParams(window.location.search).has('token') ? 'complete' : 'login')
  const [busy, setBusy] = useState(false)
  const [registrationEnabled, setRegistrationEnabled] = useState(false)

  useEffect(() => {
    request('/auth/config')
      .then((config) => setRegistrationEnabled(config.registrationEnabled))
      .catch((error) => onNotice({ type: 'error', text: error.message }))
  }, [onNotice])

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') || '').trim().toLowerCase()
    setBusy(true)
    try {
      if (mode === 'reset') {
        await request('/auth/password-reset/request', { method: 'POST', body: { email } })
        onNotice({ type: 'success', text: 'If that account exists, password reset instructions will be sent.' })
        return
      }
      if (mode === 'complete') {
        await request('/auth/password-reset/complete', {
          method: 'POST',
          body: { token: new URLSearchParams(window.location.search).get('token'), password: String(form.get('password') || '') },
        })
        window.history.replaceState({}, '', window.location.pathname)
        setMode('login')
        onNotice({ type: 'success', text: 'Password updated. Sign in with your new password.' })
        return
      }
      if (mode === 'register') {
        const payload = await request('/auth/register', {
          method: 'POST',
          body: {
            email,
            fullName: String(form.get('fullName') || ''),
            password: String(form.get('password') || ''),
            companyName: String(form.get('companyName') || ''),
            branchName: String(form.get('branchName') || 'Head Office'),
          },
        })
        onSignedIn(payload)
        return
      }
      const payload = await request('/auth/login', {
        method: 'POST',
        body: { email, password: String(form.get('password') || '') },
      })
      onSignedIn(payload)
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <Brand />
        <div className="auth-heading">
          <span className="eyebrow">SMARTBIZ WORKSPACE</span>
          <h1>{mode === 'login' ? 'Welcome back' : mode === 'reset' ? 'Reset your password' : mode === 'complete' ? 'Choose a new password' : 'Create your workspace'}</h1>
          <p>{mode === 'login' ? 'Sign in to securely manage your company workspace.' : mode === 'reset' ? 'Enter your email and we’ll send a reset link if the account exists.' : mode === 'complete' ? 'Set a strong password to secure your account.' : 'Create a company and its first administrator account.'}</p>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <label>Email address<input name="email" type="email" autoComplete="email" maxLength="254" required placeholder="you@company.com" /></label>
          {mode === 'register' && <>
            <label>Your name<input name="fullName" autoComplete="name" minLength="2" maxLength="160" required /></label>
            <label>Company name<input name="companyName" minLength="2" maxLength="160" required /></label>
            <label>First branch<input name="branchName" defaultValue="Head Office" minLength="2" maxLength="160" required /></label>
          </>}
          {(mode === 'login' || mode === 'complete' || mode === 'register') && <label>Password<input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'complete' || mode === 'register' ? 12 : undefined} maxLength="72" required /></label>}
          <button className="primary-button wide" type="submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : mode === 'complete' ? 'Update password' : 'Create company account'} <Icon name="arrow" /></button>
        </form>
        {mode === 'login' && <div className="auth-links"><button className="text-button auth-switch" onClick={() => setMode('reset')}>Forgot password?</button>{registrationEnabled && <button className="text-button auth-switch" onClick={() => setMode('register')}>Create a workspace</button>}</div>}
        {(mode === 'reset' || mode === 'register') && <button className="text-button auth-switch" onClick={() => setMode('login')}>Return to sign in</button>}
        {mode === 'register' && <p className="password-help">Password requires 12+ characters, upper/lowercase letters, and a number.</p>}
        <div className="auth-foot"><Icon name="shield" /> Secure company access · Password reset requires configured email delivery</div>
      </section>
    </main>
  )
}

function Brand() {
  return <div className="brand"><div className="brand-mark"><span /></div><div className="brand-word">smart<span>biz</span></div></div>
}

function EmptyState({ title, description }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="grid" /></span><strong>{title}</strong><p>{description}</p></div>
}

function CompanyProfile({ companyId, onNotice, canManage }) {
  const [company, setCompany] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    request(`/companies/${companyId}`, { companyId }).then((result) => {
      if (active) setCompany(result.company)
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [companyId, onNotice])

  async function save(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await request(`/companies/${companyId}`, {
        method: 'PATCH',
        companyId,
        csrf: true,
        body: {
          name: form.get('name'),
          legalName: form.get('legalName') || null,
          registrationNumber: form.get('registrationNumber') || null,
          countryCode: String(form.get('countryCode')).toUpperCase(),
          currencyCode: String(form.get('currencyCode')).toUpperCase(),
          timezone: form.get('timezone'),
        },
      })
      setCompany(result.company)
      onNotice({ type: 'success', text: 'Company profile updated.' })
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  if (!company) return <LoadingState />
  return (
    <section className="content-card">
      <div className="section-heading"><div><h2>Company profile</h2><p>Organization details shared across your workspace.</p></div><span className="status-tag active">ACTIVE</span></div>
      <form className="data-form" onSubmit={save}>
        <label>Company name<input name="name" required minLength="2" maxLength="160" defaultValue={company.name} disabled={!canManage} /></label>
        <label>Legal name<input name="legalName" maxLength="200" defaultValue={company.legal_name || ''} disabled={!canManage} /></label>
        <label>Registration number<input name="registrationNumber" maxLength="80" defaultValue={company.registration_number || ''} disabled={!canManage} /></label>
        <div className="field-pair">
          <label>Country code<input name="countryCode" required minLength="2" maxLength="2" pattern="[A-Za-z]{2}" defaultValue={company.country_code} disabled={!canManage} /></label>
          <label>Base currency<input name="currencyCode" required minLength="3" maxLength="3" pattern="[A-Za-z]{3}" defaultValue={company.currency_code} disabled={!canManage} /></label>
        </div>
        <label>Timezone<input name="timezone" required maxLength="64" defaultValue={company.timezone} disabled={!canManage} /></label>
        <div className="form-actions"><span>{canManage ? `Created ${new Date(company.created_at).toLocaleDateString()}` : 'Read-only company profile'}</span>{canManage && <button className="primary-button" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>}</div>
      </form>
    </section>
  )
}

function Branches({ companyId, onNotice, canManage }) {
  const [branches, setBranches] = useState([])
  const [busy, setBusy] = useState(false)
  const [reload, setReload] = useState(0)
  const refresh = useCallback(() => setReload((count) => count + 1), [])

  useEffect(() => {
    let active = true
    request(`/companies/${companyId}/branches`, { companyId }).then((result) => {
      if (active) setBranches(result.data)
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [companyId, onNotice, reload])

  async function createBranch(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      await request(`/companies/${companyId}/branches`, {
        method: 'POST', companyId, csrf: true,
        body: { name: form.get('name'), code: form.get('code'), address: form.get('address') || null },
      })
      event.currentTarget.reset()
      onNotice({ type: 'success', text: 'Branch created.' })
      refresh()
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function toggleBranch(branch) {
    const action = branch.is_active ? 'deactivate' : 'activate'
    if (branch.is_active && !window.confirm(`Deactivate ${branch.name}? Existing records are retained.`)) return
    try {
      await request(`/companies/${companyId}/branches/${branch.id}/status`, {
        method: 'PATCH', companyId, csrf: true, body: { isActive: !branch.is_active },
      })
      onNotice({ type: 'success', text: `Branch ${action}d.` })
      refresh()
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <>
      <section className="content-card">
        <div className="section-heading"><div><h2>Branches</h2><p>Company branches and operating locations.</p></div><span className="count-pill">{branches.length}</span></div>
        <div className="table-scroll"><table><thead><tr><th>BRANCH</th><th>CODE</th><th>ADDRESS</th><th>STATUS</th><th /></tr></thead>
          <tbody>{branches.map((branch) => <tr key={branch.id}><td className="strong-cell">{branch.name}</td><td><code>{branch.code}</code></td><td>{branch.address || '—'}</td><td><span className={`status-tag ${branch.is_active ? 'active' : 'inactive'}`}>{branch.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td><td>{canManage && <button className="table-action" onClick={() => toggleBranch(branch)}>{branch.is_active ? 'Deactivate' : 'Activate'}</button>}</td></tr>)}</tbody>
        </table></div>
        {branches.length === 0 && <EmptyState title="No branches found" description="Create the first branch for this company." />}
      </section>
      {canManage && <section className="content-card">
        <div className="section-heading"><div><h2>Add a branch</h2><p>Branch codes are unique within each company.</p></div></div>
        <form className="data-form compact-form" onSubmit={createBranch}>
          <label>Branch name<input name="name" required minLength="2" maxLength="160" /></label>
          <label>Branch code<input name="code" required minLength="2" maxLength="32" pattern="[A-Za-z0-9_-]+" /></label>
          <label>Address <span className="optional">(optional)</span><input name="address" maxLength="500" /></label>
          <div className="form-actions"><span>New branches start active.</span><button className="primary-button" disabled={busy}><Icon name="plus" />{busy ? 'Creating…' : 'Create branch'}</button></div>
        </form>
      </section>}
    </>
  )
}

function Users({ companyId, onNotice, currentUserId }) {
  const [result, setResult] = useState({ data: [], pagination: { page: 1, total: 0 } })
  const [branches, setBranches] = useState([])
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const pageSize = 25
  const refresh = useCallback(() => setReload((count) => count + 1), [])

  useEffect(() => {
    let active = true
    request(`/companies/${companyId}/branches`, { companyId }).then(({ data }) => {
      if (active) setBranches(data.filter((branch) => branch.is_active))
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [companyId, onNotice])

  useEffect(() => {
    let active = true
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (search.trim()) params.set('search', search.trim())
    request(`/companies/${companyId}/users?${params}`, { companyId }).then((data) => {
      if (active) setResult(data)
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [companyId, onNotice, page, reload, search])

  async function createUser(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      await request(`/companies/${companyId}/users`, {
        method: 'POST', companyId, csrf: true,
        body: {
          fullName: form.get('fullName') || undefined,
          email: form.get('email'),
          password: form.get('password') || undefined,
          roleCode: form.get('roleCode'),
          branchId: form.get('branchId') || null,
        },
      })
      event.currentTarget.reset()
      onNotice({ type: 'success', text: 'User account created.' })
      refresh()
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  async function toggleUser(user) {
    const action = user.is_active ? 'deactivate' : 'activate'
    if (user.is_active && !window.confirm(`Deactivate ${user.full_name}? Their active sessions will be revoked.`)) return
    try {
      await request(`/companies/${companyId}/users/${user.id}/status`, {
        method: 'PATCH', companyId, csrf: true, body: { isActive: !user.is_active },
      })
      onNotice({ type: 'success', text: `User ${action}d.` })
      refresh()
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    }
  }

  async function changeRole(user, roleCode) {
    try {
      await request(`/companies/${companyId}/users/${user.id}/role`, {
        method: 'PATCH', companyId, csrf: true, body: { roleCode },
      })
      onNotice({ type: 'success', text: 'User role updated.' })
      refresh()
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <>
      <section className="content-card">
        <div className="section-heading"><div><h2>Company users</h2><p>Accounts and roles for this company.</p></div><span className="count-pill">{result.pagination.total}</span></div>
        <label className="table-search"><Icon name="search" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search name or email" /></label>
        <div className="table-scroll"><table><thead><tr><th>USER</th><th>ROLE</th><th>BRANCH</th><th>STATUS</th><th>LAST SIGN-IN</th><th /></tr></thead>
          <tbody>{result.data.map((user) => <tr key={user.id}>
            <td><span className="user-cell"><i>{user.full_name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</i><span className="user-id"><strong>{user.full_name}{user.id === currentUserId && <small>YOU</small>}</strong><span>{user.email}</span></span></span></td>
            <td>{user.role_code === 'company_admin' ? <span className="role-label">{user.role_name}</span> : <select className="role-select" value={user.role_code} disabled={!user.is_active} onChange={(event) => changeRole(user, event.target.value)} aria-label={`Role for ${user.full_name}`}><option value="manager">Manager</option><option value="accountant">Accountant</option><option value="hr_manager">HR Manager</option><option value="employee">Employee</option><option value="branch_manager">Branch Manager</option></select>}</td>
            <td>{user.branch_name || 'All branches'}</td><td><span className={`status-tag ${user.is_active ? 'active' : 'inactive'}`}>{user.is_active ? 'ACTIVE' : 'INACTIVE'}</span></td>
            <td>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</td><td><button className="table-action" disabled={user.id === currentUserId} onClick={() => toggleUser(user)}>{user.is_active ? 'Deactivate' : 'Activate'}</button></td>
          </tr>)}</tbody>
        </table></div>
        {result.data.length === 0 && <EmptyState title="No users found" description="Adjust the search or add a user to this company." />}
        {result.pagination.total > pageSize && <div className="pagination"><span>Page {page} of {Math.ceil(result.pagination.total / pageSize)}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button disabled={page * pageSize >= result.pagination.total} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>}
      </section>
      <section className="content-card">
        <div className="section-heading"><div><h2>Create a user</h2><p>Set an initial password and company role. Share credentials securely.</p></div></div>
        <form className="data-form compact-form" onSubmit={createUser}>
          <div className="field-pair"><label>Full name<input name="fullName" minLength="2" maxLength="160" placeholder="Required for a new account" /></label><label>Email address<input name="email" type="email" required maxLength="254" /></label></div>
          <div className="field-pair"><label>Initial password<input name="password" type="password" minLength="12" maxLength="72" autoComplete="new-password" /><span className="optional">Required for a new account; leave blank to add an existing user.</span></label><label>Role<select name="roleCode" defaultValue="employee"><option value="employee">Employee</option><option value="manager">Manager</option><option value="accountant">Accountant</option><option value="hr_manager">HR Manager</option><option value="branch_manager">Branch Manager</option><option value="company_admin">Admin</option></select></label></div>
          <label>Branch <span className="optional">(optional; leave empty for all branches)</span><select name="branchId" defaultValue=""><option value="">All branches</option>{branches.map((branch) => <option value={branch.id} key={branch.id}>{branch.name} ({branch.code})</option>)}</select></label>
          <div className="form-actions"><span>Password must include upper/lowercase letters and a number.</span><button className="primary-button" disabled={busy}><Icon name="plus" />{busy ? 'Creating…' : 'Create account'}</button></div>
        </form>
      </section>
    </>
  )
}

function Roles({ companyId, onNotice }) {
  const [roles, setRoles] = useState([])
  useEffect(() => {
    let active = true
    request(`/companies/${companyId}/roles`, { companyId }).then(({ data }) => {
      if (active) setRoles(data)
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [companyId, onNotice])

  return <section className="content-card"><div className="section-heading"><div><h2>Roles & permissions</h2><p>System roles are read-only in this phase; permissions are enforced by the API.</p></div></div>
    <div className="role-grid">{roles.map((role) => <article className="role-card" key={role.code}><div><strong>{role.name}</strong><span className="status-tag active">{role.code}</span></div><p>{role.description}</p><div className="permission-list">{role.permissions.map((permission) => <span key={permission}>{permission}</span>)}</div></article>)}</div>
  </section>
}

function AuditLogs({ companyId, onNotice }) {
  const [events, setEvents] = useState([])
  useEffect(() => {
    let active = true
    request(`/companies/${companyId}/audit-logs?page=1&pageSize=50`, { companyId }).then(({ data }) => {
      if (active) setEvents(data)
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [companyId, onNotice])

  return <section className="content-card"><div className="section-heading"><div><h2>Audit history</h2><p>Security and administration events for this company.</p></div><span className="count-pill">{events.length}</span></div>
    <div className="table-scroll"><table><thead><tr><th>TIME</th><th>ACTION</th><th>RECORD</th><th>ACTOR</th><th>REQUEST</th></tr></thead><tbody>
      {events.map((event) => <tr key={event.id}><td>{new Date(event.created_at).toLocaleString()}</td><td className="strong-cell">{event.action}</td><td>{event.entity_type}{event.entity_id ? ` · ${event.entity_id.slice(0, 8)}` : ''}</td><td>{event.actor_user_id?.slice(0, 8) || 'System'}</td><td><code>{event.request_id.slice(0, 8)}</code></td></tr>)}
    </tbody></table></div>
    {events.length === 0 && <EmptyState title="No audit events yet" description="Administrative changes and sign-in events will be recorded here." />}
  </section>
}

function Sessions({ onNotice, onCurrentSessionRevoke }) {
  const [sessions, setSessions] = useState([])
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    request('/auth/sessions').then(({ data }) => {
      if (active) setSessions(data)
    }).catch((error) => onNotice({ type: 'error', text: error.message }))
    return () => { active = false }
  }, [onNotice, reload])

  async function revoke(session) {
    const isCurrent = Boolean(session.is_current)
    if (!window.confirm(isCurrent ? 'End this session and sign out?' : 'Revoke this session?')) return
    try {
      await request(`/auth/sessions/${session.id}`, { method: 'DELETE', csrf: true })
      if (isCurrent) {
        onCurrentSessionRevoke()
        return
      }
      onNotice({ type: 'success', text: 'Session revoked.' })
      setReload((value) => value + 1)
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    }
  }

  return <section className="content-card"><div className="section-heading"><div><h2>Active sessions</h2><p>Sign out sessions you no longer recognize or use.</p></div><span className="count-pill">{sessions.length}</span></div>
    <div className="table-scroll"><table><thead><tr><th>SESSION</th><th>IP ADDRESS</th><th>STARTED</th><th>EXPIRES</th><th /></tr></thead><tbody>
      {sessions.map((session) => <tr key={session.id}><td><span className="session-device"><strong>{session.is_current ? 'This device' : 'Signed-in device'}</strong><small>{session.user_agent || 'Unknown browser'}</small></span></td><td>{session.ip_address || '—'}</td><td>{new Date(session.created_at).toLocaleString()}</td><td>{new Date(session.expires_at).toLocaleString()}</td><td><button className="table-action" onClick={() => revoke(session)}>Revoke</button></td></tr>)}
    </tbody></table></div>
    {sessions.length === 0 && <EmptyState title="No active sessions" description="Sign in again to create a new secure session." />}
  </section>
}

function CompanyCreate({ onNotice, onCreated }) {
  const [busy, setBusy] = useState(false)

  async function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      const result = await request('/platform/companies', {
        method: 'POST',
        csrf: true,
        body: {
          name: form.get('name'),
          legalName: form.get('legalName') || null,
          registrationNumber: form.get('registrationNumber') || null,
          countryCode: String(form.get('countryCode')).toUpperCase(),
          currencyCode: String(form.get('currencyCode')).toUpperCase(),
          timezone: form.get('timezone'),
          branchName: form.get('branchName'),
          branchCode: form.get('branchCode'),
        },
      })
      onNotice({ type: 'success', text: 'Company created and added to your workspace.' })
      await onCreated(result.company.id)
    } catch (error) {
      onNotice({ type: 'error', text: error.message })
    } finally {
      setBusy(false)
    }
  }

  return <section className="content-card"><div className="section-heading"><div><h2>Create a company</h2><p>A new company and its first branch are created atomically. Your new membership is Admin.</p></div></div>
    <form className="data-form" onSubmit={submit}>
      <label>Company name<input name="name" required minLength="2" maxLength="160" /></label>
      <label>Legal name <span className="optional">(optional)</span><input name="legalName" maxLength="200" /></label>
      <label>Registration number <span className="optional">(optional)</span><input name="registrationNumber" maxLength="80" /></label>
      <div className="field-pair"><label>Country code<input name="countryCode" required defaultValue="RW" pattern="[A-Za-z]{2}" maxLength="2" /></label><label>Base currency<input name="currencyCode" required defaultValue="RWF" pattern="[A-Za-z]{3}" maxLength="3" /></label></div>
      <label>Timezone<input name="timezone" required defaultValue="Africa/Kigali" maxLength="64" /></label>
      <div className="field-pair"><label>First branch<input name="branchName" required defaultValue="Head Office" minLength="2" maxLength="160" /></label><label>Branch code<input name="branchCode" required defaultValue="HQ" minLength="2" maxLength="32" pattern="[A-Za-z0-9_-]+" /></label></div>
      <div className="form-actions"><span>Only platform Super Admins can add companies.</span><button className="primary-button" disabled={busy}><Icon name="plus" />{busy ? 'Creating…' : 'Create company'}</button></div>
    </form>
  </section>
}

function LoadingState() {
  return <div className="loading-state"><span className="spinner" /> Loading secure workspace…</div>
}

const pageDetails = {
  overview: ['Workspace overview', 'Your authenticated company and access summary.'],
  company: ['Company profile', 'Company identity, locale, and currency settings.'],
  branches: ['Branches', 'Manage operating locations and company branch records.'],
  users: ['Users & access', 'Create accounts, assign roles, and manage user status.'],
  roles: ['Roles & permissions', 'Review the server-enforced system role permissions.'],
  audit: ['Audit history', 'Review recorded sign-ins and administrative changes.'],
  sessions: ['Session management', 'Review and revoke your active sign-in sessions.'],
  'create-company': ['Create company', 'Create an additional tenant from your platform administrator account.'],
}

function App() {
  const [auth, setAuth] = useState({ loading: true, user: null, memberships: [] })
  const [companyId, setCompanyId] = useState('')
  const [activePage, setActivePage] = useState('overview')
  const [notice, setNotice] = useState(null)
  const [serverError, setServerError] = useState('')

  const showNotice = useCallback((value) => {
    setNotice(value)
    window.setTimeout(() => setNotice((current) => current === value ? null : current), 4500)
  }, [])

  const activeMembership = useMemo(
    () => auth.memberships.find((membership) => membership.company_id === companyId) || auth.memberships[0],
    [auth.memberships, companyId],
  )

  useEffect(() => {
    let active = true
    request('/auth/me').then((result) => {
      if (!active) return
      setAuth({ loading: false, user: result.user, memberships: result.memberships })
      setCompanyId(result.memberships[0]?.company_id || '')
    }).catch((error) => {
      if (!active) return
      if (error.status === 401) {
        setAuth({ loading: false, user: null, memberships: [] })
      } else {
        setAuth({ loading: false, user: null, memberships: [] })
        setServerError(error.message)
      }
    })
    return () => { active = false }
  }, [])

  async function signOut() {
    try {
      await request('/auth/logout', { method: 'POST', companyId, csrf: true })
      setAuth({ loading: false, user: null, memberships: [] })
      setCompanyId('')
      setActivePage('overview')
      setNotice(null)
    } catch (error) {
      showNotice({ type: 'error', text: error.message })
    }
  }

  if (auth.loading) return <LoadingState />
  if (!auth.user) {
    return <><SignIn onSignedIn={(result) => {
      setAuth({ loading: false, user: result.user, memberships: result.memberships })
      setCompanyId(result.memberships[0]?.company_id || '')
      setServerError('')
    }} onNotice={showNotice} />
      {serverError && <div className="server-error" role="alert">{serverError}</div>}
      <Notice notice={notice} onClose={() => setNotice(null)} />
    </>
  }

  const [title, subtitle] = pageDetails[activePage] || pageDetails.overview
  const isAdmin = activeMembership?.role_code === 'company_admin' || activeMembership?.role_code === 'super_admin'
  const canReadRoles = ['company_admin', 'super_admin', 'manager'].includes(activeMembership?.role_code)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="workspace-label">SECURE WORKSPACE</div>
        <label className="company-select-label" htmlFor="company-select">COMPANY</label>
        <select id="company-select" className="company-select" value={activeMembership?.company_id || ''} onChange={(event) => { setCompanyId(event.target.value); setActivePage('overview') }}>
          {auth.memberships.map((membership) => <option key={membership.company_id} value={membership.company_id}>{membership.company_name}</option>)}
        </select>
        <nav className="side-nav" aria-label="Company administration">
          <p className="nav-heading">WORKSPACE</p>
          <NavButton id="overview" activePage={activePage} setActivePage={setActivePage} label="Overview" icon="grid" />
          <p className="nav-heading">ORGANIZATION</p>
          <NavButton id="company" activePage={activePage} setActivePage={setActivePage} label="Company profile" icon="company" />
          <NavButton id="branches" activePage={activePage} setActivePage={setActivePage} label="Branches" icon="branches" />
          {isAdmin && <NavButton id="users" activePage={activePage} setActivePage={setActivePage} label="Users & access" icon="users" />}
          {activeMembership?.role_code === 'super_admin' && <NavButton id="create-company" activePage={activePage} setActivePage={setActivePage} label="Create company" icon="company" />}
          {canReadRoles && <NavButton id="roles" activePage={activePage} setActivePage={setActivePage} label="Roles & permissions" icon="shield" />}
          <NavButton id="sessions" activePage={activePage} setActivePage={setActivePage} label="Sessions" icon="history" />
          {isAdmin && <NavButton id="audit" activePage={activePage} setActivePage={setActivePage} label="Audit history" icon="history" />}
        </nav>
        <div className="sidebar-footer">
          <div className="profile-block"><span className="profile-avatar">{auth.user.fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><div><strong>{auth.user.fullName}</strong><small>{activeMembership?.role_name || 'Workspace user'}</small></div></div>
          <button className="signout-button" onClick={signOut}><Icon name="logout" /> Sign out</button>
        </div>
      </aside>
      <main className="main-panel">
        <header className="topbar"><div className="breadcrumb"><span>{activeMembership?.company_name || 'Company'}</span><Icon name="chevron" /><strong>{title}</strong></div><span className="session-indicator"><i /> Authenticated session</span></header>
        <div className="page-content">
          <section className="page-heading"><div><span className="eyebrow"><i /> PHASE 1 · IDENTITY & COMPANY SETUP</span><h1>{title}</h1><p>{subtitle}</p></div><span className="phase-badge">LIVE DATABASE</span></section>
          {activePage === 'overview' && <Overview auth={auth} membership={activeMembership} isAdmin={isAdmin} canReadRoles={canReadRoles} onOpen={setActivePage} />}
          {activePage === 'company' && activeMembership && <CompanyProfile key={activeMembership.company_id} companyId={activeMembership.company_id} canManage={isAdmin} onNotice={showNotice} />}
          {activePage === 'branches' && activeMembership && <Branches key={activeMembership.company_id} companyId={activeMembership.company_id} canManage={isAdmin} onNotice={showNotice} />}
          {activePage === 'users' && activeMembership && isAdmin && <Users key={activeMembership.company_id} companyId={activeMembership.company_id} currentUserId={auth.user.id} onNotice={showNotice} />}
          {activePage === 'roles' && activeMembership && canReadRoles && <Roles key={activeMembership.company_id} companyId={activeMembership.company_id} onNotice={showNotice} />}
          {activePage === 'sessions' && <Sessions onCurrentSessionRevoke={() => { setAuth({ loading: false, user: null, memberships: [] }); setCompanyId('') }} onNotice={showNotice} />}
          {activePage === 'create-company' && activeMembership?.role_code === 'super_admin' && <CompanyCreate onNotice={showNotice} onCreated={async (newCompanyId) => {
            const result = await request('/auth/me')
            setAuth({ loading: false, user: result.user, memberships: result.memberships })
            setCompanyId(newCompanyId)
            setActivePage('overview')
          }} />}
          {activePage === 'audit' && activeMembership && isAdmin && <AuditLogs key={activeMembership.company_id} companyId={activeMembership.company_id} onNotice={showNotice} />}
          {!activeMembership && <section className="content-card"><EmptyState title="No company membership" description="Your account is not associated with an active company. Ask a system administrator to restore access." /></section>}
          <footer className="page-footer"><Icon name="shield" /><span>Company records are isolated on the server. Permission checks are enforced by the API.</span></footer>
        </div>
      </main>
      <Notice notice={notice} onClose={() => setNotice(null)} />
    </div>
  )
}

function NavButton({ id, activePage, setActivePage, label, icon }) {
  return <button className={`nav-item ${activePage === id ? 'active' : ''}`} onClick={() => setActivePage(id)} aria-current={activePage === id ? 'page' : undefined}><Icon name={icon} /><span>{label}</span></button>
}

function Overview({ auth, membership, isAdmin, canReadRoles, onOpen }) {
  return (
    <section className="overview-grid">
      <article className="welcome-card"><div className="welcome-mark"><Icon name="company" /></div><div><span className="eyebrow">SIGNED IN AS</span><h2>{auth.user.fullName}</h2><p>{auth.user.email}</p></div></article>
      <article className="content-card overview-company"><span className="eyebrow">ACTIVE COMPANY</span><h2>{membership?.company_name || 'No company selected'}</h2><div className="company-facts"><span><small>ROLE</small><strong>{membership?.role_name || '—'}</strong></span><span><small>COUNTRY</small><strong>{membership?.country_code || '—'}</strong></span><span><small>CURRENCY</small><strong>{membership?.currency_code || '—'}</strong></span></div><button className="text-button" onClick={() => onOpen('company')}>Manage company profile <Icon name="arrow" /></button></article>
      <article className="content-card phase-card"><div className="phase-card-head"><span className="phase-number">01</span><div><h2>Phase 1 foundation</h2><p>Identity, company setup, and access controls</p></div></div><div className="phase-progress"><span /></div><div className="phase-list"><span><i><Icon name="check" /></i> Secure login and server sessions</span><span><i><Icon name="check" /></i> Company and branch records</span><span><i><Icon name="check" /></i> Server-enforced roles and permissions</span><span><i className="pending">2</i> Finance, HR, and operations in later phases</span></div><div className="phase-disclaimer">No sample business figures are presented. Dashboard metrics will be connected to transactional records in a later phase.</div></article>
      <article className="content-card quick-links"><span className="eyebrow">ADMINISTRATION</span><h2>Manage access</h2><p>Review company membership, roles, and security history.</p><div>{isAdmin && <button onClick={() => onOpen('users')}><Icon name="users" /> Users & access <Icon name="arrow" /></button>}{canReadRoles && <button onClick={() => onOpen('roles')}><Icon name="shield" /> Roles & permissions <Icon name="arrow" /></button>}{isAdmin && <button onClick={() => onOpen('audit')}><Icon name="history" /> Audit history <Icon name="arrow" /></button>}</div></article>
    </section>
  )
}

export default App
