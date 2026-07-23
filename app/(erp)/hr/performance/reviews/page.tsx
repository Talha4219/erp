import { apiServer } from '@/lib/api-server'
import { PageClient } from './_client'

type Review = { id: string; reviewDate: string; reviewType: string; summary: string | null; strengths: string | null; improvements: string | null; actionItems: string | null; nextReviewDate: string | null; employee: { id: string; firstName: string; lastName: string; employeeCode: string; department: { name: string } | null }; reviewer: { id: string; firstName: string; lastName: string } | null }

export default async function ReviewsPage() {
  const initialData = await apiServer<Review[]>('/api/hr/performance/reviews')
  return <PageClient initialData={initialData} />
}
