import { describe, expect, it } from 'vitest'
import { keepDraftFields } from '@/lib/dispenses/draft-merge'

describe('keepDraftFields', () => {
  it('keeps a field typed after the request snapshot', () => {
    const sent = { nameFa: 'علی', nationalId: '' }
    const local = { nameFa: 'علی', nationalId: '0012345678' }
    const server = { nameFa: 'علی', nationalId: '' }

    expect(keepDraftFields(server, sent, local)).toEqual({
      nameFa: 'علی',
      nationalId: '0012345678',
    })
  })

  it('takes the server value when the field still matches the snapshot', () => {
    const sent = { technicalFee: '۱۰۰', insuranceCover: '0' }
    const local = { technicalFee: '۱۰۰', insuranceCover: '0' }
    const server = { technicalFee: '100', insuranceCover: '0' }

    expect(keepDraftFields(server, sent, local)).toEqual({
      technicalFee: '100',
      insuranceCover: '0',
    })
  })

  it('merges controlled fields independently', () => {
    const sent = {
      physicianName: 'دکتر',
      recipientNationalId: '',
      technicalAck: false,
    }
    const local = {
      physicianName: 'دکتر',
      recipientNationalId: '123',
      technicalAck: true,
    }
    const server = {
      physicianName: 'دکتر',
      recipientNationalId: '',
      technicalAck: false,
    }

    expect(keepDraftFields(server, sent, local)).toEqual({
      physicianName: 'دکتر',
      recipientNationalId: '123',
      technicalAck: true,
    })
  })
})
