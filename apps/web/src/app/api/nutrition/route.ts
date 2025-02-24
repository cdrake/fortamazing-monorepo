import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get("query")

  if (!query) {
    return NextResponse.json({ error: "No query provided" }, { status: 400 })
  }

  const apiKey = process.env.USDA_API_KEY
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&api_key=${apiKey}`

  try {
    const res = await fetch(url)
    const data = await res.json()
    return NextResponse.json(data.foods || [])
  } catch {
    return NextResponse.json({ error: "Failed to fetch nutrition data" }, { status: 500 })
  }
}
