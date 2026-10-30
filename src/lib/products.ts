// Product names for scanned barcodes come from Open Food Facts, an open database with no key.
// Only the barcode number is sent.
export const openFoodFactsOrigin = 'https://world.openfoodfacts.org'

/** EAN-8, UPC-A, EAN-13 and GTIN-14 are 8 to 14 digits. */
export const isProductCode = (code: string) => /^\d{8,14}$/.test(code)

/** The product's name from an Open Food Facts response, with its brand when the name lacks it. */
export function productName(response: unknown): string | null {
  const product = (response as { product?: Record<string, unknown> })?.product
  const name =
    typeof product?.product_name === 'string' ? product.product_name.trim() : ''
  if (!name) return null
  const brand =
    typeof product?.brands === 'string'
      ? product.brands.split(',')[0].trim()
      : ''
  const named =
    brand && !name.toLowerCase().includes(brand.toLowerCase())
      ? `${name} (${brand})`
      : name
  return named.slice(0, 500)
}

/** The name of the product with this barcode, or null when it is unknown or the lookup fails. */
export async function lookupProduct(code: string): Promise<string | null> {
  if (!isProductCode(code)) return null
  try {
    const response = await fetch(
      `${openFoodFactsOrigin}/api/v2/product/${code}.json?fields=product_name,brands`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!response.ok) return null
    return productName(await response.json())
  } catch {
    return null
  }
}
