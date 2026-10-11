import { describe, expect, it } from 'vitest'
import { POST } from './route'

describe('POST /api/admin/logout', () => {
  it('clears the admin cookie', async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    const cookie = response.headers.get('set-cookie')
    expect(cookie).toContain('admin_session=')
    expect(cookie).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/)
  })
})
