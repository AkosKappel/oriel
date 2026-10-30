import { describe, expect, it } from 'vitest'
import { isProductCode, productName } from './products'

describe('productName', () => {
  it('adds the first brand unless the name already says it', () => {
    expect(
      productName({
        product: { product_name: ' Oat drink ', brands: 'Oatly, Foo' },
      }),
    ).toBe('Oat drink (Oatly)')
    expect(
      productName({ product: { product_name: 'Nutella', brands: 'nutella' } }),
    ).toBe('Nutella')
    expect(productName({ product: { product_name: 'Milk' } })).toBe('Milk')
  })

  it('gives null for an unknown product or an odd response', () => {
    expect(productName({ status: 0 })).toBeNull()
    expect(productName({ product: { product_name: '  ' } })).toBeNull()
    expect(productName(null)).toBeNull()
  })
})

describe('isProductCode', () => {
  it('accepts 8 to 14 digits only', () => {
    expect(isProductCode('5901234123457')).toBe(true)
    expect(isProductCode('1234567')).toBe(false)
    expect(isProductCode('https://example.com')).toBe(false)
  })
})
