import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const upc = searchParams.get("upc")

  if (!upc) {
    return NextResponse.json({ error: "No UPC provided" }, { status: 400 })
  }

  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${upc}.json`)
    const data = await res.json()

    if (data.status === 1) {
      const product = data.product
      console.log('data', data )
      return NextResponse.json({
        description: product.product_name,
        calories: product.nutriments["energy-kcal"],
        protein: product.nutriments["proteins"],
        fat: product.nutriments["fat"],
        carbs: product.nutriments["carbohydrates"]
      })
    } else {
      return NextResponse.json({ error: "Product not found" }, { status: 404 })
    }
  } catch {
    return NextResponse.json({ error: "Failed to fetch UPC data" }, { status: 500 })
  }
}
