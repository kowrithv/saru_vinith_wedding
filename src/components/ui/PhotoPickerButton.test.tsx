import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotoPickerButton from './PhotoPickerButton'

function photo(name = 'urlaub.jpg') {
  return new File(['x'], name, { type: 'image/jpeg' })
}

describe('PhotoPickerButton', () => {
  it('is a real file field that is reached through the big label', async () => {
    const onChange = vi.fn()
    render(<PhotoPickerButton id="p" label="Foto auswählen" onChange={onChange} />)

    const input = screen.getByLabelText('Foto auswählen')
    expect(input).toHaveAttribute('type', 'file')
    expect(input).toHaveAttribute('accept', 'image/*')
    await userEvent.upload(input, photo())
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('keeps the field keyboard focusable: it is hidden visually, not removed', () => {
    render(<PhotoPickerButton id="p" label="Foto auswählen" onChange={() => {}} />)
    const input = screen.getByLabelText('Foto auswählen')

    expect(input).toHaveClass('sr-only')
    expect(input).not.toHaveAttribute('hidden')
    expect(input).not.toHaveAttribute('tabindex', '-1')
  })

  it('shows the label as the large tap target, with a hint', () => {
    render(<PhotoPickerButton id="p" label="Fotos auswählen" hint="mehrere möglich" onChange={() => {}} />)

    const label = screen.getByText('Fotos auswählen').closest('label')
    expect(label).toHaveAttribute('for', 'p')
    expect(label).toHaveClass('border-dashed', 'cursor-pointer')
    expect(screen.getByText('mehrere möglich')).toBeInTheDocument()
  })

  it('allows several files only when asked to', () => {
    const { rerender } = render(<PhotoPickerButton id="p" label="Foto" onChange={() => {}} />)
    expect(screen.getByLabelText('Foto')).not.toHaveAttribute('multiple')

    rerender(<PhotoPickerButton id="p" label="Foto" multiple onChange={() => {}} />)
    expect(screen.getByLabelText('Foto')).toHaveAttribute('multiple')
  })

  it('cannot be used while disabled', async () => {
    const onChange = vi.fn()
    render(<PhotoPickerButton id="p" label="Foto" disabled onChange={onChange} />)

    const input = screen.getByLabelText('Foto')
    expect(input).toBeDisabled()
    await userEvent.upload(input, photo())
    expect(onChange).not.toHaveBeenCalled()
  })
})
