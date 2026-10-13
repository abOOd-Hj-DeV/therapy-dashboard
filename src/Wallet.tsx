import { useState, type FormEvent } from 'react'
import { Workspace } from './Workspace'
import { Modal } from './ui'
import { asset } from './assets'
import { remainingAssets } from './remaining-assets'
import { RemainingIcon } from './RemainingUI'
import { ApiClient } from './api'
import { ApiWalletAndWithdrawalsLive } from './api-wallet-and-withdrawals-live'

type Tab = 'overview' | 'earnings' | 'withdrawals'
type Method = '' | 'shamcash' | 'haram'
const monthly = [
  { month: 'May', short: 'May', value: 8400, height: 204, phoneHeight: 98 },
  { month: 'April', short: 'Apr', value: 9200, height: 221, phoneHeight: 110 },
  { month: 'March', short: 'Mar', value: 8500, height: 215, phoneHeight: 100 },
  { month: 'February', short: 'Feb', value: 7800, height: 191, phoneHeight: 90 },
  { month: 'January', short: 'Jan', value: 6200, height: 165, phoneHeight: 70 },
]
const earnings = [
  { name: 'Sarah Ali', date: '2024-05-20', amount: 300, status: 'Completed' },
  { name: 'Ahmed Mohammed', date: '2024-05-20', amount: 200, status: 'Completed' },
  { name: 'Sarah Khalid', date: '2024-05-17', amount: 100, status: 'Processing' },
  { name: 'Omar Youssef', date: '2024-05-16', amount: 400, status: 'Completed' },
]
const metrics = [
  { icon: 'withdrawn', title: 'Withdrawn', mobile: 'Withdrawn', value: '$30.0k' },
  { icon: 'available', title: 'Available Now', mobile: 'Available', value: '$12.5k' },
  { icon: 'pending', title: 'Pending', mobile: 'Pending', value: '$3.2k' },
  { icon: 'rate', title: 'Session Rate', mobile: 'Rate', value: '1000 SP' },
  {
    icon: 'sessions',
    title: 'Sessions',
    mobile: 'Sessions',
    value: '42 Sessions',
    phoneValue: '42 Sess.',
  },
  { icon: 'transactions', title: 'Transactions', mobile: 'Transactions', value: '8 Trans' },
] as const

export function Wallet({ navigate, api }: { navigate: (path: string) => void; api?: ApiClient }) {
  return api ? (
    <ApiWalletAndWithdrawalsLive api={api} navigate={navigate} />
  ) : (
    <DemoWallet navigate={navigate} />
  )
}

function DemoWallet({ navigate }: { navigate: (path: string) => void }) {
  const state = new URLSearchParams(window.location.search).get('state')
  const [tab, setTab] = useState<Tab>(
    state === 'earnings'
      ? 'earnings'
      : state === 'withdrawals'
        ? 'withdrawals'
        : ['withdraw', 'shamcash', 'haram'].includes(state ?? '')
          ? 'earnings'
          : 'overview',
  )
  const [requestOpen, setRequestOpen] = useState(
    ['withdraw', 'shamcash', 'haram'].includes(state ?? ''),
  )
  const [notice, setNotice] = useState('')
  return (
    <Workspace title="Dashboard" mobileTitle="Wallet" active="Wallet" navigate={navigate}>
      <div className={`wallet-layout wallet-${tab}`}>
        <p className="wallet-phone-heading">Therapist Overview</p>
        <div className="wallet-metrics">
          <article className="wallet-total textured">
            <div>
              <header>
                <span>Overview</span>
                <h2>Total in all time</h2>
              </header>
              <div className="wallet-total-numbers">
                <div>
                  <span>Total in all time</span>
                  <strong>$41.5k</strong>
                </div>
                <div>
                  <span>Monthly earnings</span>
                  <strong>8,400 SP</strong>
                </div>
                <div>
                  <span>Net available</span>
                  <strong>$9.3k</strong>
                </div>
              </div>
            </div>
          </article>
          <article className="wallet-phone-total">
            <button onClick={() => setTab('withdrawals')} aria-label="View withdrawals">
              <span>Net Available Balance</span>
              <strong className="remaining-badge">$9.3k</strong>
            </button>
            <p>
              <span>Total in all time</span>
              <span>$41.5k</span>
            </p>
            <button onClick={() => setTab('earnings')} aria-label="View earnings">
              <span>Monthly earnings</span>
              <span>8,400 SP</span>
            </button>
          </article>
          <div className="wallet-stat-grid">
            {metrics.map((metric) => (
              <article key={metric.icon}>
                <p>
                  <RemainingIcon name={metric.icon} />
                  <span className="desktop-metric-label">{metric.title}</span>
                  <span className="phone-metric-label">{metric.mobile}</span>
                </p>
                <strong className={'phoneValue' in metric ? 'desktop-metric-value' : undefined}>
                  {metric.value}
                </strong>
                {'phoneValue' in metric && (
                  <strong className="phone-metric-value">{metric.phoneValue}</strong>
                )}
              </article>
            ))}
          </div>
        </div>
        <section className="wallet-panel" aria-label="Wallet details">
          <nav className="wallet-tabs" aria-label="Wallet sections">
            {(['overview', 'earnings', 'withdrawals'] as const).map((value) => (
              <button
                key={value}
                className={tab === value ? 'selected' : ''}
                aria-current={tab === value ? 'page' : undefined}
                onClick={() => setTab(value)}
              >
                <RemainingIcon name={`${value}${tab === value ? 'Active' : 'Idle'}`} />
                {value[0].toUpperCase() + value.slice(1)}
              </button>
            ))}
            {tab === 'withdrawals' && (
              <button
                className="remaining-primary wallet-withdraw-button"
                onClick={() => setRequestOpen(true)}
              >
                Withdraw
              </button>
            )}
          </nav>
          {tab === 'overview' ? (
            <div className="wallet-chart">
              <header>
                <button onClick={() => setTab('earnings')}>Monthly Earnings</button>
                <span className="wallet-growth">
                  ↑ <span className="desktop-growth">35% since January</span>
                  <span className="phone-growth">35%</span>
                </span>
              </header>
              <div
                className="wallet-bars"
                role="img"
                aria-label="Monthly earnings: January 6,200; February 7,800; March 8,500; April 9,200; May 8,400"
              >
                <div className="desktop-wallet-bars">
                  {monthly.map((item) => (
                    <div className="wallet-bar-column" key={item.month}>
                      <strong>{item.value.toLocaleString('en-US')}</strong>
                      <div className="wallet-bar textured" style={{ height: item.height }} />
                      <small>{item.month}</small>
                    </div>
                  ))}
                </div>
                <div className="phone-wallet-bars">
                  {[...monthly].reverse().map((item) => (
                    <div className="wallet-bar-column" key={item.month}>
                      <strong>{(item.value / 1000).toFixed(1)}k</strong>
                      <div className="wallet-bar textured" style={{ height: item.phoneHeight }} />
                      <small>{item.short}</small>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="wallet-transactions">
              <div className="wallet-mobile-list-heading">
                <button onClick={() => setTab('overview')}>← Overview</button>
                <h2>{tab === 'earnings' ? 'Earnings' : 'Withdrawals'}</h2>
                {tab === 'withdrawals' && (
                  <button className="remaining-primary" onClick={() => setRequestOpen(true)}>
                    Withdraw
                  </button>
                )}
              </div>
              {earnings.map((item, index) => (
                <article key={item.name}>
                  {tab === 'earnings' ? (
                    <>
                      <img
                        className="wallet-transaction-avatar"
                        src={asset(remainingAssets.walletAvatar)}
                        alt=""
                      />
                      <div className="wallet-transaction-copy">
                        <strong>{item.name}</strong>
                        <small>Private Session · {item.date}</small>
                      </div>
                      <div className="wallet-transaction-status">
                        <strong className="wallet-income">+{item.amount} SP</strong>
                        <span className={item.status === 'Completed' ? 'completed' : 'processing'}>
                          {item.status}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="wallet-withdrawal-icon">
                        <RemainingIcon name="withdrawalsActive" />
                      </span>
                      <div className="wallet-transaction-copy">
                        <strong>Withdraw</strong>
                        <small>SA** **** **** 1234 · 2024-05-01</small>
                      </div>
                      <div className="wallet-transaction-status">
                        <strong>-7,500 ريال</strong>
                        <span className={index === 2 ? 'processing' : 'completed'}>
                          {index === 2 ? 'Processing' : 'Completed'}
                        </span>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
          <div className="wallet-advisory">
            <RemainingIcon name="withdrawalInfo" />
            <p className="desktop-wallet-advisory">
              Withdrawals are processed within 3-5 business days, minimum withdrawal is 500 Riyals —
              same terms as above the withdraw button.
            </p>
            <p className="phone-wallet-advisory">
              Withdrawals are processed in 3-5 business days. Min 500 Riyals.
            </p>
          </div>
        </section>
        {notice && (
          <p className="remaining-notice" role="status">
            {notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice('')}>
              ×
            </button>
          </p>
        )}
        {requestOpen && (
          <Modal
            title="Withdrawal Request"
            className="remaining-modal withdrawal-modal"
            closeIcon={<RemainingIcon name="close" />}
            onClose={() => setRequestOpen(false)}
          >
            <WithdrawalForm
              initial={state === 'shamcash' || state === 'haram' ? state : ''}
              onPreview={(amount, method) => {
                setRequestOpen(false)
                setNotice(
                  `Demo preview only: ${amount.toLocaleString('en-US')} SP via ${method === 'shamcash' ? 'Shamcash' : 'Al-Haram'}. No withdrawal request was sent and no money was moved.`,
                )
              }}
            />
          </Modal>
        )}
      </div>
    </Workspace>
  )
}

function WithdrawalForm({
  initial,
  onPreview,
}: {
  initial: Method
  onPreview: (amount: number, method: Exclude<Method, ''>) => void
}) {
  const [method, setMethod] = useState<Method>(initial)
  const [error, setError] = useState('')
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget),
      amount = Number(data.get('amount'))
    if (!method || !Number.isFinite(amount) || amount < 500 || amount > 12500) {
      setError('Select a payment method and enter an amount between 500 and 12,500 SP.')
      return
    }
    const fields = method === 'shamcash' ? ['code'] : ['name', 'phone', 'location']
    if (fields.some((name) => !String(data.get(name) ?? '').trim())) {
      setError('Complete the payment details.')
      return
    }
    onPreview(amount, method)
  }
  return (
    <form className="withdrawal-form" onSubmit={submit}>
      <p className="withdrawal-balance">Available Balance: 12,500 SP</p>
      <label className="withdrawal-method">
        {method && (
          <span className={`payment-logo ${method}`}>
            <img src={asset(remainingAssets[method])} alt="" />
          </span>
        )}
        <select
          aria-label="Select payment method"
          required
          value={method}
          onChange={(event) => {
            setMethod(event.target.value as Method)
            setError('')
          }}
        >
          <option value="">Select payment method</option>
          <option value="haram">Al-Haram transfer</option>
          <option value="shamcash">Shamcash Transfer</option>
        </select>
      </label>
      {method === 'haram' && (
        <div className="withdrawal-inputs" key="haram">
          <input name="name" aria-label="Full name" placeholder="Enter Your Full Name" required />
          <input
            type="tel"
            name="phone"
            aria-label="Phone number"
            placeholder="Enter Phone Number"
            required
          />
          <input name="location" aria-label="Location" placeholder="Enter Your Location" required />
        </div>
      )}
      <input
        name="amount"
        type="number"
        aria-label="Withdrawal amount"
        placeholder="Enter the ammount"
        min="500"
        max="12500"
        step="0.01"
        required
      />
      {method === 'shamcash' && (
        <input
          key="code"
          name="code"
          aria-label="Shamcash Code"
          placeholder="Enter Shamcash Code"
          required
        />
      )}
      {error && (
        <p className="remaining-error" role="alert">
          {error}
        </p>
      )}
      <button className="remaining-primary" type="submit">
        Next
      </button>
    </form>
  )
}
