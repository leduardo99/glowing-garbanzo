// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

import { StopForm } from './StopForm'

afterEach(() => {
  cleanup()
})

describe('StopForm', () => {
  it('requires a name and does not call onSubmit when blank', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<StopForm onSubmit={onSubmit} submitLabel="Save" />)

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findAllByRole('alert')).not.toHaveLength(0)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('converts a comma-decimal cost input into integer cents on submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<StopForm onSubmit={onSubmit} submitLabel="Save" />)

    await user.type(screen.getByLabelText(/nome/i), 'Poço Azul')
    await user.type(screen.getByLabelText(/custo estimado/i), '25,50')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Poço Azul', costCents: 2550 }),
    )
  })

  it('converts a dot-decimal cost input into integer cents on submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<StopForm onSubmit={onSubmit} submitLabel="Save" />)

    await user.type(screen.getByLabelText(/nome/i), 'Poço Azul')
    await user.type(screen.getByLabelText(/custo estimado/i), '25.50')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ costCents: 2550 }),
    )
  })

  it('submits a null cost when the cost field is left blank', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<StopForm onSubmit={onSubmit} submitLabel="Save" />)

    await user.type(screen.getByLabelText(/nome/i), 'Poço Azul')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ costCents: null }),
    )
  })

  it('rejects an invalid cost value and does not submit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<StopForm onSubmit={onSubmit} submitLabel="Save" />)

    await user.type(screen.getByLabelText(/nome/i), 'Poço Azul')
    await user.type(screen.getByLabelText(/custo estimado/i), 'not a number')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(
      <StopForm onSubmit={vi.fn()} onCancel={onCancel} submitLabel="Save" />,
    )

    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('pre-fills fields from defaultValues for edit mode', () => {
    render(
      <StopForm
        defaultValues={{
          name: 'Poço Azul',
          category: 'attraction',
          description: 'Bring a swimsuit',
          cost: '25.50',
          placeLabel: 'Chapada Diamantina',
        }}
        onSubmit={vi.fn()}
        submitLabel="Save"
      />,
    )

    expect(screen.getByLabelText(/nome/i)).toHaveValue('Poço Azul')
    expect(screen.getByLabelText(/dica/i)).toHaveValue('Bring a swimsuit')
    expect(screen.getByLabelText(/custo estimado/i)).toHaveValue('25.50')
    expect(screen.getByLabelText(/local/i)).toHaveValue('Chapada Diamantina')
  })
})
