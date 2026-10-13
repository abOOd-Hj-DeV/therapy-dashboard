import { useState } from 'react'
import { ApiClient, apiId } from './api'
import { useApiResource, useApiUser } from './api-hooks'
import { Workspace } from './Workspace'

type Client = {
  id: string
  full_name: string
  status: 'active' | 'past'
  completed_sessions_count: number
  next_session_date: string | null
}
export function Clients({ api, navigate }: { api: ApiClient; navigate: (path: string) => void }) {
  const user = useApiUser(api)
  return user ? (
    <ClientList key={api.getSessionKey()} api={api} navigate={navigate} />
  ) : (
    <p role="alert">Your session has ended. Please sign in again.</p>
  )
}

function ClientList({ api, navigate }: { api: ApiClient; navigate: (path: string) => void }) {
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const resource = useApiResource<{
    data: Client[]
    pagination: { current_page: number; last_page: number; total: number }
  }>(api, `/therapists/clients?search=${encodeURIComponent(search)}&page=${page}`)
  return (
    <Workspace api={api} title="Clients" active="Clients" navigate={navigate}>
      <section className="sessions-panel api-clients">
        <form
          className="part2-form"
          onSubmit={(event) => {
            event.preventDefault()
            setPage(1)
            setSearch(query.trim())
          }}
        >
          <label>
            Search clients
            <input
              value={query}
              maxLength={100}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="remaining-primary">Search</button>
        </form>
        {resource.loading && <p role="status">Loading clients…</p>}
        {resource.error && (
          <p role="alert">
            {resource.error.message}
            <button onClick={resource.reload}>Retry</button>
          </p>
        )}
        {resource.data && (
          <>
            <p>{resource.data.pagination.total} clients</p>
            {resource.data.data.length === 0 && <p>No clients found.</p>}
            <div className="api-table-scroll">
              <table className="sessions-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Relationship</th>
                    <th>Completed sessions</th>
                    <th>Next session</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {resource.data.data.map((client) => (
                    <tr key={client.id}>
                      <td>{client.full_name}</td>
                      <td>{client.status}</td>
                      <td>{client.completed_sessions_count}</td>
                      <td>{client.next_session_date || 'None scheduled'}</td>
                      <td>
                        <button
                          onClick={() => navigate(`/sessions/upcoming?client=${apiId(client.id)}`)}
                        >
                          Clinical record
                        </button>
                        {client.status === 'active' && (
                          <button onClick={() => navigate(`/chats?client=${apiId(client.id)}`)}>
                            Message
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="Client pages">
              <button disabled={page <= 1 || resource.loading} onClick={() => setPage(page - 1)}>
                Previous
              </button>
              <span>
                Page {page} of {resource.data.pagination.last_page}
              </span>
              <button
                disabled={page >= resource.data.pagination.last_page || resource.loading}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </nav>
          </>
        )}
      </section>
    </Workspace>
  )
}
