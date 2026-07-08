import { apiRequest } from "@/lib/apiClient"
import { buildSalonApiPath, resolveShopSlug } from "@/lib/shopSlug"

export interface UserTrainer {
  id: string
  name: string
  specialty: string
  rating: number
  photoUrl: string
  availableDates: string[]
}

interface PublicTrainerResponse {
  trainer_id: string
  name: string
  description: string | null
  image_url: string | null
}

export async function fetchUserTrainers(shopSlug?: string): Promise<UserTrainer[]> {
  const resolvedShopSlug = resolveShopSlug(shopSlug)
  if (!resolvedShopSlug) return []
  const trainers = await apiRequest<PublicTrainerResponse[]>(
    buildSalonApiPath(resolvedShopSlug, "/trainers"),
  )
  return trainers.map((trainer) => ({
    id: trainer.trainer_id,
    name: trainer.name,
    specialty: trainer.description ?? "",
    rating: 0,
    photoUrl: trainer.image_url ?? "",
    availableDates: [],
  }))
}

