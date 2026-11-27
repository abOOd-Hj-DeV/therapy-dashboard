import { ApiError } from './api'

export const therapistProfilePath = '/therapists/me/profile'
export const therapistSubmissionPath = '/therapists/me/profile-submission'

export const profileLabels = {
  full_name: 'الاسم',
  job_title: 'المسمى الوظيفي',
  specialty: 'التخصص',
  bio: 'النبذة التعريفية',
  email: 'البريد الإلكتروني',
  city: 'المدينة',
  country: 'البلد',
  languages: 'اللغات',
  years_of_experience: 'سنوات الخبرة',
}

export type ProfileField = keyof typeof profileLabels
type SubmittedProfile = Record<Exclude<ProfileField, 'languages' | 'years_of_experience'>, string> & {
  languages: string[]
  years_of_experience: number
}
export type ReviewedProfile = { [K in keyof SubmittedProfile]: SubmittedProfile[K] | null }
type Kind = 'initial' | 'update'
export type ProfileRevision = {
  id: string
  kind: Kind
  status: 'pending' | 'approved' | 'rejected' | 'superseded'
  submitted_at: string
  data: ReviewedProfile
}
export type TherapistProfileReview = {
  approval_status: null | 'pending' | 'approved' | 'rejected'
  application_ref: string | null
  account: { whatsapp_number: string; email: string | null }
  published: ReviewedProfile
  pending_revision: ProfileRevision | null
  last_review: {
    revision_id: string
    kind: Kind
    status: 'approved' | 'rejected'
    note: string | null
    reviewed_at: string
  } | null
}
export type TherapistProfileResponse = { data: TherapistProfileReview }

export function profileReviewError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422 && error.code === 'no_changes')
      return 'لا توجد تعديلات على الملف المنشور لإرسالها للمراجعة.'
    if (error.status === 422) return 'يرجى مراجعة الحقول المشار إليها والمحاولة مرة أخرى.'
    if (error.status === 429) return 'تم إرسال طلبات كثيرة. انتظر قليلًا قبل المحاولة مرة أخرى.'
    if (error.status === 0 || error.status === 408)
      return 'تعذّر الاتصال بالخادم. تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.'
  }
  return 'تعذّر إكمال الطلب. حاول مرة أخرى.'
}
