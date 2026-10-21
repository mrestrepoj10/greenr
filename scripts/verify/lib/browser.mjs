import { execFileSync } from 'node:child_process'

/** agent-browser driver shared by the verify scripts. Every call names the session. */
export function createBrowser({ session, bypass }) {
  const fetchHeaders = bypass ? { 'x-vercel-protection-bypass': bypass } : {}
  const browserHeaders = bypass ? { ...fetchHeaders, 'x-vercel-set-bypass-cookie': 'true' } : {}

  function ab(args, input, timeout = 240_000) {
    return execFileSync('agent-browser', [...args, '--session', session], {
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'inherit'],
      timeout,
      maxBuffer: 64 * 1024 * 1024,
    }).trim()
  }

  // agent-browser prints JSON for objects and quoted strings, but a bare word for some plain strings.
  const parse = (text) => {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  const evalJson = (script) => {
    const out = parse(ab(['eval', '--stdin'], script))
    return typeof out === 'string' ? parse(out) : out
  }

  return {
    fetchHeaders,
    ab,
    evalJson,
    open: (url, extra = []) => ab([...(bypass ? ['open', url, '--headers', JSON.stringify(browserHeaders)] : ['open', url]), ...extra]),
    waitFn: (fn, timeoutMs = 60_000) => ab(['wait', '--fn', fn, '--timeout', String(timeoutMs)], undefined, timeoutMs + 30_000),
    click: (selector) => ab(['click', selector]),
    screenshot: (path) => ab(['screenshot', path]),
    close: () => {
      try {
        ab(['close'])
      } catch {}
    },
  }
}

export function createChecks() {
  const failures = []
  const check = (ok, label, detail) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail === undefined ? '' : ` (${JSON.stringify(detail)})`}`)
    if (!ok) failures.push(label)
    return ok
  }
  return { check, failures }
}
