import NutritionLookup from './components/NutritionLookup'
import DietLog from './components/DietLog'
import DietPosts from './components/DietPosts'

export default function DietPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Diet</h1>

      {/* ✅ Nutrition Lookup */}
      <NutritionLookup />

      {/* 📝 User Diet Log */}
      <DietLog />

      {/* 📚 Diet-Related Posts */}
      <DietPosts />
    </div>
  )
}
