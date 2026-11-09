import { describe, expect, it } from 'vitest'
import {
  cleanLabel,
  hasLabel,
  labelLimit,
  labelsInUse,
  normalizeLabels,
  readLabels,
} from './labels'

describe('labels', () => {
  it('cleans what was typed', () => {
    expect(cleanLabel('  #home   repairs ')).toBe('home repairs')
    expect(cleanLabel('#')).toBe('')
    expect(cleanLabel('x'.repeat(40))).toHaveLength(30)
  })

  it('reads stored labels leniently', () => {
    expect(readLabels('["Home","Work"]')).toEqual(['Home', 'Work'])
    expect(readLabels(null)).toEqual([])
    expect(readLabels('not json')).toEqual([])
    expect(readLabels('{"a":1}')).toEqual([])
    expect(readLabels('["Home",3]')).toEqual(['Home'])
  })

  it('drops duplicates ignoring case and accents, keeping the first spelling', () => {
    expect(normalizeLabels(['Kávé', 'kave', ' ', 'Work', '#work'])).toEqual([
      'Kávé',
      'Work',
    ])
    const many = Array.from({ length: 15 }, (_, index) => `l${index}`)
    expect(normalizeLabels(many)).toHaveLength(labelLimit)
  })

  it('matches a label ignoring case and accents', () => {
    expect(hasLabel('["Kávé"]', 'KAVE')).toBe(true)
    expect(hasLabel('["Kávé"]', 'tea')).toBe(false)
    expect(hasLabel(null, 'tea')).toBe(false)
  })

  it('lists labels in use, most used first', () => {
    expect(
      labelsInUse(['["Work","Home"]', '["home"]', null, '["Garden"]']),
    ).toEqual(['Home', 'Garden', 'Work'])
  })
})
