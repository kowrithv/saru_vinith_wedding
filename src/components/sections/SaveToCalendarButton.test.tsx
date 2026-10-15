import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SaveToCalendarButton from './SaveToCalendarButton'
import { downloadEventIcs } from '@/lib/calendar'

vi.mock('@/lib/calendar', () => ({ downloadEventIcs: vi.fn() }))

describe('SaveToCalendarButton', () => {
  it('hands the date over as a calendar file', async () => {
    render(<SaveToCalendarButton />)
    await userEvent.click(screen.getByRole('button', { name: /in kalender speichern/i }))
    expect(downloadEventIcs).toHaveBeenCalledTimes(1)
  })
})
